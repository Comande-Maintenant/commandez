import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SHOPIFY_WEBHOOK_SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shopify webhook handler for subscription lifecycle events.
 *
 * Handles:
 * - subscription_contracts/create -> INSERT subscription (trial or active)
 * - orders/paid -> UPDATE subscription to active
 * - subscription_billing_attempts/failure -> UPDATE to past_due
 * - subscription_contracts/update -> check for cancellation
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawBody = await req.text();

  // HMAC-SHA256 verification
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
  if (!hmacHeader || !SHOPIFY_WEBHOOK_SECRET) {
    console.error("[shopify-webhooks] Missing HMAC header or secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isValid = await verifyHmac(rawBody, hmacHeader, SHOPIFY_WEBHOOK_SECRET);
  if (!isValid) {
    console.error("[shopify-webhooks] HMAC verification failed");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const payload = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log(`[shopify-webhooks] Received topic: ${topic}`);

  try {
    switch (topic) {
      case "subscription_contracts/create":
        await handleContractCreate(supabase, payload);
        break;
      case "orders/paid":
        await handleOrderPaid(supabase, payload);
        break;
      case "subscription_billing_attempts/failure":
        await handleBillingFailure(supabase, payload);
        break;
      case "subscription_contracts/update":
        await handleContractUpdate(supabase, payload);
        break;
      default:
        console.log(`[shopify-webhooks] Unhandled topic: ${topic}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[shopify-webhooks] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================
// HMAC verification
// ============================================================
async function verifyHmac(body: string, hmac: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return computed === hmac;
}

// ============================================================
// Extract restaurant_id from note_attributes or email
// ============================================================
async function resolveRestaurantId(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<string | null> {
  // Try note_attributes first
  const noteAttrs = (payload.note_attributes as Array<{ name: string; value: string }>) ?? [];
  const restaurantAttr = noteAttrs.find((a) => a.name === "restaurant_id");
  if (restaurantAttr?.value) return restaurantAttr.value;

  // Fallback: match by email via owners table
  const email =
    (payload as any).email ||
    (payload as any).customer?.email ||
    (payload as any).contact_email;
  if (email) {
    const { data } = await supabase
      .from("owners")
      .select("id")
      .eq("email", email)
      .single();
    if (data?.id) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (restaurant?.id) return restaurant.id;
    }
  }

  return null;
}

// Helper to extract note attribute value
function getNoteAttr(payload: Record<string, unknown>, name: string): string | null {
  const noteAttrs = (payload.note_attributes as Array<{ name: string; value: string }>) ?? [];
  const attr = noteAttrs.find((a) => a.name === name);
  return attr?.value ?? null;
}

// ============================================================
// subscription_contracts/create
// ============================================================
async function handleContractCreate(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const restaurantId = await resolveRestaurantId(supabase, payload);
  if (!restaurantId) {
    console.error("[shopify-webhooks] Could not resolve restaurant_id for contract create");
    return;
  }

  const contractId = String((payload as any).admin_graphql_api_id || (payload as any).id || "");
  const plan = getNoteAttr(payload, "plan") || "monthly";
  const billingDay = parseInt(getNoteAttr(payload, "billing_day") || "15", 10);
  const promoCode = getNoteAttr(payload, "promo_code") || null;

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  // Determine status based on trial
  const status = "trial";

  const { error } = await supabase.from("subscriptions").upsert(
    {
      restaurant_id: restaurantId,
      status,
      plan,
      billing_day: billingDay,
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      shopify_contract_id: contractId || null,
      shopify_customer_id: String((payload as any).customer_id || (payload as any).customer?.id || ""),
      promo_code_used: promoCode,
    },
    { onConflict: "shopify_contract_id" }
  );

  if (error) {
    console.error("[shopify-webhooks] Error inserting subscription:", error);
    return;
  }

  // Sync restaurant status
  await syncRestaurantStatus(supabase, restaurantId, "trial");

  // Apply promo code if present
  if (promoCode) {
    await applyPromoCode(supabase, restaurantId, promoCode);
  }

  // Send activation email
  await sendEmailNotification(supabase, restaurantId, "subscription_activated", {
    plan,
    trialEnd: trialEnd.toISOString().split("T")[0],
  });

  console.log(`[shopify-webhooks] Contract created for restaurant ${restaurantId}, plan: ${plan}`);
}

// ============================================================
// orders/paid
// ============================================================
async function handleOrderPaid(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const restaurantId = await resolveRestaurantId(supabase, payload);
  if (!restaurantId) return;

  const orderId = String((payload as any).id || "");

  // Check if this is a subscription order (has selling plan allocation)
  const lineItems = (payload as any).line_items ?? [];
  const hasSellingPlan = lineItems.some(
    (li: any) => li.selling_plan_allocation != null
  );
  if (!hasSellingPlan) return;

  // Update subscription to active
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      shopify_order_id: orderId,
      current_period_start: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId)
    .in("status", ["trial", "pending_payment", "past_due"]);

  if (error) {
    console.error("[shopify-webhooks] Error updating subscription on order paid:", error);
    return;
  }

  await syncRestaurantStatus(supabase, restaurantId, "active");

  console.log(`[shopify-webhooks] Order paid for restaurant ${restaurantId}`);
}

// ============================================================
// subscription_billing_attempts/failure
// ============================================================
async function handleBillingFailure(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const contractId = String(
    (payload as any).subscription_contract_id ||
    (payload as any).admin_graphql_api_id ||
    ""
  );

  if (!contractId) return;

  // Find subscription by contract
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, restaurant_id")
    .eq("shopify_contract_id", contractId)
    .single();

  if (!sub) return;

  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("id", sub.id);

  await syncRestaurantStatus(supabase, sub.restaurant_id, "past_due");

  // Send payment failed email
  await sendEmailNotification(supabase, sub.restaurant_id, "payment_failed", {});

  console.log(`[shopify-webhooks] Billing failure for subscription ${sub.id}`);
}

// ============================================================
// subscription_contracts/update (cancellation)
// ============================================================
async function handleContractUpdate(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const contractId = String((payload as any).admin_graphql_api_id || (payload as any).id || "");
  const contractStatus = String((payload as any).status || "").toLowerCase();

  // Only process cancellations
  if (contractStatus !== "cancelled" && contractStatus !== "expired") return;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, restaurant_id")
    .eq("shopify_contract_id", contractId)
    .single();

  if (!sub) return;

  const newStatus = contractStatus === "cancelled" ? "cancelled" : "expired";

  await supabase
    .from("subscriptions")
    .update({ status: newStatus })
    .eq("id", sub.id);

  // Disable ordering
  await supabase
    .from("restaurants")
    .update({ subscription_status: newStatus, is_accepting_orders: false })
    .eq("id", sub.restaurant_id);

  // Send cancellation email
  await sendEmailNotification(supabase, sub.restaurant_id, "subscription_cancelled", {});

  console.log(`[shopify-webhooks] Contract ${newStatus} for restaurant ${sub.restaurant_id}`);
}

// ============================================================
// Helpers
// ============================================================
async function syncRestaurantStatus(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  status: string
) {
  await supabase
    .from("restaurants")
    .update({ subscription_status: status })
    .eq("id", restaurantId);
}

async function applyPromoCode(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  code: string
) {
  try {
    const { data: promo } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("active", true)
      .single();

    if (!promo) return;

    // Check max uses
    if (promo.max_uses && promo.current_uses >= promo.max_uses) return;

    // Check if already used by this restaurant
    const { data: existingUse } = await supabase
      .from("promo_code_uses")
      .select("id")
      .eq("promo_code_id", promo.id)
      .eq("restaurant_id", restaurantId)
      .single();

    if (existingUse) return;

    // Apply based on type
    if (promo.type === "free_days") {
      await supabase
        .from("subscriptions")
        .update({ bonus_days: promo.value })
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1);
    } else if (promo.type === "free_trial_extension") {
      // Extend trial_end by value days
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, trial_end")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (sub?.trial_end) {
        const newEnd = new Date(sub.trial_end);
        newEnd.setDate(newEnd.getDate() + Number(promo.value));
        await supabase
          .from("subscriptions")
          .update({ trial_end: newEnd.toISOString() })
          .eq("id", sub.id);
      }
    }
    // discount_percent and discount_fixed are handled by Shopify discount codes natively

    // Record usage
    await supabase.from("promo_code_uses").insert({
      promo_code_id: promo.id,
      restaurant_id: restaurantId,
    });

    // Increment counter
    await supabase
      .from("promo_codes")
      .update({ current_uses: promo.current_uses + 1 })
      .eq("id", promo.id);

    // Send promo confirmation email
    await sendEmailNotification(supabase, restaurantId, "promo_applied", {
      promoCode: code,
      promoType: promo.type,
      promoValue: String(promo.value),
    });
  } catch (err) {
    console.error("[shopify-webhooks] Error applying promo code:", err);
  }
}

async function sendEmailNotification(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  template: string,
  data: Record<string, string>
) {
  try {
    // Get owner email and restaurant name
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name, owner_id, owners!inner(email)")
      .eq("id", restaurantId)
      .single();

    if (!restaurant) return;

    const ownerEmail = (restaurant as any).owners?.email;
    if (!ownerEmail) return;

    await supabase.functions.invoke("send-email", {
      body: {
        template,
        to: ownerEmail,
        data: { ...data, restaurantName: restaurant.name },
      },
    });
  } catch (err) {
    console.error(`[shopify-webhooks] Failed to send ${template} email:`, err);
  }
}
