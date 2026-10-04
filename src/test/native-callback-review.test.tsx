vi.mock('@/context/CartContext', () => ({useCart:()=>({restaurantId:null})}));
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ app: vi.fn(), launch: vi.fn(), session: vi.fn(), exchange: vi.fn(), navigate: vi.fn() }));
vi.mock('@/lib/native', async importOriginal => ({ ...await importOriginal<object>(), isNative: () => true }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({pathname:'/'}) }));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.app, getLaunchUrl: mocks.launch } }));
vi.mock('@capacitor/network', () => ({ Network: { getStatus: vi.fn().mockResolvedValue({ connected: true }), addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { setSession: mocks.session, exchangeCodeForSession: mocks.exchange, startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() } } }));
import { NativeLifecycle } from '@/components/NativeLifecycle';
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
beforeEach(() => {
  vi.clearAllMocks(); mocks.navigate = vi.fn(); mocks.app.mockResolvedValue({ remove: vi.fn() }); mocks.launch.mockResolvedValue(null);
  mocks.session.mockResolvedValue({ error: null }); mocks.exchange.mockResolvedValue({ error: null });
});
afterEach(cleanup);
describe('independent native callback characterization', () => {
  it('keeps launch listeners stable across navigation and uses the latest router callback', async () => {
    mocks.launch.mockResolvedValue({ url: 'https://app.commandeici.com/cafe-auxerre' });
    const { rerender } = render(<NativeLifecycle />); await flush();
    expect(mocks.launch).toHaveBeenCalledOnce();
    const latestNavigate = vi.fn(); mocks.navigate = latestNavigate;
    rerender(<NativeLifecycle />); await flush();
    expect(mocks.launch).toHaveBeenCalledOnce();
    expect(mocks.app).toHaveBeenCalledTimes(2);
    expect(latestNavigate).not.toHaveBeenCalled();
    await act(async () => mocks.app.mock.calls.find(call => call[0] === 'appUrlOpen')![1]({ url: 'https://app.commandeici.com/autre-cafe-paris' }));
    expect(latestNavigate).toHaveBeenLastCalledWith('/autre-cafe-paris', { replace: true });
  });
  it('refuses implicit tokens from a public restaurant URL', async () => {
    render(<NativeLifecycle />); await flush();
    await act(async () => mocks.app.mock.calls.find(call => call[0] === 'appUrlOpen')![1]({ url: 'https://app.commandeici.com/public-restaurant#access_token=foreign-access&refresh_token=foreign-refresh' }));
    await flush();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('exchanges a duplicated launch and URL event once and preserves success', async () => {
    const url = 'commandeici://auth/profil?code=one-use-code';
    mocks.launch.mockResolvedValue({ url });
    mocks.exchange.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('code already used') });
    render(<NativeLifecycle />); await flush();
    await act(async () => mocks.app.mock.calls.find(call => call[0] === 'appUrlOpen')![1]({ url }));
    await flush();
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenLastCalledWith('/profil', { replace: true });
  });
  it('refuses implicit tokens even on an explicit native callback', async () => {
    mocks.launch.mockResolvedValue({ url: 'commandeici://auth/order#access_token=x&refresh_token=y' });
    render(<NativeLifecycle />); await flush();
    expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('does not exchange a code attached to a public menu link', async () => {
    mocks.launch.mockResolvedValue({ url: 'https://app.commandeici.com/menu-auxerre?code=one-use-code' });
    render(<NativeLifecycle />); await flush();
    expect(mocks.exchange).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('handles a thrown code exchange error by showing the login route', async () => {
    mocks.launch.mockResolvedValue({ url: 'commandeici://auth/order?code=broken' });
    mocks.exchange.mockRejectedValue(new Error('offline'));
    render(<NativeLifecycle />); await flush();
    expect(mocks.navigate).toHaveBeenLastCalledWith('/connexion');
  });
});
