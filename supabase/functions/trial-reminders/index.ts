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
 * 1. Sends reminder emails at J-7, J-3, J-1 before trial end
 * 2. Sends expiration email when trial ends
 * 3. Marks expired trials as 'expired' and disables ordering
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: string[] = [];

  try {
    // Get all restaurants on trial with their owner email
    const { data: restaurants, error } = await supabase
      .from("restaurants")
      .select("id, name, trial_end_date, bonus_weeks, subscription_status, owner_id, owners!inner(email)")
      .eq("subscription_status", "trial")
      .not("trial_end_date", "is", null);

    if (error) {
      console.error("[trial-reminders] Query error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!restaurants || restaurants.length === 0) {
      return new Response(
        JSON.stringify({ message: "No trial restaurants found", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();

    for (const r of restaurants) {
      const trialEnd = new Date(r.trial_end_date);
      // Add bonus weeks
      if (r.bonus_weeks > 0) {
        trialEnd.setDate(trialEnd.getDate() + r.bonus_weeks * 7);
      }

      const diffMs = trialEnd.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const ownerEmail = (r as any).owners?.email;

      if (!ownerEmail) continue;

      // Trial already expired
      if (daysLeft <= 0) {
        // Expire the trial
        await supabase
          .from("restaurants")
          .update({ subscription_status: "expired", is_accepting_orders: false })
          .eq("id", r.id);

        // Send expiration email
        await sendEmail(supabase, "trial_expired", ownerEmail, {
          restaurantName: r.name,
        });

        results.push(`${r.name}: expired, email sent to ${ownerEmail}`);
        continue;
      }

      // Send reminders at J-7, J-3, J-1
      if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
        await sendEmail(supabase, "trial_expiring", ownerEmail, {
          restaurantName: r.name,
          daysLeft: String(daysLeft),
        });
        results.push(`${r.name}: J-${daysLeft} reminder sent to ${ownerEmail}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: restaurants.length, results }),
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
