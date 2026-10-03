import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardParametres } from '@/components/dashboard/DashboardParametres';
import type { DbRestaurant } from '@/types/database';
const mocks = vi.hoisted(() => ({ suspend: vi.fn(), signOut: vi.fn(), getUser: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/native-push-client', () => ({ suspendNativePushBeforeSignOut: mocks.suspend }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signOut: mocks.signOut, getUser: mocks.getUser } } }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, language: 'fr' }) }));
vi.mock('@/components/auth/DeleteAccountButton', () => ({ DeleteAccountButton: () => null }));
vi.mock('@/components/dashboard/referral/ReferralSection', () => ({ ReferralSection: () => null }));
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }));
const restaurant = { id: 'r1', owner_id: 'owner-a', name: 'Chez Alice', schedule: [], is_accepting_orders: true } as unknown as DbRestaurant;
beforeEach(() => { vi.clearAllMocks(); mocks.suspend.mockResolvedValue(undefined); mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } }, error: null }); mocks.signOut.mockResolvedValue({ error: new Error('auth offline') }); });
afterEach(cleanup);
describe('Merchant logout cleanup', () => {
  it('keeps the merchant session when cleanup fails and lets the owner retry', async () => {
    mocks.suspend.mockRejectedValueOnce(new Error('push offline'));
    render(<MemoryRouter><DashboardParametres restaurant={restaurant} /></MemoryRouter>);
    const logout = screen.getByRole('button', { name: 'dashboard.settings.logout' });
    fireEvent.click(logout);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(logout).not.toBeDisabled();
    fireEvent.click(logout);
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(mocks.suspend.mock.invocationCallOrder[1]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
  });
  it('prevents a second logout while native cleanup is still pending', async () => {
    mocks.suspend.mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><DashboardParametres restaurant={restaurant} /></MemoryRouter>);
    const logout = screen.getByRole('button', { name: 'dashboard.settings.logout' });
    fireEvent.click(logout);
    expect(logout).toBeDisabled();
    fireEvent.click(logout);
    expect(mocks.suspend).toHaveBeenCalledOnce();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it('does not sign out a different owner connected during cleanup', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-b' } }, error: null });
    render(<MemoryRouter><DashboardParametres restaurant={restaurant} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'dashboard.settings.logout' }));
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

});
