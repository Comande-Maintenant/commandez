import { useState, useMemo, useCallback } from "react";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateOrderItems } from "@/lib/api";
import { calculateCustomizationPrice, formatPOSOrderSummary } from "@/lib/posHelpers";
import type { DbMenuItem, DbOrder, CustomizationConfig } from "@/types/database";
import type { POSCustomization, POSDrinkItem, POSDessertItem } from "@/types/pos";
import { usePOSCustomization } from "./usePOSCustomization";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  order: DbOrder;
  menuItems: DbMenuItem[];
  config: CustomizationConfig | null;
  onUpdated: () => void;
}

type AddMode = "custom" | "drink" | "dessert";

export const POSAddItemModal = ({ open, onClose, order, menuItems, config, onUpdated }: Props) => {
  const [mode, setMode] = useState<AddMode>("drink");
  const [extraDrinks, setExtraDrinks] = useState<POSDrinkItem[]>([]);
  const [extraDesserts, setExtraDesserts] = useState<POSDessertItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const customization = usePOSCustomization(config);

  const drinkItems = useMemo(
    () => menuItems.filter((item) => item.category.toLowerCase().includes("boisson")),
    [menuItems]
  );

  const dessertItems = useMemo(
    () => menuItems.filter((item) => item.category.toLowerCase().includes("dessert")),
    [menuItems]
  );

  const addDrink = (item: DbMenuItem) => {
    setExtraDrinks((prev) => {
      const existing = prev.findIndex((d) => d.menuItemId === item.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateDrinkQty = (index: number, delta: number) => {
    setExtraDrinks((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity: newQty };
      }
      return updated;
    });
  };

  const addDessert = (item: DbMenuItem) => {
    setExtraDesserts((prev) => {
      const existing = prev.findIndex((d) => d.menuItemId === item.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateDessertQty = (index: number, delta: number) => {
    setExtraDesserts((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity: newQty };
      }
      return updated;
    });
  };

  const extraTotal = useMemo(() => {
    const drinksSum = extraDrinks.reduce((sum, d) => sum + d.price * d.quantity, 0);
    const dessertsSum = extraDesserts.reduce((sum, d) => sum + d.price * d.quantity, 0);
    return drinksSum + dessertsSum;
  }, [extraDrinks, extraDesserts]);

  const handleConfirm = useCallback(async () => {
    if (extraDrinks.length === 0 && extraDesserts.length === 0) return;
    setSubmitting(true);
    try {
      const existingItems = (order.items as any[]) || [];
      const newItems = [...existingItems];

      for (const d of extraDrinks) {
        newItems.push({
          type: "drink",
          personLabel: "Boissons (ajout)",
          name: d.name,
          price: d.price,
          quantity: d.quantity,
        });
      }

      for (const d of extraDesserts) {
        newItems.push({
          type: "dessert",
          personLabel: "Desserts (ajout)",
          name: d.name,
          price: d.price,
          quantity: d.quantity,
        });
      }

      const newTotal = Number(order.total) + extraTotal;
      await updateOrderItems(order.id, newItems, newTotal);
      toast.success("Article(s) ajoute(s)");
      onUpdated();
      onClose();
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSubmitting(false);
    }
  }, [order, extraDrinks, extraDesserts, extraTotal, onUpdated, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter a #{order.order_number}</DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("drink")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === "drink" ? "bg-foreground text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            Boissons
          </button>
          <button
            onClick={() => setMode("dessert")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === "dessert" ? "bg-foreground text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            Desserts
          </button>
        </div>

        {/* Drink items */}
        {mode === "drink" && (
          <div className="grid grid-cols-2 gap-2">
            {drinkItems.map((item) => {
              const inCart = extraDrinks.find((d) => d.menuItemId === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => addDrink(item)}
                  className={`relative bg-card border-2 rounded-xl p-3 text-left transition-all active:scale-[0.97] min-h-[56px] ${
                    inCart ? "border-foreground" : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} €</p>
                  {inCart && (
                    <span className="absolute top-1 right-1 bg-foreground text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Dessert items */}
        {mode === "dessert" && (
          <div className="grid grid-cols-2 gap-2">
            {dessertItems.map((item) => {
              const inCart = extraDesserts.find((d) => d.menuItemId === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => addDessert(item)}
                  className={`relative bg-card border-2 rounded-xl p-3 text-left transition-all active:scale-[0.97] min-h-[56px] ${
                    inCart ? "border-foreground" : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} €</p>
                  {inCart && (
                    <span className="absolute top-1 right-1 bg-foreground text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected extras recap */}
        {(extraDrinks.length > 0 || extraDesserts.length > 0) && (
          <div className="mt-4 pt-3 border-t border-border space-y-1">
            {extraDrinks.map((d, i) => (
              <div key={d.menuItemId} className="flex items-center justify-between text-sm">
                <span>{d.quantity}x {d.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{(d.price * d.quantity).toFixed(2)} €</span>
                  <button onClick={() => updateDrinkQty(i, -1)} className="p-1 rounded-full hover:bg-secondary">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button onClick={() => updateDrinkQty(i, 1)} className="p-1 rounded-full hover:bg-secondary">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {extraDesserts.map((d, i) => (
              <div key={d.menuItemId} className="flex items-center justify-between text-sm">
                <span>{d.quantity}x {d.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{(d.price * d.quantity).toFixed(2)} €</span>
                  <button onClick={() => updateDessertQty(i, -1)} className="p-1 rounded-full hover:bg-secondary">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button onClick={() => updateDessertQty(i, 1)} className="p-1 rounded-full hover:bg-secondary">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-2">
              <span>A ajouter</span>
              <span>+{extraTotal.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* Confirm button */}
        <Button
          className="w-full rounded-xl min-h-[48px] text-base font-semibold mt-4"
          onClick={handleConfirm}
          disabled={submitting || (extraDrinks.length === 0 && extraDesserts.length === 0)}
        >
          {submitting ? "Ajout..." : "Confirmer l'ajout"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
