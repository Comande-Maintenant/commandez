import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ShoppingBag, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { createOrder, fetchClientIp, fetchRestaurantById } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProtectedPhone } from "@/components/ProtectedPhone";
import { PickupTimePicker } from "@/components/PickupTimePicker";

const OrderPage = () => {
  const { items, subtotal, clearCart, restaurantId, restaurantSlug } = useCart();
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restaurantPhone, setRestaurantPhone] = useState<string | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const clientIpRef = useRef<string | null>(null);

  // Fetch restaurant phone + client IP on mount
  useEffect(() => {
    if (!restaurantId) return;
    fetchRestaurantById(restaurantId).then((r) => {
      if (r?.restaurant_phone) setRestaurantPhone(r.restaurant_phone);
      if (r?.prep_time_config) {
        const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
        const est = Math.min(
          r.prep_time_config.default_minutes + itemCount * r.prep_time_config.per_item_minutes,
          r.prep_time_config.max_minutes
        );
        setEstimatedMinutes(est);
      }
    });
    fetchClientIp().then((ip) => { clientIpRef.current = ip; });
  }, [restaurantId]);

  const total = subtotal;

  const handleConfirm = async () => {
    if (!restaurantId || submitting) return;
    setSubmitting(true);
    try {
      const orderItems = items.map((i) => ({
        name: i.menuItem.name,
        quantity: i.quantity,
        sauces: i.selectedSauces,
        supplements: i.selectedSupplements.map((s) => s.name),
        price: i.totalPrice,
      }));
      const order = await createOrder({
        restaurant_id: restaurantId,
        customer_name: name,
        customer_phone: phone,
        order_type: "collect",
        items: orderItems,
        subtotal,
        total,
        client_ip: clientIpRef.current,
        pickup_time: pickupTime,
      });
      localStorage.setItem("active-order", JSON.stringify({
        orderId: order.id,
        restaurantSlug: restaurantSlug || "",
        createdAt: Date.now(),
      }));
      // Save last order for reorder feature
      if (restaurantId) {
        localStorage.setItem(`last-order-${restaurantId}`, JSON.stringify(orderItems));
      }
      clearCart();
      navigate("/suivi/" + order.id);
    } catch (e) {
      console.error("Order error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/20" />
        <p className="text-muted-foreground">{t("cart.empty")}</p>
        <Link to="/" className="text-sm text-foreground underline">{t("order.back_home")}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2" aria-label="Retour">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">{t("order.place_order")}</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          {/* Order summary */}
          <div className="p-4 bg-secondary/50 rounded-2xl space-y-2 text-sm">
            <h3 className="font-semibold text-foreground">{t("order.summary")}</h3>
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-muted-foreground">
                <span>{item.quantity}x {item.menuItem.name}</span>
                <span>{(item.totalPrice * item.quantity).toFixed(2)} €</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between font-semibold text-foreground"><span>{t("cart.total")}</span><span>{total.toFixed(2)} €</span></div>
            </div>
          </div>

          {/* Customer info */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("order.your_info")}</h2>
          <div className="space-y-3">
            <Input placeholder={t("order.your_name")} value={name} onChange={(e) => setName(e.target.value)} className="h-14 rounded-2xl bg-secondary border-0 text-base" />
            <Input placeholder={t("order.phone")} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-14 rounded-2xl bg-secondary border-0 text-base" />
          </div>

          {/* Pickup time picker */}
          {restaurantId && (
            <div className="p-4 bg-secondary/50 rounded-2xl">
              <PickupTimePicker
                restaurantId={restaurantId}
                estimatedMinutes={estimatedMinutes}
                value={pickupTime}
                onChange={setPickupTime}
              />
            </div>
          )}

          <div className="p-4 bg-secondary/50 rounded-2xl">
            <div className="flex justify-between font-semibold text-foreground"><span>{t("order.total_to_pay")}</span><span>{total.toFixed(2)} €</span></div>
          </div>

          {/* Reminder block */}
          <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-sm text-amber-900">
                <p className="font-medium">En validant, vous vous engagez a venir recuperer et regler votre commande.</p>
                <p>Les commandes non honorees peuvent entrainer un blocage de votre acces.</p>
                {restaurantPhone && (
                  <p className="flex items-center gap-1.5 pt-1">
                    Un imprevu ? Contactez le restaurant :
                    <ProtectedPhone phone={restaurantPhone} className="text-amber-700 hover:text-amber-900" variant="button" iconClassName="h-3.5 w-3.5" />
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={!name || !phone || submitting}
            className="w-full h-14 text-base font-semibold rounded-2xl"
            size="lg"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("order.confirm", { price: total.toFixed(2) })}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderPage;
