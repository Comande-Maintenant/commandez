import { createOrder } from '@/lib/api';
import { checkoutRequestId, clearCheckoutRequest } from '@/services/order-request';

const estimates = new Map<string, string>();

export async function submitPosOrder(payload: Parameters<typeof createOrder>[0], account: string, prepMinutes: number) {
  const scope = `pos:${account}`;
  const requestId = await checkoutRequestId({ ...payload, prepMinutes }, scope);
  const estimateKey = `commandeici_pos_estimate:${requestId}`;
  let estimatedReadyAt = estimates.get(requestId);
  try { estimatedReadyAt = sessionStorage.getItem(estimateKey) || estimatedReadyAt; } catch { /* memory fallback */ }
  if (!estimatedReadyAt || !Number.isFinite(Date.parse(estimatedReadyAt))) {
    estimatedReadyAt = new Date(Date.now() + prepMinutes * 60000).toISOString();
    estimates.set(requestId, estimatedReadyAt);
    try { sessionStorage.setItem(estimateKey, estimatedReadyAt); } catch { /* no customer information is persisted */ }
  }
  // A failed response keeps both ID and timestamp. The server rejects reuse with
  // a different payload, so recomputing Date.now() on retry would create a sale twice.
  const order = await createOrder({ ...payload, request_id: requestId, estimated_ready_at: estimatedReadyAt });
  clearCheckoutRequest(payload.restaurant_id, scope);
  estimates.delete(requestId);
  try { sessionStorage.removeItem(estimateKey); } catch { /* memory cleared */ }
  return order;
}
