import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Store, Trash2, CreditCard, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Alert {
  type: "stale_order" | "inactive_restaurant" | "deletion_pending" | "trial_expiring" | "pending_payment" | "no_restaurant";
  message: string;
  detail: string;
  severity: "warning" | "danger";
}

export const PlatformAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    const result: Alert[] = [];

    try {
      // Orders not accepted > 10 min
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: staleOrders } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, restaurant_id, created_at")
        .eq("status", "new")
        .lt("created_at", tenMinAgo)
        .limit(10);

      for (const order of staleOrders ?? []) {
        const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
        result.push({
          type: "stale_order",
          message: `Commande #${order.order_number} non acceptee depuis ${mins} min`,
          detail: order.customer_name,
          severity: mins > 20 ? "danger" : "warning",
        });
      }

      // Restaurants inactive > 7 days (exclude demo)
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id, name, slug, is_demo")
        .is("deactivated_at", null);

      const realRestaurants = (restaurants ?? []).filter((r: any) => !r.is_demo);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      for (const r of realRestaurants) {
        const { count } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", r.id)
          .gte("created_at", sevenDaysAgo);

        if (count === 0) {
          result.push({
            type: "inactive_restaurant",
            message: `${r.name} : aucune commande depuis 7+ jours`,
            detail: r.slug,
            severity: "warning",
          });
        }
      }

      // Restaurants pending deletion
      const { data: pendingDeletion } = await supabase
        .from("restaurants")
        .select("id, name, scheduled_deletion_at")
        .not("scheduled_deletion_at", "is", null);

      for (const r of pendingDeletion ?? []) {
        const daysLeft = Math.ceil((new Date(r.scheduled_deletion_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysLeft <= 30 && daysLeft > 0) {
          result.push({
            type: "deletion_pending",
            message: `${r.name} : suppression dans ${daysLeft} jours`,
            detail: `Suppression prevue le ${new Date(r.scheduled_deletion_at).toLocaleDateString("fr-FR")}`,
            severity: daysLeft <= 7 ? "danger" : "warning",
          });
        }
      }

      // Trial expiring < 7 days (real restaurants only)
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      for (const r of realRestaurants) {
        const rAny = r as any;
        if (
          rAny.trial_end_date &&
          rAny.trial_end_date > now &&
          rAny.trial_end_date < sevenDaysFromNow
        ) {
          const daysLeft = Math.ceil((new Date(rAny.trial_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          result.push({
            type: "trial_expiring",
            message: `${r.name} : essai expire dans ${daysLeft}j`,
            detail: `Fin le ${new Date(rAny.trial_end_date).toLocaleDateString("fr-FR")}`,
            severity: daysLeft <= 3 ? "danger" : "warning",
          });
        }
      }

      // Pending payment
      const { data: pendingPaymentRestos } = await supabase
        .from("restaurants")
        .select("id, name, subscription_status, is_demo")
        .eq("subscription_status", "pending_payment")
        .eq("is_demo", false);

      for (const r of pendingPaymentRestos ?? []) {
        result.push({
          type: "pending_payment",
          message: `${r.name} : paiement en attente`,
          detail: "Le restaurateur n'a pas encore finalise son paiement",
          severity: "warning",
        });
      }

      // Owners without restaurant (exclude super_admin)
      const { data: owners } = await supabase.from("owners").select("id, email, role");
      const { data: allRestos } = await supabase.from("restaurants").select("owner_id, is_demo");
      const ownerIdsWithResto = new Set(
        ((allRestos ?? []) as any[]).filter((r) => !r.is_demo).map((r) => r.owner_id)
      );
      for (const o of (owners ?? []) as any[]) {
        if (o.role !== "super_admin" && !ownerIdsWithResto.has(o.id)) {
          result.push({
            type: "no_restaurant",
            message: `${o.email} : compte sans restaurant`,
            detail: "Inscrit mais n'a pas cree de restaurant",
            severity: "warning",
          });
        }
      }
    } catch (e) {
      console.error("Error loading alerts:", e);
    }

    setAlerts(result);
    setLoading(false);
  };

  if (loading) {
    return <Skeleton className="h-32 rounded-2xl" />;
  }

  if (alerts.length === 0) {
    return (
      <Card className="rounded-2xl border-border">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Aucune alerte. Tout fonctionne bien !</p>
        </CardContent>
      </Card>
    );
  }

  const iconMap: Record<string, any> = {
    stale_order: Clock,
    inactive_restaurant: Store,
    deletion_pending: Trash2,
    trial_expiring: Clock,
    pending_payment: CreditCard,
    no_restaurant: UserX,
  };

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alertes plateforme ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const Icon = iconMap[alert.type] || AlertTriangle;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-xl ${
                  alert.severity === "danger" ? "bg-destructive/5" : "bg-amber-50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                    alert.severity === "danger" ? "text-destructive" : "text-amber-600"
                  }`}
                />
                <div>
                  <p className={`text-sm font-medium ${
                    alert.severity === "danger" ? "text-destructive" : "text-amber-900"
                  }`}>
                    {alert.message}
                  </p>
                  <p className="text-xs text-muted-foreground">{alert.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
