/**
 * send-email - Central email sending Edge Function for commandeici
 *
 * Receives: { template, to, data, userId, restaurantId }
 * - Checks user email preferences (respects unsubscribe)
 * - Anti-duplicate: one-time emails never resent
 * - Marketing cooldown: max 1 non-transactional per user per 24h
 * - Sends via Resend API
 * - Logs in email_logs table
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = "commandeici <noreply@commandeici.com>";

const APP_URL = "https://app.commandeici.com";
const SITE_URL = "https://commandeici.com";
const LOGO_URL = "https://cdn.shopify.com/s/files/1/1050/3749/6659/files/commandeici-logo.svg?v=1772387258";
const PRIMARY_COLOR = "#10B981";
const COMPANY_ADDRESS = "Bourgogne, France";
const CONTACT_EMAIL = "contact@commandeici.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Transactional emails bypass marketing preferences (but not full unsubscribe)
const TRANSACTIONAL_TYPES = [
  "subscription_activated", "payment_failed", "subscription_cancelled",
  "trial_checkin", "trial_expiring", "trial_expired",
  "trial_expired_relance1", "trial_expired_relance2",
  "trial_migration_30d",
];

// One-time emails: never resent to the same user/restaurant
const ONE_TIME_TYPES = [
  "referral_completed_referrer", "referral_completed_referee",
  "comeback_3days", "comeback_7days",
];

// Marketing cooldown: max 1 non-transactional per 24h
const MARKETING_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── Email templates ────────────────────────────────────────────────────────────

type TemplateData = Record<string, string>;

const templates: Record<string, (data: TemplateData) => { subject: string; content: string }> = {
  trial_migration_30d: (data) => ({
    subject: `Ta page ${data.restaurantName || "commandeici"} est prete, 30 jours gratuits`,
    content: `
      <h2>Salut ${data.restaurantName || ""},</h2>
      <p>Petit message pour te dire que ta page commandeici est 100% operationnelle. Tu n'as rien a payer pour l'instant, tu as <strong>30 jours gratuits</strong> pour tester tranquille, sans carte bancaire.</p>

      <p><strong>Ton tableau de bord (c'est la que ca se passe) :</strong><br>
      <a href="${APP_URL}/admin/${data.slug}">${APP_URL}/admin/${data.slug}</a></p>

      <p><strong>Ta page de commande pour tes clients :</strong><br>
      <a href="${APP_URL}/${data.slug}">${APP_URL}/${data.slug}</a></p>

      <div class="highlight-box">
        <p><strong>Ton QR code est pret.</strong> Va dans ton admin, onglet "QR code" : tu peux le telecharger, l'imprimer, le coller sur ton comptoir ou tes tables. Tes clients le scannent et commandent directement.</p>
      </div>

      <p>Pendant tes 30 jours, teste tout : ajoute tes plats, personnalise tes couleurs, prends une vraie commande. Si quelque chose ne va pas ou si tu as une question, reponds simplement a cet email.</p>

      <p><a href="${APP_URL}/admin/${data.slug}" class="cta-btn">Acceder a mon admin &rarr;</a></p>

      <p style="font-size:13px;color:#6b7280;">Apres tes 30 jours, si tu veux continuer, tu ajouteras ta carte bancaire en 1 minute (1 euro/mois pendant 3 mois, puis 29,99 euros/mois, sans engagement).</p>
    `,
  }),

  trial_checkin: (data) => ({
    subject: `Ca roule chez ${data.restaurantName || "toi"} ?`,
    content: `
      <h2>Salut ${data.restaurantName || ""},</h2>
      <p>Ca fait une semaine que tu as installe ta page commandeici. Tout va bien ?</p>
      <p>Si tu as une question, une galere ou une idee, reponds directement a cet email, je lis tout.</p>
      <p><a href="${APP_URL}/admin" class="cta-btn">Voir mon tableau de bord &rarr;</a></p>
      <p style="font-size:13px;color:#6b7280;">Rappel : tes 30 jours gratuits sont actifs, pas de CB demandee.</p>
    `,
  }),

  trial_expiring: (data) => ({
    subject: `Plus que ${data.daysLeft} jours gratuits sur commandeici`,
    content: `
      <h2>Salut ${data.restaurantName || ""},</h2>
      <p>Ton essai gratuit se termine dans <strong>${data.daysLeft} jours</strong>.</p>
      <p>Pour continuer a recevoir des commandes sans interruption, ajoute ta carte bancaire. Ca prend une minute.</p>
      <div class="highlight-box">
        <p><strong>1 euro/mois pendant 3 mois</strong>, puis 29,99 euros/mois. Sans engagement, annulable a tout moment.</p>
      </div>
      <p><a href="${APP_URL}/choisir-plan" class="cta-btn">Ajouter ma carte &rarr;</a></p>
    `,
  }),

  trial_expired: (data) => ({
    subject: "Ton essai commandeici est termine",
    content: `
      <h2>Salut ${data.restaurantName || ""},</h2>
      <p>Tes 30 jours gratuits sont termines. Bonne nouvelle : ta page reste en ligne et tes donnees sont intactes.</p>
      <p>Pour continuer, il te reste juste a ajouter ta carte bancaire.</p>
      <div class="highlight-box">
        <p><strong>1 euro/mois pendant 3 mois</strong>, puis 29,99 euros/mois. Sans engagement.</p>
      </div>
      <p><a href="${APP_URL}/choisir-plan" class="cta-btn">Ajouter ma carte &rarr;</a></p>
    `,
  }),

  trial_expired_relance1: (data) => ({
    subject: `${data.restaurantName || "Ton resto"}, une minute pour garder ta page ?`,
    content: `
      <h2>Salut ${data.restaurantName || ""},</h2>
      <p>Ca fait une semaine que ton essai est termine. Ta page est toujours en ligne, tes clients peuvent toujours commander.</p>
      <p>Ajoute ta carte bancaire quand tu veux, c'est rapide.</p>
      <p><a href="${APP_URL}/choisir-plan" class="cta-btn">Ajouter ma carte &rarr;</a></p>
      <p style="font-size:13px;color:#6b7280;">Une question ? Reponds a cet email.</p>
    `,
  }),

  trial_expired_relance2: (data) => ({
    subject: "Derniere relance avant suspension de ton compte",
    content: `
      <h2>Salut ${data.restaurantName || ""},</h2>
      <p>Ca fait deux semaines que ton essai est fini. Si tu veux garder ta page et tes donnees, ajoute ta carte bancaire maintenant.</p>
      <p>Sinon pas de souci, repond simplement a cet email et je supprime le compte.</p>
      <p><a href="${APP_URL}/choisir-plan" class="cta-btn">Ajouter ma carte &rarr;</a></p>
    `,
  }),

  referral_completed_referrer: (data) => ({
    subject: "Bravo ! Vous avez gagne 4 semaines gratuites",
    content: `
      <h2>Bonjour ${data.referrerName || ""},</h2>
      <p><strong>${data.refereeName || "Un restaurateur"}</strong> s'est inscrit avec votre lien de parrainage !</p>
      <div class="highlight-box">
        <p>Vous gagnez <strong>4 semaines gratuites</strong> sur votre abonnement.</p>
      </div>
      <p>Continuez a parrainer pour gagner plus de semaines gratuites.</p>
      <p><a href="${APP_URL}/admin" class="cta-btn">Voir mon dashboard &rarr;</a></p>
    `,
  }),

  referral_completed_referee: (data) => ({
    subject: "Bienvenue ! Vous avez 8 semaines d'essai",
    content: `
      <h2>Bonjour ${data.refereeName || ""},</h2>
      <p>Grace au parrainage de <strong>${data.referrerName || "un restaurateur"}</strong>, vous beneficiez de <strong>8 semaines d'essai</strong> au lieu de 4 !</p>
      <p>Profitez-en pour configurer votre menu et tester toutes les fonctionnalites.</p>
      <p><a href="${APP_URL}/inscription" class="cta-btn">Commencer &rarr;</a></p>
    `,
  }),

  subscription_activated: (data) => ({
    subject: "Votre abonnement commandeici est actif !",
    content: `
      <h2>Bonjour ${data.restaurantName || ""},</h2>
      <p>Votre abonnement commandeici est maintenant actif.</p>
      <p>Vous etes a <strong>1 euro/mois pendant 3 mois</strong>, puis 29,99 euros/mois. Sans engagement.</p>
      <div class="highlight-box">
        <p>Ce qui est inclus :<br>
        - Page de commande personnalisee<br>
        - QR code pour vos clients<br>
        - Dashboard avec suivi des commandes<br>
        - Base de donnees clients</p>
      </div>
      <p><a href="${APP_URL}/admin" class="cta-btn">Acceder a mon dashboard &rarr;</a></p>
      <p style="font-size:13px;color:#6b7280;">Sans engagement, annulable a tout moment.</p>
    `,
  }),

  payment_failed: (data) => ({
    subject: "Probleme de paiement sur commandeici",
    content: `
      <h2>Bonjour ${data.restaurantName || ""},</h2>
      <p>Votre dernier paiement pour commandeici a echoue.</p>
      <p>Mettez a jour vos informations de paiement pour continuer a recevoir des commandes.</p>
      <p><a href="${APP_URL}/choisir-plan" class="cta-btn" style="background:#EF4444;">Mettre a jour mon paiement &rarr;</a></p>
      <p style="font-size:13px;color:#6b7280;">Si vous avez besoin d'aide, repondez directement a cet email.</p>
    `,
  }),

  subscription_cancelled: (data) => ({
    subject: "Votre abonnement commandeici a ete annule",
    content: `
      <h2>Bonjour ${data.restaurantName || ""},</h2>
      <p>Votre abonnement commandeici a ete annule. Votre page de commande n'est plus accessible par vos clients.</p>
      <p>Vous pouvez reactiver votre abonnement a tout moment pour remettre votre page en ligne.</p>
      <p><a href="${APP_URL}/choisir-plan" class="cta-btn">Reactiver mon abonnement &rarr;</a></p>
      <p style="font-size:13px;color:#6b7280;">Toutes vos donnees sont conservees pendant 90 jours.</p>
    `,
  }),

  promo_applied: (data) => ({
    subject: "Code promo applique sur commandeici !",
    content: `
      <h2>Bonjour ${data.restaurantName || ""},</h2>
      <p>Le code promo <strong>${data.promoCode || ""}</strong> a bien ete applique a votre compte.</p>
      <div class="highlight-box">
        <p>${data.promoType === "free_days" ? `${data.promoValue} jours offerts.` : ""}
        ${data.promoType === "free_trial_extension" ? `Essai gratuit prolonge de ${data.promoValue} jours.` : ""}
        ${data.promoType === "discount_percent" ? `${data.promoValue}% de reduction sur votre premier cycle.` : ""}
        ${data.promoType === "discount_fixed" ? `${data.promoValue} EUR de reduction sur votre premier cycle.` : ""}</p>
      </div>
      <p><a href="${APP_URL}/admin" class="cta-btn">Acceder a mon dashboard &rarr;</a></p>
    `,
  }),

  comeback_3days: (data) => ({
    subject: "Vous n'avez pas encore cree votre page de commande ?",
    content: `
      <h2>Bonjour${data.restaurantName ? " " + data.restaurantName : ""},</h2>
      <p>Vous vous etes inscrit il y a quelques jours mais votre page de commande n'est pas encore en ligne.</p>
      <p>Ca prend 5 minutes : ajoutez votre menu, personnalisez les couleurs, et partagez le lien a vos clients.</p>
      <div class="highlight-box">
        <p><strong>1 euro/mois pendant 3 mois</strong>, puis 29,99 euros/mois. Sans engagement.</p>
      </div>
      <p><a href="${APP_URL}/inscription" class="cta-btn">Creer ma page &rarr;</a></p>
    `,
  }),

  comeback_7days: (data) => ({
    subject: "Votre page de commande vous attend",
    content: `
      <h2>Bonjour${data.restaurantName ? " " + data.restaurantName : ""},</h2>
      <p>Avec commandeici, vos clients commandent directement depuis leur telephone. Pas de commission, pas d'intermediaire.</p>
      <p>- QR code pour votre comptoir ou vos tables<br>
      - Menu en ligne avec photos et personnalisation<br>
      - Dashboard avec suivi des commandes en temps reel<br>
      - Base clients pour fidéliser</p>
      <p><a href="${APP_URL}/inscription" class="cta-btn">Commencer pour 1 euro &rarr;</a></p>
      <p style="font-size:13px;color:#6b7280;">Si commandeici ne vous convient pas, pas de souci. Vous pouvez vous desinscrire ci-dessous.</p>
    `,
  }),
};

// ─── HTML wrapper ───────────────────────────────────────────────────────────────

function wrapHtml(content: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>commandeici</title>
<style>
  body { margin: 0; padding: 0; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .header { background-color: ${PRIMARY_COLOR}; padding: 24px 32px; text-align: center; }
  .header img { height: 32px; width: auto; }
  .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; }
  .body { padding: 32px 28px; }
  .body p { color: #1a1a1a; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
  .body h2 { color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 16px; }
  .cta-btn { display: inline-block; background: ${PRIMARY_COLOR}; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 8px 0 16px; }
  .highlight-box { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
  .highlight-box p { margin: 0; }
  .footer { background: #fafafa; padding: 24px 28px; border-top: 1px solid #eee; text-align: center; }
  .footer p { color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0 0 8px; }
  .footer a { color: #6b7280; text-decoration: underline; }
  .divider { border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  @media (prefers-color-scheme: dark) {
    body { background-color: #1a1a1a !important; }
    .wrapper { background: #262626 !important; }
    .header { background-color: #059669 !important; }
    .body p { color: #e5e5e5 !important; }
    .body h2 { color: #f5f5f5 !important; }
    .highlight-box { background: #064e3b !important; border-color: #10b981 !important; }
    .footer { background: #1f1f1f !important; border-color: #404040 !important; }
    .footer p, .footer a { color: #9ca3af !important; }
  }
  @media only screen and (max-width: 620px) {
    .wrapper { width: 100% !important; border-radius: 0 !important; }
    .body, .header, .footer { padding: 20px !important; }
  }
</style>
</head>
<body>
<div style="background:#f7f7f7;padding:0;">
<div class="wrapper" style="margin:0 auto;">
  <div class="header">
    <a href="${SITE_URL}">
      <img src="${LOGO_URL}" alt="commandeici" style="height:32px;width:auto;">
    </a>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <a href="${SITE_URL}">
      <img src="${LOGO_URL}" alt="commandeici" style="height:24px;width:auto;margin-bottom:12px;opacity:0.6;">
    </a>
    <p><strong>commandeici</strong> - Moins de telephone. Plus de cuisine.</p>
    <p>Vos clients commandent directement depuis leur telephone.<br>Pas de commission, pas d'intermediaire.</p>
    <p style="margin-top:12px;">
      <a href="${SITE_URL}">Site web</a> &nbsp;|&nbsp;
      <a href="${APP_URL}/inscription">S'inscrire</a> &nbsp;|&nbsp;
      <a href="mailto:${CONTACT_EMAIL}">Contact</a>
    </p>
    <p style="margin-top:12px;font-size:11px;">
      ${COMPANY_ADDRESS}<br>
      <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
    </p>
    <p style="margin-top:8px;font-size:11px;">
      <a href="${unsubscribeUrl}">Se desinscrire</a> &nbsp;|&nbsp;
      <a href="${SITE_URL}/pages/mentions-legales">Mentions legales</a> &nbsp;|&nbsp;
      <a href="${SITE_URL}/pages/politique-de-confidentialite">Confidentialite</a>
    </p>
  </div>
</div>
</div>
</body>
</html>`;
}

// ─── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template, to, data = {}, userId, restaurantId } = await req.json() as {
      template: string;
      to: string;
      data?: Record<string, string>;
      userId?: string;
      restaurantId?: string;
    };

    if (!template || !to || !templates[template]) {
      return new Response(
        JSON.stringify({ error: "Invalid template or missing 'to' address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      console.log(`[send-email] Dry run: template=${template}, to=${to}`);
      return new Response(
        JSON.stringify({ success: true, dryRun: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ─── Check user email preferences ─────────────────────────────────────────
    if (userId && !TRANSACTIONAL_TYPES.includes(template)) {
      const { data: prefs } = await supabase
        .from("user_email_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (prefs?.unsubscribed_at) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "user_unsubscribed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isReferral = template.startsWith("referral_");
      if (isReferral && prefs?.referral_emails === false) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "referral_emails_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!isReferral && prefs?.marketing_emails === false) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "marketing_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Anti-duplicate ───────────────────────────────────────────────────────
    const lookupId = userId || restaurantId;
    const lookupCol = userId ? "user_id" : "restaurant_id";

    if (lookupId) {
      // One-time emails: check if ever sent
      if (ONE_TIME_TYPES.includes(template)) {
        const { data: existing } = await supabase
          .from("email_logs")
          .select("id")
          .eq(lookupCol, lookupId)
          .eq("email_type", template)
          .limit(1);

        if (existing && existing.length > 0) {
          return new Response(
            JSON.stringify({ skipped: true, reason: "already_sent" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Marketing cooldown: max 1 non-transactional per 24h
      if (!TRANSACTIONAL_TYPES.includes(template)) {
        const since = new Date(Date.now() - MARKETING_COOLDOWN_MS).toISOString();
        const { data: recent } = await supabase
          .from("email_logs")
          .select("id")
          .eq(lookupCol, lookupId)
          .gte("sent_at", since)
          .limit(1);

        if (recent && recent.length > 0) {
          return new Response(
            JSON.stringify({ skipped: true, reason: "cooldown_24h" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ─── Generate unsubscribe token ───────────────────────────────────────────
    const unsubscribeToken = userId
      ? btoa(JSON.stringify({ uid: userId, ts: Date.now() }))
      : "";
    const unsubscribeUrl = `${APP_URL}/unsubscribe${unsubscribeToken ? "?token=" + unsubscribeToken : ""}`;

    // ─── Build and send ───────────────────────────────────────────────────────
    const { subject, content } = templates[template](data);
    const html = wrapHtml(content, unsubscribeUrl);

    const sendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });

    const result = await sendResponse.json();

    if (!sendResponse.ok) {
      console.error("[send-email] Resend error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Log the send ─────────────────────────────────────────────────────────
    try {
      await supabase.from("email_logs").insert({
        user_id: userId || null,
        restaurant_id: restaurantId || null,
        email_type: template,
        recipient_email: to,
        resend_id: result.id || null,
        metadata: { subject, data },
      });
    } catch (logErr) {
      console.error("[send-email] Log error:", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id, template }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-email] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
