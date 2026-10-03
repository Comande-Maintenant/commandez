import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), invoke: vi.fn(), maybeSingle: vi.fn(), native: false }));
vi.mock('@/services/native-push-client', () => ({ suspendNativePushBeforeSignOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser }, functions: { invoke: mocks.invoke } } }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, language: 'fr' }) }));
vi.mock('@/lib/native', () => ({ isNative: () => mocks.native, publicAppUrl: 'https://app.commandeici.com', shareRestaurant: vi.fn() }));
vi.mock('@/components/auth/DeleteAccountButton', () => ({ DeleteAccountButton: () => null }));
vi.mock('@/components/dashboard/referral/ReferralSection', () => ({ ReferralSection: () => null }));
import { PricingCards } from '@/components/onboarding/PricingCards';
import { OnboardingSuccess } from '@/components/onboarding/OnboardingSuccess';
import { SubscriptionGate } from '@/components/auth/SubscriptionGate';
import { DashboardParametres } from '@/components/dashboard/DashboardParametres';
import { getPricingPlans } from '@/services/subscription';
import { chatbotKnowledge } from '@/data/chatbotKnowledge';
import AbonnementPage from '@/pages/AbonnementPage';
import ChoisirPlanPage from '@/pages/ChoisirPlanPage';
import AbonnementConfirmePage from '@/pages/AbonnementConfirmePage';
import { NativeSubscription } from '@/components/NativeSubscription';
import type { DbRestaurant } from '@/types/database';
beforeEach(() => {
  cleanup(); vi.clearAllMocks(); mocks.native = false;
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-1', email: 'owner@example.test' } }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { slug: 'chez-alice-auxerre' }, error: null });
  const query: any = { select: () => query, eq: () => query, order: () => query, limit: () => query, single: () => mocks.maybeSingle(), maybeSingle: () => mocks.maybeSingle(), then: (resolve: any) => Promise.resolve({ data: { status: 'expired' } }).then(resolve) };
  mocks.from.mockReturnValue(query);
});
function routePage(Component: () => React.ReactNode) {
  render(<MemoryRouter initialEntries={['/legacy-billing']}><Routes>
    <Route path="/legacy-billing" element={<Component />} />
    <Route path="/admin/:slug" element={<div>Merchant dashboard</div>} />
    <Route path="/connexion" element={<div>Sign in</div>} />
    <Route path="/inscription" element={<div>Create establishment</div>} />
  </Routes></MemoryRouter>);
}
describe('Current merchant access is free', () => {
  it('publishes without trial or introductory payment on web', () => {
    const select = vi.fn();
    render(<PricingCards onSelect={select} />);
    expect(screen.getAllByText('commerce.free_title')[0]).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'commerce.publish' }));
    expect(select).toHaveBeenCalledWith('monthly');
    expect(screen.queryByText(/1€|29[.,]99/)).not.toBeInTheDocument();
  });
  it('prices the current offer at zero and does not sell priority support', () => {
    const plan = getPricingPlans((key) => key)[0];
    expect(plan.price).toBe(0);
    expect(plan.features).not.toContain('subscription.features.priority_support');
  });
  it('answers merchant pricing questions with the current free offer', () => {
    const answer = chatbotKnowledge.find((entry) => entry.question === 'Combien coûte commandeici ?')!.answer;
    expect(answer).toMatch(/gratuit actuellement/i);
    expect(answer).not.toMatch(/29[.,]99|1 EUR|essai|à vie/i);
  });
  it('allows the dashboard immediately without querying historical billing status', () => {
    render(<SubscriptionGate restaurantId="restaurant-1"><div>Order dashboard</div></SubscriptionGate>);
    expect(screen.getByText('Order dashboard')).toBeVisible();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('shows a free published page without card or promo actions', () => {
    render(<MemoryRouter><OnboardingSuccess restaurantName="Chez Alice" slug="chez-alice-auxerre" restaurantId="restaurant-1" email="owner@example.test" plan="monthly" /></MemoryRouter>);
    expect(screen.getByText('commerce.online_desc')).toBeVisible();
    expect(screen.queryByText('onboarding.success.add_card_now')).not.toBeInTheDocument();
    expect(screen.queryByText('onboarding.success.promo_question')).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('shows current free access in settings without querying subscription or showing billing fields', () => {
    render(<MemoryRouter><DashboardParametres restaurant={{ id: 'restaurant-1', name: 'Chez Alice', schedule: [], is_accepting_orders: true } as unknown as DbRestaurant} isDemo /></MemoryRouter>);
    expect(screen.getAllByText('commerce.free_title')[0]).toBeVisible();
    expect(screen.queryByText('dashboard.settings.billing')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.settings.promo_code')).not.toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalledWith('subscriptions');
  });
  for (const [name, Component] of Object.entries({ AbonnementPage, ChoisirPlanPage, AbonnementConfirmePage, NativeSubscription })) {
    it(`${name} returns a signed-in merchant to their dashboard without a payment request`, async () => {
      routePage(Component);
      expect(await screen.findByText('Merchant dashboard')).toBeVisible();
      expect(mocks.from).not.toHaveBeenCalledWith('subscriptions');
      expect(mocks.invoke).not.toHaveBeenCalled();
    });
  }
  it('offers a retry when the restaurant read fails instead of waiting for a payment', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('network') }).mockResolvedValueOnce({ data: { slug: 'chez-alice-auxerre' }, error: null });
    routePage(ChoisirPlanPage);
    expect(await screen.findByRole('alert')).toHaveTextContent('commerce.load_error');
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(await screen.findByText('Merchant dashboard')).toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('publishes on iOS without a payment or browser billing link', () => {
    mocks.native = true;
    const select = vi.fn();
    render(<PricingCards onSelect={select} />);
    fireEvent.click(screen.getByRole('button', { name: 'native.free.publish' }));
    expect(select).toHaveBeenCalledWith('none');
    expect(screen.queryByText('native.subscription')).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('sends unauthenticated visitors of old billing links to sign in', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    routePage(AbonnementPage);
    expect(await screen.findByText('Sign in')).toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('sends authenticated owners without a restaurant to onboarding', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    routePage(ChoisirPlanPage);
    expect(await screen.findByText('Create establishment')).toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
