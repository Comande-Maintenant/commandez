import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Tag, Loader2, Gift, Lock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
const PLAN_PRICES = {
  monthly: 29.99,
  annual: 239.88,
} as const;

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
      // Call Stripe checkout edge function
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          plan,
          restaurant_id: restaurantId,
          restaurant_slug: restaurantSlug,
          email,
          promo_code: promoResult?.valid ? promoCode.trim().toUpperCase() : undefined,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || t("plan.redirect_error"));
        setRedirecting(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(t("plan.redirect_error"));
        setRedirecting(false);
      }
    } catch (err: any) {
      toast.error(err.message || t("plan.redirect_error"));
      setRedirecting(false);
    }
  };

  const price = PLAN_PRICES[plan];

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

        {/* Launch offer banner */}
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
          <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">Offre de lancement : 3 mois a 1&#8364;/mois</p>
            <p className="text-xs text-green-700 mt-0.5">
              Testez pendant 3 mois pour 1&#8364;/mois, puis choisissez votre formule. Sans engagement.
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
            <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs font-semibold px-3 py-0.5 rounded-full">
              POPULAIRE
            </div>
            <h3 className="font-semibold text-foreground text-lg">{t("plan.monthly")}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-primary">1&#8364;</span>
              <span className="text-sm text-muted-foreground">/mois pendant 3 mois</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              puis 29,99&#8364;/mois
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sans engagement, annulable a tout moment
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
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
          >
            <h3 className="font-semibold text-foreground text-lg">{t("plan.annual")}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-foreground">239,88&#8364;</span>
              <span className="text-sm text-muted-foreground">/an</span>
            </div>
            <p className="text-xs text-primary font-medium mt-1">
              = 19,99&#8364;/mois (-33% vs mensuel)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sans engagement, annulable a tout moment
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
            {plan === "monthly" ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aujourd'hui</span>
                  <span className="font-semibold text-primary">1,00&#8364;</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mois 2 et 3</span>
                  <span className="text-muted-foreground">1,00&#8364;/mois</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">A partir du mois 4</span>
                  <span className="text-muted-foreground">29,99&#8364;/mois</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aujourd'hui</span>
                  <span className="font-semibold text-foreground">239,88&#8364;</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renouvellement annuel</span>
                  <span className="text-muted-foreground">239,88&#8364;/an</span>
                </div>
              </>
            )}
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
          ) : plan === "monthly" ? (
            "Commencer pour 1\u20AC"
          ) : (
            "Souscrire pour 239,88\u20AC/an"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          Paiement securise par Stripe. Annulable a tout moment.
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
