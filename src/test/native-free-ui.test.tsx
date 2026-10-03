import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fr from '@/i18n/fr.json';
import { NativeSubscription } from '@/components/NativeSubscription';
import { PricingCards } from '@/components/onboarding/PricingCards';
import { OnboardingSuccess } from '@/components/onboarding/OnboardingSuccess';

vi.mock('@/lib/native', () => ({ isNative: () => true, publicAppUrl: 'https://app.commandeici.com', shareRestaurant: vi.fn() }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => (fr as Record<string, string>)[key] || key }) }));
const functions = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions, auth: { getUser: vi.fn(() => new Promise(() => {})) } } }));
afterEach(cleanup);

describe('native free launch screens', () => {
  it('describes free access without linking to an external payment or an expiry', () => {
    const { container } = render(<MemoryRouter><NativeSubscription /></MemoryRouter>);
    expect(screen.getByRole('heading').textContent).toBe("Gratuit jusqu'en 2027");
    expect(container.textContent).not.toMatch(/facturation|Stripe|29,99|essai/i);
    expect(container.querySelector('a[href*="commandeici.com"]')).toBeNull();
  });
  it('publishes on the free plan without a billing call', () => {
    const onSelect = vi.fn();
    const { container } = render(<PricingCards onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Créer ma carte gratuitement' }));
    expect(onSelect).toHaveBeenCalledWith('none');
    expect(functions.invoke).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/30 jours|1€|29,99|Stripe|essai/i);
  });
  it('confirms free publication and keeps the restaurant and dashboard accessible', () => {
    const { container } = render(<MemoryRouter><OnboardingSuccess restaurantName="Test" slug="test-ville" email="test@example.com" restaurantId="test" plan="none" /></MemoryRouter>);
    expect(container.textContent).toContain("Gratuit jusqu'en 2027");
    expect(container.textContent).not.toMatch(/30 jours|essai|carte bancaire|abonnement/i);
    expect(container.querySelector('a[href="/admin/test-ville"]')).not.toBeNull();
  });
});
