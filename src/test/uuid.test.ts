import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { randomUuid } from '@/lib/uuid';
import { checkoutRequestId, clearCheckoutRequest } from '@/services/order-request';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe('UUID compatibility with iOS 15.0', () => {
  it('uses the native generator when available', () => {
    const native = vi.fn(() => '12345678-1234-4234-8234-123456789abc');
    vi.stubGlobal('crypto', { randomUUID: native });
    expect(randomUuid()).toBe('12345678-1234-4234-8234-123456789abc');
    expect(native).toHaveBeenCalledOnce();
  });

  it('uses cryptographic bytes with version 4 and RFC variant bits when randomUUID is absent', () => {
    const bytes = vi.fn((buffer: Uint8Array) => buffer.fill(255));
    const weakRandom = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', { getRandomValues: bytes });
    expect(randomUuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(bytes).toHaveBeenCalledOnce();
    expect(weakRandom).not.toHaveBeenCalled();
  });

  it('generates distinct valid UUIDs without the native API', () => {
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    const values = Array.from({ length: 100 }, randomUuid);
    expect(new Set(values).size).toBe(100);
    expect(values.every(value => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))).toBe(true);
  });

  it('fails explicitly when no cryptographic generator exists', () => {
    vi.stubGlobal('crypto', undefined);
    expect(randomUuid).toThrow('Cryptographic random generation unavailable');
  });

  it('keeps checkout retries idempotent on iOS without randomUUID', async () => {
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle: webcrypto.subtle });
    const payload = { restaurant_id: 'uuid-compat-restaurant', total: 12 };
    clearCheckoutRequest(payload.restaurant_id, 'uuid-compat-user');
    const first = await checkoutRequestId(payload, 'uuid-compat-user');
    expect(await checkoutRequestId(payload, 'uuid-compat-user')).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    clearCheckoutRequest(payload.restaurant_id, 'uuid-compat-user');
  });
});
