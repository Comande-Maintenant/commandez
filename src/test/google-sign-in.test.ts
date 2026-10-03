import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ oauth: vi.fn(), native: vi.fn(), redirect: vi.fn((p: string) => `https://app.commandeici.com${p}`), open: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithOAuth: mocks.oauth } } }));
vi.mock('@/lib/native', () => ({ isNative: mocks.native, authRedirectUrl: mocks.redirect, openExternalUrl: mocks.open }));
import { signInWithGoogle } from '@/services/google-sign-in';
beforeEach(() => { vi.clearAllMocks(); mocks.native.mockReturnValue(false); });
it('keeps the checkout return route for web Google sign-in', async () => {
  mocks.oauth.mockResolvedValue({ data: { url: 'https://accounts.google.com/auth' }, error: null });
  await signInWithGoogle('/order');
  expect(mocks.oauth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://app.commandeici.com/order', skipBrowserRedirect: false } });
  expect(mocks.open).not.toHaveBeenCalled();
});
it('opens the native system browser for PKCE and propagates provider failures', async () => {
  mocks.native.mockReturnValue(true);
  mocks.oauth.mockResolvedValue({ data: { url: 'https://accounts.google.com/auth' }, error: null });
  await signInWithGoogle('/inscription');
  expect(mocks.oauth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ skipBrowserRedirect: true }) }));
  expect(mocks.open).toHaveBeenCalledWith('https://accounts.google.com/auth');
  mocks.oauth.mockResolvedValue({ data: {}, error: new Error('Provider disabled') });
  await expect(signInWithGoogle('/order')).rejects.toThrow('Provider disabled');
});
