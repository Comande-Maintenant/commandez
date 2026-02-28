import { useState, useEffect, useMemo } from "react";
import { Euro, ShoppingBag, Receipt, TrendingUp } from "lucide-react";
import { fetchOrders } from "@/lib/api";
import type { DbRestaurant, DbOrder } from "@/types/database";
import type { LiveVisitor, VisitorAlert } from "@/types/visitor";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLiveVisitors } from "@/components/dashboard/DashboardLiveVisitors";
import { DemandTip } from "@/components/dashboard/DemandTip";
import { DemandCalendar } from "@/components/dashboard/DemandCalendar";
import { DemandHourlyChart } from "@/components/dashboard/DemandHourlyChart";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  restaurant: DbRestaurant;
  visitors: LiveVisitor[];
  alerts: VisitorAlert[];
}

export const DashboardEnDirect = ({ restaurant, visitors, alerts }: Props) => {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders(restaurant.id).then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }, [restaurant.id]);

  const todayStats = useMemo(() => {
    const now = new Date();
    const todayOrders = orders.filter(
      (o) => new Date(o.created_at).toDateString() === now.toDateString()
    );
    const revenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
    const count = todayOrders.length;
    const avg = count > 0 ? revenue / count : 0;

    // Most ordered item
    const itemCounts: Record<string, number> = {};
    todayOrders.forEach((o) => {
      const items = (o.items as any[]) || [];
      items.forEach((item: any) => {
        const name = item.name || "Inconnu";
        itemCounts[name] = (itemCounts[name] || 0) + (item.quantity || 1);
      });
    });
    const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

    return { revenue, count, avg, topItem: topItem ? `${topItem[0]} (${topItem[1]}x)` : "-" };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Live visitors */}
      <DashboardLiveVisitors visitors={visitors} alerts={alerts} />

      {/* Stats du jour */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">Stats du jour</h3>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "CA du jour", value: `${todayStats.revenue.toFixed(2)} EUR`, icon: Euro, accent: true },
              { label: "Commandes", value: todayStats.count, icon: ShoppingBag },
              { label: "Ticket moyen", value: `${todayStats.avg.toFixed(2)} EUR`, icon: Receipt },
              { label: "Top plat", value: todayStats.topItem, icon: TrendingUp },
            ].map((kpi) => (
              <Card key={kpi.label} className="rounded-2xl border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold truncate ${kpi.accent ? "text-[hsl(var(--primary))]" : "text-foreground"}`}>
                    {kpi.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Demand tip */}
      <DemandTip />

      {/* Calendar + Hourly chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DemandCalendar />
        <DemandHourlyChart />
      </div>
    </div>
  );
};
