import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
import { fetchOrders, subscribeToOrders, subscribeToOrderStatus } from '@/lib/api';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('operational snapshots', () => {
  it('keeps unfinished orders and today, with pagination beyond 500 orders', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({ id: `order-${index}` }));
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), or: vi.fn(() => query), order: vi.fn(() => query), abortSignal: vi.fn(() => query), range: vi.fn().mockResolvedValueOnce({ data: firstPage, error: null }).mockResolvedValueOnce({ data: [{ id: 'last-order' }], error: null }) };
    mocks.from.mockReturnValue(query);
    const result = await fetchOrders('restaurant-a', { operational: true });
    expect(result).toHaveLength(501);
    expect(query.eq).toHaveBeenCalledWith('restaurant_id', 'restaurant-a');
    expect(query.or).toHaveBeenCalledWith(expect.stringMatching(/^status.in.\(new,preparing,ready\),created_at.gte./));
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect(query.order).toHaveBeenCalledWith('id', { ascending: false });
  });

  it('aborts stalled operational reads after 15 seconds so recovery is not blocked forever', async () => {
    let signal: AbortSignal | undefined;
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), or: vi.fn(() => query), order: vi.fn(() => query), abortSignal: vi.fn(value => { signal = value; return query; }),
      range: vi.fn(() => new Promise((_resolve, reject) => { signal?.addEventListener('abort', () => reject(new Error('aborted'))); })) };
    mocks.from.mockReturnValue(query);
    const pending = fetchOrders('restaurant-a', { operational: true });
    const rejection = expect(pending).rejects.toThrow('aborted');
    expect(signal).toBeDefined();
    await vi.advanceTimersByTimeAsync(15000);
    await rejection;
    expect(signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('merchant realtime subscription', () => {
  it('receives INSERT and UPDATE for the selected merchant', () => {
    const handlers: Array<{ filter: Record<string, string>; callback: (payload: unknown) => void }> = [];
    const channel = { on: vi.fn((_type, filter, callback) => { handlers.push({ filter, callback }); return channel; }), subscribe: vi.fn(() => channel) };
    mocks.channel.mockReturnValue(channel);
    const callback = vi.fn();
    const unsubscribe = subscribeToOrders('restaurant-a', callback);
    expect(handlers.map(h => h.filter.event)).toEqual(['INSERT', 'UPDATE']);
    for (const h of handlers) expect(h.filter.filter).toBe('restaurant_id=eq.restaurant-a');
    handlers[1].callback({ new: { id: 'order-a', status: 'ready' } });
    expect(callback).toHaveBeenCalledWith({ id: 'order-a', status: 'ready' });
    unsubscribe();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('uses independent channel names for simultaneous kitchen and POS subscribers', () => {
    const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
    mocks.channel.mockReturnValue(channel);
    const a = subscribeToOrders('restaurant-a', vi.fn());
    const b = subscribeToOrders('restaurant-a', vi.fn());
    expect(mocks.channel.mock.calls[0][0]).not.toBe(mocks.channel.mock.calls[1][0]);
    a(); b();
  });
});

describe('customer order tracking polling', () => {
  it('does not overlap slow RPC calls or deliver after unsubscription', async () => {
    let resolve!: (value: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise(r => { resolve = r; }));
    const callback = vi.fn();
    const stop = subscribeToOrderStatus('order-a', callback);
    await vi.advanceTimersByTimeAsync(9000);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    stop();
    resolve({ data: { id: 'order-a', status: 'new' }, error: null });
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();
  });

  it('reports changed preparation time even when status stays preparing', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: 'order-a', status: 'preparing', estimated_ready_at: '2026-10-03T12:00:00Z' } })
      .mockResolvedValue({ data: { id: 'order-a', status: 'preparing', estimated_ready_at: '2026-10-03T12:10:00Z' } });
    const callback = vi.fn();
    const stop = subscribeToOrderStatus('order-a', callback);
    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(2);
    stop();
  });

  it('immediately catches up after returning online', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'order-a', status: 'new' } });
    const stop = subscribeToOrderStatus('order-a', vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stops polling once the merchant completes the order', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'order-a', status: 'done' } });
    const stop = subscribeToOrderStatus('order-a', vi.fn());
    await vi.advanceTimersByTimeAsync(60000);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    stop();
  });

  it('suspends reads in a hidden tab and refreshes on return', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'order-a', status: 'new' } });
    const stop = subscribeToOrderStatus('order-a', vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    stop(); hidden.mockRestore();
  });

  it('backs off failed tracking requests instead of polling every three seconds', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('temporary outage') });
    const stop = subscribeToOrderStatus('order-a', vi.fn());
    await vi.advanceTimersByTimeAsync(9000);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    stop();
  });
});
