import { useState, useEffect } from "react";
import { Store, Users, Euro, TrendingUp } from "lucide-react";
import { fetchSuperAdminKPIs, type SuperAdminKPIs } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const PlatformStats = () => {
  const [stats, setStats] = useState<SuperAdminKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuperAdminKPIs()
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

  const subscriberDetail = stats.activeSubscribers > 0
    ? `${stats.activeSubscribers} (${stats.monthlySubscribers} mens., ${stats.annualSubscribers} ann.)`
    : "0";

  const kpis = [
    { label: "Vrais restaurants", value: stats.realRestaurants, icon: Store },
    { label: "Abonnes actifs", value: subscriberDetail, icon: Users },
    { label: "MRR", value: `${stats.mrr.toFixed(2)} EUR/mois`, icon: Euro, accent: true },
    { label: "ARR", value: `${stats.arr.toFixed(2)} EUR/an`, icon: TrendingUp },
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
            <p className={`text-xl font-bold ${kpi.accent ? "text-[hsl(var(--primary))]" : "text-foreground"}`}>
              {kpi.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
