import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/api', () => ({ createOrder: mocks.create }));
import { submitPosOrder } from '@/services/pos-order-request';
const payload = { restaurant_id: 'restaurant-a', customer_name: 'Table 1', customer_phone: '', order_type: 'sur_place', source: 'pos', items: [{ id: 'item-a', quantity: 1 }], subtotal: 10, total: 10 };
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('crypto', webcrypto); sessionStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('POS retries without duplicate sales', () => {
  it('reuses the exact request ID and preparation time after an ambiguous timeout', async () => {
    mocks.create.mockRejectedValueOnce(new Error('response lost')).mockResolvedValue({ id: 'existing' });
    await expect(submitPosOrder(payload, 'owner-a', 15)).rejects.toThrow('response lost');
    vi.advanceTimersByTime(60000);
    await submitPosOrder(payload, 'owner-a', 15);
    const [first, second] = mocks.create.mock.calls.map(call => call[0]);
    expect(first.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toEqual(first);
  });

  it('gives an identical new sale a new request ID after confirmed success', async () => {
    mocks.create.mockResolvedValue({ id: 'confirmed' });
    await submitPosOrder(payload, 'owner-a', 15);
    await submitPosOrder(payload, 'owner-a', 15);
    const [first, second] = mocks.create.mock.calls.map(call => call[0]);
    expect(first.request_id).toBeTruthy();
    expect(first.request_id).not.toBe(second.request_id);
  });

  it('keeps retries distinct across merchants and owners', async () => {
    mocks.create.mockRejectedValue(new Error('network'));
    await submitPosOrder(payload, 'owner-a', 15).catch(() => {});
    await submitPosOrder(payload, 'owner-b', 15).catch(() => {});
    await submitPosOrder({ ...payload, restaurant_id: 'restaurant-b' }, 'owner-a', 15).catch(() => {});
    expect(new Set(mocks.create.mock.calls.map(call => call[0].request_id)).size).toBe(3);
  });

  it('restores the same request and frozen estimate after module reload', async () => {
    mocks.create.mockRejectedValueOnce(new Error('lost response')).mockResolvedValue({ id: 'existing' });
    await submitPosOrder(payload, 'owner-reload', 15).catch(() => {});
    const first = mocks.create.mock.calls[0][0];
    vi.advanceTimersByTime(60000);
    vi.resetModules();
    const reloaded = await import('@/services/pos-order-request');
    await reloaded.submitPosOrder(payload, 'owner-reload', 15);
    expect(mocks.create.mock.calls[1][0]).toEqual(first);
  });
});
