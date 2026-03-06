import { useState, useEffect } from "react";
import { ShoppingBag, UtensilsCrossed, Plus, Minus, Trash2, ChevronRight, Check, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/context/CartContext";
import { MenuItemCard } from "@/components/MenuItemCard";
import { fetchUniversalCustomizationData } from "@/lib/customizationApi";
import type { UniversalCustomizationData } from "@/types/customization";
import type { DbMenuItem } from "@/types/database";

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  menuItems: DbMenuItem[];
  primaryColor: string;
  availablePaymentMethods: string[];
  onSubmit: (items: any[], total: number, orderType: string, customerName: string, covers: number, paymentMethod: string) => Promise<void>;
  submitting: boolean;
}

export const POSSimple = ({ restaurantId, restaurantSlug, menuItems, primaryColor, availablePaymentMethods, onSubmit, submitting }: Props) => {
  const { items, subtotal, clearCart } = useCart();
  const [customizationData, setCustomizationData] = useState<UniversalCustomizationData | null>(null);
  const [orderType, setOrderType] = useState<"sur_place" | "collect">("sur_place");
  const [customerName, setCustomerName] = useState("");
  const [covers, setCovers] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [screen, setScreen] = useState<"menu" | "recap" | "success">("menu");

  useEffect(() => {
    clearCart();
    fetchUniversalCustomizationData(restaurantId).then(setCustomizationData);
  }, [restaurantId]);

  const categories = [...new Set(menuItems.filter((i) => i.enabled).map((i) => i.category))];

  const handleSubmit = async () => {
    const orderItems = items.map((i) => ({
      name: i.menuItem.name,
      menu_item_id: i.menuItem.id,
      quantity: i.quantity,
      price: i.totalPrice,
      sauces: i.selectedSauces,
      supplements: i.selectedSupplements.map((s) => ({ name: s.name, price: s.price })),
      viande_choice: i.viandeChoice || null,
      garniture_choices: i.garnitureChoices || null,
    }));
    const total = subtotal;
    const name = customerName || `Caisse (${covers} pers.)`;
    await onSubmit(orderItems, total, orderType, name, covers, paymentMethod);
    clearCart();
    setScreen("success");
  };

  if (screen === "success") {
    return (
      <div className="text-center py-16">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"
        >
          <Check className="h-10 w-10 text-green-600" />
        </motion.div>
        <p className="text-2xl font-bold text-foreground mb-2">Commande envoyee</p>
        <Button onClick={() => { setCustomerName(""); setCovers(1); setScreen("menu"); }} className="rounded-xl">
          Nouvelle commande
        </Button>
      </div>
    );
  }

  if (screen === "recap") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setScreen("menu")} className="p-2 rounded-xl hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-foreground">Recap commande</h2>
        </div>

        {/* Order type */}
        <div className="flex gap-3">
          <button
            onClick={() => setOrderType("sur_place")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${orderType === "sur_place" ? "border-foreground bg-foreground text-primary-foreground" : "border-border"}`}
          >
            <UtensilsCrossed className="h-4 w-4" /> Sur place
          </button>
          <button
            onClick={() => setOrderType("collect")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${orderType === "collect" ? "border-foreground bg-foreground text-primary-foreground" : "border-border"}`}
          >
            <ShoppingBag className="h-4 w-4" /> A emporter
          </button>
        </div>

        {orderType === "sur_place" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Couverts :</span>
            <button onClick={() => setCovers(Math.max(1, covers - 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center">-</button>
            <span className="font-bold">{covers}</span>
            <button onClick={() => setCovers(covers + 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center">+</button>
          </div>
        )}

        <Input
          placeholder="Nom client (optionnel)"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="h-12 rounded-xl"
        />

        {/* Items */}
        <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
          {items.map((line) => (
            <div key={line.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-foreground font-medium">{line.quantity}x {line.menuItem.name}</span>
                {line.viandeChoice && <span className="text-muted-foreground text-xs ml-1">({line.viandeChoice})</span>}
                {line.selectedSauces.length > 0 && (
                  <p className="text-xs text-muted-foreground">{line.selectedSauces.join(", ")}</p>
                )}
              </div>
              <span className="font-medium">{(line.totalPrice * line.quantity).toFixed(2)} €</span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 flex justify-between font-bold text-foreground">
            <span>Total</span>
            <span>{subtotal.toFixed(2)} €</span>
          </div>
        </div>

        {/* Payment */}
        <div className="flex gap-2 flex-wrap">
          {(availablePaymentMethods.length > 0 ? availablePaymentMethods : ["cash", "card"]).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${paymentMethod === m ? "border-foreground bg-foreground text-primary-foreground" : "border-border"}`}
            >
              {m === "cash" ? "Especes" : m === "card" ? "CB" : m === "ticket_restaurant" ? "Ticket resto" : m}
            </button>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="w-full h-14 rounded-xl text-base font-semibold"
        >
          {submitting ? "..." : `Envoyer - ${subtotal.toFixed(2)} €`}
        </Button>
      </motion.div>
    );
  }

  // Menu screen - reuse MenuItemCard with full customization
  return (
    <div className="space-y-4">
      {/* Floating cart bar */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-16 z-40 rounded-xl p-3 flex items-center justify-between shadow-lg text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm font-medium">{items.reduce((s, l) => s + l.quantity, 0)} articles</span>
            <span className="font-bold">{subtotal.toFixed(2)} €</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearCart} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-lg gap-1"
              onClick={() => setScreen("recap")}
            >
              Valider <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Menu items by category */}
      {categories.map((cat) => {
        const catItems = menuItems.filter((i) => i.enabled && i.category === cat);
        if (catItems.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h3>
            <div className="space-y-2">
              {catItems.map((item, i) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  index={i}
                  restaurantSlug={restaurantSlug}
                  restaurantId={restaurantId}
                  primaryColor={primaryColor}
                  customizationData={customizationData}
                  menuItems={menuItems}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
