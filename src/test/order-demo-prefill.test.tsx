import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import fr from '@/i18n/fr.json';

const mocks = vi.hoisted(() => ({ restaurant: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchRestaurantById: mocks.restaurant, createOrder: vi.fn(), isCustomerBanned: vi.fn().mockResolvedValue({ banned: false }) }));
vi.mock('@/context/CartContext', () => ({ useCart: () => ({
  restaurantId: 'demo-id', restaurantSlug: 'demo', subtotal: 6.5, clearCart: vi.fn(),
  items: [{ id: 'cart-kebab', menuItem: { id: 'kebab', name: 'Kebab', price: 6.5 }, quantity: 1, totalPrice: 6.5, selectedSauces: [], selectedSupplements: [] }],
}) }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({
  t: (key: string) => (fr as Record<string, string>)[key] ?? key, tMenu: (item: unknown) => item, isRTL: false,
}) }));
vi.mock('@/context/CustomerAuthContext', () => ({ useCustomerAuth: () => ({ user: null, isLoggedIn: false, profile: null, isLoading: false }) }));
vi.mock('@/hooks/useKioskMode', () => ({ useKioskMode: () => ({ isKiosk: false, config: {} }) }));
vi.mock('@/components/CustomerAuthModal', () => ({ CustomerAuthModal: () => null }));
vi.mock('@/components/PickupTimePicker', () => ({ PickupTimePicker: () => null }));
vi.mock('@/components/ProtectedPhone', () => ({ ProtectedPhone: () => null }));
import OrderPage from '@/pages/OrderPage';

let resolveRestaurant: (value: unknown) => void;
const deliverDemo = () => act(async () => resolveRestaurant({ id: 'demo-id', is_demo: true }));
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.restaurant.mockImplementation(() => new Promise(resolve => { resolveRestaurant = resolve; }));
});
afterEach(() => { cleanup(); localStorage.clear(); });
const mount = () => render(<MemoryRouter initialEntries={['/order']}><OrderPage /></MemoryRouter>);

for (const label of [fr['order.your_name'], fr['order.phone'], fr['order.email_optional']]) {
  it(`leaves the focused ${label} empty when demo metadata arrives before typing`, async () => {
    mount(); const input = screen.getByPlaceholderText(label);
    fireEvent.focus(input);
    await deliverDemo();
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: label === fr['order.phone'] ? '0612345678' : 'Client' } });
    expect(input).toHaveValue(label === fr['order.phone'] ? '0612345678' : 'Client');
  });
}
it('respects a deliberately cleared saved phone and accepts its replacement', async () => {
  localStorage.setItem('cm_customer', JSON.stringify({ name: 'Client', phone: '0600000000' }));
  mount(); const input = screen.getByPlaceholderText(fr['order.phone']);
  fireEvent.change(input, { target: { value: '' } });
  await deliverDemo();
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: '0612345678' } });
  expect(input).toHaveValue('0612345678');
  expect(screen.getByRole('button', { name: /Confirmer/ })).toBeEnabled();
});
it('still prefills untouched demo fields so confirmation remains easy', async () => {
  mount(); await deliverDemo();
  expect(screen.getByPlaceholderText(fr['order.your_name'])).not.toHaveValue('');
  expect(screen.getByPlaceholderText(fr['order.phone'])).not.toHaveValue('');
  expect(screen.getByPlaceholderText(fr['order.email_optional'])).not.toHaveValue('');
  expect(screen.getByRole('button', { name: /Confirmer/ })).toBeEnabled();
});
