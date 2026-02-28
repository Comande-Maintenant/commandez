import { ArrowLeft, UtensilsCrossed, ShoppingBag, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { POSOrderType } from "@/types/pos";
import type { POSPersonOrder, POSItem } from "@/types/pos";

interface Props {
  orderType: POSOrderType;
  covers: number;
  persons: POSPersonOrder[];
  upsellItems: POSItem[];
  customerName: string;
  notes: string;
  onSetCustomerName: (name: string) => void;
  onSetNotes: (notes: string) => void;
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
  covers,
  persons,
  upsellItems,
  customerName,
  notes,
  onSetCustomerName,
  onSetNotes,
  onSubmit,
  onBack,
  submitting,
}: Props) => {
  const personsTotal = persons.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + i.price * i.quantity, 0),
    0
  );
  const upsellTotal = upsellItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const grandTotal = personsTotal + upsellTotal;
  const cfg = orderTypeConfig[orderType];
  const Icon = cfg.icon;

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
          <span className="text-sm text-muted-foreground">{covers} couvert{covers > 1 ? "s" : ""}</span>
        </div>

        {/* Per-person sections */}
        {persons.map((person) => {
          if (person.items.length === 0) return null;
          const personTotal = person.items.reduce((s, i) => s + i.price * i.quantity, 0);
          return (
            <div key={person.personIndex} className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-semibold text-foreground mb-2">{person.label}</h3>
              <div className="space-y-1">
                {person.items.map((item) => (
                  <div key={item.menuItemId} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.quantity}x {item.name}</span>
                    <span className="text-foreground font-medium">{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm font-semibold">
                <span>Sous-total</span>
                <span>{personTotal.toFixed(2)} €</span>
              </div>
            </div>
          );
        })}

        {/* Upsell section */}
        {upsellItems.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-foreground mb-2">Boissons / Desserts</h3>
            <div className="space-y-1">
              {upsellItems.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-sm">
                  <span className="text-foreground">{item.quantity}x {item.name}</span>
                  <span className="text-foreground font-medium">{(item.price * item.quantity).toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer name */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <label className="text-sm text-muted-foreground">Nom (optionnel)</label>
          <Input
            value={customerName}
            onChange={(e) => onSetCustomerName(e.target.value)}
            placeholder="Table 4, Martin..."
            className="mt-1"
          />
        </div>

        {/* Notes */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <label className="text-sm text-muted-foreground">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => onSetNotes(e.target.value)}
            placeholder="Allergies, sans oignons..."
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
          disabled={submitting}
        >
          {submitting ? "Envoi..." : "Envoyer en cuisine"}
        </Button>
      </div>
    </motion.div>
  );
};
