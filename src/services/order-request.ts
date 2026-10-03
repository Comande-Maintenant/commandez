import { randomUuid } from '@/lib/uuid';
const fallback = new Map<string, { fingerprint: string; id: string }>();
const keyFor = (restaurant: string, account: string) => `commandeici_order_request:${account}:${restaurant}`;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export async function checkoutRequestId(payload: { restaurant_id: string; [key: string]: unknown }, account: string): Promise<string> {
  const key = keyFor(payload.restaurant_id, account);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(payload))));
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  let saved = fallback.get(key);
  try { saved = JSON.parse(sessionStorage.getItem(key) || 'null') || saved; } catch { /* use memory if storage is unavailable */ }
  if (saved?.fingerprint === fingerprint && /^[0-9a-f-]{36}$/i.test(saved.id)) return saved.id;
  const next = { fingerprint, id: randomUuid() };
  fallback.set(key, next);
  try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* no customer details are persisted */ }
  return next.id;
}
export function clearCheckoutRequest(restaurant: string, account: string) {
  const key = keyFor(restaurant, account);
  fallback.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* memory cleared */ }
}
