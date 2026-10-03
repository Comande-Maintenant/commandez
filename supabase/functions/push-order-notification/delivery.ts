export interface PushJob {
  id: string; order_id: string; restaurant_id: string; restaurant_slug: string; token: string; lease: string;
}
export type PushResult = 'sent' | 'retry' | 'invalid_token' | 'failed' | 'cancelled';
export interface PushStore {
  claim(limit: number): Promise<PushJob[]>;
  authorize(job: PushJob): Promise<boolean>;
  finish(job: PushJob, result: PushResult, reason: string | null, retrySeconds: number): Promise<boolean>;
  wake?(): Promise<void>;
}
export interface PushConfig { cronSecret: string; privateKey: string; keyId: string; teamId: string; topic: string }
interface Dependencies { store: PushStore; fetcher?: typeof fetch; sign?: (config: PushConfig) => Promise<string> }
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function retryDelay(value: string | null): number {
  if (!value) return 60;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 86400)) : 60;
}
function base64url(bytes: Uint8Array): string {
  let binary = ''; for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
export async function signProviderToken(config: PushConfig): Promise<string> {
  const pem = config.privateKey.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const der = Uint8Array.from(atob(pem), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const text = new TextEncoder();
  const header = base64url(text.encode(JSON.stringify({ alg: 'ES256', kid: config.keyId })));
  const payload = base64url(text.encode(JSON.stringify({ iss: config.teamId, iat: Math.floor(Date.now() / 1000) })));
  const input = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text.encode(input)));
  if (signature.length !== 64) throw new Error('invalid_ES256_signature');
  return `${input}.${base64url(signature)}`;
}

export function createPushHandler(config: PushConfig, deps: Dependencies) {
  const fetcher = deps.fetcher ?? fetch;
  let cached: { token: string; until: number } | null = null;
  const providerToken = async () => {
    if (cached && cached.until > Date.now()) return cached.token;
    const token = await (deps.sign ?? signProviderToken)(config);
    cached = { token, until: Date.now() + 50 * 60 * 1000 }; return token;
  };
  const record = async (job: PushJob, result: PushResult, reason: string | null = null, retrySeconds = 60) => {
    const saved = await deps.store.finish(job, result, reason, retrySeconds);
    if (!saved) return 'stale';
    return result;
  };
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (config.cronSecret.length < 32) return json(503, { error: 'push_not_configured' });
    // Compare fixed-length digests to avoid exposing secret-prefix timing.
    const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [expected, supplied] = await Promise.all([digest(config.cronSecret), digest(request.headers.get('x-cron-secret') ?? '')]);
    let difference = 0; for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ supplied[i];
    if (difference) return json(401, { error: 'unauthorized' });
    if (!config.privateKey || config.keyId !== '6D52537PYB' || config.teamId !== '889YAF54QV' || config.topic !== 'com.commandeici.app') return json(503, { error: 'push_not_configured' });
    try {
      // Validate signing before claiming jobs: missing/broken config leaves the queue untouched.
      const bearer = await providerToken();
      const started = Date.now();
      let claimed = 0;
      let lastBatchFull = false;
      const results: Record<string, number> = {};
      // Stop reserving early enough to finish a claimed batch: each production
      // claim/authorize/APNs/receipt RPC is bounded to 5s, including a failed
      // receipt's retry. Four concurrent jobs leave at most 25s after claim start.
      while (claimed < 100 && Date.now() - started < 5000) {
      const jobs = await deps.store.claim(Math.min(4, 100 - claimed));
      claimed += jobs.length;
      lastBatchFull = jobs.length === 4;
      if (!jobs.length) break;
      let cursor = 0;
      const consume = async () => {
        while (cursor < jobs.length) {
          // A durable lease already exists. Finish every reserved job even when
          // claim crossed the reservation deadline, rather than parking it 120s.
          const job = jobs[cursor++];
          let result: string;
          try {
            if (!/^[a-f0-9]{64}$/.test(job.token)) result = await record(job, 'invalid_token', 'invalid_token_shape');
            else if (!await deps.store.authorize(job)) result = await record(job, 'cancelled', 'recipient_changed');
            else {
              const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
              try {
                const response = await fetcher(`https://api.push.apple.com/3/device/${job.token}`, {
                  method: 'POST', redirect: 'error', signal: controller.signal,
                  headers: { authorization: `bearer ${bearer}`, 'Content-Type': 'application/json', 'apns-topic': config.topic,
                    'apns-id': job.id, 'apns-collapse-id': job.order_id, 'apns-push-type': 'alert', 'apns-priority': '10',
                    'apns-expiration': String(Math.floor(Date.now() / 1000) + 300) },
                  body: JSON.stringify({ aps: { alert: { title: 'CommandeIci', body: 'Nouvelle commande à traiter' }, sound: 'default' },
                    type: 'new_order', restaurant_slug: job.restaurant_slug, restaurant_id: job.restaurant_id, order_id: job.order_id }),
                });
                if (response.status === 200) result = await record(job, 'sent');
                else {
                  const body = await response.json().catch(() => null);
                  const reason = typeof body?.reason === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(body.reason) ? body.reason : `APNs_${response.status}`;
                  if (response.status === 410 || (response.status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(reason))) result = await record(job, 'invalid_token', reason);
                  else if (response.status === 429 || response.status === 408 || response.status >= 500) result = await record(job, 'retry', reason, retryDelay(response.headers.get('retry-after')));
                  else result = await record(job, 'failed', reason);
                }
              } finally { clearTimeout(timer); }
            }
          } catch {
            // A failed receipt leaves the lease durable for a later worker to recover.
            try { result = await record(job, 'retry', 'network_error'); } catch { result = 'receipt_pending'; }
          }
          results[result] = (results[result] ?? 0) + 1;
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, consume));
      if (!lastBatchFull) break;
      }
      // Coalesced database dispatch continues a full queue without waiting for five cron cycles.
      // Leave 5s for the continuation RPC; cron is the fallback beyond this.
      if (lastBatchFull && Date.now() - started < 25000 && deps.store.wake) await deps.store.wake().catch(() => {});
      return json(200, { claimed, results });
    } catch { return json(503, { error: 'push_worker_unavailable' }); }
  };
}
