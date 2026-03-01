/**
 * Shopify checkout URL builder for subscription plans.
 *
 * Uses Shopify cart permalink format with selling plans.
 */

const SHOPIFY_STORE = "idwzsh-11.myshopify.com";

// Product variant ID for "commandeici Pro"
const VARIANT_ID = "53146218692947";

// Selling plan IDs by plan type
const SELLING_PLAN_IDS: Record<string, string> = {
  monthly: "690731942227",
  annual: "690731974995",
};

export interface CheckoutParams {
  plan: "monthly" | "annual";
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
  const { plan, restaurantId, restaurantSlug, email, promoCode } = params;

  const sellingPlanId = SELLING_PLAN_IDS[plan];
  if (!sellingPlanId) {
    throw new Error(`Selling plan not configured for ${plan}`);
  }

  const url = new URL(`https://${SHOPIFY_STORE}/cart/${VARIANT_ID}:1`);

  // Selling plan
  url.searchParams.set("selling_plan", sellingPlanId);

  // Cart attributes -> will appear as note_attributes on the order
  url.searchParams.set("attributes[restaurant_id]", restaurantId);
  url.searchParams.set("attributes[restaurant_slug]", restaurantSlug);
  url.searchParams.set("attributes[plan]", plan);
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
