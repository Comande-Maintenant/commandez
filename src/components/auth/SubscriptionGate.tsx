import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  restaurantId: string;
  children: ReactNode;
}

interface SubscriptionState {
  status: string | null;
  trialEndDate: string | null;
  bonusWeeks: number;
}

/**
 * Wraps the dashboard. Checks subscription_status and trial_end_date.
 * - trial + trial_end_date > now → access OK
 * - active → access OK
 * - Otherwise → redirect to /abonnement
 */
export function SubscriptionGate({ restaurantId, children }: Props) {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data } = await supabase
        .from("restaurants")
        .select("subscription_status, trial_end_date, bonus_weeks")
        .eq("id", restaurantId)
        .single();

      if (data) {
        setState({
          status: data.subscription_status || "trial",
          trialEndDate: data.trial_end_date || null,
          bonusWeeks: data.bonus_weeks || 0,
        });
      }
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

  const { status, trialEndDate, bonusWeeks } = state;

  // Active subscription - always OK
  if (status === "active") return <>{children}</>;

  // Trial period - check if still valid
  if (status === "trial" && trialEndDate) {
    const endDate = new Date(trialEndDate);
    // Add bonus weeks
    if (bonusWeeks > 0) {
      endDate.setDate(endDate.getDate() + bonusWeeks * 7);
    }
    if (endDate > new Date()) {
      return <>{children}</>;
    }
  }

  // Expired, cancelled, or trial ended - redirect to subscription page
  return <Navigate to="/abonnement" replace />;
}
