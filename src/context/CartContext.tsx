import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { DbMenuItem, Supplement } from "@/types/database";
import type { StepSelection } from "@/types/customization";

export interface CartItem {
  id: string;
  menuItem: DbMenuItem;
  quantity: number;
  selectedSauces: string[];
  selectedSupplements: Supplement[];
  garnitureChoices?: { name: string; level: "oui" | "x2" }[];
  viandeChoice?: string;
  baseChoice?: string;
  fritesInside?: boolean;
  accompagnementChoice?: { name: string; size?: string; sauces?: string[] };
  accompagnementChoices?: { name: string; size?: string; sauces?: string[] }[];
  drinkChoice?: { name: string; price: number };
  dessertChoice?: { name: string; price: number };
  customChoices?: StepSelection[];
  sauceExtraCost?: number;
  totalPrice: number;
}

interface CartContextType {
  items: CartItem[];
  restaurantSlug: string | null;
  restaurantId: string | null;
  addItem: (item: DbMenuItem, sauces: string[], supplements: Supplement[], restaurantSlug: string, restaurantId: string, options?: { garnitureChoices?: { name: string; level: "oui" | "x2" }[]; viandeChoice?: string; extraCost?: number; baseChoice?: string; fritesInside?: boolean; accompagnementChoice?: { name: string; size?: string; sauces?: string[] }; accompagnementChoices?: { name: string; size?: string; sauces?: string[] }[]; drinkChoice?: { name: string; price: number }; dessertChoice?: { name: string; price: number }; customChoices?: StepSelection[]; sauceExtraCost?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "resto-order-cart";

function loadCart(storageKey: string): { items: CartItem[]; restaurantSlug: string | null; restaurantId: string | null } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved?.items)) return {
        items: saved.items.filter((item: CartItem) => item && typeof item.id === 'string' && item.menuItem && typeof item.menuItem.id === 'string'
          && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.totalPrice) && item.totalPrice >= 0
          && Array.isArray(item.selectedSauces) && Array.isArray(item.selectedSupplements)),
        restaurantSlug: typeof saved.restaurantSlug === 'string' ? saved.restaurantSlug : null,
        restaurantId: typeof saved.restaurantId === 'string' ? saved.restaurantId : null,
      };
    }
  } catch { /* malformed or blocked storage starts with an empty basket */ }
  return { items: [], restaurantSlug: null, restaurantId: null };
}

function saveCart(items: CartItem[], restaurantSlug: string | null, restaurantId: string | null, storageKey: string) {
  try { localStorage.setItem(storageKey, JSON.stringify({ items, restaurantSlug, restaurantId })); } catch { /* keep the in-memory basket */ }
}

export const CartProvider: React.FC<{ children: React.ReactNode; storageKey?: string }> = ({ children, storageKey = CART_KEY }) => {
  const [state, setState] = useState(() => loadCart(storageKey));

  useEffect(() => {
    saveCart(state.items, state.restaurantSlug, state.restaurantId, storageKey);
  }, [state, storageKey]);

  const addItem = useCallback((menuItem: DbMenuItem, sauces: string[], supplements: Supplement[], slug: string, restId: string, options?: { garnitureChoices?: { name: string; level: "oui" | "x2" }[]; viandeChoice?: string; extraCost?: number; baseChoice?: string; fritesInside?: boolean; accompagnementChoice?: { name: string; size?: string; sauces?: string[] }; accompagnementChoices?: { name: string; size?: string; sauces?: string[] }[]; drinkChoice?: { name: string; price: number }; dessertChoice?: { name: string; price: number }; customChoices?: StepSelection[]; sauceExtraCost?: number }) => {
    setState((prev) => {
      let items = prev.items;
      if (prev.restaurantSlug && prev.restaurantSlug !== slug) {
        items = [];
      }
      const suppTotal = supplements.reduce((sum, s) => sum + s.price, 0);
      const sauceExtra = options?.sauceExtraCost || 0;
      const totalPrice = menuItem.price + suppTotal + (options?.extraCost || 0) + sauceExtra;
      const cartId = `${menuItem.id}-${Date.now()}`;
      return {
        items: [...items, {
          id: cartId,
          menuItem,
          quantity: 1,
          selectedSauces: sauces,
          selectedSupplements: supplements,
          garnitureChoices: options?.garnitureChoices,
          viandeChoice: options?.viandeChoice,
          baseChoice: options?.baseChoice,
          fritesInside: options?.fritesInside,
          accompagnementChoice: options?.accompagnementChoice,
          accompagnementChoices: options?.accompagnementChoices,
          drinkChoice: options?.drinkChoice,
          dessertChoice: options?.dessertChoice,
          customChoices: options?.customChoices,
          sauceExtraCost: sauceExtra > 0 ? sauceExtra : undefined,
          totalPrice,
        }],
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
    try { localStorage.removeItem(storageKey); } catch { /* the in-memory basket is cleared */ }
  }, [storageKey]);

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
