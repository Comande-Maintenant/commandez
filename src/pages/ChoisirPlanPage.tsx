import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Tag, Loader2, Gift, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildCheckoutUrl,
  PLAN_PRICES,
} from "@/services/shopify-checkout";

const features = [
  "Page de commande personnalisee",
  "Menu modifiable en temps reel",
  "0% de commission sur les commandes",
  "Dashboard et statistiques",
  "Base clients avec historique",
  "Notifications en temps reel",
  "QR Code aux couleurs de votre resto",
  "Traduction auto en 12 langues",
  "Support reactif",
];

interface PromoResult {
  valid: boolean;
  type?: string;
  value?: number;
  description?: string;
  error?: string;
}

const ChoisirPlanPage = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Load restaurant info for current user
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/connexion");
        return;
      }
      setEmail(user.email || null);

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, slug")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (restaurant) {
        setRestaurantId(restaurant.id);
        setRestaurantSlug(restaurant.slug);
      }
    }
    load();
  }, [navigate]);

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-promo", {
        body: { code: promoCode.trim(), restaurant_id: restaurantId },
      });
      if (error) throw error;
      setPromoResult(data as PromoResult);
      if (data?.valid) {
        toast.success("Code promo applique !");
      } else {
        toast.error(data?.error || "Code invalide");
      }
    } catch {
      toast.error("Erreur lors de la validation");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!restaurantId || !restaurantSlug || !email) {
      toast.error("Impossible de continuer. Verifiez votre connexion.");
      return;
    }

    setRedirecting(true);

    try {
      // Upsert subscription as pending_payment
      await supabase.from("subscriptions").upsert(
        {
          restaurant_id: restaurantId,
          status: "pending_payment",
          plan,
          promo_code_used: promoResult?.valid ? promoCode.trim().toUpperCase() : null,
        },
        { onConflict: "restaurant_id" }
      );

      const url = buildCheckoutUrl({
        plan,
        restaurantId,
        restaurantSlug,
        email,
        promoCode: promoResult?.valid ? promoCode.trim().toUpperCase() : undefined,
      });

      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la redirection");
      setRedirecting(false);
    }
  };

  const price = PLAN_PRICES[plan];
  const monthlyEquiv = plan === "annual" ? (price / 12).toFixed(2) : null;

  // Calculate first payment date (J+14)
  const firstPayment = new Date();
  firstPayment.setDate(firstPayment.getDate() + 14);
  const firstPaymentStr = firstPayment.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <a
            href="https://commandeici.com"
            className="flex items-center gap-2 text-foreground hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold text-lg">commandeici</span>
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Choisissez votre formule
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Sans engagement, resiliable a tout moment.
        </p>

        {/* Trial reassurance banner */}
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
          <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">14 jours d'essai gratuit</p>
            <p className="text-xs text-green-700 mt-0.5">
              Testez sans engagement, vous ne serez debite qu'apres la periode d'essai.
            </p>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Monthly */}
          <button
            onClick={() => setPlan("monthly")}
            className={`relative rounded-xl border-2 p-6 text-left transition-all ${
              plan === "monthly"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
          >
            <h3 className="font-semibold text-foreground text-lg">Mensuel</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-foreground">29,99</span>
              <span className="text-sm text-muted-foreground">EUR/mois</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sans engagement
            </p>
            {plan === "monthly" && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>

          {/* Annual */}
          <button
            onClick={() => setPlan("annual")}
            className={`relative rounded-xl border-2 p-6 text-left transition-all ${
              plan === "annual"
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-primary/40 bg-primary/5 hover:border-primary scale-[1.02]"
            }`}
          >
            <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs font-semibold px-3 py-0.5 rounded-full">
              Populaire
            </div>
            <h3 className="font-semibold text-foreground text-lg">Annuel</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-foreground">19,99</span>
              <span className="text-sm text-muted-foreground">EUR/mois</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              (soit 239,88 EUR/an)
            </p>
            <p className="text-xs text-primary font-medium mt-1">
              Economisez 120 EUR/an
            </p>
            {plan === "annual" && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>
        </div>

        {/* Features */}
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <p className="text-sm font-semibold text-foreground mb-3">
            Inclus dans votre abonnement :
          </p>
          <ul className="space-y-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 text-sm text-muted-foreground"
              >
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Promo code */}
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Code promotionnel
            </h3>
          </div>
          <div className="flex gap-2">
            <Input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoResult(null);
              }}
              placeholder="LANCEMENT"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleValidatePromo}
              disabled={promoLoading || !promoCode.trim()}
            >
              {promoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Appliquer"
              )}
            </Button>
          </div>
          {promoResult?.valid && (
            <p className="text-sm text-green-600 mt-2">
              {promoResult.description}
            </p>
          )}
          {promoResult && !promoResult.valid && (
            <p className="text-sm text-destructive mt-2">{promoResult.error}</p>
          )}
        </div>

        {/* Recap */}
        <div className="bg-muted/50 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Recapitulatif
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aujourd'hui</span>
              <span className="font-semibold text-foreground">0,00 EUR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Premier prelevement le {firstPaymentStr}
              </span>
              <span className="font-semibold text-foreground">
                {price.toFixed(2)} EUR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Puis chaque {plan === "annual" ? "annee" : "mois"}
              </span>
              <span className="text-muted-foreground">
                {price.toFixed(2)} EUR
                {monthlyEquiv && ` (${monthlyEquiv} EUR/mois)`}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={handleCheckout}
          disabled={redirecting || !restaurantId}
          className="w-full h-12 rounded-xl text-base"
        >
          {redirecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Redirection vers le paiement...
            </>
          ) : (
            "Continuer vers le paiement"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          Aucun paiement aujourd'hui. Votre essai gratuit de 14 jours commence maintenant.
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
          <Lock className="h-3.5 w-3.5" />
          <span>Paiement securise via Shopify. Aucun debit avant 14 jours.</span>
        </div>
      </main>
    </div>
  );
};

export default ChoisirPlanPage;
