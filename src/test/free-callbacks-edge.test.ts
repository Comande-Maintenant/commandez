import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { FREE_ACCESS, freeAccessResponse } from '../../supabase/functions/_shared/access-policy';
type Handler = (request: Request) => Promise<Response>;
function fixture(name: 'stripe-webhooks' | 'convert-prospect', options: { free?: boolean; admin?: boolean; configured?: boolean } = {}) {
  let handler!: Handler;
  const writes: Array<{ table: string; value: Record<string, unknown> }> = [];
  const restaurant = { id: 'restaurant-a', name: 'Pizza Auxerre', slug: 'pizza-auxerre', account_status: 'prospect', primary_color: '#000000' };
  const from = vi.fn((table: string) => {
    const query = { select: () => query, eq: () => query, order: () => query,
      single: async () => ({ data: restaurant, error: null }),
      limit: async () => ({ data: [], error: null }),
      update: (value: Record<string, unknown>) => { writes.push({ table, value }); return query; },
      insert: async (value: Record<string, unknown>) => { writes.push({ table, value }); return { error: null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return query;
  });
  const createClient = vi.fn(() => ({ from, auth: { admin: {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-a' } }, error: null }),
    generateLink: vi.fn().mockResolvedValue({ data: { properties: { action_link: 'https://app.commandeici.com/admin/pizza-auxerre' } } }),
  } } }));
  const Stripe = vi.fn(function () { throw new Error('Stripe must stay unused during free access'); });
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8').replace(/^import .*;\n/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function('Deno', 'createClient', 'Stripe', 'requireSuperAdmin', 'fetch', 'FREE_ACCESS', 'freeAccessResponse', js)(
    { serve: (fn: Handler) => { handler = fn; }, env: { get: () => options.configured === false ? '' : 'fixture-only' } },
    createClient, Stripe, async () => options.admin === false ? null : { id: 'super-admin' }, fetcher, options.free ?? FREE_ACCESS, freeAccessResponse,
  );
  const request = (body: Record<string, unknown>, method = 'POST') => handler(new Request('https://fixture.supabase.co/functions/v1/test', { method, headers: { 'stripe-signature': 'fixture-signature' }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }));
  return { request, createClient, Stripe, writes, fetcher };
}
describe('free access blocks Stripe callback side effects', () => {
  it.each(['checkout.session.completed', 'customer.subscription.updated', 'invoice.payment_failed'])('acknowledges %s without creating Stripe/DB clients or calling providers', async type => {
    const f = fixture('stripe-webhooks'); const response = await f.request({ type });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ received: true, skipped: true, reason: 'currently_free' });
    expect(f.Stripe).not.toHaveBeenCalled(); expect(f.createClient).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });
  it('is inert even when Stripe secrets are absent', async () => {
    const f = fixture('stripe-webhooks', { configured: false }); expect((await f.request({ type: 'invoice.payment_failed' })).status).toBe(200); expect(f.Stripe).not.toHaveBeenCalled();
  });
});
describe('manual authorized prospect conversion uses the current free offer', () => {
  it('activates a prospect without an expiry regardless of a supplied bonus duration', async () => {
    const f = fixture('convert-prospect'); const response = await f.request({ restaurantId: 'restaurant-a', email: 'fixture@example.test', freeMonths: 999 });
    expect(response.status).toBe(200);
    expect(f.writes.find(write => write.table === 'restaurants')?.value).toMatchObject({ account_status: 'active', subscription_status: 'free', trial_end_date: null });
    const email = JSON.parse(f.fetcher.mock.calls[0][1].body);
    expect(email.html).toContain('gratuit actuellement'); expect(email.html).not.toMatch(/essai|4 semaines|expiration|bonus|gratuit à vie/i);
  });
  it('keeps the recap action without trial or expiry claims and without account activation', async () => {
    const f = fixture('convert-prospect'); expect((await f.request({ restaurantId: 'restaurant-a', email: 'fixture@example.test', action: 'recap' })).status).toBe(200);
    const email = JSON.parse(f.fetcher.mock.calls[0][1].body);
    expect(email.html).toContain('gratuit actuellement'); expect(email.html).not.toMatch(/essai|4 semaines|expiration|bonus|gratuit à vie/i);
    expect(f.writes.some(write => write.table === 'restaurants' || write.table === 'owners')).toBe(false);
  });
  it('preserves the super-admin guard before reads, writes or simulated emails', async () => {
    const f = fixture('convert-prospect', { admin: false }); expect((await f.request({ restaurantId: 'restaurant-a', email: 'fixture@example.test' })).status).toBe(403);
    expect(f.createClient).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('keeps the legacy trial behavior dormant for a separate future policy rollout', async () => {
    const f = fixture('convert-prospect', { free: false }); await f.request({ restaurantId: 'restaurant-a', email: 'fixture@example.test', freeMonths: 1 });
    expect(f.writes.find(write => write.table === 'restaurants')?.value).toMatchObject({ subscription_status: 'trial', trial_end_date: expect.any(String) });
    expect(JSON.parse(f.fetcher.mock.calls[0][1].body).html).toContain('Essai gratuit 4 semaines');
  });
});
