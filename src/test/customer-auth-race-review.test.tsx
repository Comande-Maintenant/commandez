import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), change: vi.fn(), signOut: vi.fn(), getProfile: vi.fn(), upsert: vi.fn(), link: vi.fn(), signIn: vi.fn(), suspend: vi.fn(), rpc: vi.fn() }));
vi.mock('@/services/native-push-client', () => ({ suspendNativePushBeforeSignOut: mocks.suspend }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, auth: { getSession: mocks.getSession, onAuthStateChange: mocks.change, signOut: mocks.signOut, signInWithPassword: mocks.signIn } } }));
vi.mock('@/lib/api', () => ({ fetchCustomerProfile: mocks.getProfile, upsertCustomerProfile: mocks.upsert, linkOrdersToUser: mocks.link, updateCustomerProfile: vi.fn() }));
vi.mock('@/services/account-registration', () => ({ registerCustomer: vi.fn() }));
vi.mock('@/lib/native', () => ({ authRedirectUrl: (path: string) => path }));
import { CustomerAuthProvider, useCustomerAuth } from '@/context/CustomerAuthContext';
const user = (id: string) => ({ id, email: `${id}@example.test`, email_confirmed_at: '2026-10-03', user_metadata: { role: 'customer' } });
const profile = (id: string) => ({ id, email: `${id}@example.test`, name: id, phone: '0600000000' });
const flush = async () => { await act(async () => { await Promise.resolve(); vi.runOnlyPendingTimers(); await Promise.resolve(); }); };
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); localStorage.clear();
  mocks.change.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.suspend.mockResolvedValue(undefined);
  mocks.rpc.mockResolvedValue({ data: { deleted: true }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getSession.mockResolvedValue({ data: { session: { user: user('client-a') } } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const wrapper = ({ children }: { children: React.ReactNode }) => <CustomerAuthProvider>{children}</CustomerAuthProvider>;
describe('Customer profile ownership during auth changes', () => {
  it('does not restore the previous customer profile after account B signs in', async () => {
    let resolveA!: (value: unknown) => void;
    mocks.getProfile.mockImplementation((id) => id === 'client-a' ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve(profile('client-b')));
    const { result } = renderHook(useCustomerAuth, { wrapper });
    await flush();
    act(() => mocks.change.mock.calls[0][0]('SIGNED_IN', { user: user('client-b') }));
    await flush();
    expect(result.current.profile?.id).toBe('client-b');
    await act(async () => resolveA(profile('client-a')));
    expect(result.current.user?.id).toBe('client-b');
    expect(result.current.profile?.id).toBe('client-b');
    expect(JSON.parse(localStorage.getItem('cm_customer')!).email).toBe('client-b@example.test');
  });
  it('does not restore a customer profile or cache after sign-out', async () => {
    let resolveA!: (value: unknown) => void;
    mocks.getProfile.mockImplementation(() => new Promise(resolve => { resolveA = resolve; }));
    const { result } = renderHook(useCustomerAuth, { wrapper });
    await flush();
    act(() => mocks.change.mock.calls[0][0]('SIGNED_OUT', null));
    await flush();
    await act(async () => resolveA(profile('client-a')));
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem('cm_customer')).toBeNull();
  });
  it('does not allow a delayed initial session read to replace a newer authenticated account', async () => {
    let initial!: (value: unknown) => void;
    mocks.getSession.mockImplementation(() => new Promise(resolve => { initial = resolve; }));
    mocks.getProfile.mockImplementation((id) => Promise.resolve(profile(id)));
    const { result } = renderHook(useCustomerAuth, { wrapper });
    act(() => mocks.change.mock.calls[0][0]('SIGNED_IN', { user: user('client-b') }));
    await flush();
    await act(async () => initial({ data: { session: { user: user('client-a') } } }));
    expect(result.current.user?.id).toBe('client-b');
    expect(result.current.profile?.id).toBe('client-b');
  });
  it('keeps a valid profile when preferences storage is unavailable', async () => {
    mocks.getProfile.mockResolvedValue(profile('client-a'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
    const { result } = renderHook(useCustomerAuth, { wrapper });
    await flush();
    expect(result.current.profile?.id).toBe('client-a');
    expect(result.current.isLoggedIn).toBe(true);
  });
  it('does not restore an old sign-in response after a newer account event', async () => {
    let resolveSignIn!: (value: unknown) => void;
    mocks.signIn.mockImplementation(() => new Promise(resolve => { resolveSignIn = resolve; }));
    mocks.getProfile.mockImplementation((id) => Promise.resolve(profile(id)));
    const { result } = renderHook(useCustomerAuth, { wrapper });
    await flush();
    let pending!: Promise<void>;
    act(() => { pending = result.current.signIn('client-a@example.test', 'password'); });
    act(() => mocks.change.mock.calls[0][0]('SIGNED_IN', { user: user('client-b') }));
    await flush();
    await act(async () => { resolveSignIn({ data: { user: user('client-a') }, error: null }); await pending; });
    expect(result.current.user?.id).toBe('client-b');
    expect(result.current.profile?.id).toBe('client-b');
  });
  it('still rejects a merchant after its auth event arrives before sign-in resolves', async () => {
    let resolveSignIn!: (value: unknown) => void;
    mocks.signIn.mockImplementation(() => new Promise(resolve => { resolveSignIn = resolve; }));
    mocks.getProfile.mockImplementation((id) => Promise.resolve(profile(id)));
    const { result } = renderHook(useCustomerAuth, { wrapper }); await flush();
    let pending!: Promise<void>;
    act(() => { pending = result.current.signIn('merchant@example.test', 'password'); });
    const merchant = { ...user('merchant'), user_metadata: { role: 'owner' } };
    act(() => mocks.change.mock.calls[0][0]('SIGNED_IN', { user: merchant }));
    await act(async () => { resolveSignIn({ data: { user: merchant }, error: null }); await expect(pending).rejects.toThrow('restaurateur'); });
    expect(result.current.user).toBeNull(); expect(mocks.signOut).toHaveBeenCalled();
  });
});


describe('Native cleanup before account mutations', () => {
  it('retains session and cache on cleanup failure and permits a logout retry', async () => {
    mocks.getProfile.mockResolvedValue(profile('client-a'));
    const { result } = renderHook(useCustomerAuth, { wrapper }); await flush();
    mocks.suspend.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await expect(result.current.signOut()).rejects.toThrow('offline'); });
    expect(result.current.user?.id).toBe('client-a');
    expect(result.current.profile?.id).toBe('client-a');
    expect(localStorage.getItem('cm_customer')).not.toBeNull();
    expect(mocks.signOut).not.toHaveBeenCalled();
    await act(async () => { await result.current.signOut(); });
    expect(mocks.suspend).toHaveBeenCalledTimes(2);
    expect(mocks.suspend.mock.invocationCallOrder[1]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
    expect(result.current.user).toBeNull();
  });
  it('blocks account deletion while cleanup fails, then deletes only after successful cleanup', async () => {
    mocks.getProfile.mockResolvedValue(profile('client-a'));
    const { result } = renderHook(useCustomerAuth, { wrapper }); await flush();
    mocks.suspend.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await expect(result.current.deleteAccount()).rejects.toThrow('offline'); });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result.current.isLoggedIn).toBe(true);
    await act(async () => { await result.current.deleteAccount(); });
    expect(mocks.suspend.mock.invocationCallOrder[1]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
    expect(result.current.user).toBeNull();
  });
  it('does not log out account B if it arrives during cleanup of account A', async () => {
    mocks.getProfile.mockImplementation(id => Promise.resolve(profile(id)));
    let finish!: () => void;
    mocks.suspend.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const { result } = renderHook(useCustomerAuth, { wrapper }); await flush();
    let pending!: Promise<void>;
    act(() => { pending = result.current.signOut(); });
    act(() => mocks.change.mock.calls[0][0]('SIGNED_IN', { user: user('client-b') })); await flush();
    await act(async () => { finish(); await pending; });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(result.current.user?.id).toBe('client-b');
  });
});
