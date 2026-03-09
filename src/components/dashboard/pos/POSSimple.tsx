import { useState, useEffect, useMemo } from "react";
import { ShoppingBag, UtensilsCrossed, Plus, Minus, Trash2, ChevronRight, Check, ArrowLeft, Timer } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { MenuItemCard } from "@/components/MenuItemCard";
import { fetchUniversalCustomizationData } from "@/lib/customizationApi";
import { fetchOrdersByPeriod } from "@/lib/api";
import type { UniversalCustomizationData } from "@/types/customization";
import type { DbMenuItem } from "@/types/database";

interface PrepTimeConfig {
  default_minutes: number;
  per_item_minutes: number;
  max_minutes: number;
}

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  menuItems: DbMenuItem[];
  primaryColor: string;
  availablePaymentMethods: string[];
  prepTimeConfig?: PrepTimeConfig | null;
  onSubmit: (items: any[], total: number, orderType: string, customerName: string, covers: number, paymentMethod: string, estimatedMinutes: number) => Promise<void>;
  submitting: boolean;
}

export const POSSimple = ({ restaurantId, restaurantSlug, menuItems, primaryColor, availablePaymentMethods, prepTimeConfig, onSubmit, submitting }: Props) => {
  const { items, subtotal, clearCart } = useCart();
  const { t } = useLanguage();
  const [customizationData, setCustomizationData] = useState<UniversalCustomizationData | null>(null);
  const [orderType, setOrderType] = useState<"sur_place" | "collect">("sur_place");
  const [customerName, setCustomerName] = useState("");
  const [covers, setCovers] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [screen, setScreen] = useState<"menu" | "recap" | "success">("menu");
  const [prepMinutes, setPrepMinutes] = useState(10);

  // Calculate default prep time based on item count
  const defaultPrepMinutes = useMemo(() => {
    const itemCount = items.reduce((s, l) => s + l.quantity, 0);
    const cfg = prepTimeConfig || { default_minutes: 10, per_item_minutes: 2, max_minutes: 60 };
    return Math.min(cfg.default_minutes + itemCount * cfg.per_item_minutes, cfg.max_minutes);
  }, [items, prepTimeConfig]);

  // Reset prep time when items change
  useEffect(() => {
    setPrepMinutes(defaultPrepMinutes);
  }, [defaultPrepMinutes]);

  const [topItemIds, setTopItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    clearCart();
    fetchUniversalCustomizationData(restaurantId).then(setCustomizationData);
    // Compute popular items from last 14 days of orders
    const since = new Date();
    since.setDate(since.getDate() - 14);
    fetchOrdersByPeriod(restaurantId, since).then((orders) => {
      const counts: Record<string, number> = {};
      for (const order of orders) {
        for (const item of (order.items as any[]) || []) {
          const id = item.menu_item_id;
          if (id) counts[id] = (counts[id] || 0) + (item.quantity || 1);
        }
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const topIds = new Set(sorted.slice(0, 6).map(([id]) => id));
      setTopItemIds(topIds);
    }).catch(() => {});
  }, [restaurantId]);

  // Popular items: from real order data, fallback to static `popular` flag
  const popularItems = useMemo(() => {
    const enabled = menuItems.filter((i) => i.enabled);
    if (topItemIds.size > 0) {
      return enabled.filter((i) => topItemIds.has(i.id));
    }
    return enabled.filter((i) => i.popular);
  }, [menuItems, topItemIds]);

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
    const name = customerName || t("pos.pos_name").replace("{covers}", String(covers));
    await onSubmit(orderItems, total, orderType, name, covers, paymentMethod, prepMinutes);
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
        <p className="text-2xl font-bold text-foreground mb-2">{t("pos.order_sent")}</p>
        <Button onClick={() => { setCustomerName(""); setCovers(1); setScreen("menu"); }} className="rounded-xl">
          {t("pos.new_order")}
        </Button>
      </div>
    );
  }

  if (screen === "recap") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setScreen("menu")} className="p-2 rounded-xl hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-foreground">{t("pos.recap")}</h2>
        </div>

        {/* Order type */}
        <div className="flex gap-3">
          <button
            onClick={() => setOrderType("sur_place")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${orderType === "sur_place" ? "border-foreground bg-foreground text-primary-foreground" : "border-border"}`}
          >
            <UtensilsCrossed className="h-4 w-4" /> {t("pos.dine_in")}
          </button>
          <button
            onClick={() => setOrderType("collect")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${orderType === "collect" ? "border-foreground bg-foreground text-primary-foreground" : "border-border"}`}
          >
            <ShoppingBag className="h-4 w-4" /> {t("pos.takeaway")}
          </button>
        </div>

        {orderType === "sur_place" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("pos.covers_label")}</span>
            <button onClick={() => setCovers(Math.max(1, covers - 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center">-</button>
            <span className="font-bold">{covers}</span>
            <button onClick={() => setCovers(covers + 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center">+</button>
          </div>
        )}

        <Input
          placeholder={t("pos.customer_name")}
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
            <span>{t("pos.total")}</span>
            <span>{subtotal.toFixed(2)} €</span>
          </div>
        </div>

        {/* Add more items */}
        <button
          onClick={() => setScreen("menu")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
        >
          <Plus className="h-4 w-4" />
          {t("pos.add_item")}
        </button>

        {/* Payment */}
        <div className="flex gap-2 flex-wrap">
          {(availablePaymentMethods.length > 0 ? availablePaymentMethods : ["cash", "card"]).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${paymentMethod === m ? "border-foreground bg-foreground text-primary-foreground" : "border-border"}`}
            >
              {m === "cash" ? t("pos.cash") : m === "card" ? t("pos.card") : m === "ticket_restaurant" ? t("pos.meal_voucher") : m}
            </button>
          ))}
        </div>

        {/* Estimated prep time */}
        <div className="bg-secondary/50 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t("pos.prep_time")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPrepMinutes(Math.max(1, prepMinutes - 5))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-lg font-bold text-foreground min-w-[48px] text-center">{prepMinutes} {t("dashboard.stats.min_suffix")}</span>
              <button
                onClick={() => setPrepMinutes(Math.min(120, prepMinutes + 5))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="w-full h-14 rounded-xl text-base font-semibold"
        >
          {submitting ? t("pos.sending") : `${t("pos.send_to_kitchen")} - ${subtotal.toFixed(2)} €`}
        </Button>
      </motion.div>
    );
  }

  // Menu screen - reuse MenuItemCard with full customization
  return (
    <div className="space-y-4 pb-20">
      {/* Floating cart bar - fixed at bottom above nav */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-[56px] lg:bottom-0 left-0 right-0 lg:left-60 z-40 mx-3 lg:mx-auto lg:max-w-6xl rounded-xl p-3 flex items-center justify-between shadow-lg text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm font-medium">{t("cart.items").replace("{count}", String(items.reduce((s, l) => s + l.quantity, 0)))}</span>
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
              {t("pos.validate")} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Popular items first */}
      {popularItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-2">{t("pos.popular")}</h3>
          <div className="space-y-2">
            {popularItems.map((item, i) => (
              <MenuItemCard
                key={`pop-${item.id}`}
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
      )}

      {/* Menu items by category */}
      {categories.map((cat) => {
        const catItems = menuItems
          .filter((i) => i.enabled && i.category === cat)
          .sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
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
