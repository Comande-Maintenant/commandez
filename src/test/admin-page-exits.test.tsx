import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { DbRestaurant } from '@/types/database';
import fr from '@/i18n/fr.json';
import ar from '@/i18n/ar.json';

const mocks = vi.hoisted(() => ({
  restaurant: null as DbRestaurant | null,
  loading: false,
  restaurantError: false,
  authChecked: true,
  authError: null as string | null,
  authUserId: 'owner-a' as string | null,
  rtl: false,
  retry: vi.fn(),
  orders: vi.fn(() => ({ orders: [] })),
  updateRestaurant: vi.fn(),
}));
vi.mock('@/hooks/useDashboardRestaurant', () => ({ useDashboardRestaurant: () => ({
  restaurant: mocks.restaurant, loading: mocks.loading, error: mocks.restaurantError,
  retry: mocks.retry, setRestaurant: vi.fn(),
}) }));
vi.mock('@/hooks/useDashboardAuth', () => ({ useDashboardAuth: () => ({
  authChecked: mocks.authChecked, authError: mocks.authError, authUserId: mocks.authUserId,
}) }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({
  t: (key: string) => ((mocks.rtl ? ar : fr) as Record<string, string>)[key] ?? key,
  isRTL: mocks.rtl, language: mocks.rtl ? 'ar' : 'fr',
}) }));
vi.mock('@/hooks/useRestaurantOrders', () => ({ useRestaurantOrders: mocks.orders }));
vi.mock('@/hooks/useLiveVisitors', () => ({ useLiveVisitors: () => ({ visitors: [], alerts: [] }) }));
vi.mock('@/hooks/useNotificationSound', () => ({ useNotificationSound: () => ({ audioUnlocked: true, unlockAudio: vi.fn(), play: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ updateRestaurant: mocks.updateRestaurant }));
vi.mock('@/lib/native', () => ({ isNative: () => false }));
vi.mock('@/services/native-push-client', () => ({ nativePushStatus: () => 'disabled' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/DemoOrderControls', () => ({ DemoOrderControls: () => null }));
vi.mock('@/components/NativeOrderNotifications', () => ({ NativeOrderNotifications: () => null }));
vi.mock('@/components/dashboard/MerchantSetup', () => ({ MerchantSetup: () => null }));
vi.mock('@/components/dashboard/GererMenu', () => ({ GererMenu: () => null }));
vi.mock('@/components/dashboard/AdminSidebar', () => ({ AdminSidebar: () => null }));
vi.mock('@/components/dashboard/AdminBottomNav', () => ({ AdminBottomNav: () => null }));
vi.mock('@/components/dashboard/LiveSummaryBanner', () => ({ LiveSummaryBanner: () => null }));
vi.mock('@/components/dashboard/AssistantChatbot', () => ({ AssistantChatbot: () => null }));
vi.mock('@/components/dashboard/OnboardingTour', () => ({ OnboardingTour: () => null }));
vi.mock('@/components/dashboard/OrderHistorySheet', () => ({ OrderHistorySheet: () => null }));
vi.mock('@/components/auth/SubscriptionGate', () => ({ SubscriptionGate: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/dashboard/DashboardOrders', () => ({ DashboardOrders: () => null }));
vi.mock('@/components/restaurant/LanguageSelector', () => ({ LanguageSelector: () => null }));

import AdminPage from '@/pages/AdminPage';
import Index from '@/pages/Index';

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks, { restaurant: null, loading: false, restaurantError: false,
    authChecked: true, authError: null, authUserId: 'owner-a', rtl: false });
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

for (const state of ['loading', 'auth unavailable', 'login required', 'restaurant error', 'not found', 'access denied']) {
  it(`lets the merchant leave ${state} without completing auth or restaurant requests`, () => {
    const demo = state === 'loading' || state === 'restaurant error';
    if (state === 'loading') mocks.loading = true;
    if (state === 'auth unavailable') mocks.authError = 'unavailable';
    if (state === 'login required') mocks.authError = 'not_logged_in';
    if (state === 'restaurant error') mocks.restaurantError = true;
    if (state === 'access denied') {
      mocks.restaurant = { id: 'restaurant-a', owner_id: 'another-owner' } as DbRestaurant;
      mocks.rtl = true;
    }
    render(<MemoryRouter initialEntries={[demo ? '/admin/demo' : '/admin/chez-alice']}>
      <Routes>
        <Route path="/admin/:slug" element={<AdminPage />} />
        <Route path="/" element={<p>Accueil accessible</p>} />
        <Route path="/decouvrir" element={<p>Démos accessibles</p>} />
      </Routes>
    </MemoryRouter>);
    const back = screen.getByRole('button', { name: (mocks.rtl ? ar : fr)['nav.back'] });
    if (state === 'auth unavailable' || state === 'restaurant error') {
      expect(screen.getByRole('button', { name: fr['common.retry'] })).toBeEnabled();
    }
    if (state === 'login required' || state === 'not found' || state === 'access denied') {
      expect(screen.getByRole('link')).toHaveAttribute('href', '/connexion');
    }
    if (state === 'access denied') {
      expect(back.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(screen.getByText(ar['dashboard.admin.access_denied'])).toBeVisible();
      expect(mocks.orders).toHaveBeenCalledWith(null, expect.any(Object));
    }
    fireEvent.click(back);
    expect(screen.getByText(demo ? 'Démos accessibles' : 'Accueil accessible')).toBeVisible();
    expect(mocks.updateRestaurant).not.toHaveBeenCalled();
    expect(mocks.retry).not.toHaveBeenCalled();
  });
}

it('lets a signed-in merchant switch to browsing without modifying their account or orders', () => {
 mocks.restaurant = { id: 'restaurant-a', slug: 'chez-alice', name: 'Alice', owner_id: 'owner-a', is_accepting_orders: false } as DbRestaurant;
 render(<MemoryRouter initialEntries={['/admin/chez-alice']}><Routes>
   <Route path='/admin/:slug' element={<AdminPage />} />
   <Route path='/espace/client' element={<p>Recherche client</p>} />
 </Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button', { name: 'Espace client' }));
 expect(screen.getByText('Recherche client')).toBeVisible();
 expect(JSON.parse(localStorage.getItem('commandeici.entry.v1')!)).toMatchObject({ role: 'client' });
 expect(mocks.updateRestaurant).not.toHaveBeenCalled();
});

it('returns to role choices without looping back to an authenticated merchant preference', () => {
 localStorage.setItem('commandeici.entry.v1', JSON.stringify({ role: 'merchant', city: 'Auxerre' }));
 mocks.restaurantError = true;
 render(<MemoryRouter initialEntries={['/admin/chez-alice']}><Routes>
  <Route path='/admin/:slug' element={<AdminPage />} />
  <Route path='/' element={<Index />} />
  <Route path='/espace/commercant' element={<p>Retour bloqué dans le même parcours</p>} />
 </Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
 expect(screen.getByRole('button', { name: 'Je suis commerçant' })).toBeVisible();
 expect(screen.getByRole('button', { name: 'Trouver un commerce et commander' })).toBeVisible();
});
