import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  restaurantId: string;
  children: ReactNode;
}

interface SubState {
  // From subscriptions table (new system)
  subStatus: string | null;
  subTrialEnd: string | null;
  subBonusDays: number;
  // From restaurants table (legacy fallback)
  legacyStatus: string | null;
  legacyTrialEnd: string | null;
  legacyBonusWeeks: number;
}

/**
 * Wraps the dashboard. Non-blocking model: access is always granted,
 * with contextual banners nudging toward payment when needed.
 *
 * - active / promo -> access OK, no banner
 * - trial + trial_end > now -> access + trial countdown banner
 * - trial expired / pending_payment / expired / cancelled -> access + "add card" banner
 * - past_due -> access + payment-failed banner
 */
export function SubscriptionGate({ restaurantId, children }: Props) {
  const [state, setState] = useState<SubState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      // Query new subscriptions table
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, trial_end, bonus_days")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Query legacy restaurants table
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("subscription_status, trial_end_date, bonus_weeks")
        .eq("id", restaurantId)
        .single();

      setState({
        subStatus: sub?.status || null,
        subTrialEnd: sub?.trial_end || null,
        subBonusDays: sub?.bonus_days || 0,
        legacyStatus: restaurant?.subscription_status || null,
        legacyTrialEnd: restaurant?.trial_end_date || null,
        legacyBonusWeeks: restaurant?.bonus_weeks || 0,
      });
      setLoading(false);
    }
    check();
  }, [restaurantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state) return <>{children}</>;

  // ---- New system (subscriptions table) ----
  if (state.subStatus) {
    const { subStatus, subTrialEnd, subBonusDays } = state;

    if (subStatus === "active" || subStatus === "promo") {
      return <>{children}</>;
    }

    if (subStatus === "trial" && subTrialEnd) {
      const endDate = new Date(subTrialEnd);
      if (subBonusDays > 0) {
        endDate.setDate(endDate.getDate() + subBonusDays);
      }
      if (endDate > new Date()) {
        const daysLeft = Math.ceil(
          (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return (
          <>
            <TrialBanner daysLeft={daysLeft} />
            {children}
          </>
        );
      }
      return (
        <>
          <ExpiredBanner />
          {children}
        </>
      );
    }

    if (subStatus === "past_due") {
      return (
        <>
          <PastDueBanner />
          {children}
        </>
      );
    }

    return (
      <>
        <ExpiredBanner />
        {children}
      </>
    );
  }

  // ---- Legacy system (restaurants table only) ----
  const { legacyStatus, legacyTrialEnd, legacyBonusWeeks } = state;

  if (legacyStatus === "active") return <>{children}</>;

  if ((legacyStatus === "trial" || !legacyStatus) && legacyTrialEnd) {
    const endDate = new Date(legacyTrialEnd);
    if (legacyBonusWeeks > 0) {
      endDate.setDate(endDate.getDate() + legacyBonusWeeks * 7);
    }
    if (endDate > new Date()) {
      const daysLeft = Math.ceil(
        (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return (
        <>
          <TrialBanner daysLeft={daysLeft} />
          {children}
        </>
      );
    }
  }

  return (
    <>
      <ExpiredBanner />
      {children}
    </>
  );
}

// ---- Trial Banner ----
function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const { t } = useLanguage();
  const isUrgent = daysLeft <= 3;

  return (
    <div
      className={`mx-auto max-w-xl mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm ${
        isUrgent
          ? "bg-amber-50 border border-amber-200 text-amber-800"
          : "bg-emerald-50 border border-emerald-200 text-emerald-800"
      }`}
    >
      <Clock className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>{t('subscription.gate.trial')}</strong> : {t('subscription.gate.days_remaining', { days: daysLeft })}
      </span>
      <Link
        to="/choisir-plan"
        className={`ml-auto text-xs font-semibold underline whitespace-nowrap ${
          isUrgent ? "text-amber-700" : "text-emerald-700"
        }`}
      >
        {t('subscription.gate.activate')}
      </Link>
    </div>
  );
}

// ---- Expired Banner (trial terminé, non bloquant) ----
function ExpiredBanner() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-xl mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>{t('subscription.gate.expired_title')}</strong> · {t('subscription.gate.expired_desc')}
      </span>
      <Link
        to="/choisir-plan"
        className="ml-auto text-xs font-semibold underline whitespace-nowrap text-amber-700"
      >
        {t('subscription.gate.add_card')}
      </Link>
    </div>
  );
}

// ---- Past Due Banner (paiement échoué, non bloquant) ----
function PastDueBanner() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-xl mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm bg-red-50 border border-red-200 text-red-800">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>{t('subscription.gate.payment_problem')}</strong> · {t('subscription.gate.payment_desc')}
      </span>
      <Link
        to="/choisir-plan"
        className="ml-auto text-xs font-semibold underline whitespace-nowrap text-red-700"
      >
        {t('subscription.gate.manage_payment')}
      </Link>
    </div>
  );
}
