import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbOrder, DbRestaurant } from '@/types/database';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), subscribe: vi.fn(), stop: vi.fn(), update: vi.fn(), ring: vi.fn(), upsert: vi.fn(), stats: vi.fn() }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, language: 'fr' }) }));
vi.mock('@/lib/api', () => ({ fetchOrders: mocks.fetch, fetchDemoOrders: mocks.fetch, subscribeToOrders: mocks.subscribe,
  updateOrderStatus: mocks.update, upsertCustomer: mocks.upsert, updateCustomerStats: mocks.stats, fetchMenuItems: vi.fn().mockResolvedValue([]), fetchAllMenuItems: vi.fn().mockResolvedValue([]), fetchCustomers: vi.fn().mockResolvedValue([]), fetchRestaurantHours: vi.fn().mockResolvedValue([]) }));
vi.mock('@/components/dashboard/OrderDetailSheet', () => ({ OrderDetailSheet: ({ order, onStatusChange }: { order: DbOrder; onStatusChange: (id: string, status: string) => void }) => <button onClick={() => onStatusChange(order.id, 'done')}>finish-order</button> }));
vi.mock('@/components/dashboard/BanDialog', () => ({ BanDialog: () => null }));
vi.mock('@/components/dashboard/PrepSummaryBoard', () => ({ PrepSummaryBoard: () => null }));
vi.mock('@/components/dashboard/CustomerBadge', () => ({ CustomerBadge: () => null }));
vi.mock('@/components/dashboard/CustomerMiniProfile', () => ({ CustomerMiniProfile: () => null }));
vi.mock('@/components/dashboard/pos/POSOrderType', () => ({ POSOrderType: () => <div>new-sale</div> }));
import { DashboardOrders } from '@/components/dashboard/DashboardOrders';
import { DashboardPOS } from '@/components/dashboard/pos/DashboardPOS';
import { RestaurantOrdersContext } from '@/context/RestaurantOrdersContext';
import { useRestaurantOrders } from '@/hooks/useRestaurantOrders';

const restaurant = { id: 'restaurant-a', owner_id: 'owner-a', slug: 'a', name: 'Test', categories: [], availability_mode: 'always', customization_config: { enabled: true, base_price: 0, steps: [] }, cuisine_type: 'kebab' } as DbRestaurant;
const order = (status = 'new') => ({ id: 'order-a', restaurant_id: restaurant.id, status, order_number: 1, customer_name: 'Client test', customer_phone: '', total: 10, items: [], order_type: 'collect', created_at: new Date(Date.now() - 20 * 60000).toISOString() } as DbOrder);
function Dashboard({ tab }: { tab: string }) {
  const feed = useRestaurantOrders(restaurant.id, { onNewOrder: mocks.ring });
  return <RestaurantOrdersContext.Provider value={feed}>{tab === 'cuisine' ? <DashboardOrders restaurant={restaurant} /> : tab === 'caisse' ? <DashboardPOS restaurant={restaurant} /> : <div>settings</div>}</RestaurantOrdersContext.Provider>;
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); mocks.subscribe.mockReturnValue(mocks.stop); mocks.fetch.mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('merchant screen integration', () => {
  it('keeps one feed and rings new orders while navigating from settings to caisse', async () => {
    const { rerender } = render(<Dashboard tab="settings" />);
    await act(async () => { await Promise.resolve(); });
    const receive = mocks.subscribe.mock.calls[0][1];
    act(() => receive(order()));
    expect(mocks.ring).toHaveBeenCalledTimes(1);
    rerender(<Dashboard tab="caisse" />);
    await act(async () => { await Promise.resolve(); });
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    act(() => receive(order('ready')));
    fireEvent.click(screen.getByText('pos.to_collect'));
    expect(screen.getAllByText('Client test').length).toBeGreaterThan(0);
    act(() => receive(order('preparing')));
    expect(screen.queryByText('Client test')).not.toBeInTheDocument();
    act(() => receive(order('ready')));
    expect(screen.getByText('Client test')).toBeInTheDocument();
    act(() => receive(order('done')));
    expect(screen.getByText(/^Client test/)).toBeInTheDocument();
    act(() => receive(order('preparing')));
    expect(screen.queryByText('Client test')).not.toBeInTheDocument();
    expect(mocks.ring).toHaveBeenCalledTimes(1);
  });

  it('keeps stale unaccepted kitchen orders visible instead of completing them silently', async () => {
    mocks.fetch.mockResolvedValue([order()]);
    render(<Dashboard tab="cuisine" />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Client test' })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Client test' })).toBeInTheDocument();
  });

  it('does not count a server-recorded customer purchase again when it is completed', async () => {
    const customer = { total_orders: 1, total_spent: 10 };
    mocks.upsert.mockResolvedValue({ id: 'customer-a' });
    mocks.stats.mockImplementation(async (_id, total) => { customer.total_orders += 1; customer.total_spent += total; });
    mocks.fetch.mockResolvedValue([{ ...order('preparing'), customer_phone: '0600000000' }]);
    render(<Dashboard tab="cuisine" />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByText('#1'));
    await act(async () => fireEvent.click(screen.getByText('finish-order')));
    expect(customer).toEqual({ total_orders: 1, total_spent: 10 });
    expect(mocks.stats).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
