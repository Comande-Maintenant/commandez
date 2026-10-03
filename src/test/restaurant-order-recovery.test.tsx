import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbOrder } from '@/types/database';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), demo: vi.fn(), subscribe: vi.fn(), stop: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchOrders: mocks.fetch, fetchDemoOrders: mocks.demo, subscribeToOrders: mocks.subscribe }));
import { useRestaurantOrders } from '@/hooks/useRestaurantOrders';
const order = (id: string, status = 'new', restaurant_id = 'restaurant-a') => ({ id, status, restaurant_id, created_at: new Date().toISOString() } as DbOrder);
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers(); mocks.fetch.mockResolvedValue([]); mocks.subscribe.mockReturnValue(mocks.stop); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('merchant recovery shared by kitchen and POS', () => {
  it('alerts once for pending new orders present when the merchant opens the dashboard', async () => {
    mocks.fetch.mockResolvedValue([order('waiting-a'), order('waiting-b')]);
    const ring = vi.fn();
    renderHook(() => useRestaurantOrders('restaurant-a', { onNewOrder: ring }));
    await flush();
    expect(ring).toHaveBeenCalledTimes(1);
    expect(ring.mock.calls[0][0].id).toBe('waiting-a');
  });

  it('recovers and rings a missed order immediately after network reconnection, once', async () => {
    const ring = vi.fn();
    const { result } = renderHook(() => useRestaurantOrders('restaurant-a', { onNewOrder: ring }));
    await flush();
    mocks.fetch.mockResolvedValue([order('missed')]);
    act(() => window.dispatchEvent(new Event('online')));
    await flush();
    expect(result.current.orders.map(o => o.id)).toEqual(['missed']);
    expect(ring).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('online')));
    await flush();
    expect(ring).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a realtime update with an older in-flight snapshot', async () => {
    let resolve!: (orders: DbOrder[]) => void;
    mocks.fetch.mockReturnValue(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useRestaurantOrders('restaurant-a'));
    const receive = mocks.subscribe.mock.calls[0][1];
    act(() => receive(order('order-a', 'ready')));
    await act(async () => resolve([order('order-a', 'new')]));
    expect(result.current.orders[0].status).toBe('ready');
  });

  it('serializes repeated resume events and clears connection errors after recovery', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useRestaurantOrders('restaurant-a'));
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.disconnected).toBe(true);
    let resolve!: (orders: DbOrder[]) => void;
    mocks.fetch.mockReturnValue(new Promise(r => { resolve = r; }));
    act(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('commandeici:resume')); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    await act(async () => resolve([]));
    expect(result.current.disconnected).toBe(false);
  });

  it('ignores delayed old-tenant reads and foreign realtime rows', async () => {
    let resolve!: (orders: DbOrder[]) => void;
    mocks.fetch.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue([order('b', 'new', 'restaurant-b')]);
    const { result, rerender } = renderHook(({ id }) => useRestaurantOrders(id), { initialProps: { id: 'restaurant-a' } });
    const oldReceive = mocks.subscribe.mock.calls[0][1];
    rerender({ id: 'restaurant-b' });
    await flush();
    act(() => mocks.subscribe.mock.calls[1][1](order('foreign')));
    act(() => oldReceive(order('late')));
    await act(async () => resolve([order('old-a')]));
    expect(result.current.orders.map(o => o.id)).toEqual(['b']);
  });

  it('reports realtime failure and refreshes at resubscription', async () => {
    const { result } = renderHook(() => useRestaurantOrders('restaurant-a'));
    await flush();
    const status = mocks.subscribe.mock.calls[0][2];
    expect(typeof status).toBe('function');
    act(() => status('CHANNEL_ERROR'));
    expect(result.current.disconnected).toBe(true);
    mocks.fetch.mockResolvedValue([order('ready', 'ready')]);
    act(() => status('SUBSCRIBED'));
    await flush();
    expect(result.current.orders[0].status).toBe('ready');
  });

  it('polls every 30 seconds when visible and asks only for operational orders', async () => {
    renderHook(() => useRestaurantOrders('restaurant-a'));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).toHaveBeenLastCalledWith('restaurant-a', expect.objectContaining({ operational: true }));
  });

  it('deduplicates realtime inserts and performs no callbacks or reads after unmount', async () => {
    const ring = vi.fn();
    const { result, unmount } = renderHook(() => useRestaurantOrders('restaurant-a', { onNewOrder: ring }));
    await flush();
    const receive = mocks.subscribe.mock.calls[0][1];
    act(() => { receive(order('a')); receive(order('a')); });
    expect(result.current.orders).toHaveLength(1);
    expect(ring).toHaveBeenCalledTimes(1);
    unmount();
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    act(() => { receive(order('b')); window.dispatchEvent(new Event('online')); });
    expect(ring).toHaveBeenCalledTimes(1);
    expect(mocks.stop).toHaveBeenCalled();
  });

  it('suspends snapshots in hidden screens and resumes without waiting for the interval', async () => {
    renderHook(() => useRestaurantOrders('restaurant-a'));
    await flush();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await flush();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    hidden.mockRestore();
  });

  it('does not read orders before merchant authorization has supplied a restaurant', async () => {
    const { result } = renderHook(() => useRestaurantOrders(null));
    await flush();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(result.current.orders).toEqual([]);
  });
});

