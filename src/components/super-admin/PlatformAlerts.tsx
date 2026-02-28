import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Store, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Alert {
  type: "stale_order" | "inactive_restaurant" | "deletion_pending";
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

      // Restaurants inactive > 7 days (no orders)
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id, name, slug")
        .is("deactivated_at", null);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      for (const r of restaurants ?? []) {
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

  const iconMap = {
    stale_order: Clock,
    inactive_restaurant: Store,
    deletion_pending: Trash2,
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
            const Icon = iconMap[alert.type];
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
