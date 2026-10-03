import { describe, expect, it, vi } from 'vitest';
import { createPushHandler, retryDelay, signProviderToken } from '../../supabase/functions/push-order-notification/delivery';
const secret = 'qa-private-worker-secret-never-production';
const job = { id: 'd1800000-0000-4000-8000-000000000001', order_id: 'c1800000-0000-4000-8000-000000000001', restaurant_id: 'b1800000-0000-4000-8000-000000000001', restaurant_slug: 'pizza-auxerre', token: 'a'.repeat(64), lease: 'e1800000-0000-4000-8000-000000000001' };
const config = { cronSecret: secret, privateKey: 'test-only', keyId: '6D52537PYB', teamId: '889YAF54QV', topic: 'com.commandeici.app' };
const request = (header = secret) => new Request('https://test.supabase.co/functions/v1/push-order-notification', { method: 'POST', headers: { 'x-cron-secret': header } });
const fixture = (response: Response = new Response('', { status: 200 })) => {
 const store = { claim: vi.fn().mockResolvedValue([job]), authorize: vi.fn().mockResolvedValue(true), finish: vi.fn().mockResolvedValue(true) };
 const fetcher = vi.fn().mockResolvedValue(response); const sign = vi.fn().mockResolvedValue('fixture-jwt');
 return { store, fetcher, sign, handler: createPushHandler(config, { store, fetcher, sign }) };
};
describe('APNs production worker, fully simulated network', () => {
 it('refuses unknown cron callers before database access', async () => {
   const f = fixture(); expect((await f.handler(request('wrong'))).status).toBe(401); expect(f.store.claim).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
 });
 it('is inert without server APNs configuration', async () => {
   const f = fixture(); const handler = createPushHandler({ ...config, privateKey: '' }, f);
   expect((await handler(request())).status).toBe(503); expect(f.store.claim).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
 });
 it('uses the production gateway, stable APNs ID and generic payload with owner route fields', async () => {
   const f = fixture(); expect((await f.handler(request())).status).toBe(200);
   const [url, options] = f.fetcher.mock.calls[0]; expect(url).toBe(`https://api.push.apple.com/3/device/${job.token}`);
   expect(options.headers).toMatchObject({ 'apns-id': job.id, 'apns-topic': config.topic, 'apns-collapse-id': job.order_id, 'apns-push-type': 'alert' });
   const body = JSON.parse(options.body); expect(body).toMatchObject({ type: 'new_order', restaurant_slug: job.restaurant_slug, restaurant_id: job.restaurant_id, order_id: job.order_id, aps: { sound: 'default' } });
   expect(Object.keys(body).sort()).toEqual(['aps','order_id','restaurant_id','restaurant_slug','type']);
   expect(f.store.finish).toHaveBeenCalledWith(job, 'sent', null, 60);
 });
 it('never sends a lease invalidated by transfer, revoke or accepted order', async () => {
   const f = fixture(); f.store.authorize.mockResolvedValue(false); await f.handler(request()); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.store.finish).toHaveBeenCalledWith(job, 'cancelled', 'recipient_changed', 60);
 });
 it('disables a token after APNs 410', async () => {
   const f = fixture(new Response(JSON.stringify({ reason: 'Unregistered' }), { status: 410 })); await f.handler(request()); expect(f.store.finish).toHaveBeenCalledWith(job, 'invalid_token', 'Unregistered', 60);
 });
 it('stores a 429 retry using retry-after seconds', async () => {
   const f = fixture(new Response(JSON.stringify({ reason: 'TooManyRequests' }), { status: 429, headers: { 'retry-after': '123' } })); await f.handler(request()); expect(f.store.finish).toHaveBeenCalledWith(job, 'retry', 'TooManyRequests', 123);
 });
 it('retries provider 5xx without dropping the order', async () => {
   const f = fixture(new Response('{}', { status: 503 })); await f.handler(request()); expect(f.store.finish).toHaveBeenCalledWith(job, 'retry', 'APNs_503', 60);
 });
 it('retries network failure without leaking tokens in the response', async () => {
   const f = fixture(); f.fetcher.mockRejectedValue(new Error('network-secret')); const response = await f.handler(request()); expect(f.store.finish).toHaveBeenCalledWith(job, 'retry', 'network_error', 60); expect(await response.text()).not.toContain('network-secret');
 });
 it('uses a finite request timeout and fails permanent APNs rejection', async () => {
   const f = fixture(new Response(JSON.stringify({ reason: 'BadTopic' }), { status: 400 })); await f.handler(request()); expect(f.fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal); expect(f.store.finish).toHaveBeenCalledWith(job, 'failed', 'BadTopic', 60);
 });
 it('rejects attempts to configure a different topic or signing identity', async () => {
   const f = fixture(); expect((await createPushHandler({ ...config, topic: 'foreign.app' }, f)(request())).status).toBe(503); expect(f.store.claim).not.toHaveBeenCalled();
 });
 it('bounds retry-after and supports dates', () => {
   expect(retryDelay('9999999')).toBe(86400); expect(retryDelay('junk')).toBe(60);
   expect(retryDelay(new Date(Date.now() + 90000).toUTCString())).toBeGreaterThanOrEqual(89);
 });
 it('signs a valid ES256 JWT using a fresh ephemeral key, never the Apple production key', async () => {
   const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
   const exported = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey));
   const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...exported))}\n-----END PRIVATE KEY-----`;
   const jwt = await signProviderToken({ ...config, privateKey: pem }); const [header, payload, signature] = jwt.split('.');
   const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
   expect(JSON.parse(new TextDecoder().decode(decode(header)))).toEqual({ alg: 'ES256', kid: config.keyId });
   expect(JSON.parse(new TextDecoder().decode(decode(payload))).iss).toBe(config.teamId);
   expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, decode(signature), new TextEncoder().encode(`${header}.${payload}`))).toBe(true);
 });
 it('keeps a durable pending receipt when database acknowledgement fails', async () => {
   const f = fixture(); f.store.finish.mockRejectedValue(new Error('database offline')); const response = await f.handler(request());
   expect(await response.json()).toMatchObject({ results: { receipt_pending: 1 } }); expect(f.fetcher).toHaveBeenCalledTimes(1);
 });
 it('does not claim jobs if the signing key is broken', async () => {
   const f = fixture(); f.sign.mockRejectedValue(new Error('bad key')); expect((await f.handler(request())).status).toBe(503); expect(f.store.claim).not.toHaveBeenCalled();
 });
 it('drains 100 queued notifications in bounded batches and schedules continuation', async () => {
   const f = fixture(); const wake = vi.fn().mockResolvedValue(undefined);
   let index = 0;
   f.store.claim.mockImplementation(async () => Array.from({ length: 4 }, () => ({ ...job, id: `d1800000-0000-4000-8000-${String(++index).padStart(12, '0')}` })));
   const handler = createPushHandler(config, { ...f, store: { ...f.store, wake } });
   expect(await (await handler(request())).json()).toMatchObject({ claimed: 100, results: { sent: 100 } });
   expect(f.store.claim).toHaveBeenCalledTimes(25); expect(f.fetcher).toHaveBeenCalledTimes(100); expect(wake).toHaveBeenCalledTimes(1);
 });
 it('bounds a slow 100-job queue before reserving more devices and preserves the recovery wake', async () => {
   const f = fixture(); const wake = vi.fn().mockResolvedValue(undefined);
   let now = 0; vi.spyOn(Date, 'now').mockImplementation(() => now);
   f.store.claim.mockResolvedValue(Array.from({ length: 4 }, () => job));
   f.store.authorize.mockImplementation(async () => { now += 5000; return true; });
   const handler = createPushHandler(config, { ...f, store: { ...f.store, wake } });
   const response = await handler(request());
   expect((await response.json()).claimed).toBe(4); expect(f.store.claim).toHaveBeenCalledTimes(1);
   expect(wake).toHaveBeenCalledTimes(1); vi.restoreAllMocks();
 });
});
