import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { DbMenuItem } from "@/types/database";
import type { POSItem } from "@/types/pos";

interface Props {
  upsellItems: POSItem[];
  menuItems: DbMenuItem[];
  onUpdateUpsell: (items: POSItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const UPSELL_CATEGORIES = ["boissons", "desserts"];

export const POSUpsell = ({ upsellItems, menuItems, onUpdateUpsell, onNext, onBack }: Props) => {
  const filteredMenu = useMemo(
    () =>
      menuItems.filter((item) =>
        UPSELL_CATEGORIES.some((cat) => item.category.toLowerCase().includes(cat))
      ),
    [menuItems]
  );

  const addItem = (menuItem: DbMenuItem) => {
    const updated = [...upsellItems];
    const existing = updated.findIndex((i) => i.menuItemId === menuItem.id);
    if (existing >= 0) {
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
    } else {
      updated.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        category: menuItem.category,
      });
    }
    onUpdateUpsell(updated);
  };

  const updateQuantity = (itemIndex: number, delta: number) => {
    const updated = [...upsellItems];
    const newQty = updated[itemIndex].quantity + delta;
    if (newQty <= 0) {
      updated.splice(itemIndex, 1);
    } else {
      updated[itemIndex] = { ...updated[itemIndex], quantity: newQty };
    }
    onUpdateUpsell(updated);
  };

  const upsellTotal = upsellItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

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
        <h2 className="text-xl font-bold text-foreground">Boissons & Desserts</h2>
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filteredMenu.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucun item dans ces categories</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredMenu.map((item) => {
              const inCart = upsellItems.find((i) => i.menuItemId === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => addItem(item)}
                  className={`relative bg-card border rounded-2xl p-4 text-left hover:shadow-md transition-all active:scale-[0.97] min-h-[80px] ${
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

      {/* Upsell recap */}
      {upsellItems.length > 0 && (
        <div className="border-t border-border bg-card px-4 py-3">
          <div className="space-y-1 mb-2 max-h-24 overflow-y-auto">
            {upsellItems.map((item, i) => (
              <div key={item.menuItemId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.quantity}x {item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">{(item.price * item.quantity).toFixed(2)} €</span>
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
          <p className="text-sm text-muted-foreground">Total extras : {upsellTotal.toFixed(2)} €</p>
        </div>
      )}

      {/* Bottom buttons */}
      <div className="px-4 py-3 border-t border-border bg-background flex gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-xl min-h-[56px] text-base"
          onClick={onNext}
        >
          Passer
        </Button>
        <Button
          className="flex-1 rounded-xl min-h-[56px] text-base font-semibold"
          onClick={onNext}
          disabled={upsellItems.length === 0}
        >
          Suivant
        </Button>
      </div>
    </motion.div>
  );
};
