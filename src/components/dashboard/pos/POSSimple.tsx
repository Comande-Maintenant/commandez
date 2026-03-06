import { useState } from "react";
import { ShoppingBag, UtensilsCrossed, Plus, Minus, Trash2, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import type { DbMenuItem } from "@/types/database";

interface CartLine {
  item: DbMenuItem;
  qty: number;
}

interface Props {
  menuItems: DbMenuItem[];
  availablePaymentMethods: string[];
  onSubmit: (items: any[], total: number, orderType: string, customerName: string, covers: number, paymentMethod: string) => Promise<void>;
  submitting: boolean;
}

export const POSSimple = ({ menuItems, availablePaymentMethods, onSubmit, submitting }: Props) => {
  const { t } = useLanguage();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<"sur_place" | "collect">("sur_place");
  const [customerName, setCustomerName] = useState("");
  const [covers, setCovers] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [screen, setScreen] = useState<"menu" | "recap" | "success">("menu");
  const [displayNumber, setDisplayNumber] = useState("");

  const categories = [...new Set(menuItems.filter((i) => i.enabled).map((i) => i.category))];
  const total = cart.reduce((s, l) => s + l.item.price * l.qty, 0);

  const addItem = (item: DbMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) return prev.map((l) => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => l.item.id === itemId ? { ...l, qty: l.qty + delta } : l)
        .filter((l) => l.qty > 0)
    );
  };

  const handleSubmit = async () => {
    const items = cart.map((l) => ({
      name: l.item.name,
      menu_item_id: l.item.id,
      quantity: l.qty,
      price: l.item.price,
      sauces: [],
      supplements: [],
    }));
    const name = customerName || `Caisse (${covers} pers.)`;
    await onSubmit(items, total, orderType, name, covers, paymentMethod);
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
        {displayNumber && <p className="text-lg text-muted-foreground mb-6">{displayNumber}</p>}
        <Button onClick={() => { setCart([]); setCustomerName(""); setCovers(1); setScreen("menu"); }} className="rounded-xl">
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
            <Minus className="h-5 w-5" />
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
          {cart.map((line) => (
            <div key={line.item.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{line.qty}x {line.item.name}</span>
              <span className="font-medium">{(line.item.price * line.qty).toFixed(2)} €</span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 flex justify-between font-bold text-foreground">
            <span>Total</span>
            <span>{total.toFixed(2)} €</span>
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
          disabled={submitting || cart.length === 0}
          className="w-full h-14 rounded-xl text-base font-semibold"
        >
          {submitting ? "..." : `Envoyer - ${total.toFixed(2)} €`}
        </Button>
      </motion.div>
    );
  }

  // Menu screen
  return (
    <div className="space-y-4">
      {/* Floating cart bar */}
      {cart.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-16 z-40 bg-foreground text-primary-foreground rounded-xl p-3 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm font-medium">{cart.reduce((s, l) => s + l.qty, 0)} articles</span>
            <span className="font-bold">{total.toFixed(2)} €</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCart([])} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
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

      {/* Categories + items grid */}
      {categories.map((cat) => {
        const items = menuItems.filter((i) => i.enabled && i.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {items.map((item) => {
                const inCart = cart.find((l) => l.item.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className={`relative text-left p-3 rounded-xl border-2 transition-all hover:shadow-sm ${
                      inCart ? "border-foreground bg-secondary" : "border-border bg-card"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground leading-tight">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.price.toFixed(2)} €</p>
                    {inCart && (
                      <div className="absolute top-1 right-1 flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }}
                          className="w-6 h-6 rounded-full bg-foreground text-primary-foreground flex items-center justify-center text-xs"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold text-foreground w-4 text-center">{inCart.qty}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }}
                          className="w-6 h-6 rounded-full bg-foreground text-primary-foreground flex items-center justify-center text-xs"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
