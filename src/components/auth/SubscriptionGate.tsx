import { ReactNode, useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

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
 * Wraps the dashboard. Checks subscription status from the new
 * subscriptions table first, with fallback to the legacy restaurants table
 * for backward compatibility.
 *
 * - trial + trial_end > now -> access OK (with trial banner)
 * - active / promo -> access OK
 * - past_due -> blocked with payment error screen
 * - expired / cancelled -> redirect to /abonnement
 * - pending_payment -> redirect to /choisir-plan
 * - no subscription row -> check legacy, then redirect
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

    // Active or promo -> always OK
    if (subStatus === "active" || subStatus === "promo") {
      return <>{children}</>;
    }

    // Trial -> check end date
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
      // Trial expired
      return <Navigate to="/abonnement" replace />;
    }

    // Past due -> show payment error screen
    if (subStatus === "past_due") {
      return <PastDueScreen />;
    }

    // Pending payment -> redirect to plan selection
    if (subStatus === "pending_payment") {
      return <Navigate to="/choisir-plan" replace />;
    }

    // Expired or cancelled -> redirect to reactivation
    return <Navigate to="/abonnement" replace />;
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

  return <Navigate to="/abonnement" replace />;
}

// ---- Trial Banner ----
function TrialBanner({ daysLeft }: { daysLeft: number }) {
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
        <strong>Essai gratuit</strong> : {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant
        {daysLeft > 1 ? "s" : ""}.
      </span>
      <Link
        to="/choisir-plan"
        className={`ml-auto text-xs font-semibold underline whitespace-nowrap ${
          isUrgent ? "text-amber-700" : "text-emerald-700"
        }`}
      >
        Activer
      </Link>
    </div>
  );
}

// ---- Past Due Screen ----
function PastDueScreen() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-sm mx-auto text-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Probleme de paiement
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Votre dernier paiement a echoue. Mettez a jour vos informations de
            paiement pour continuer a utiliser commandeici.
          </p>
          <Button asChild className="w-full">
            <a
              href={`https://idwzsh-11.myshopify.com/account`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Gerer mon paiement
            </a>
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Vous serez redirige vers votre espace client Shopify.
          </p>
        </div>
      </div>
    </div>
  );
}
