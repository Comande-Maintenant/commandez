import { describe, expect, it, vi } from 'vitest';
import { createNativePush, notificationRoute } from '@/services/native-push';
const user = '520191e5-1b13-4b56-8c69-ae36ac03df1b';
const identity = { id: user, secret: 'b'.repeat(64) };
const token = 'a'.repeat(64);
function fixture(native = true, persisted = false) {
  const listeners: Record<string, (event: any) => void> = {};
  const sdk = { checkPermissions: vi.fn().mockResolvedValue({ receive: 'prompt' }), requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }), register: vi.fn().mockResolvedValue(undefined), unregister: vi.fn().mockResolvedValue(undefined), removeAllDeliveredNotifications: vi.fn().mockResolvedValue(undefined), addListener: vi.fn(async (event: string, callback: (event: any) => void) => { listeners[event] = callback; return { remove: vi.fn() }; }) };
  const initialize = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue(undefined), revoke = vi.fn().mockResolvedValue(undefined);
  let fStored: string | null = null;
  const storage = { getItem: vi.fn().mockImplementation(async () => fStored), setItem: vi.fn().mockImplementation(async (_key: string, value: string) => { fStored = value; }), removeItem: vi.fn().mockResolvedValue(undefined) };
  let created = persisted; let number = persisted ? 1 : 0; let currentIdentity = identity;
  const installation = vi.fn(async (create: boolean) => { if (create && !created) { created = true; number++; currentIdentity = number === 1 ? identity : { id: '620191e5-1b13-4b56-8c69-ae36ac03df1b', secret: 'c'.repeat(64) }; } return created ? currentIdentity : null; });
  const resetInstallation = vi.fn(async () => { created = false; });
  const onChange = vi.fn();
  const push = createNativePush({ native, sdk, register, revoke, storage, installation, initialize, resetInstallation, environment: 'production', onChange });
  return { push, sdk, register, revoke, listeners, storage, initialize, installation, resetInstallation, onChange };
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
    expect(f.register).toHaveBeenCalledWith(token, 'production', identity, expect.any(AbortSignal)); expect(f.storage.setItem).toHaveBeenCalledWith('commandeici_push_token', token);
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
  it('initializes the private installation before registering with Apple', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable();
    expect(f.initialize).toHaveBeenCalledOnce();
    expect(f.initialize.mock.invocationCallOrder[0]).toBeLessThan(f.sdk.register.mock.invocationCallOrder[0]);
  });
  it('rejects a late token when installation initialization failed', async () => {
    const f = fixture(); f.initialize.mockRejectedValue(new Error('offline')); await f.push.sync(user); await f.push.enable();
    expect(f.sdk.register).not.toHaveBeenCalled(); await f.listeners.registration({ value: token });
    expect(f.register).not.toHaveBeenCalled(); expect(f.push.status()).toBe('error');
  });
  it('never registers after logout overtakes an in-flight initialization', async () => {
    const f = fixture(); let resolve!: () => void;
    f.initialize.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    await f.push.sync(user); const enabling = f.push.enable(); await vi.waitFor(() => expect(resolve).toBeDefined());
    const logout = f.push.suspend(); resolve(); await enabling; await logout;
    expect(f.sdk.register).not.toHaveBeenCalled(); expect(f.revoke).toHaveBeenCalledOnce(); expect(f.resetInstallation).toHaveBeenCalled();
  });
  it('invalidates the old account immediately while installation initialization is in flight', async () => {
    const f = fixture(); f.sdk.checkPermissions.mockResolvedValue({ receive: 'granted' });
    let release!: () => void;
    f.initialize.mockImplementationOnce(() => new Promise<void>(done => { release = done; }));
    const first = f.push.sync(user); await vi.waitFor(() => expect(release).toBeDefined());
    const second = f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b');
    expect(f.push.status()).toBe('idle');
    release(); await first; await second;
    expect(f.sdk.register).toHaveBeenCalledOnce();
    expect(f.revoke).toHaveBeenCalledOnce();
    await f.push.dispose();
  });
  it('does not announce the old account enabled after a switch overtakes token registration', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable();
    let release!: () => void;
    f.register.mockImplementationOnce(() => new Promise<void>(done => { release = done; }));
    const tokenRegistration = f.listeners.registration({ value: token });
    await vi.waitFor(() => expect(release).toBeDefined());
    const switched = f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b');
    expect(f.push.status()).toBe('idle');
    release(); await tokenRegistration; await switched;
    expect(f.onChange).not.toHaveBeenCalledWith('enabled');
    expect(f.revoke).toHaveBeenCalledOnce();
    await f.push.dispose();
  });
  it('skips an intermediate queued account when A to B to C overtakes bootstrap', async () => {
    const f = fixture(); f.sdk.checkPermissions.mockResolvedValue({ receive: 'granted' });
    let release!: () => void;
    f.initialize.mockImplementationOnce(() => new Promise<void>(done => { release = done; }));
    const first = f.push.sync(user); await vi.waitFor(() => expect(release).toBeDefined());
    const second = f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b');
    const third = f.push.sync('720191e5-1b13-4b56-8c69-ae36ac03df1b');
    release(); await first; await second; await third;
    expect(f.sdk.register).toHaveBeenCalledOnce();
    expect(f.initialize).toHaveBeenCalledTimes(2);
    expect(f.revoke).toHaveBeenCalledOnce();
    await f.listeners.registration({ value: 'c'.repeat(64) });
    expect(f.register).toHaveBeenCalledOnce(); expect(f.push.status()).toBe('enabled');
    await f.push.dispose();
  });
  it('cleans up before returning to A when a queued B has already become stale', async () => {
    const f = fixture(); f.sdk.checkPermissions.mockResolvedValue({ receive: 'granted' });
    await f.push.sync(user); await f.listeners.registration({ value: token });
    const second = f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b');
    const returned = f.push.sync(user);
    await second; await returned;
    expect(f.revoke).toHaveBeenCalledOnce();
    expect(f.sdk.register).toHaveBeenCalledTimes(2);
    expect(f.push.status()).toBe('enabling');
    await f.push.dispose();
  });
  it('resumes A even when superseded B already started revoking the old installation', async () => {
    const f = fixture(); f.sdk.checkPermissions.mockResolvedValue({ receive: 'granted' });
    await f.push.sync(user); await f.listeners.registration({ value: token });
    let release!: () => void;
    f.revoke.mockImplementationOnce(() => new Promise<void>(done => { release = done; }));
    const second = f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b');
    await vi.waitFor(() => expect(release).toBeDefined());
    const returned = f.push.sync(user);
    release(); await second; await returned;
    expect(f.sdk.register).toHaveBeenCalledTimes(2);
    expect(f.push.status()).toBe('enabling');
    await f.push.dispose();
  });
  it('does not bootstrap an old account after its permission lookup resolves', async () => {
    const f = fixture(); f.sdk.checkPermissions.mockResolvedValue({ receive: 'granted' });
    let release!: (value: { receive: string }) => void;
    f.sdk.checkPermissions.mockImplementationOnce(() => new Promise(done => { release = done; }));
    const first = f.push.sync(user); await vi.waitFor(() => expect(release).toBeDefined());
    const second = f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b');
    release({ receive: 'granted' }); await first; await second;
    expect(f.initialize).toHaveBeenCalledOnce(); expect(f.sdk.register).toHaveBeenCalledOnce();
    await f.push.dispose();
  });
  it('retries unconfirmed cleanup for the latest queued identity without publishing stale errors', async () => {
    const f = fixture(); f.sdk.checkPermissions.mockResolvedValue({ receive: 'granted' });
    await f.push.sync(user); await f.listeners.registration({ value: token });
    f.onChange.mockClear();
    let reject!: (error: Error) => void;
    f.revoke.mockImplementationOnce(() => new Promise<void>((_done, fail) => { reject = fail; }));
    const second = f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b');
    await vi.waitFor(() => expect(reject).toBeDefined());
    const third = f.push.sync('720191e5-1b13-4b56-8c69-ae36ac03df1b');
    reject(new Error('offline')); await second; await third;
    expect(f.revoke).toHaveBeenCalledTimes(2);
    expect(f.sdk.register).toHaveBeenCalledTimes(2);
    expect(f.onChange).not.toHaveBeenCalledWith('error');
    await f.listeners.registration({ value: 'c'.repeat(64) });
    expect(f.push.status()).toBe('enabled');
    await f.push.dispose();
  });
  it('rotates installation credentials after revocation before another account', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token });
    await f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b'); await f.push.enable();
    expect(f.initialize.mock.calls[1][0].id).not.toBe(f.initialize.mock.calls[0][0].id);
    expect(f.initialize.mock.calls[1][0].secret).not.toBe(f.initialize.mock.calls[0][0].secret);
  });
  it('respects denied permission and ignores malformed APNs tokens', async () => {
    const f = fixture(); f.sdk.requestPermissions.mockResolvedValue({ receive: 'denied' }); await f.push.sync(user); await f.push.enable(); expect(f.sdk.register).not.toHaveBeenCalled(); await f.listeners.registration({ value: 'email@example.com' }); expect(f.register).not.toHaveBeenCalled();
  });
  it('unregisters iOS and server before returning from logout preparation', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token });
    await f.push.suspend(); expect(f.sdk.unregister).toHaveBeenCalledOnce(); expect(f.sdk.removeAllDeliveredNotifications).toHaveBeenCalledOnce(); expect(f.revoke).toHaveBeenCalledWith(identity, expect.any(AbortSignal)); expect(f.storage.removeItem).toHaveBeenCalledWith('commandeici_push_token');
    await f.listeners.registration({ value: token }); expect(f.register).toHaveBeenCalledTimes(1);
  });
  it('surfaces backend failures and retries without reporting enabled', async () => {
    const f = fixture(); f.register.mockRejectedValueOnce(new Error('offline')); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token }); expect(f.push.status()).toBe('error'); await f.listeners.registration({ value: token }); expect(f.push.status()).toBe('enabled');
  });
  it('retries cold-start cleanup before enabling a device for a new merchant', async () => {
    const f = fixture(true, true); f.revoke.mockRejectedValueOnce(new Error('offline'));
    await f.push.sync(user); expect(f.push.status()).toBe('error'); expect(f.sdk.checkPermissions).not.toHaveBeenCalled();
    await f.push.enable(); expect(f.revoke).toHaveBeenCalledTimes(2); expect(f.sdk.register).toHaveBeenCalledOnce();
  });
  it('revokes a lost session installation and can resume after a failed logout', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token });
    f.revoke.mockRejectedValueOnce(new Error('offline')); await expect(f.push.suspend()).rejects.toThrow('offline');
    await f.push.sync(user); await f.push.enable(); expect(f.sdk.register).toHaveBeenCalledTimes(2);
    await f.push.sync(null); expect(f.revoke).toHaveBeenCalledTimes(3); expect(f.push.status()).toBe('idle');
  });
  it('revokes the old installation before another account registers a different token', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token });
    await f.push.sync('620191e5-1b13-4b56-8c69-ae36ac03df1b'); await f.push.enable(); await f.listeners.registration({ value: 'c'.repeat(64) });
    expect(f.revoke).toHaveBeenCalledOnce(); expect(f.register).toHaveBeenCalledTimes(2);
    expect(f.revoke.mock.invocationCallOrder[0]).toBeLessThan(f.register.mock.invocationCallOrder[1]);
  });
  it('aborts a hanging backend request and releases the serial queue for retry', async () => {
    const f = fixture(); let signal: AbortSignal | undefined;
    f.register.mockImplementationOnce(async (_token, _env, _identity, requestSignal) => { signal = requestSignal; await new Promise(() => {}); });
    await f.push.sync(user); await f.push.enable(); vi.useFakeTimers();
    try {
      const pending = f.listeners.registration({ value: token }); await vi.advanceTimersByTimeAsync(10001); await pending;
      expect(signal!.aborted).toBe(true); expect(f.push.status()).toBe('error');
      await f.listeners.registration({ value: token }); expect(f.push.status()).toBe('enabled');
    } finally { vi.useRealTimers(); }
  });
  it('still revokes on the server when iOS cleanup fails', async () => {
    const f = fixture(); await f.push.sync(user); await f.push.enable(); await f.listeners.registration({ value: token });
    f.sdk.unregister.mockRejectedValueOnce(new Error('native cleanup failed'));
    await expect(f.push.suspend()).rejects.toThrow('native cleanup failed');
    expect(f.revoke).toHaveBeenCalledOnce(); expect(f.sdk.removeAllDeliveredNotifications).toHaveBeenCalledOnce();
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
