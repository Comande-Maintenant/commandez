/**
 * convert-prospect - Convert a prospect restaurant to an active account
 *
 * Receives: { restaurantId, email, freeMonths? }
 * 1. Creates auth user + owner record
 * 2. Updates restaurant owner_id + account_status
 * 3. Sends invitation email via Resend
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { restaurantId, email, freeMonths, ownerName } = await req.json();
    if (!restaurantId || !email) {
      return new Response(JSON.stringify({ error: "restaurantId and email required" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get restaurant info
    const { data: restaurant, error: rErr } = await supabase
      .from("restaurants")
      .select("id, name, slug, account_status")
      .eq("id", restaurantId)
      .single();
    if (rErr || !restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), { status: 404 });
    }
    if (restaurant.account_status !== "prospect") {
      return new Response(JSON.stringify({ error: "Restaurant is not a prospect" }), { status: 400 });
    }

    // 2. Create auth user (with password reset flow)
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { restaurant_slug: restaurant.slug },
    });
    if (authErr) {
      return new Response(JSON.stringify({ error: `Auth error: ${authErr.message}` }), { status: 400 });
    }

    const userId = authUser.user.id;

    // 3. Create owner record
    const { error: ownerErr } = await supabase
      .from("owners")
      .insert({ id: userId, email, role: "owner" });
    if (ownerErr && !ownerErr.message.includes("duplicate")) {
      console.error("Owner insert error:", ownerErr);
    }

    // 4. Update restaurant
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
      return new Response(JSON.stringify({ error: `Update error: ${updateErr.message}` }), { status: 500 });
    }

    // 5. Generate password reset link
    const { data: resetData, error: resetErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `https://app.commandeici.com/admin/${restaurant.slug}` },
    });

    const inviteLink = resetData?.properties?.action_link ?? `https://app.commandeici.com/admin/${restaurant.slug}`;

    // 6. Send invitation email via Resend
    const greeting = ownerName ? `Bonjour ${ownerName},` : "Bonjour,";
    const storeUrl = `https://app.commandeici.com/${restaurant.slug}`;
    const dashUrl = inviteLink;

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
          subject: `${restaurant.name} : votre page de commande est prete`,
          html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.6;">

  <div style="text-align:center;padding:24px 0;border-bottom:1px solid #E5E7EB;">
    <span style="font-size:20px;font-weight:700;color:#10B981;">CommandeIci</span>
  </div>

  <div style="padding:32px 16px;">
    <p style="font-size:16px;">${greeting}</p>

    <p>Nous avons prepare votre page de commande en ligne pour <strong>${restaurant.name}</strong>. Tout est deja en place : votre carte, vos produits, vos horaires.</p>

    <div style="background:#F0FDF4;border:1px solid #D1FAE5;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="font-weight:600;margin:0 0 8px;">Votre page de commande :</p>
      <a href="${storeUrl}" style="color:#10B981;font-weight:600;font-size:15px;">${storeUrl}</a>
      <p style="font-size:13px;color:#6B7280;margin:8px 0 0;">C'est la page que vos clients utiliseront pour commander.</p>
    </div>

    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="font-weight:600;margin:0 0 8px;">Activez votre compte :</p>
      <a href="${dashUrl}" style="display:inline-block;background:#10B981;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Acceder a mon espace</a>
      <p style="font-size:13px;color:#6B7280;margin:8px 0 0;">Cliquez pour definir votre mot de passe et acceder a votre tableau de bord.</p>
    </div>

    <h3 style="font-size:15px;margin:28px 0 12px;color:#111827;">Ce qu'on vous recommande de verifier :</h3>
    <ul style="padding-left:20px;font-size:14px;color:#374151;">
      <li style="margin-bottom:6px;"><strong>Votre carte</strong> : verifiez les noms, prix et descriptions de vos produits</li>
      <li style="margin-bottom:6px;"><strong>Vos horaires</strong> : ajustez vos horaires d'ouverture dans les parametres</li>
      <li style="margin-bottom:6px;"><strong>Vos photos</strong> : ajoutez vos propres photos pour donner envie (optionnel)</li>
      <li style="margin-bottom:6px;"><strong>Un test</strong> : passez une commande test pour voir le parcours client</li>
    </ul>

    <h3 style="font-size:15px;margin:28px 0 12px;color:#111827;">Mise en place dans votre commerce :</h3>
    <p style="font-size:14px;color:#374151;">Pour que tout fonctionne au mieux, on recommande <strong>3 ecrans minimum</strong> :</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px;font-weight:600;">1. Cuisine</td>
        <td style="padding:8px;color:#6B7280;">Pour voir les nouvelles commandes en temps reel et les preparer</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px;font-weight:600;">2. Caisse</td>
        <td style="padding:8px;color:#6B7280;">Pour prendre les commandes sur place et encaisser</td>
      </tr>
      <tr>
        <td style="padding:8px;font-weight:600;">3. Comptoir</td>
        <td style="padding:8px;color:#6B7280;">Une tablette ou un ecran cote client avec votre QR code</td>
      </tr>
    </table>
    <p style="font-size:13px;color:#6B7280;">Un telephone, une tablette ou un vieil ordinateur suffisent. Pas besoin de materiel special.</p>

    <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:12px;padding:16px;margin:24px 0;">
      <p style="font-size:14px;color:#92400E;margin:0;"><strong>Essai gratuit 4 semaines</strong> : vous avez tout le temps de tester. Aucun engagement, aucun prelevement pendant l'essai.</p>
    </div>

    <p style="font-size:14px;">Une question ? Repondez directement a cet email, on est la.</p>

    <p style="font-size:14px;margin-top:24px;">A bientot,<br><strong>L'equipe CommandeIci</strong></p>
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

    // 7. Log the email
    await supabase.from("email_logs").insert({
      email_type: "prospect_invitation",
      recipient_email: email,
      metadata: { restaurant_id: restaurantId, restaurant_name: restaurant.name },
    });

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
