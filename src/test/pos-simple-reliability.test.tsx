import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ clear: vi.fn(), submit: vi.fn() }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/context/CartContext', () => ({ useCart: () => ({ items: [{ id: 'line-a', menuItem: { id: 'item-a', name: 'Sandwich', price: 8 }, quantity: 1, totalPrice: 10, selectedSauces: [], selectedSupplements: [], baseChoice: 'Galette', drinkChoice: { name: 'Cola', price: 2 }, customChoices: [{ stepKey: 'base', selections: [{ id: 'galette', name: 'Galette' }] }] }], subtotal: 10, clearCart: mocks.clear }) }));
vi.mock('@/lib/api', () => ({ fetchOrdersByPeriod: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/customizationApi', () => ({ fetchUniversalCustomizationData: vi.fn().mockResolvedValue(null) }));
vi.mock('@/components/MenuItemCard', () => ({ MenuItemCard: () => null }));
import { POSSimple } from '@/components/dashboard/pos/POSSimple';
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
describe('simple POS submission', () => {
  it('retains the basket and recap when the parent reports a failed order', async () => {
    mocks.submit.mockResolvedValue(false);
    render(<POSSimple restaurantId="restaurant-a" restaurantSlug="restaurant-a" menuItems={[]} primaryColor="#000000" availablePaymentMethods={['cash']} onSubmit={mocks.submit} submitting={false} />);
    await act(async () => { await Promise.resolve(); });
    const clearsBeforeSubmission = mocks.clear.mock.calls.length;
    fireEvent.click(screen.getByText('pos.validate'));
    await act(async () => fireEvent.click(screen.getByText(/pos.send_to_kitchen/)));
    expect(mocks.clear).toHaveBeenCalledTimes(clearsBeforeSubmission);
    expect(screen.queryByText('pos.order_sent')).not.toBeInTheDocument();
    expect(screen.getByText(/pos.send_to_kitchen/)).toBeInTheDocument();
  });

  it('sends menu selections required by server pricing, then clears only after success', async () => {
    mocks.submit.mockResolvedValue(true);
    render(<POSSimple restaurantId="restaurant-a" restaurantSlug="restaurant-a" menuItems={[]} primaryColor="#000000" availablePaymentMethods={['cash']} onSubmit={mocks.submit} submitting={false} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByText('pos.validate'));
    await act(async () => fireEvent.click(screen.getByText(/pos.send_to_kitchen/)));
    expect(mocks.submit.mock.calls[0][0][0]).toEqual(expect.objectContaining({
      menu_item_id: 'item-a', extra_cost: 2, base_choice: 'Galette', drink_choice: { name: 'Cola', price: 2 },
      custom_choices: [{ stepKey: 'base', selections: [{ id: 'galette', name: 'Galette' }] }],
    }));
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(screen.getByText('pos.order_sent')).toBeInTheDocument();
  });
});
