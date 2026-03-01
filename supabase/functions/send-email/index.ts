import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = "commandeici <contact@commandeici.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Email templates
const templates: Record<string, (data: Record<string, string>) => { subject: string; html: string }> = {
  // Trial expiring soon (J-7, J-3, J-1)
  trial_expiring: (data) => ({
    subject: `Votre essai commandeici se termine dans ${data.daysLeft} jours`,
    html: wrapHtml(`
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a;">Bonjour ${data.restaurantName},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        Votre essai gratuit se termine dans <strong>${data.daysLeft} jours</strong>.
        Pour continuer a recevoir des commandes directes, activez votre abonnement a 19 euros/mois.
      </p>
      <a href="https://app.commandeici.com/abonnement" style="display:inline-block;background-color:#10B981;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Activer mon abonnement</a>
      <p style="margin:16px 0 0;font-size:13px;color:#999;">Sans engagement, arretez quand vous voulez.</p>
    `),
  }),

  // Trial expired
  trial_expired: (data) => ({
    subject: "Votre essai commandeici est termine",
    html: wrapHtml(`
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a;">Bonjour ${data.restaurantName},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        Votre essai gratuit est termine. Votre page est maintenant desactivee.<br>
        Activez votre abonnement pour la remettre en ligne.
      </p>
      <a href="https://app.commandeici.com/abonnement" style="display:inline-block;background-color:#10B981;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Reactiver ma page</a>
    `),
  }),

  // Referral completed (to referrer)
  referral_completed_referrer: (data) => ({
    subject: "Bravo ! Vous avez gagne 4 semaines gratuites",
    html: wrapHtml(`
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a;">Bonjour ${data.referrerName},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        <strong>${data.refereeName}</strong> s'est inscrit avec votre lien de parrainage !<br>
        Vous gagnez <strong>4 semaines gratuites</strong> sur votre abonnement.
      </p>
      <p style="font-size:15px;color:#555;">Continuez a parrainer pour gagner plus de semaines gratuites.</p>
    `),
  }),

  // Referral completed (to referee)
  referral_completed_referee: (data) => ({
    subject: "Bienvenue ! Vous avez 8 semaines d'essai",
    html: wrapHtml(`
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a;">Bonjour ${data.refereeName},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        Grace au parrainage de <strong>${data.referrerName}</strong>, vous beneficiez de
        <strong>8 semaines d'essai gratuit</strong> au lieu de 4 !<br>
        Profitez-en pour tester toutes les fonctionnalites.
      </p>
      <a href="https://app.commandeici.com/inscription" style="display:inline-block;background-color:#10B981;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Commencer</a>
    `),
  }),
};

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
<tr><td style="background-color:#10B981;padding:24px 32px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">commandeici</h1>
</td></tr>
<tr><td style="padding:32px 28px;">${content}</td></tr>
<tr><td style="padding:16px 28px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
  <p style="margin:0;font-size:12px;color:#999;">commandeici &bull; contact@commandeici.com</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { template, to, data } = await req.json();

    if (!template || !to || !templates[template]) {
      return new Response(
        JSON.stringify({ error: "Invalid template or missing 'to' address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = templates[template](data || {});

    if (!RESEND_API_KEY) {
      console.log(`[send-email] Dry run: template=${template}, to=${to}, subject=${subject}`);
      return new Response(
        JSON.stringify({ success: true, dryRun: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });

    if (!sendResponse.ok) {
      const errText = await sendResponse.text();
      console.error("[send-email] Resend error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendResponse.json();
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
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
