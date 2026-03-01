import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_POLL_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

/**
 * Post-checkout confirmation page.
 * Polls the subscriptions table until status changes from pending_payment,
 * then redirects to the admin dashboard.
 */
const AbonnementConfirmePage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"polling" | "confirmed" | "timeout">("polling");

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();

    async function poll() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Find the user's restaurant
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, slug")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!restaurant || cancelled) return;

      // Check subscription status
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cancelled) return;

      if (sub && sub.status !== "pending_payment") {
        setStatus("confirmed");
        // Brief delay so user sees the confirmation
        setTimeout(() => {
          if (!cancelled) navigate(`/admin/${restaurant.slug}`, { replace: true });
        }, 1500);
        return;
      }

      // Check timeout
      if (Date.now() - startTime > MAX_POLL_MS) {
        setStatus("timeout");
        return;
      }

      // Continue polling
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-sm mx-auto text-center px-4">
        {status === "polling" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Activation en cours...
            </h2>
            <p className="text-sm text-muted-foreground">
              Nous confirmons votre abonnement. Cela peut prendre quelques secondes.
            </p>
          </>
        )}

        {status === "confirmed" && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Abonnement active !
            </h2>
            <p className="text-sm text-muted-foreground">
              Redirection vers votre tableau de bord...
            </p>
          </>
        )}

        {status === "timeout" && (
          <>
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Confirmation en attente
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Votre paiement est en cours de traitement. Si vous avez bien
              termine le paiement sur Shopify, votre abonnement sera active dans
              les prochaines minutes.
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              Verifier a nouveau
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AbonnementConfirmePage;
