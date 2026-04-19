import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Trial reminders cron (daily via pg_cron + pg_net).
 *
 * Non-blocking model: access to the dashboard stays open after trial ends.
 * We only send reminder emails. The admin keeps working until the owner
 * adds a card or asks to be deleted.
 *
 * Schedule relative to trial_start:
 *   J+7   -> trial_checkin          ("ca roule ?")
 *   J+21  -> trial_expiring (9d)    ("plus que 9 jours")
 *   J+28  -> trial_expiring (2d)    ("plus que 2 jours")
 *   J+30  -> trial_expired          (on flag status = expired)
 *   J+37  -> trial_expired_relance1 (J+7 apres fin)
 *   J+45  -> trial_expired_relance2 (J+15 apres fin)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: string[] = [];

  try {
    // Pull all subs that could need a touch (trial or expired with trial_start)
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, restaurant_id, trial_start, trial_end, bonus_days, status")
      .in("status", ["trial", "expired"])
      .not("trial_start", "is", null);

    const now = Date.now();

    for (const sub of subs ?? []) {
      const start = new Date(sub.trial_start).getTime();
      const daysSinceStart = Math.floor((now - start) / MS_PER_DAY);
      const bonus = sub.bonus_days ?? 0;

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("name, owner_id, owners!inner(email)")
        .eq("id", sub.restaurant_id)
        .single();

      if (!restaurant) continue;
      const ownerEmail = (restaurant as any).owners?.email;
      if (!ownerEmail) continue;

      // Flip status to expired at J+30 (+bonus), without touching ordering
      const expireOn = 30 + bonus;
      if (sub.status === "trial" && daysSinceStart >= expireOn) {
        await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("id", sub.id);
        await supabase
          .from("restaurants")
          .update({ subscription_status: "expired" })
          .eq("id", sub.restaurant_id);
        await sendEmail(supabase, "trial_expired", ownerEmail, {
          restaurantName: restaurant.name,
        }, restaurant.owner_id, sub.restaurant_id);
        results.push(`[sub] ${restaurant.name}: J+${daysSinceStart} expired, email sent`);
        continue;
      }

      // Check-in J+7
      if (sub.status === "trial" && daysSinceStart === 7) {
        await sendEmail(supabase, "trial_checkin", ownerEmail, {
          restaurantName: restaurant.name,
        }, restaurant.owner_id, sub.restaurant_id);
        results.push(`[sub] ${restaurant.name}: J+7 checkin sent`);
        continue;
      }

      // Expiring reminders J+21 (9d left) and J+28 (2d left)
      if (sub.status === "trial" && daysSinceStart === 21) {
        await sendEmail(supabase, "trial_expiring", ownerEmail, {
          restaurantName: restaurant.name,
          daysLeft: "9",
        }, restaurant.owner_id, sub.restaurant_id);
        results.push(`[sub] ${restaurant.name}: J-9 expiring sent`);
        continue;
      }
      if (sub.status === "trial" && daysSinceStart === 28) {
        await sendEmail(supabase, "trial_expiring", ownerEmail, {
          restaurantName: restaurant.name,
          daysLeft: "2",
        }, restaurant.owner_id, sub.restaurant_id);
        results.push(`[sub] ${restaurant.name}: J-2 expiring sent`);
        continue;
      }

      // Post-expiry relances (status now = expired)
      if (sub.status === "expired" && daysSinceStart === expireOn + 7) {
        await sendEmail(supabase, "trial_expired_relance1", ownerEmail, {
          restaurantName: restaurant.name,
        }, restaurant.owner_id, sub.restaurant_id);
        results.push(`[sub] ${restaurant.name}: relance1 sent (J+${daysSinceStart})`);
        continue;
      }
      if (sub.status === "expired" && daysSinceStart === expireOn + 15) {
        await sendEmail(supabase, "trial_expired_relance2", ownerEmail, {
          restaurantName: restaurant.name,
        }, restaurant.owner_id, sub.restaurant_id);
        results.push(`[sub] ${restaurant.name}: relance2 sent (J+${daysSinceStart})`);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[trial-reminders] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  template: string,
  to: string,
  data: Record<string, string>,
  userId?: string,
  restaurantId?: string,
) {
  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: { template, to, data, userId, restaurantId },
    });
    if (error) console.error(`[trial-reminders] send-email error for ${to}:`, error);
  } catch (err) {
    console.error(`[trial-reminders] Failed to invoke send-email for ${to}:`, err);
  }
}
