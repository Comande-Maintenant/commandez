import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '@/i18n/fr.json';

const mocks = vi.hoisted(() => ({
  fetchRestaurantById: vi.fn(),
  createOrder: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  fetchRestaurantById: mocks.fetchRestaurantById,
  createOrder: mocks.createOrder,
  isCustomerBanned: vi.fn().mockResolvedValue({ banned: false }),
}));
vi.mock('@/services/order-request', () => ({ checkoutRequestId: vi.fn().mockResolvedValue('request'), clearCheckoutRequest: vi.fn() }));
vi.mock('@/context/CartContext', () => ({
  useCart: () => ({
    items: [{ id: 'line', menuItem: { id: 'item', name: 'Bun', price: 9 }, quantity: 1, selectedSauces: [], selectedSupplements: [], totalPrice: 9 }],
    subtotal: 9,
    clearCart: vi.fn(),
    restaurantId: 'restaurant',
    restaurantSlug: 'citrus',
  }),
}));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'fr', isRTL: false, tMenu: (item: unknown) => item, t: (key: string) => (fr as Record<string, string>)[key] ?? key }),
}));
vi.mock('@/context/CustomerAuthContext', () => ({ useCustomerAuth: () => ({ user: { id: 'customer', email: 'client@example.com', email_confirmed_at: '2026-10-29T00:00:00Z' }, isLoggedIn: true, profile: null, isLoading: false }) }));

import OrderPage from '@/pages/OrderPage';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function renderOrder(paymentMethods: string[] | null, path = '/order') {
  mocks.fetchRestaurantById.mockResolvedValue({ id: 'restaurant', order_mode: 'pickup', payment_methods: paymentMethods });
  return render(<MemoryRouter initialEntries={[path]}><OrderPage /></MemoryRouter>);
}

function fillAndConfirm() {
  fireEvent.change(screen.getByPlaceholderText(fr['order.your_name']), { target: { value: 'Client' } });
  fireEvent.change(screen.getByPlaceholderText(fr['order.phone']), { target: { value: '0612345678' } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(fr['order.confirm'].split('{')[0].trim()) }));
}

describe('order payment methods', () => {
  it('shows only cash for a cash-only commerce', async () => {
    renderOrder(['cash']);
    await waitFor(() => expect(screen.queryByRole('button', { name: fr['order.payment_card'] })).toBeNull());
    expect(screen.getByRole('button', { name: fr['order.payment_cash'] })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Espèces (sur place)' })).toBeInTheDocument();
  });

  it('keeps card and cash when the commerce has no setting', async () => {
    renderOrder(null);
    await waitFor(() => expect(mocks.fetchRestaurantById).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: fr['order.payment_card'] })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: fr['order.payment_cash'] })).toBeInTheDocument();
  });

  it('sends cash when the commerce only accepts cash', async () => {
    mocks.createOrder.mockResolvedValue({ id: 'order', order_number: 1, daily_number: 1 });
    renderOrder(['cash']);
    await waitFor(() => expect(screen.queryByRole('button', { name: fr['order.payment_card'] })).toBeNull());
    fireEvent.change(screen.getByPlaceholderText(fr['order.your_name']), { target: { value: 'Client' } });
    fireEvent.change(screen.getByPlaceholderText(fr['order.phone']), { target: { value: '0612345678' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(fr['order.confirm'].split('{')[0].trim()) }));
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalled());
    expect(mocks.createOrder.mock.calls[0][0].payment_method).toBe('cash');
  });

  it('never sends a method the commerce refused after the customer picked it', async () => {
    mocks.createOrder.mockResolvedValue({ id: 'order', order_number: 1, daily_number: 1 });
    renderOrder(null);
    await waitFor(() => expect(mocks.fetchRestaurantById).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: fr['order.payment_card'] }));
    mocks.fetchRestaurantById.mockResolvedValue({ id: 'restaurant', order_mode: 'pickup', payment_methods: ['cash'] });
    fillAndConfirm();
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalled());
    expect(mocks.createOrder.mock.calls[0][0].payment_method).toBe('cash');
  });

  it('keeps pay-at-counter on a counter kiosk even for a card-only commerce', async () => {
    mocks.createOrder.mockResolvedValue({ id: 'order', order_number: 1, daily_number: 1 });
    renderOrder(['card'], '/order?kiosk=true');
    await waitFor(() => expect(mocks.fetchRestaurantById).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: new RegExp(fr['order.confirm'].split('{')[0].trim()) }));
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalled());
    expect(mocks.createOrder.mock.calls[0][0].payment_method).toBe('cash');
  });
});
