import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { checkoutRequestId, clearCheckoutRequest } from '@/services/order-request';
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
it('keeps one request id for unchanged retries and reloads', async () => {
  const payload = { restaurant_id: 'a', total: 12, items: [{ id: 'pizza', quantity: 1 }] };
  const first = await checkoutRequestId(payload, 'client-a');
  expect(await checkoutRequestId(payload, 'client-a')).toBe(first);
  expect(await checkoutRequestId({ items: payload.items, total: 12, restaurant_id: 'a' }, 'client-a')).toBe(first);
});
it('isolates accounts and carts and starts a new purchase after success', async () => {
  const payload = { restaurant_id: 'a', total: 12 };
  const first = await checkoutRequestId(payload, 'client-a');
  expect(await checkoutRequestId(payload, 'client-b')).not.toBe(first);
  clearCheckoutRequest('a', 'client-a');
  expect(await checkoutRequestId(payload, 'client-a')).not.toBe(first);
  expect(await checkoutRequestId({ ...payload, total: 24 }, 'client-a')).not.toBe(first);
});
