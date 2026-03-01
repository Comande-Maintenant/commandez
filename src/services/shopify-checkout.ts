/**
 * Shopify checkout URL builder for subscription plans.
 *
 * Uses Shopify cart permalink format with selling plans.
 * The selling plan IDs must be filled in after creating the plans in Shopify admin.
 */

const SHOPIFY_STORE = "idwzsh-11.myshopify.com";

// Product variant ID for "commandeici Pro" - fill after creating the product
const VARIANT_ID = "FILL_AFTER_SETUP";

// Selling plan IDs mapped by plan type and billing day
// Fill these after creating the 12 selling plans in Shopify admin
const SELLING_PLANS: Record<string, Record<number, string>> = {
  monthly: {
    1: "FILL_AFTER_SETUP",
    5: "FILL_AFTER_SETUP",
    10: "FILL_AFTER_SETUP",
    15: "FILL_AFTER_SETUP",
    20: "FILL_AFTER_SETUP",
    25: "FILL_AFTER_SETUP",
  },
  annual: {
    1: "FILL_AFTER_SETUP",
    5: "FILL_AFTER_SETUP",
    10: "FILL_AFTER_SETUP",
    15: "FILL_AFTER_SETUP",
    20: "FILL_AFTER_SETUP",
    25: "FILL_AFTER_SETUP",
  },
};

export interface CheckoutParams {
  plan: "monthly" | "annual";
  billingDay: number;
  restaurantId: string;
  restaurantSlug: string;
  email: string;
  promoCode?: string;
}

/**
 * Build a Shopify checkout URL with the subscription selling plan.
 *
 * Uses the cart permalink format:
 * https://store.myshopify.com/cart/VARIANT_ID:1?selling_plan=PLAN_ID&attributes[key]=value&checkout[email]=email
 */
export function buildCheckoutUrl(params: CheckoutParams): string {
  const { plan, billingDay, restaurantId, restaurantSlug, email, promoCode } = params;

  const sellingPlanId = SELLING_PLANS[plan]?.[billingDay];
  if (!sellingPlanId || sellingPlanId === "FILL_AFTER_SETUP") {
    throw new Error(`Selling plan not configured for ${plan}/${billingDay}`);
  }

  const url = new URL(`https://${SHOPIFY_STORE}/cart/${VARIANT_ID}:1`);

  // Selling plan
  url.searchParams.set("selling_plan", sellingPlanId);

  // Cart attributes -> will appear as note_attributes on the order
  url.searchParams.set("attributes[restaurant_id]", restaurantId);
  url.searchParams.set("attributes[restaurant_slug]", restaurantSlug);
  url.searchParams.set("attributes[plan]", plan);
  url.searchParams.set("attributes[billing_day]", String(billingDay));
  if (promoCode) {
    url.searchParams.set("attributes[promo_code]", promoCode);
  }

  // Pre-fill email
  url.searchParams.set("checkout[email]", email);

  return url.toString();
}

export const PLAN_PRICES = {
  monthly: 29.99,
  annual: 239.88,
} as const;

export const BILLING_DAYS = [1, 5, 10, 15, 20, 25] as const;
export type BillingDay = (typeof BILLING_DAYS)[number];
