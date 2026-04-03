import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY") || "price_1TFfc91URUOTUP9a1YsBjdJq";

const COUPON_3MOIS = Deno.env.get("STRIPE_COUPON_3MOIS") || "kZdytKw3";

const APP_URL = "https://app.commandeici.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { plan, restaurant_id, restaurant_slug, email, promo_code } = await req.json();

    if (!restaurant_id || !email) {
      return new Response(JSON.stringify({ error: "restaurant_id and email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = PRICE_MONTHLY;

    // ─── Find or create Stripe Customer ───────────────────────────────────
    let customerId: string | null = null;

    // Check if we already have a customer for this restaurant
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    }

    if (!customerId) {
      // Check Stripe for existing customer with this email
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email,
          metadata: { restaurant_id, restaurant_slug: restaurant_slug || "" },
        });
        customerId = customer.id;
      }
    }

    // ─── Build Checkout Session ───────────────────────────────────────────
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      success_url: `${APP_URL}/abonnement-confirme?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/choisir-plan?checkout=cancel`,
      locale: "fr",
      metadata: {
        restaurant_id,
        restaurant_slug: restaurant_slug || "",
        plan: "monthly",
      },
      subscription_data: {
        metadata: {
          restaurant_id,
          restaurant_slug: restaurant_slug || "",
          plan: "monthly",
        },
      },
      custom_text: {
        submit: {
          message: "1 euro/mois pendant 3 mois, puis 29,99 euros/mois. Sans engagement.",
        },
      },
    };

    // Apply coupon (3 mois a 1 euro), unless external promo
    if (promo_code) {
      try {
        const promoCodes = await stripe.promotionCodes.list({ code: promo_code, active: true, limit: 1 });
        if (promoCodes.data.length > 0) {
          sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
        } else {
          sessionParams.allow_promotion_codes = true;
        }
      } catch {
        sessionParams.allow_promotion_codes = true;
      }
    } else {
      // Auto-apply 3 months at 1 euro coupon
      sessionParams.discounts = [{ coupon: COUPON_3MOIS }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // ─── Update subscription in DB ────────────────────────────────────────
    await supabase.from("subscriptions").upsert({
      restaurant_id,
      stripe_customer_id: customerId,
      stripe_session_id: session.id,
      plan: "monthly",
      status: "pending_payment",
      updated_at: new Date().toISOString(),
    }, { onConflict: "restaurant_id" });

    return new Response(JSON.stringify({
      url: session.url,
      session_id: session.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-checkout] Error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
