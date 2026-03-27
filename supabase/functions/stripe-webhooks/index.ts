import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TFfc91URUOTUP9a1YsBjdJq": "monthly",
  "price_1TFfcA1URUOTUP9ae4sv6vMA": "annual",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    console.error("[stripe-webhooks] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ─── Verify webhook signature ─────────────────────────────────────────
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhooks] Signature verification failed:", (err as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[stripe-webhooks] Event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // ─── Checkout completed ───────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const restaurantId = session.metadata?.restaurant_id;
        const plan = session.metadata?.plan || "monthly";
        const stripeSubId = session.subscription as string;
        const customerId = session.customer as string;

        if (!restaurantId) {
          console.error("[stripe-webhooks] No restaurant_id in session metadata");
          break;
        }

        // Retrieve subscription details for period dates
        const subscription = await stripe.subscriptions.retrieve(stripeSubId);
        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;
        const currentPeriodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null;

        // Update subscriptions table
        await supabase.from("subscriptions").upsert({
          restaurant_id: restaurantId,
          stripe_subscription_id: stripeSubId,
          stripe_customer_id: customerId,
          stripe_session_id: session.id,
          status: "active",
          plan,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "restaurant_id" });

        // Update restaurants table for backward compat
        await supabase.from("restaurants").update({
          subscription_status: "active",
          is_accepting_orders: true,
        }).eq("id", restaurantId);

        // Send activation email
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name, owner_id")
          .eq("id", restaurantId)
          .single();

        if (restaurant?.owner_id) {
          const { data: owner } = await supabase
            .from("owners")
            .select("email")
            .eq("id", restaurant.owner_id)
            .single();

          if (owner?.email) {
            supabase.functions.invoke("send-email", {
              body: {
                type: "subscription_activated",
                to: owner.email,
                data: { restaurantName: restaurant.name, plan },
              },
            }).catch(console.error);
          }
        }

        console.log(`[stripe-webhooks] Subscription activated for restaurant ${restaurantId}`);
        break;
      }

      // ─── Subscription updated ─────────────────────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const restaurantId = subscription.metadata?.restaurant_id;
        if (!restaurantId) break;

        const priceId = subscription.items.data[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId || ""] || subscription.metadata?.plan || "monthly";
        const status = subscription.status; // active, past_due, canceled, unpaid, trialing
        const isActive = status === "active" || status === "trialing";

        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        // Map Stripe status to our status
        let ourStatus = status;
        if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
          ourStatus = "cancelled";
        }

        await supabase.from("subscriptions").upsert({
          restaurant_id: restaurantId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          status: ourStatus,
          plan,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "restaurant_id" });

        // Update restaurants table
        await supabase.from("restaurants").update({
          subscription_status: isActive ? "active" : ourStatus,
          is_accepting_orders: isActive,
        }).eq("id", restaurantId);

        console.log(`[stripe-webhooks] Subscription updated: ${restaurantId} -> ${ourStatus}`);
        break;
      }

      // ─── Subscription deleted ─────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const restaurantId = subscription.metadata?.restaurant_id;
        if (!restaurantId) break;

        await supabase.from("subscriptions").update({
          status: "cancelled",
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq("restaurant_id", restaurantId);

        await supabase.from("restaurants").update({
          subscription_status: "cancelled",
          is_accepting_orders: false,
        }).eq("id", restaurantId);

        // Send cancellation email
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name, owner_id")
          .eq("id", restaurantId)
          .single();

        if (restaurant?.owner_id) {
          const { data: owner } = await supabase
            .from("owners")
            .select("email")
            .eq("id", restaurant.owner_id)
            .single();

          if (owner?.email) {
            supabase.functions.invoke("send-email", {
              body: {
                type: "subscription_cancelled",
                to: owner.email,
                data: { restaurantName: restaurant.name },
              },
            }).catch(console.error);
          }
        }

        console.log(`[stripe-webhooks] Subscription cancelled: ${restaurantId}`);
        break;
      }

      // ─── Invoice paid (recurring) ─────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;

        // Only process recurring, not first payment (already handled by checkout.session.completed)
        if (invoice.billing_reason === "subscription_cycle") {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const restaurantId = subscription.metadata?.restaurant_id;
          if (!restaurantId) break;

          const currentPeriodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;

          await supabase.from("subscriptions").update({
            status: "active",
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          }).eq("restaurant_id", restaurantId);

          await supabase.from("restaurants").update({
            subscription_status: "active",
            is_accepting_orders: true,
          }).eq("id", restaurantId);

          console.log(`[stripe-webhooks] Recurring payment success: ${restaurantId}`);
        }
        break;
      }

      // ─── Invoice payment failed ───────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;

        const subscription = await stripe.subscriptions.retrieve(subId);
        const restaurantId = subscription.metadata?.restaurant_id;
        if (!restaurantId) break;

        await supabase.from("subscriptions").update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        }).eq("restaurant_id", restaurantId);

        await supabase.from("restaurants").update({
          subscription_status: "past_due",
        }).eq("id", restaurantId);

        // Send payment failed email
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name, owner_id")
          .eq("id", restaurantId)
          .single();

        if (restaurant?.owner_id) {
          const { data: owner } = await supabase
            .from("owners")
            .select("email")
            .eq("id", restaurant.owner_id)
            .single();

          if (owner?.email) {
            supabase.functions.invoke("send-email", {
              body: {
                type: "payment_failed",
                to: owner.email,
                data: { restaurantName: restaurant.name },
              },
            }).catch(console.error);
          }
        }

        console.log(`[stripe-webhooks] Payment failed: ${restaurantId}`);
        break;
      }

      default:
        console.log(`[stripe-webhooks] Unhandled event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[stripe-webhooks] Error processing ${event.type}:`, (err as Error).message);
    // Return 200 to prevent Stripe retries on processing errors
    return new Response(JSON.stringify({ received: true, error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
