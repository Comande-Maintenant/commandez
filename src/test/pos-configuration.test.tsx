import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomizationConfig, DbRestaurant } from '@/types/database';

vi.mock('@/lib/api', () => ({ fetchMenuItems: vi.fn().mockResolvedValue([]) }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, language: 'fr' }) }));
vi.mock('@/components/dashboard/pos/POSSimple', () => ({ POSSimple: () => <div>simple POS</div> }));
vi.mock('@/components/dashboard/pos/POSOrderType', () => ({ POSOrderType: () => <div>custom POS</div> }));
import { usePOSCustomization } from '@/components/dashboard/pos/usePOSCustomization';
import { DashboardPOS } from '@/components/dashboard/pos/DashboardPOS';
import { RestaurantOrdersContext } from '@/context/RestaurantOrdersContext';

const config: CustomizationConfig = { enabled: true, base_price: 8, steps: [
  { id: 'base', title: 'Base', type: 'single', required: true, options: [{ id: 'bread', name: 'Pain', price_modifier: 0, image: null }] },
  { id: 'accompagnement', title: 'Accompagnement', type: 'single', required: false, options: [{ id: 'fries', name: 'Frites', price_modifier: 2, image: null, portion_options: [{ id: 'normale', label: 'Normale', price_modifier: 1.5 }, { id: 'double', label: 'Double', price_modifier: 3 }] }] },
] };
afterEach(cleanup);
describe('POS uses the enabled merchant configuration and canonical portion prices', () => {
  it('opens the simple POS when the custom configuration is disabled', async () => {
    const restaurant = { id: 'restaurant-a', slug: 'a', owner_id: 'owner-a', customization_config: { ...config, enabled: false } } as DbRestaurant;
    const feed = { orders: [], setOrders: vi.fn(), loading: false, disconnected: false, notification: null, receiveDemoOrder: vi.fn() };
    render(<RestaurantOrdersContext.Provider value={feed}><DashboardPOS restaurant={restaurant} /></RestaurantOrdersContext.Provider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('simple POS')).toBeInTheDocument();
    expect(screen.queryByText('custom POS')).not.toBeInTheDocument();
  });

  it('includes the normal portion modifier as soon as an accompaniment is selected', () => {
    const { result } = renderHook(() => usePOSCustomization(config));
    act(() => result.current.handleSelectBase('bread'));
    act(() => result.current.handleSelectAccompagnement('fries'));
    expect(result.current.accompagnement?.portion).toBe('normale');
    expect(result.current.accompagnement?.portionPriceMod).toBe(1.5);
    expect(result.current.price).toBe(11.5);
    act(() => result.current.handleSetAccompagnementPortion('double'));
    expect(result.current.price).toBe(13);
    act(() => result.current.handleSetAccompagnementPortion('normale'));
    expect(result.current.price).toBe(11.5);
  });
});
