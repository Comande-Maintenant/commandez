import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fr from '@/i18n/fr.json';
vi.mock('@/services/referral', () => ({ getReferralStats: async () => ({ totalReferrals: 2, completedReferrals: 1, totalBonusWeeks: 4, referralCode: 'ABC123' }), getReferrals: async () => [] }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string, params: Record<string, string> = {}) => Object.entries(params).reduce((text, [name, value]) => text.split(`{${name}}`).join(value), (fr as Record<string, string>)[key] || key) }) }));
import { ReferralSection } from '@/components/dashboard/referral/ReferralSection';
describe('Referral links while access is currently free', () => {
  it('shares an actual clickable invitation link without interpolation placeholders or bonus-week promises', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ReferralSection restaurantId="restaurant-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'WhatsApp' }));
    const whatsapp = new URL(open.mock.calls[0][0] as string).searchParams.get('text')!;
    expect(whatsapp).toContain('https://app.commandeici.com/inscription?ref=ABC123');
    expect(whatsapp).not.toMatch(/\{(?:url|link|code)\}|semaine|essai/i);
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    const body = new URL(open.mock.calls[1][0] as string).searchParams.get('body')!;
    expect(body).toContain('https://app.commandeici.com/inscription?ref=ABC123');
    expect(body).not.toMatch(/\{(?:url|link|code)\}|semaine|essai/i);
    expect(screen.queryByText(/semaines? gagnées|\+4/)).not.toBeInTheDocument();
    open.mockRestore();
  });
});
