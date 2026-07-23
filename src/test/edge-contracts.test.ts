import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stripeWebhookPath = resolve(
  process.cwd(),
  "supabase/functions/stripe-webhooks/index.ts",
);

describe("Edge Function contracts", () => {
  it("uses the send-email template field for every Stripe lifecycle email", () => {
    const source = readFileSync(stripeWebhookPath, "utf8");
    const invocations = source.matchAll(
      /functions\.invoke\("send-email",\s*\{\s*body:\s*\{([\s\S]*?)\}\s*,?\s*\}\)/g,
    );
    const bodies = [...invocations].map((match) => match[1]);

    expect(bodies).toHaveLength(3);
    for (const body of bodies) {
      expect(body).toMatch(/template:\s*"/);
      expect(body).not.toMatch(/\btype:\s*"/);
    }
  });

  it("maps Stripe price IDs from deployment secrets", () => {
    const source = readFileSync(stripeWebhookPath, "utf8");

    expect(source).toContain('Deno.env.get("STRIPE_PRICE_MONTHLY")');
    expect(source).toContain('Deno.env.get("STRIPE_PRICE_ANNUAL")');
  });
});
