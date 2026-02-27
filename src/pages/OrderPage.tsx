import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Check, ShoppingBag, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { createOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "collect" | "delivery";
type Step = "mode" | "info" | "confirm";

const OrderPage = () => {
  const { items, subtotal, clearCart, restaurantId } = useCart();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("collect");
  const [step, setStep] = useState<Step>("mode");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = mode === "delivery" ? 2.99 : 0;
  const total = subtotal + deliveryFee;

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
        customer_address: mode === "delivery" ? address : "",
        order_type: mode,
        items: orderItems,
        subtotal,
        delivery_fee: deliveryFee,
        total,
      });
      setOrderNumber(order.order_number);
      setConfirmed(true);
      clearCart();
    } catch (e) {
      console.error("Order error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/20" />
        <p className="text-muted-foreground">Votre panier est vide</p>
        <Link to="/" className="text-sm text-foreground underline">Retour à l'accueil</Link>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20 }} className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-foreground text-primary-foreground flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Commande confirmée !</h1>
          <p className="text-muted-foreground mt-2">Commande #{orderNumber}</p>
          <div className="mt-6 p-4 bg-secondary rounded-2xl text-sm text-muted-foreground">
            <div className="flex items-center gap-2 justify-center">
              <Clock className="h-4 w-4" />
              <span>Temps estimé : 15-25 min</span>
            </div>
            <p className="mt-2">{mode === "collect" ? "Récupérez votre commande sur place" : "Livraison en cours"}</p>
          </div>
          <div className="mt-8 space-y-4 text-left">
            {["Confirmée", "En préparation", "Prête", mode === "collect" ? "À récupérer" : "En livraison"].map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {i === 0 ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-sm ${i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</span>
              </div>
            ))}
          </div>
          <Button onClick={() => navigate("/")} className="mt-8 w-full h-12 rounded-2xl" variant="outline">Retour à l'accueil</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => (step === "mode" ? navigate(-1) : setStep("mode"))} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Passer commande</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {step === "mode" && (
            <motion.div key="mode" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Mode de retrait</h2>
              {(["collect", "delivery"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`w-full p-4 rounded-2xl text-left transition-all border ${mode === m ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div><p className="font-medium text-foreground">{m === "collect" ? "Click & Collect" : "Livraison"}</p>
                    <p className="text-sm text-muted-foreground">{m === "collect" ? "Recuperez sur place - Gratuit" : `A domicile - ${deliveryFee.toFixed(2)} \u20ac`}</p></div>
                  </div>
                </button>
              ))}
              <div className="p-4 bg-secondary/50 rounded-2xl space-y-2 text-sm">
                <h3 className="font-semibold text-foreground">Récapitulatif</h3>
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-muted-foreground">
                    <span>{item.quantity}x {item.menuItem.name}</span>
                    <span>{(item.totalPrice * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span className="text-foreground">{subtotal.toFixed(2)} €</span></div>
                  {mode === "delivery" && <div className="flex justify-between"><span className="text-muted-foreground">Livraison</span><span className="text-foreground">{deliveryFee.toFixed(2)} €</span></div>}
                  <div className="flex justify-between font-semibold text-foreground mt-1"><span>Total</span><span>{total.toFixed(2)} €</span></div>
                </div>
              </div>
              <Button onClick={() => setStep("info")} className="w-full h-14 text-base font-semibold rounded-2xl" size="lg">Continuer</Button>
            </motion.div>
          )}

          {step === "info" && (
            <motion.div key="info" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vos informations</h2>
              <div className="space-y-3">
                <Input placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} className="h-14 rounded-2xl bg-secondary border-0 text-base" />
                <Input placeholder="Téléphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-14 rounded-2xl bg-secondary border-0 text-base" />
                {mode === "delivery" && <Input placeholder="Adresse de livraison" value={address} onChange={(e) => setAddress(e.target.value)} className="h-14 rounded-2xl bg-secondary border-0 text-base" />}
              </div>
              <div className="p-4 bg-secondary/50 rounded-2xl">
                <div className="flex justify-between font-semibold text-foreground"><span>Total à payer</span><span>{total.toFixed(2)} €</span></div>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={!name || !phone || (mode === "delivery" && !address) || submitting}
                className="w-full h-14 text-base font-semibold rounded-2xl"
                size="lg"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : `Confirmer la commande - ${total.toFixed(2)} \u20ac`}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OrderPage;
