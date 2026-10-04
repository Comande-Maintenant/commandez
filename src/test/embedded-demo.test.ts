import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ native: true, rpc: vi.fn(), from: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => f.native } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: f.rpc, from: f.from } }));
import { createOrder, fetchDemoRestaurant, fetchDemoOrders, fetchRestaurantBySlug, fetchRestaurantById, fetchMenuItems, fetchOrderById, subscribeToOrderStatus } from '@/lib/api';
import { fetchUniversalCustomizationData } from '@/lib/customizationApi';
import { createDemoOrder } from '@/lib/demo-order';
import { storeDemoOrders } from '@/lib/demo-order-store';
const localId = 'demo-restaurant-antalya';
beforeEach(() => {
  vi.restoreAllMocks();
  f.native = true; sessionStorage.clear(); vi.clearAllMocks();
  f.rpc.mockRejectedValue(new Error('Network unavailable'));
  f.from.mockImplementation(() => { throw new Error('Network unavailable'); });
});
describe('embedded iOS demonstration without business network access', () => {
  it('resolves the same isolated merchant through dashboard, menu and checkout', async () => {
    const dashboard = await fetchDemoRestaurant('demo');
    expect(dashboard?.id).toBe(localId);
    expect(await fetchRestaurantBySlug('antalya-kebab-moneteau')).toEqual(dashboard);
    expect(await fetchRestaurantById(localId)).toEqual(dashboard);
    expect(dashboard?.owner_id).toBeNull();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('contains all 15 illustrated products and complete meats, sauces, sizes and steps', async () => {
    const menu = await fetchMenuItems(localId);
    const options = await fetchUniversalCustomizationData(localId);
    expect(menu).toHaveLength(15);
    expect(menu.every(item => item.image.startsWith('/images/') && item.restaurant_id === localId)).toBe(true);
    expect(options.bases).toHaveLength(6); expect(options.viandes).toHaveLength(8);
    expect(options.sauces).toHaveLength(7); expect(options.stepTemplates).toHaveLength(10);
    expect(options.bases.some(base => base.name.toLowerCase() === 'grande assiette' && base.price === 11)).toBe(true);
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled();
  });
  it('creates a local order once, restores it for kitchen and tracking without writing remotely', async () => {
    const estimate = new Date(Date.now() + 15 * 60000).toISOString();
    const payload = { request_id: 'fixture-idempotent', restaurant_id: localId, customer_name: 'Demo Test', customer_phone: '0612345678', source: 'demo', order_type: 'collect', items: [{ name: 'Kebab', quantity: 1, price: 6.5 }], subtotal: 6.5, total: 6.5, estimated_ready_at:estimate };
    const first = await createOrder(payload); const second = await createOrder(payload);
    expect(first.id).toMatch(/^demo-local-/); expect(second.id).toBe(first.id);
    expect(first.is_test).toBe(true);
    expect((await fetchDemoOrders(localId)).filter(order => order.id === first.id)).toHaveLength(1);
    const tracked = await fetchOrderById(first.id);
    expect(tracked?.restaurant.is_demo).toBe(true); expect(tracked?.total).toBe(6.5);
    expect(tracked?.estimated_ready_at).toBe(estimate);
    const cancel = subscribeToOrderStatus(first.id, vi.fn()); cancel();
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('commandeici:demo-orders:' + localId)).not.toContain('0612345678');
  });
  it('preserves server access for real merchants and does not interpret demo hints as a tenant bypass', async () => {
    await expect(fetchRestaurantBySlug('real-merchant')).rejects.toThrow('Network unavailable');
    await expect(fetchRestaurantById('real-id')).rejects.toThrow('Network unavailable');
    await expect(createOrder({restaurant_id:'real-id',customer_name:'Test',customer_phone:'',order_type:'collect',source:'demo',items:[],subtotal:0,total:0})).rejects.toThrow('Network unavailable');
    expect(f.rpc).toHaveBeenCalledTimes(3);
  });
  it('keeps the existing web catalogue server path', async () => {
    f.native = false;
    await expect(fetchDemoRestaurant('demo')).rejects.toThrow('Network unavailable');
    expect(f.rpc).toHaveBeenCalledWith('get_demo_restaurant', {p_slug:'demo'});
  });
  it('keeps received orders and their latest status available when session storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    const received = createDemoOrder(localId, 3, {customer:'Client démo',notes:'Simulation'});
    storeDemoOrders(localId, [received]);
    expect((await fetchDemoOrders(localId)).some(order => order.id === received.id)).toBe(true);
    storeDemoOrders(localId, [{...received,status:'ready'}]);
    expect((await fetchOrderById(received.id))?.status).toBe('ready');
    vi.restoreAllMocks();
  });
});
