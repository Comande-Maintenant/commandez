import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FREE_ACCESS, freeAccessResponse } from '../../supabase/functions/_shared/access-policy';
type Handler = (req: Request) => Promise<Response>;
const secret = 'fixture-shopify-secret-never-production';
const financial = ['subscription_activated', 'payment_failed', 'subscription_cancelled', 'trial_checkin', 'trial_expiring', 'trial_expired', 'trial_expired_relance1', 'trial_expired_relance2', 'trial_migration_30d', 'referral_completed_referrer', 'referral_completed_referee', 'promo_applied'];
function fixture(name: 'shopify-webhooks' | 'validate-promo' | 'send-email', authorized = true) {
  let handler!: Handler; const writes: unknown[] = [];
  const from = vi.fn((table: string) => {
    const query = { select: () => query, eq: () => query, in: () => query, order: () => query, gte: () => query,
      maybeSingle: async () => ({ data: table === 'restaurants' ? { id: 'restaurant-a' } : null, error: null }),
      single: async () => ({ data: table === 'promo_codes' ? { id: 'promo-a', type: 'free_trial_extension', value: 20, active: true, current_uses: 0 } : { id: 'subscription-a', restaurant_id: 'restaurant-a', name: 'QA', owners: { email: 'fixture@example.test' } }, error: null }),
      limit: async () => ({ data: [], error: null }),
      update: (value: unknown) => { writes.push({ table, value }); return query; },
      upsert: (value: unknown) => { writes.push({ table, value }); return query; },
      insert: async (value: unknown) => { writes.push({ table, value }); return { error: null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    }; return query;
  });
  const invoke = vi.fn().mockResolvedValue({ error: null });
  const createClient = vi.fn(() => ({ from, functions: { invoke } }));
  const fetcher = vi.fn().mockResolvedValue(new Response('{"id":"fixture-email"}', { status: 200 }));
  const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8').replace(/^import .*;\n/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function('Deno', 'serve', 'createClient', 'requireUser', 'isServiceRole', 'signToken', 'fetch', 'FREE_ACCESS', 'freeAccessResponse', js)(
    { serve: (fn: Handler) => { handler = fn; }, env: { get: (key: string) => key === 'SHOPIFY_WEBHOOK_SECRET' ? secret : 'fixture-only' } },
    (fn: Handler) => { handler = fn; }, createClient, async () => authorized ? { id: 'owner-a' } : null, () => authorized, async () => 'fixture-signature', fetcher, FREE_ACCESS, freeAccessResponse,
  );
  const request = (body: Record<string, unknown>, headers = {}) => handler(new Request('https://fixture.supabase.co/functions/v1/test', { method: 'POST', body: JSON.stringify(body), headers }));
  return { request, from, createClient, invoke, fetcher, writes };
}
async function hmac(body: Record<string, unknown>) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify(body))));
  return btoa(String.fromCharCode(...signature));
}
afterEach(() => vi.restoreAllMocks());
describe('Shopify callbacks keep authentication but have no free-offer side effects', () => {
  it.each(['subscription_contracts/create', 'orders/paid', 'subscription_billing_attempts/failure', 'subscription_contracts/update'])('skips %s before DB or emails', async topic => {
    const f = fixture('shopify-webhooks');
    const body = { id: 'contract-a', status: 'cancelled', subscription_contract_id: 'contract-a', note_attributes: [{ name: 'restaurant_id', value: 'restaurant-a' }], line_items: [{ selling_plan_allocation: {} }] };
    const response = await f.request(body, { 'x-shopify-topic': topic, 'x-shopify-hmac-sha256': await hmac(body) });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true, skipped: true, reason: 'currently_free' });
    expect(f.createClient).not.toHaveBeenCalled(); expect(f.invoke).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });
  it('still refuses an invalid HMAC before acknowledging the callback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = fixture('shopify-webhooks'); expect((await f.request({}, { 'x-shopify-hmac-sha256': 'invalid' })).status).toBe(401); expect(f.createClient).not.toHaveBeenCalled();
  });
});
describe('promo validation never grants a trial or bonus while access is free', () => {
  it('returns an explicit inactive promotion without reading promo records', async () => {
    const f = fixture('validate-promo'); const response = await f.request({ code: 'EXTRA20' });
    expect(await response.json()).toMatchObject({ valid: false, skipped: true, reason: 'currently_free' }); expect(f.createClient).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });
  it('preserves auth and missing-code validation', async () => {
    const denied = fixture('validate-promo', false); expect((await denied.request({ code: 'EXTRA20' })).status).toBe(401); expect(denied.createClient).not.toHaveBeenCalled();
    const missing = fixture('validate-promo'); expect(await (await missing.request({})).json()).toMatchObject({ valid: false, error: 'Code requis' });
  });
});
describe('central email does not deliver legacy financial promises', () => {
  it.each(financial)('blocks %s after request validation, before DB/email', async template => {
    const f = fixture('send-email'); const response = await f.request({ template, to: 'fixture@example.test', userId: 'owner-a', data: {} });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ skipped: true, reason: 'currently_free' });
    expect(f.createClient).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });
  it.each(['comeback_3days', 'comeback_7days'])('preserves %s as a free onboarding reminder with existing preference and logging flow', async template => {
    const f = fixture('send-email'); const response = await f.request({ template, to: 'fixture@example.test', userId: 'owner-a', data: {} });
    expect(response.status).toBe(200); expect(f.fetcher).toHaveBeenCalledTimes(1);
    const email = JSON.parse(f.fetcher.mock.calls[0][1].body); expect(email.html).toContain('gratuit actuellement'); expect(email.html).not.toMatch(/1 euro|29,99|semaines d'essai/i);
    expect(f.from).toHaveBeenCalledWith('user_email_preferences'); expect(f.writes).toContainEqual(expect.objectContaining({ table: 'email_logs' }));
  });
  it('preserves service-role and body validation before skip policy', async () => {
    const denied = fixture('send-email', false); expect((await denied.request({ template: 'payment_failed', to: 'fixture@example.test' })).status).toBe(403); expect(denied.fetcher).not.toHaveBeenCalled();
    const invalid = fixture('send-email'); expect((await invalid.request({ template: 'unknown', to: 'fixture@example.test' })).status).toBe(400); expect(invalid.fetcher).not.toHaveBeenCalled();
  });
});
