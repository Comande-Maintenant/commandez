import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc } }));
import { fetchMerchantRestaurantBySlug } from '@/lib/api';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } }, error: null });
  mocks.from.mockReturnValue(mocks);
  mocks.select.mockReturnValue(mocks);
  mocks.eq.mockReturnValue(mocks);
  mocks.maybeSingle.mockResolvedValue({ data: { id: 'restaurant-a', owner_id: 'owner-a' }, error: null });
});
describe('authenticated merchant restaurant access', () => {
  it('reads the private owner-scoped row rather than the public projection', async () => {
    expect(await fetchMerchantRestaurantBySlug('merchant-a')).toEqual({ id: 'restaurant-a', owner_id: 'owner-a' });
    expect(mocks.from).toHaveBeenCalledWith('restaurants');
    expect(mocks.eq).toHaveBeenCalledWith('slug', 'merchant-a');
    expect(mocks.eq).toHaveBeenCalledWith('owner_id', 'owner-a');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not query restaurant rows without an authenticated owner', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await fetchMerchantRestaurantBySlug('merchant-a')).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('returns no row when the server denies access to another merchant', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchMerchantRestaurantBySlug('merchant-b')).toBeNull();
    expect(mocks.eq).toHaveBeenCalledWith('owner_id', 'owner-a');
  });
  it('propagates authentication and database failures for the retry screen', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Auth unavailable') });
    await expect(fetchMerchantRestaurantBySlug('merchant-a')).rejects.toThrow('Auth unavailable');
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('503') });
    await expect(fetchMerchantRestaurantBySlug('merchant-a')).rejects.toThrow('503');
  });
});
