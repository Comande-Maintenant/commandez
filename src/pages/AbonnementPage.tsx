import { Link } from "react-router-dom";
import { ArrowLeft, Check, Shield, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

const AbonnementPage = () => {
  const { t } = useLanguage();

  const features = [
    t("sub.feature_1"),
    t("sub.feature_2"),
    t("sub.feature_3"),
    t("sub.feature_4"),
    t("sub.feature_5"),
    t("sub.feature_6"),
    t("sub.feature_7"),
    t("sub.feature_8"),
    t("sub.feature_9"),
    t("sub.feature_10"),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="https://commandeici.com" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold text-lg">commandeici</span>
          </a>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        {/* Trial expired message */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-center">
          <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-foreground mb-1">{t("sub.trial_ended")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("sub.activate_desc")}
          </p>
        </div>

        {/* Pricing card */}
        <div className="bg-card border-2 border-primary rounded-2xl p-8 text-center relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
            {t("sub.launch_offer")}
          </div>

          <h3 className="text-xl font-bold text-foreground mb-1">{t("sub.pro_name")}</h3>
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-4xl font-bold text-primary">1&euro;</span>
            <span className="text-muted-foreground">/mois pendant 3 mois</span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            puis 29,99&#8364;/mois
          </p>
          <p className="text-sm text-muted-foreground mb-6">{t("plan.no_commitment_short")}</p>

          <ul className="text-left space-y-2.5 mb-8">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <Button className="w-full h-12 rounded-xl text-base" asChild>
            <Link to="/choisir-plan">
              {t("sub.reactivate")}
            </Link>
          </Button>

          <p className="text-xs text-muted-foreground mt-3">
            {t("sub.stripe_info")}
          </p>
        </div>

        {/* Reassurance */}
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("sub.no_commitment_title")}</p>
              <p className="text-xs text-muted-foreground">{t("sub.no_commitment_desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
            <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("sub.profitable_title")}</p>
              <p className="text-xs text-muted-foreground">{t("sub.profitable_desc")}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AbonnementPage;
