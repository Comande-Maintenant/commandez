import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: api.rpc } }));
import { completeOnboarding } from '@/services/onboarding';
const categories = [{ name: 'Sandwichs', items: [{ name: 'Sandwich', price: 4.5, description: '' }] }];
beforeEach(() => { vi.clearAllMocks(); api.rpc.mockResolvedValue({ data: { id: 'new-store', slug: 'new-store', created: true }, error: null }); });

for (const business_type of ['epicerie', 'fleuriste']) {
  it(`creates a ${business_type} catalogue without restaurant inference or defaults`, async () => {
    await completeOnboarding('key', { name: 'Commerce', business_type, cuisine_type: 'kebab' }, categories);
    const payload = api.rpc.mock.calls[0][1];
    expect(payload.p_restaurant.business_type).toBe(business_type);
    expect(payload.p_restaurant.cuisine_type).toBe('generic');
    expect(payload.p_menu).toHaveLength(1);
    expect(payload.p_menu[0].product_type).toBe('simple');
    expect(payload.p_defaults).toEqual({});
  });
}
it('preserves restaurant cuisine defaults and the legacy missing-type call', async () => {
  await completeOnboarding('key', { name: 'Restaurant', cuisine_type: 'kebab' }, categories);
  const payload = api.rpc.mock.calls[0][1];
  expect(payload.p_restaurant.business_type).toBe('restaurant');
  expect(payload.p_menu.length).toBeGreaterThan(1);
  expect(payload.p_defaults).toHaveProperty('boissons');
});
it('rejects an unknown business type before requesting creation', async () => {
  await expect(completeOnboarding('key', { name: 'Bad', business_type: 'admin' }, categories)).rejects.toThrow('Invalid business type');
  expect(api.rpc).not.toHaveBeenCalled();
});
