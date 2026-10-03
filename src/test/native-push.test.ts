import { describe, expect, it, vi } from 'vitest';
import { createNativePush, notificationRoute } from '@/services/native-push';
const user = '520191e5-1b13-4b56-8c69-ae36ac03df1b';
const token = 'a'.repeat(64);
function fixture(native = true) {
  const listeners: Record<string, (event: any) => void> = {};
  const sdk = { checkPermissions: vi.fn().mockResolvedValue({ receive: 'prompt' }), requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }), register: vi.fn().mockResolvedValue(undefined), unregister: vi.fn().mockResolvedValue(undefined), removeAllDeliveredNotifications: vi.fn().mockResolvedValue(undefined), addListener: vi.fn(async (event: string, callback: (event: any) => void) => { listeners[event] = callback; return { remove: vi.fn() }; }) };
  const register = vi.fn().mockResolvedValue(undefined), revoke = vi.fn().mockResolvedValue(undefined);
  let fStored: string | null = null;
  const storage = { getItem: vi.fn().mockImplementation(async () => fStored), setItem: vi.fn().mockImplementation(async (_key: string, value: string) => { fStored = value; }), removeItem: vi.fn().mockResolvedValue(undefined) };
  const push = createNativePush({ native, sdk, register, revoke, storage, environment: 'production', onChange: vi.fn() });
  return { push, sdk, register, revoke, listeners, storage };
}
describe('native order push', () => {
  it('never asks for OS permission automatically or for a guest', async () => {
    const f = fixture(); await f.push.sync(null); await f.push.enable();
    expect(f.sdk.checkPermissions).not.toHaveBeenCalled();
    await f.push.sync(user); expect(f.sdk.requestPermissions).not.toHaveBeenCalled(); expect(f.sdk.register).not.toHaveBeenCalled();
  });
  it('has no SDK effects on web', async () => { const f = fixture(false); await f.push.sync(user); await f.push.enable(); expect(f.sdk.addListener).not.toHaveBeenCalled(); });
  it('registers only after explicit consent and stores the token privately', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable();
    expect(f.sdk.requestPermissions).toHaveBeenCalledOnce(); expect(f.sdk.register).toHaveBeenCalledOnce();
    await f.listeners.registration({ value: token });
    expect(f.register).toHaveBeenCalledWith(token, 'production'); expect(f.storage.setItem).toHaveBeenCalledWith('commandeici_push_token', token);
  });
  it('does not register if logout happens while the OS permission dialog is open', async () => {
    const f = fixture(); let resolve!: (value: { receive: string }) => void;
    f.sdk.requestPermissions.mockImplementation(() => new Promise(done => { resolve = done; }));
    await f.push.sync(user); const enabling = f.push.enable(); await vi.waitFor(() => expect(resolve).toBeDefined());
    const logout = f.push.suspend(); resolve({ receive: 'granted' }); await enabling; await logout;
    expect(f.sdk.register).not.toHaveBeenCalled(); expect(f.push.status()).toBe('idle');
  });
  it('shows retry when APNs never returns a token', async () => {
    vi.useFakeTimers();
    try { const f = fixture(); await f.push.sync(user); await f.push.enable(); await vi.advanceTimersByTimeAsync(20001); expect(f.push.status()).toBe('error'); }
    finally { vi.useRealTimers(); }
  });
  it('respects denied permission and ignores malformed APNs tokens', async () => {
    const f = fixture(); f.sdk.requestPermissions.mockResolvedValue({ receive: 'denied' }); await f.push.sync(user); await f.push.enable(); expect(f.sdk.register).not.toHaveBeenCalled(); await f.listeners.registration({ value: 'email@example.com' }); expect(f.register).not.toHaveBeenCalled();
  });
  it('unregisters iOS and server before returning from logout preparation', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token });
    await f.push.suspend(); expect(f.sdk.unregister).toHaveBeenCalledOnce(); expect(f.sdk.removeAllDeliveredNotifications).toHaveBeenCalledOnce(); expect(f.revoke).toHaveBeenCalledWith(token); expect(f.storage.removeItem).toHaveBeenCalledWith('commandeici_push_token');
    await f.listeners.registration({ value: token }); expect(f.register).toHaveBeenCalledTimes(1);
  });
  it('surfaces backend failures and retries without reporting enabled', async () => {
    const f = fixture(); f.register.mockRejectedValueOnce(new Error('offline')); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token }); expect(f.push.status()).toBe('error'); await f.listeners.registration({ value: token }); expect(f.push.status()).toBe('enabled');
  });
  it('removes OS registration even if server revocation fails', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token }); f.revoke.mockRejectedValue(new Error('offline'));
    await expect(f.push.suspend()).rejects.toThrow('offline'); expect(f.sdk.unregister).toHaveBeenCalledOnce(); expect(f.push.status()).not.toBe('enabled');
  });
});
describe('notification destination', () => {
  it('accepts only a new-order notification for a current owned slug', () => {
    expect(notificationRoute({ type: 'new_order', restaurant_slug: 'chez-alice' }, ['chez-alice'])).toBe('/admin/chez-alice?view=cuisine');
    for (const data of [{ type: 'new_order', restaurant_slug: 'other' }, { type: 'new_order', restaurant_slug: '../other' }, { type: 'link', restaurant_slug: 'chez-alice' }, { type: 'new_order', url: 'https://evil.test', restaurant_slug: 'demo' }]) expect(notificationRoute(data, ['chez-alice'])).toBeNull();
  });
});
