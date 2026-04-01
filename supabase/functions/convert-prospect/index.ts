/**
 * convert-prospect - Manage prospect lifecycle
 *
 * action: "recap"   → Send recap email only (no account created, stays prospect)
 * action: "convert" → Create auth user + activate + send invitation email (default)
 *
 * Receives: { restaurantId, email, ownerName?, freeMonths?, action? }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurantId, email, freeMonths, ownerName, action } = await req.json();
    if (!restaurantId || !email) {
      return new Response(JSON.stringify({ error: "restaurantId and email required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get restaurant info
    const { data: restaurant, error: rErr } = await supabase
      .from("restaurants")
      .select("id, name, slug, account_status, address, restaurant_phone, primary_color")
      .eq("id", restaurantId)
      .single();
    if (rErr || !restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), { status: 404, headers: corsHeaders });
    }

    // Get menu items (up to 12, grouped by category)
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("name, price, category")
      .eq("restaurant_id", restaurantId)
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .limit(50);

    const menuCount = menuItems?.length ?? 0;
    const brandColor = restaurant.primary_color || "#10B981";

    // Group items by category (max 3 categories, max 4 items each)
    const catMap = new Map<string, { name: string; price: number }[]>();
    for (const item of (menuItems ?? [])) {
      const cat = item.category || "Autres";
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push({ name: item.name, price: item.price });
    }
    const categories = [...catMap.entries()].slice(0, 3);
    const previewHtml = categories.map(([cat, items]) => {
      const itemsHtml = items.slice(0, 4).map(i =>
        `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F3F4F6;font-size:13px;">
          <span style="color:#374151;">${i.name}</span>
          <span style="color:#111827;font-weight:600;">${Number(i.price).toFixed(2).replace(".", ",")} &euro;</span>
        </div>`
      ).join("");
      const moreCount = items.length > 4 ? items.length - 4 : 0;
      const moreHtml = moreCount > 0 ? `<p style="font-size:11px;color:#9CA3AF;margin:4px 0 0;">+ ${moreCount} autre${moreCount > 1 ? "s" : ""}</p>` : "";
      return `<div style="margin-bottom:12px;">
        <p style="font-size:12px;font-weight:700;color:${brandColor};text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">${cat}</p>
        ${itemsHtml}${moreHtml}
      </div>`;
    }).join("");

    const storeUrl = `https://app.commandeici.com/${restaurant.slug}`;
    const greeting = ownerName ? `Bonjour ${ownerName},` : "Bonjour,";

    // ──────────── RECAP EMAIL (no account, stays prospect) ────────────
    if (action === "recap") {
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500, headers: corsHeaders });
      }

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "CommandeIci <noreply@commandeici.com>",
          to: email,
          reply_to: "contact@commandeici.com",
          subject: `${restaurant.name} : ta page de commande est prête`,
          html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.6;">

  <div style="text-align:center;padding:24px 0;border-bottom:1px solid #E5E7EB;">
    <span style="font-size:20px;font-weight:700;color:#10B981;">CommandeIci</span>
  </div>

  <div style="padding:32px 16px;">
    <p style="font-size:16px;">${greeting}</p>

    <p>On a préparé ta page de commande en ligne pour <strong>${restaurant.name}</strong>. Tout est en place.</p>

    <div style="background:#F0FDF4;border:1px solid #D1FAE5;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="font-weight:600;margin:0 0 8px;">Ta page de commande :</p>
      <a href="${storeUrl}" style="color:#10B981;font-weight:600;font-size:15px;">${storeUrl}</a>
      <p style="font-size:13px;color:#6B7280;margin:8px 0 0;">C'est cette page que tes clients utiliseront pour commander.</p>
    </div>

    <h3 style="font-size:15px;margin:28px 0 12px;color:#111827;">Ce qu'on a fait pour toi :</h3>
    <ul style="padding-left:20px;font-size:14px;color:#374151;">
      <li style="margin-bottom:6px;"><strong>${menuCount} produits</strong> ajoutés à ta carte</li>
      <li style="margin-bottom:6px;"><strong>Horaires</strong> configurés automatiquement</li>
      <li style="margin-bottom:6px;"><strong>Page personnalisée</strong> avec les infos de ton commerce</li>
    </ul>

    ${previewHtml ? `
    <div style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin:24px 0;">
      <div style="background:${brandColor};padding:14px 16px;">
        <span style="font-size:16px;font-weight:700;color:white;">${restaurant.name}</span>
        ${restaurant.address ? `<p style="font-size:12px;color:rgba(255,255,255,0.8);margin:4px 0 0;">${restaurant.address}</p>` : ""}
      </div>
      <div style="padding:16px;">
        ${previewHtml}
      </div>
      <div style="background:#F9FAFB;padding:8px 16px;text-align:center;border-top:1px solid #E5E7EB;">
        <span style="font-size:11px;color:#9CA3AF;">Propulsé par <strong>CommandeIci</strong></span>
      </div>
    </div>
    ` : ""}

    <h3 style="font-size:15px;margin:28px 0 12px;color:#111827;">Les prochaines étapes :</h3>
    <ul style="padding-left:20px;font-size:14px;color:#374151;">
      <li style="margin-bottom:6px;">Regarde ta page et vérifie que tout est bon</li>
      <li style="margin-bottom:6px;">Si tu veux activer le système de commande, réponds à cet email</li>
      <li style="margin-bottom:6px;">On active ton compte, tu testes gratuitement pendant 4 semaines</li>
    </ul>

    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:24px 0;">
      <p style="font-size:14px;color:#374151;margin:0;"><strong>Pas de compte à créer, pas de carte bancaire.</strong> On a tout fait pour toi. Réponds juste à cet email si tu veux lancer.</p>
    </div>

    <p style="font-size:14px;">À bientôt,<br><strong>L'équipe CommandeIci</strong></p>
  </div>

  <div style="border-top:1px solid #E5E7EB;padding:16px;text-align:center;font-size:12px;color:#9CA3AF;">
    CommandeIci - Commande en ligne sans commission pour les commerces locaux<br>
    <a href="https://commandeici.com" style="color:#9CA3AF;">commandeici.com</a>
  </div>

</div>
          `,
        }),
      });

      await supabase.from("email_logs").insert({
        email_type: "prospect_recap",
        recipient_email: email,
        metadata: { restaurant_id: restaurantId, restaurant_name: restaurant.name },
      });

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // ──────────── CONVERT (create account + activate) ────────────
    if (restaurant.account_status !== "prospect") {
      return new Response(JSON.stringify({ error: "Restaurant is not a prospect" }), { status: 400, headers: corsHeaders });
    }

    // 1. Create auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { restaurant_slug: restaurant.slug },
    });
    if (authErr) {
      return new Response(JSON.stringify({ error: `Auth error: ${authErr.message}` }), { status: 400, headers: corsHeaders });
    }

    const userId = authUser.user.id;

    // 2. Create owner record
    const { error: ownerErr } = await supabase
      .from("owners")
      .insert({ id: userId, email, role: "owner" });
    if (ownerErr && !ownerErr.message.includes("duplicate")) {
      console.error("Owner insert error:", ownerErr);
    }

    // 3. Update restaurant → active
    const { error: updateErr } = await supabase
      .from("restaurants")
      .update({
        owner_id: userId,
        account_status: "active",
        subscription_status: "trial",
        trial_end_date: new Date(Date.now() + (freeMonths ? freeMonths * 30 : 28) * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", restaurantId);
    if (updateErr) {
      return new Response(JSON.stringify({ error: `Update error: ${updateErr.message}` }), { status: 500, headers: corsHeaders });
    }

    // 4. Generate magic link for password setup
    const { data: resetData } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `https://app.commandeici.com/admin/${restaurant.slug}` },
    });

    const inviteLink = resetData?.properties?.action_link ?? `https://app.commandeici.com/admin/${restaurant.slug}`;

    // 5. Send invitation email
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "CommandeIci <noreply@commandeici.com>",
          to: email,
          reply_to: "contact@commandeici.com",
          subject: `${restaurant.name} : ton compte est activé`,
          html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.6;">

  <div style="text-align:center;padding:24px 0;border-bottom:1px solid #E5E7EB;">
    <span style="font-size:20px;font-weight:700;color:#10B981;">CommandeIci</span>
  </div>

  <div style="padding:32px 16px;">
    <p style="font-size:16px;">${greeting}</p>

    <p>Ton compte pour <strong>${restaurant.name}</strong> est maintenant actif. Le système de commande en ligne est prêt à fonctionner.</p>

    <div style="background:#F0FDF4;border:1px solid #D1FAE5;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="font-weight:600;margin:0 0 8px;">Ta page de commande :</p>
      <a href="${storeUrl}" style="color:#10B981;font-weight:600;font-size:15px;">${storeUrl}</a>
      <p style="font-size:13px;color:#6B7280;margin:8px 0 0;">C'est la page que tes clients vont utiliser pour commander.</p>
    </div>

    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="font-weight:600;margin:0 0 8px;">Accède à ton espace :</p>
      <a href="${inviteLink}" style="display:inline-block;background:#10B981;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Définir mon mot de passe</a>
      <p style="font-size:13px;color:#6B7280;margin:8px 0 0;">Clique pour créer ton mot de passe et accéder à ton tableau de bord.</p>
    </div>

    <h3 style="font-size:15px;margin:28px 0 12px;color:#111827;">Ce que tu peux faire depuis ton espace :</h3>
    <ul style="padding-left:20px;font-size:14px;color:#374151;">
      <li style="margin-bottom:6px;"><strong>Modifier ta carte</strong> : ajouter, supprimer ou modifier tes produits</li>
      <li style="margin-bottom:6px;"><strong>Gérer les commandes</strong> : voir les commandes en temps réel</li>
      <li style="margin-bottom:6px;"><strong>Ajuster tes horaires</strong> : ouvrir/fermer quand tu veux</li>
      <li style="margin-bottom:6px;"><strong>Imprimer tes QR codes</strong> : pour afficher dans ton commerce</li>
    </ul>

    <h3 style="font-size:15px;margin:28px 0 12px;color:#111827;">Mise en place recommandée :</h3>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px;font-weight:600;">1. Cuisine</td>
        <td style="padding:8px;color:#6B7280;">Pour voir les nouvelles commandes et les préparer</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px;font-weight:600;">2. Caisse</td>
        <td style="padding:8px;color:#6B7280;">Pour prendre les commandes sur place et encaisser</td>
      </tr>
      <tr>
        <td style="padding:8px;font-weight:600;">3. Comptoir</td>
        <td style="padding:8px;color:#6B7280;">Une tablette côté client avec ton QR code</td>
      </tr>
    </table>

    <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:12px;padding:16px;margin:24px 0;">
      <p style="font-size:14px;color:#92400E;margin:0;"><strong>Essai gratuit 4 semaines</strong> - Aucun engagement, aucun prélèvement pendant l'essai.</p>
    </div>

    <p style="font-size:14px;">Une question ? Réponds directement à cet email.</p>

    <p style="font-size:14px;margin-top:24px;">À bientôt,<br><strong>L'équipe CommandeIci</strong></p>
  </div>

  <div style="border-top:1px solid #E5E7EB;padding:16px;text-align:center;font-size:12px;color:#9CA3AF;">
    CommandeIci - Commande en ligne sans commission pour les commerces locaux<br>
    <a href="https://commandeici.com" style="color:#9CA3AF;">commandeici.com</a>
  </div>

</div>
          `,
        }),
      });
    }

    await supabase.from("email_logs").insert({
      email_type: "prospect_invitation",
      recipient_email: email,
      metadata: { restaurant_id: restaurantId, restaurant_name: restaurant.name },
    });

    return new Response(JSON.stringify({ success: true, userId }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Internal error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
