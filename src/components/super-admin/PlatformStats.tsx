import { useState, useEffect } from "react";
import { Store, ShoppingBag, Euro, TrendingUp } from "lucide-react";
import { fetchPlatformStats } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const PlatformStats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  if (!stats) return null;

  const kpis = [
    { label: "Restaurants actifs", value: stats.totalRestaurants, icon: Store },
    { label: "Commandes ce mois", value: stats.ordersThisMonth, icon: ShoppingBag },
    { label: "CA ce mois", value: `${stats.revenueThisMonth.toFixed(2)} €`, icon: Euro, accent: true },
    { label: "Commandes aujourd'hui", value: stats.ordersToday, icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="rounded-2xl border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className={`text-2xl font-bold ${kpi.accent ? "text-[hsl(var(--primary))]" : "text-foreground"}`}>
              {kpi.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
