import React, { createContext, useContext, useState, useCallback } from "react";
import type { MenuItem, Supplement } from "@/data/mockData";

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  selectedSauces: string[];
  selectedSupplements: Supplement[];
  totalPrice: number;
}

interface CartContextType {
  items: CartItem[];
  restaurantSlug: string | null;
  addItem: (item: MenuItem, sauces: string[], supplements: Supplement[], restaurantSlug: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);

  const addItem = useCallback((menuItem: MenuItem, sauces: string[], supplements: Supplement[], slug: string) => {
    setRestaurantSlug((prev) => {
      if (prev && prev !== slug) {
        setItems([]);
      }
      return slug;
    });

    const suppTotal = supplements.reduce((sum, s) => sum + s.price, 0);
    const totalPrice = menuItem.price + suppTotal;
    const cartId = `${menuItem.id}-${Date.now()}`;

    setItems((prev) => [
      ...prev,
      { id: cartId, menuItem, quantity: 1, selectedSauces: sauces, selectedSupplements: supplements, totalPrice },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setRestaurantSlug(null);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, restaurantSlug, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
