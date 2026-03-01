import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMO_DESCRIPTIONS: Record<string, (value: number) => string> = {
  free_days: (v) => `${v} jours offerts apres activation`,
  free_trial_extension: (v) => `+${v} jours d'essai supplementaires`,
  discount_percent: (v) => `${v}% de reduction sur le premier cycle`,
  discount_fixed: (v) => `${v} EUR de reduction sur le premier cycle`,
};

/**
 * Validate a promo code server-side.
 * Input: { code, restaurant_id }
 * Output: { valid, type, value, description } or { valid: false, error }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, restaurant_id } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ valid: false, error: "Code requis" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const upperCode = code.toUpperCase().trim();

    // Find promo code
    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", upperCode)
      .single();

    if (error || !promo) {
      return new Response(
        JSON.stringify({ valid: false, error: "Code invalide" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check active
    if (!promo.active) {
      return new Response(
        JSON.stringify({ valid: false, error: "Ce code n'est plus actif" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "Ce code a expire" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, error: "Ce code a atteint sa limite d'utilisation" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already used by this restaurant
    if (restaurant_id) {
      const { data: existingUse } = await supabase
        .from("promo_code_uses")
        .select("id")
        .eq("promo_code_id", promo.id)
        .eq("restaurant_id", restaurant_id)
        .single();

      if (existingUse) {
        return new Response(
          JSON.stringify({ valid: false, error: "Vous avez deja utilise ce code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const descFn = PROMO_DESCRIPTIONS[promo.type];
    const description = descFn ? descFn(Number(promo.value)) : "";

    return new Response(
      JSON.stringify({
        valid: true,
        type: promo.type,
        value: Number(promo.value),
        description,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[validate-promo] Error:", err);
    return new Response(
      JSON.stringify({ valid: false, error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
