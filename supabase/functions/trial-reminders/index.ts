import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Trial reminders cron function.
 * Called daily via pg_cron + pg_net.
 *
 * Checks both:
 * 1. New subscriptions table (trial status)
 * 2. Legacy restaurants table (backward compat for existing restaurants)
 *
 * Actions:
 * - Sends reminder emails at J-7, J-3, J-1 before trial end
 * - Sends expiration email when trial ends
 * - Marks expired trials and disables ordering
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: string[] = [];

  try {
    // ---- 1. New subscriptions table ----
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, restaurant_id, trial_end, bonus_days, status")
      .eq("status", "trial")
      .not("trial_end", "is", null);

    if (subs && subs.length > 0) {
      const now = new Date();

      for (const sub of subs) {
        const trialEnd = new Date(sub.trial_end);
        if (sub.bonus_days > 0) {
          trialEnd.setDate(trialEnd.getDate() + sub.bonus_days);
        }

        const diffMs = trialEnd.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Get owner email
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name, owner_id, owners!inner(email)")
          .eq("id", sub.restaurant_id)
          .single();

        if (!restaurant) continue;
        const ownerEmail = (restaurant as any).owners?.email;
        if (!ownerEmail) continue;

        if (daysLeft <= 0) {
          // Expire the subscription
          await supabase
            .from("subscriptions")
            .update({ status: "expired" })
            .eq("id", sub.id);

          await supabase
            .from("restaurants")
            .update({ subscription_status: "expired", is_accepting_orders: false })
            .eq("id", sub.restaurant_id);

          await sendEmail(supabase, "trial_expired", ownerEmail, {
            restaurantName: restaurant.name,
          });

          results.push(`[sub] ${restaurant.name}: expired, email sent`);
          continue;
        }

        if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
          await sendEmail(supabase, "trial_expiring", ownerEmail, {
            restaurantName: restaurant.name,
            daysLeft: String(daysLeft),
          });
          results.push(`[sub] ${restaurant.name}: J-${daysLeft} reminder sent`);
        }
      }
    }

    // ---- 2. Legacy restaurants table (backward compat) ----
    // Only process restaurants that do NOT have a row in subscriptions
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name, trial_end_date, bonus_weeks, subscription_status, owner_id, owners!inner(email)")
      .eq("subscription_status", "trial")
      .not("trial_end_date", "is", null);

    if (restaurants && restaurants.length > 0) {
      // Get restaurant IDs that already have subscriptions rows
      const restaurantIds = restaurants.map((r) => r.id);
      const { data: existingSubs } = await supabase
        .from("subscriptions")
        .select("restaurant_id")
        .in("restaurant_id", restaurantIds);

      const subRestaurantIds = new Set((existingSubs ?? []).map((s: any) => s.restaurant_id));

      const now = new Date();

      for (const r of restaurants) {
        // Skip if already managed by subscriptions table
        if (subRestaurantIds.has(r.id)) continue;

        const trialEnd = new Date(r.trial_end_date);
        if (r.bonus_weeks > 0) {
          trialEnd.setDate(trialEnd.getDate() + r.bonus_weeks * 7);
        }

        const diffMs = trialEnd.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const ownerEmail = (r as any).owners?.email;

        if (!ownerEmail) continue;

        if (daysLeft <= 0) {
          await supabase
            .from("restaurants")
            .update({ subscription_status: "expired", is_accepting_orders: false })
            .eq("id", r.id);

          await sendEmail(supabase, "trial_expired", ownerEmail, {
            restaurantName: r.name,
          });

          results.push(`[legacy] ${r.name}: expired, email sent`);
          continue;
        }

        if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
          await sendEmail(supabase, "trial_expiring", ownerEmail, {
            restaurantName: r.name,
            daysLeft: String(daysLeft),
          });
          results.push(`[legacy] ${r.name}: J-${daysLeft} reminder sent`);
        }
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
  data: Record<string, string>
) {
  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: { template, to, data },
    });
    if (error) console.error(`[trial-reminders] send-email error for ${to}:`, error);
  } catch (err) {
    console.error(`[trial-reminders] Failed to invoke send-email for ${to}:`, err);
  }
}
