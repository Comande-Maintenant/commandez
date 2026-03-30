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
    const { restaurantId, email, freeMonths } = await req.json();
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
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "commandeici <noreply@commandeici.com>",
          to: email,
          reply_to: "augustin.foucheres@gmail.com",
          subject: `${restaurant.name} - Votre page de commande est prete`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#111827;">Bienvenue sur CommandeIci !</h2>
              <p>Votre page de commande en ligne pour <strong>${restaurant.name}</strong> est prete.</p>
              <p><strong>Votre page :</strong><br>
              <a href="https://app.commandeici.com/${restaurant.slug}" style="color:#10B981;">
                app.commandeici.com/${restaurant.slug}
              </a></p>
              <p><strong>Votre tableau de bord :</strong><br>
              <a href="${inviteLink}" style="color:#10B981;">
                Acceder a mon espace
              </a></p>
              <p>Cliquez sur le lien ci-dessus pour vous connecter et decouvrir votre espace.</p>
              <p style="color:#6B7280;font-size:14px;margin-top:32px;">
                CommandeIci - Commande en ligne sans commission
              </p>
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
