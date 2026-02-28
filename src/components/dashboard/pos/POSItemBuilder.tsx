import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { DbMenuItem } from "@/types/database";
import type { POSPersonOrder, POSItem } from "@/types/pos";

interface Props {
  persons: POSPersonOrder[];
  currentPerson: number;
  menuItems: DbMenuItem[];
  categories: string[];
  onUpdatePersons: (persons: POSPersonOrder[]) => void;
  onSetCurrentPerson: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export const POSItemBuilder = ({
  persons,
  currentPerson,
  menuItems,
  categories,
  onUpdatePersons,
  onSetCurrentPerson,
  onNext,
  onBack,
}: Props) => {
  const [activeCategory, setActiveCategory] = useState(categories[0] || "");

  const filteredItems = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [menuItems, activeCategory]
  );

  const person = persons[currentPerson];
  const personItems = person?.items || [];
  const personTotal = personItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const personItemCount = personItems.reduce((sum, i) => sum + i.quantity, 0);

  const addItem = (menuItem: DbMenuItem) => {
    const updated = [...persons];
    const pItems = [...updated[currentPerson].items];
    const existing = pItems.findIndex((i) => i.menuItemId === menuItem.id);
    if (existing >= 0) {
      pItems[existing] = { ...pItems[existing], quantity: pItems[existing].quantity + 1 };
    } else {
      pItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        category: menuItem.category,
      });
    }
    updated[currentPerson] = { ...updated[currentPerson], items: pItems };
    onUpdatePersons(updated);
  };

  const updateQuantity = (itemIndex: number, delta: number) => {
    const updated = [...persons];
    const pItems = [...updated[currentPerson].items];
    const newQty = pItems[itemIndex].quantity + delta;
    if (newQty <= 0) {
      pItems.splice(itemIndex, 1);
    } else {
      pItems[itemIndex] = { ...pItems[itemIndex], quantity: newQty };
    }
    updated[currentPerson] = { ...updated[currentPerson], items: pItems };
    onUpdatePersons(updated);
  };

  const goToPerson = (index: number) => {
    if (index >= 0 && index < persons.length) {
      onSetCurrentPerson(index);
    }
  };

  const isLastPerson = currentPerson === persons.length - 1;

  const handleNext = () => {
    if (!isLastPerson) {
      goToPerson(currentPerson + 1);
    } else {
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-[calc(100vh-2rem)] max-h-[900px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPerson(currentPerson - 1)}
            disabled={currentPerson === 0}
            className="p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold text-foreground min-w-[140px] text-center">
            Personne {currentPerson + 1}/{persons.length}
          </span>
          <button
            onClick={() => goToPerson(currentPerson + 1)}
            disabled={currentPerson === persons.length - 1}
            className="p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="w-9" />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 border-b border-border bg-background">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px] ${
              activeCategory === cat
                ? "bg-foreground text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const inCart = personItems.find((i) => i.menuItemId === item.id);
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
      </div>

      {/* Person mini recap */}
      {personItemCount > 0 && (
        <div className="border-t border-border bg-card px-4 py-3">
          <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
            {personItems.map((item, i) => (
              <div key={item.menuItemId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {item.quantity}x {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">
                    {(item.price * item.quantity).toFixed(2)} €
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateQuantity(i, -1); }}
                    className="p-1 rounded-full hover:bg-secondary"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateQuantity(i, 1); }}
                    className="p-1 rounded-full hover:bg-secondary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {personItemCount} article{personItemCount > 1 ? "s" : ""} : {personTotal.toFixed(2)} €
            </span>
          </div>
        </div>
      )}

      {/* Bottom button */}
      <div className="px-4 py-3 border-t border-border bg-background">
        <Button
          className="w-full rounded-xl min-h-[56px] text-base font-semibold"
          onClick={handleNext}
        >
          {isLastPerson ? "Boissons / Desserts" : `Personne suivante (${currentPerson + 2}/${persons.length})`}
        </Button>
      </div>
    </motion.div>
  );
};
