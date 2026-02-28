import { useMemo } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { DbMenuItem } from "@/types/database";
import type { POSDessertItem } from "@/types/pos";

interface Props {
  desserts: POSDessertItem[];
  menuItems: DbMenuItem[];
  onUpdateDesserts: (desserts: POSDessertItem[]) => void;
  onSetDessertPending: (pending: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export const POSDesserts = ({ desserts, menuItems, onUpdateDesserts, onSetDessertPending, onNext, onBack }: Props) => {
  const dessertItems = useMemo(
    () => menuItems.filter((item) => item.category.toLowerCase().includes("dessert")),
    [menuItems]
  );

  const addDessert = (menuItem: DbMenuItem) => {
    const updated = [...desserts];
    const existing = updated.findIndex((d) => d.menuItemId === menuItem.id);
    if (existing >= 0) {
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
    } else {
      updated.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
      });
    }
    onUpdateDesserts(updated);
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...desserts];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index] = { ...updated[index], quantity: newQty };
    }
    onUpdateDesserts(updated);
  };

  const dessertsTotal = desserts.reduce((sum, d) => sum + d.price * d.quantity, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-[calc(100vh-2rem)] max-h-[900px]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-xl font-bold text-foreground">Desserts</h2>
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {dessertItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucun dessert dans le menu</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dessertItems.map((item) => {
              const inCart = desserts.find((d) => d.menuItemId === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => addDessert(item)}
                  className={`relative bg-card border-2 rounded-2xl p-4 text-left hover:shadow-md transition-all active:scale-[0.97] min-h-[80px] ${
                    inCart ? "border-foreground" : "border-border"
                  }`}
                >
                  <p className="font-semibold text-foreground text-sm leading-tight">{item.name}</p>
                  <p className="text-foreground/70 font-bold mt-1">{item.price.toFixed(2)} €</p>
                  {inCart && (
                    <span className="absolute top-2 right-2 bg-foreground text-primary-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recap */}
      {desserts.length > 0 && (
        <div className="border-t border-border bg-card px-4 py-3">
          <div className="space-y-1 mb-2 max-h-24 overflow-y-auto">
            {desserts.map((d, i) => (
              <div key={d.menuItemId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{d.quantity}x {d.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">{(d.price * d.quantity).toFixed(2)} €</span>
                  <button onClick={() => updateQuantity(i, -1)} className="p-1 rounded-full hover:bg-secondary">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => updateQuantity(i, 1)} className="p-1 rounded-full hover:bg-secondary">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Total desserts : {dessertsTotal.toFixed(2)} €</p>
        </div>
      )}

      {/* Bottom buttons */}
      <div className="px-4 py-3 border-t border-border bg-background space-y-2">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl min-h-[48px] text-sm"
            onClick={() => { onUpdateDesserts([]); onSetDessertPending(false); onNext(); }}
          >
            Pas de dessert
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-xl min-h-[48px] text-sm"
            onClick={() => { onUpdateDesserts([]); onSetDessertPending(true); onNext(); }}
          >
            Peut-etre apres
          </Button>
        </div>
        {desserts.length > 0 && (
          <Button
            className="w-full rounded-xl min-h-[48px] text-base font-semibold"
            onClick={() => { onSetDessertPending(false); onNext(); }}
          >
            Suivant
          </Button>
        )}
      </div>
    </motion.div>
  );
};
