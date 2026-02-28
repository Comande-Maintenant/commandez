import { ArrowLeft, UtensilsCrossed, ShoppingBag, Phone, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { POSOrderType } from "@/types/pos";
import type { POSPersonOrder, POSDrinkItem, POSDessertItem } from "@/types/pos";
import { formatPOSOrderSummary, calculateGrandTotal } from "@/lib/posHelpers";

interface Props {
  orderType: POSOrderType;
  persons: POSPersonOrder[];
  drinks: POSDrinkItem[];
  desserts: POSDessertItem[];
  dessertPending: boolean;
  customerName: string;
  tableNumber: string;
  notes: string;
  onSetCustomerName: (name: string) => void;
  onSetTableNumber: (num: string) => void;
  onSetNotes: (notes: string) => void;
  onEditPerson: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

const orderTypeConfig: Record<POSOrderType, { label: string; icon: typeof UtensilsCrossed }> = {
  sur_place: { label: "Sur place", icon: UtensilsCrossed },
  a_emporter: { label: "A emporter", icon: ShoppingBag },
  telephone: { label: "Telephone", icon: Phone },
};

export const POSRecap = ({
  orderType,
  persons,
  drinks,
  desserts,
  dessertPending,
  customerName,
  tableNumber,
  notes,
  onSetCustomerName,
  onSetTableNumber,
  onSetNotes,
  onEditPerson,
  onSubmit,
  onBack,
  submitting,
}: Props) => {
  const grandTotal = calculateGrandTotal(persons, drinks, desserts);
  const cfg = orderTypeConfig[orderType];
  const Icon = cfg.icon;
  const personCount = persons.filter((p) => p.customization).length;
  const drinksTotal = drinks.reduce((sum, d) => sum + d.price * d.quantity, 0);
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
        <h2 className="text-xl font-bold text-foreground">Recap commande</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Order type badge */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-foreground/10 rounded-full text-sm font-medium text-foreground">
            <Icon className="h-4 w-4" />
            {cfg.label}
          </span>
          <span className="text-sm text-muted-foreground">{personCount} personne{personCount > 1 ? "s" : ""}</span>
        </div>

        {/* Per-person sections */}
        {persons.map((person) => {
          if (!person.customization) return null;
          const summary = formatPOSOrderSummary(person.customization);
          const baseName = person.customization.baseName;
          const viandeNames = person.customization.viandeNames.join("+");
          return (
            <div key={person.personIndex} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">{person.label}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-bold">{person.itemPrice.toFixed(2)} €</span>
                  <button
                    onClick={() => onEditPerson(person.personIndex)}
                    className="p-1.5 rounded-full hover:bg-secondary transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">{baseName} {viandeNames}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
            </div>
          );
        })}

        {/* Drinks section */}
        {drinks.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-foreground mb-2">Boissons</h3>
            <div className="space-y-1">
              {drinks.map((d) => (
                <div key={d.menuItemId} className="flex justify-between text-sm">
                  <span className="text-foreground">{d.quantity}x {d.name}</span>
                  <span className="text-foreground font-medium">{(d.price * d.quantity).toFixed(2)} €</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm text-muted-foreground">
              <span>Sous-total</span>
              <span>{drinksTotal.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* Desserts section */}
        {desserts.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-foreground mb-2">Desserts</h3>
            <div className="space-y-1">
              {desserts.map((d) => (
                <div key={d.menuItemId} className="flex justify-between text-sm">
                  <span className="text-foreground">{d.quantity}x {d.name}</span>
                  <span className="text-foreground font-medium">{(d.price * d.quantity).toFixed(2)} €</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm text-muted-foreground">
              <span>Sous-total</span>
              <span>{dessertsTotal.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* Dessert pending */}
        {dessertPending && desserts.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-3">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Dessert : peut-etre apres</p>
          </div>
        )}

        {/* Customer name + table */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Nom (optionnel)</label>
            <Input
              value={customerName}
              onChange={(e) => onSetCustomerName(e.target.value)}
              placeholder="Martin, Famille..."
              className="mt-1"
            />
          </div>
          {orderType === "sur_place" && (
            <div>
              <label className="text-sm text-muted-foreground">Table (optionnel)</label>
              <Input
                value={tableNumber}
                onChange={(e) => onSetTableNumber(e.target.value)}
                placeholder="4, terrasse..."
                className="mt-1"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <label className="text-sm text-muted-foreground">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => onSetNotes(e.target.value)}
            placeholder="Allergies, remarques..."
            rows={2}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
      </div>

      {/* Total + submit */}
      <div className="px-4 py-4 border-t border-border bg-background space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">Total</span>
          <span className="text-2xl font-bold text-foreground">{grandTotal.toFixed(2)} €</span>
        </div>
        <Button
          className="w-full rounded-xl min-h-[56px] text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
          onClick={onSubmit}
          disabled={submitting || personCount === 0}
        >
          {submitting ? "Envoi..." : "ENVOYER EN CUISINE"}
        </Button>
      </div>
    </motion.div>
  );
};
