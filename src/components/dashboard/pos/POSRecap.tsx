import { ArrowLeft, UtensilsCrossed, ShoppingBag, Phone, Pencil, CreditCard, Banknote, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { POSOrderType } from "@/types/pos";
import type { POSPersonOrder, POSDrinkItem, POSDessertItem } from "@/types/pos";
import { formatPOSOrderSummary, calculateGrandTotal } from "@/lib/posHelpers";
import { useLanguage } from "@/context/LanguageContext";

const paymentOptionsDef = [
  { id: "cash", labelKey: "pos.cash", icon: Banknote },
  { id: "card", labelKey: "pos.card", icon: CreditCard },
  { id: "ticket_restaurant", labelKey: "pos.meal_voucher", icon: Ticket },
] as const;

interface Props {
  orderType: POSOrderType;
  persons: POSPersonOrder[];
  drinks: POSDrinkItem[];
  desserts: POSDessertItem[];
  dessertPending: boolean;
  customerName: string;
  tableNumber: string;
  notes: string;
  paymentMethod: string;
  availablePaymentMethods: string[];
  onSetCustomerName: (name: string) => void;
  onSetTableNumber: (num: string) => void;
  onSetNotes: (notes: string) => void;
  onSetPaymentMethod: (method: string) => void;
  onEditPerson: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

const orderTypeConfig: Record<POSOrderType, { labelKey: string; icon: typeof UtensilsCrossed }> = {
  sur_place: { labelKey: "pos.dine_in", icon: UtensilsCrossed },
  a_emporter: { labelKey: "pos.takeaway", icon: ShoppingBag },
  telephone: { labelKey: "pos.phone", icon: Phone },
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
  paymentMethod,
  availablePaymentMethods,
  onSetCustomerName,
  onSetTableNumber,
  onSetNotes,
  onSetPaymentMethod,
  onEditPerson,
  onSubmit,
  onBack,
  submitting,
}: Props) => {
  const { t } = useLanguage();
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
        <h2 className="text-xl font-bold text-foreground">{t('pos.recap')}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Order type badge */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-foreground/10 rounded-full text-sm font-medium text-foreground">
            <Icon className="h-4 w-4" />
            {t(cfg.labelKey)}
          </span>
          <span className="text-sm text-muted-foreground">{t('pos.persons_count', { count: personCount })}</span>
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
                    title={t('pos.modify')}
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
            <h3 className="font-semibold text-foreground mb-2">{t('pos.drinks')}</h3>
            <div className="space-y-1">
              {drinks.map((d) => (
                <div key={d.menuItemId} className="flex justify-between text-sm">
                  <span className="text-foreground">{d.quantity}x {d.name}</span>
                  <span className="text-foreground font-medium">{(d.price * d.quantity).toFixed(2)} €</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm text-muted-foreground">
              <span>{t('pos.subtotal')}</span>
              <span>{drinksTotal.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* Desserts section */}
        {desserts.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-foreground mb-2">{t('pos.desserts')}</h3>
            <div className="space-y-1">
              {desserts.map((d) => (
                <div key={d.menuItemId} className="flex justify-between text-sm">
                  <span className="text-foreground">{d.quantity}x {d.name}</span>
                  <span className="text-foreground font-medium">{(d.price * d.quantity).toFixed(2)} €</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm text-muted-foreground">
              <span>{t('pos.subtotal')}</span>
              <span>{dessertsTotal.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* Dessert pending */}
        {dessertPending && desserts.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-3">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">{t('pos.dessert_pending')}</p>
          </div>
        )}

        {/* Customer name + table */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">{t('pos.customer_name')}</label>
            <Input
              value={customerName}
              onChange={(e) => onSetCustomerName(e.target.value)}
              placeholder={t('pos.customer_name_placeholder')}
              className="mt-1"
            />
          </div>
          {orderType === "sur_place" && (
            <div>
              <label className="text-sm text-muted-foreground">{t('pos.table')}</label>
              <Input
                value={tableNumber}
                onChange={(e) => onSetTableNumber(e.target.value)}
                placeholder={t('pos.table_placeholder')}
                className="mt-1"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <label className="text-sm text-muted-foreground">{t('pos.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => onSetNotes(e.target.value)}
            placeholder={t('pos.notes_placeholder')}
            rows={2}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>

        {/* Payment method */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <label className="text-sm text-muted-foreground mb-2 block">{t('pos.payment_method')}</label>
          <div className="flex gap-2">
            {paymentOptionsDef
              .filter((opt) => availablePaymentMethods.includes(opt.id))
              .map((opt) => {
                const Icon = opt.icon;
                const isActive = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onSetPaymentMethod(opt.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                      isActive
                        ? "border-foreground bg-foreground text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(opt.labelKey)}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Total + submit */}
      <div className="px-4 py-4 border-t border-border bg-background space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">{t('pos.total')}</span>
          <span className="text-2xl font-bold text-foreground">{grandTotal.toFixed(2)} €</span>
        </div>
        <Button
          className="w-full rounded-xl min-h-[56px] text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
          onClick={onSubmit}
          disabled={submitting || personCount === 0}
        >
          {submitting ? t('pos.sending') : t('pos.send_to_kitchen')}
        </Button>
      </div>
    </motion.div>
  );
};