describe('isolated interactive demo', () => {
  it('receives a sample once, preserves its preparation through polling, and resets for another restaurant', async () => {
    mocks.demo.mockResolvedValue([]);
    const ring=vi.fn();
    const {result,rerender}=renderHook(({id})=>useRestaurantOrders(id,{isDemo:true,onNewOrder:ring}),{initialProps:{id:'restaurant-a'}});
    await flush();
    act(()=>result.current.receiveDemoOrder({...order('demo-local-a'),is_test:true}));
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.notification?.order.id).toBe('demo-local-a');
    expect(ring).toHaveBeenCalledTimes(1);
    act(()=>result.current.setOrders(previous=>previous.map(o=>({...o,status:'preparing'}))));
    await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
    expect(result.current.orders[0].status).toBe('preparing');
    expect(ring).toHaveBeenCalledTimes(1);
    rerender({id:'restaurant-b'}); await flush();
    expect(result.current.orders).toEqual([]);
    expect(result.current.notification).toBeNull();
  });
  it('rejects sample injection on real restaurants and foreign restaurant identities', async () => {
    const {result,rerender}=renderHook(({isDemo})=>useRestaurantOrders('restaurant-a',{isDemo}),{initialProps:{isDemo:false}});
    await flush();
    act(()=>result.current.receiveDemoOrder({...order('demo-local-a'),is_test:true}));
    expect(result.current.orders).toEqual([]);
    rerender({isDemo:true}); mocks.demo.mockResolvedValue([]); await flush();
    act(()=>result.current.receiveDemoOrder({...order('demo-local-a','new','foreign'),is_test:true}));
    expect(result.current.orders).toEqual([]);
  });
});
it('rejects a stale sample callback after switching restaurants', async()=>{
 mocks.demo.mockResolvedValue([]);
 const {result,rerender}=renderHook(({id})=>useRestaurantOrders(id,{isDemo:true}),{initialProps:{id:'restaurant-a'}});await flush();
 const staleReceive=result.current.receiveDemoOrder;
 rerender({id:'restaurant-b'});await flush();
 act(()=>staleReceive({...order('demo-local-stale'),is_test:true}));
 expect(result.current.orders).toEqual([]);
});
it('restores local demo orders and their statuses on remount without announcing again',async()=>{
 mocks.demo.mockResolvedValue([]);
 const ring=vi.fn();
 const first=renderHook(()=>useRestaurantOrders('restore-demo',{isDemo:true,onNewOrder:ring}));await flush();
 act(()=>first.result.current.receiveDemoOrder({id:'demo-local-restore',restaurant_id:'restore-demo',is_test:true,source:'demo',status:'new',created_at:new Date().toISOString(),customer_name:'Demo',order_number:1,daily_number:1,total:6.5,subtotal:6.5,items:[{name:'Kebab',quantity:1,price:6.5}],order_type:'collect',notes:''} as DbOrder));
 act(()=>first.result.current.setOrders(previous=>previous.map(order=>({...order,status:'preparing'}))));first.unmount();
 const second=renderHook(()=>useRestaurantOrders('restore-demo',{isDemo:true,onNewOrder:ring}));await flush();
 expect(second.result.current.orders).toHaveLength(1);expect(second.result.current.orders[0].status).toBe('preparing');expect(ring).toHaveBeenCalledTimes(1);
});
