import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Tag, Loader2, Gift, Lock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
          plan: "monthly",
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

        {/* Pricing card */}
        <div className="relative rounded-2xl border-2 border-primary bg-primary/5 p-8 text-center mb-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
            {t("plan.launch_offer")}
          </div>
          <div className="flex items-baseline justify-center gap-1 mt-2">
            <span className="text-4xl font-bold text-primary">1&#8364;</span>
            <span className="text-muted-foreground">/mois pendant 3 mois</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            puis 29,99&#8364;/mois. Sans engagement.
          </p>
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
            t("plan.cta_start")
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          {t("plan.secure_stripe")}
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
