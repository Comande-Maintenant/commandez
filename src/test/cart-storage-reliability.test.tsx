import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from '@/context/CartContext';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('merchant and customer cart storage', () => {
  it('keeps merchant baskets independent from the public customer basket', () => {
    const line = { id: 'line-a', menuItem: { id: 'item-a', name: 'Sandwich' }, quantity: 1, totalPrice: 10, selectedSauces: [], selectedSupplements: [] };
    localStorage.setItem('resto-order-cart', JSON.stringify({ items: [], restaurantId: null, restaurantSlug: null }));
    localStorage.setItem('pos:owner-a:restaurant-a', JSON.stringify({ items: [line], restaurantId: 'restaurant-a', restaurantSlug: 'a' }));
    const { result } = renderHook(useCart, { wrapper: ({ children }) => <CartProvider storageKey="pos:owner-a:restaurant-a">{children}</CartProvider> });
    expect(result.current.items).toHaveLength(1);
    act(() => result.current.clearCart());
    expect(JSON.parse(localStorage.getItem('resto-order-cart')!).items).toEqual([]);
  });

  it('works when browser storage writes and deletes are blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage denied'); });
    let result!: ReturnType<typeof renderHook<ReturnType<typeof useCart>, unknown>>;
    expect(() => { result = renderHook(useCart, { wrapper: CartProvider }); }).not.toThrow();
    expect(() => act(() => result.result.current.clearCart())).not.toThrow();
  });

  it('ignores a corrupted persisted basket instead of crashing the entire dashboard', () => {
    localStorage.setItem('resto-order-cart', JSON.stringify({ items: true }));
    let count = -1;
    expect(() => {
      const { result } = renderHook(useCart, { wrapper: CartProvider });
      count = result.current.items.length;
    }).not.toThrow();
    expect(count).toBe(0);
  });
});
