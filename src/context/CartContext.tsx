import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { DbMenuItem, Supplement } from "@/types/database";

export interface CartItem {
  id: string;
  menuItem: DbMenuItem;
  quantity: number;
  selectedSauces: string[];
  selectedSupplements: Supplement[];
  totalPrice: number;
}

interface CartContextType {
  items: CartItem[];
  restaurantSlug: string | null;
  restaurantId: string | null;
  addItem: (item: DbMenuItem, sauces: string[], supplements: Supplement[], restaurantSlug: string, restaurantId: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "resto-order-cart";

function loadCart(): { items: CartItem[]; restaurantSlug: string | null; restaurantId: string | null } {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { items: [], restaurantSlug: null, restaurantId: null };
}

function saveCart(items: CartItem[], restaurantSlug: string | null, restaurantId: string | null) {
  localStorage.setItem(CART_KEY, JSON.stringify({ items, restaurantSlug, restaurantId }));
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState(loadCart);

  useEffect(() => {
    saveCart(state.items, state.restaurantSlug, state.restaurantId);
  }, [state]);

  const addItem = useCallback((menuItem: DbMenuItem, sauces: string[], supplements: Supplement[], slug: string, restId: string) => {
    setState((prev) => {
      let items = prev.items;
      if (prev.restaurantSlug && prev.restaurantSlug !== slug) {
        items = [];
      }
      const suppTotal = supplements.reduce((sum, s) => sum + s.price, 0);
      const totalPrice = menuItem.price + suppTotal;
      const cartId = `${menuItem.id}-${Date.now()}`;
      return {
        items: [...items, { id: cartId, menuItem, quantity: 1, selectedSauces: sauces, selectedSupplements: supplements, totalPrice }],
        restaurantSlug: slug,
        restaurantId: restId,
      };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setState((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setState((prev) => ({
      ...prev,
      items: quantity <= 0 ? prev.items.filter((i) => i.id !== id) : prev.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState({ items: [], restaurantSlug: null, restaurantId: null });
    localStorage.removeItem(CART_KEY);
  }, []);

  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce((sum, i) => sum + i.totalPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: state.items, restaurantSlug: state.restaurantSlug, restaurantId: state.restaurantId, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
