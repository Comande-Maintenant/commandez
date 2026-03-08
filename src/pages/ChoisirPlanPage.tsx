import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Tag, Loader2, Gift, Lock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildCheckoutUrl,
  PLAN_PRICES,
} from "@/services/shopify-checkout";

interface PromoResult {
  valid: boolean;
  type?: string;
  value?: number;
  description?: string;
  error?: string;
}

const ChoisirPlanPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const features = [
    t("plan.feature_1"),
    t("plan.feature_2"),
    t("plan.feature_3"),
    t("plan.feature_4"),
    t("plan.feature_5"),
    t("plan.feature_6"),
    t("plan.feature_7"),
    t("plan.feature_8"),
    t("plan.feature_9"),
  ];

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
        toast.success(t("plan.promo_applied"));
      } else {
        toast.error(data?.error || t("plan.invalid_code"));
      }
    } catch {
      toast.error(t("plan.validation_error"));
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!restaurantId || !restaurantSlug || !email) {
      toast.error(t("plan.checkout_error"));
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
      toast.error(err.message || t("plan.redirect_error"));
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
          {t("plan.choose_plan")}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t("plan.no_commitment")}
        </p>

        {/* Trial reassurance banner */}
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
          <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">{t("plan.free_trial")}</p>
            <p className="text-xs text-green-700 mt-0.5">
              {t("plan.free_trial_desc")}
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
            <h3 className="font-semibold text-foreground text-lg">{t("plan.monthly")}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-foreground">29,99</span>
              <span className="text-sm text-muted-foreground">{t("plan.per_month")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("plan.no_commitment_short")}
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
              {t("plan.popular")}
            </div>
            <h3 className="font-semibold text-foreground text-lg">{t("plan.annual")}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-foreground">19,99</span>
              <span className="text-sm text-muted-foreground">{t("plan.per_month")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("plan.annual_total").replace("{price}", "239,88")}
            </p>
            <p className="text-xs text-primary font-medium mt-1">
              {t("plan.annual_savings").replace("{amount}", "120")}
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
            {t("plan.included")}
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
              {t("plan.promo_code")}
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
                t("plan.apply")
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
            {t("plan.summary")}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("plan.today")}</span>
              <span className="font-semibold text-foreground">0,00 EUR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("plan.first_payment").replace("{date}", firstPaymentStr)}
              </span>
              <span className="font-semibold text-foreground">
                {price.toFixed(2)} EUR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("plan.then_each").replace("{period}", plan === "annual" ? t("plan.year") : t("plan.month"))}
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
              {t("plan.redirecting")}
            </>
          ) : (
            t("plan.continue_payment")
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          {t("plan.no_payment_today")}
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
          <Lock className="h-3.5 w-3.5" />
          <span>{t("plan.secure_payment")}</span>
        </div>
      </main>
    </div>
  );
};

export default ChoisirPlanPage;
