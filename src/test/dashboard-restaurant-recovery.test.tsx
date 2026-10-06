import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbRestaurant } from '@/types/database';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), demo: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchMerchantRestaurantBySlug: mocks.fetch, fetchDemoRestaurant: mocks.demo }));
import { useDashboardRestaurant } from '@/hooks/useDashboardRestaurant';
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
describe('merchant dashboard restaurant reads', () => {
  it('releases the loader on HTTP failure and supports a successful retry', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('503')).mockResolvedValue({ id: 'restaurant-a', slug: 'a' });
    const { result } = renderHook(() => useDashboardRestaurant('a', false));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(true);
    act(() => result.current.retry());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.restaurant?.id).toBe('restaurant-a');
    expect(result.current.error).toBe(false);
  });
  it('ignores the older restaurant when navigation changes while a request is in flight', async () => {
    let resolve!: (restaurant: DbRestaurant) => void;
    mocks.fetch.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue({ id: 'restaurant-b', slug: 'b' });
    const { result, rerender } = renderHook(({ slug }) => useDashboardRestaurant(slug, false), { initialProps: { slug: 'a' } });
    rerender({ slug: 'b' });
    await act(async () => { await Promise.resolve(); });
    await act(async () => resolve({ id: 'restaurant-a', slug: 'a' } as DbRestaurant));
    expect(result.current.restaurant?.id).toBe('restaurant-b');
  });
});
