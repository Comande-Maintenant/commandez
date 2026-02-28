import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { TrendingUp, ShoppingBag, Receipt, Euro } from "lucide-react";
import { fetchOrders } from "@/lib/api";
import type { DbRestaurant, DbOrder } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DemandCalendar } from "@/components/dashboard/DemandCalendar";
import { DemandHourlyChart } from "@/components/dashboard/DemandHourlyChart";
import { DemandTip } from "@/components/dashboard/DemandTip";

type Period = "day" | "week" | "month";

interface Props {
  restaurant: DbRestaurant;
}

const periodLabels: Record<Period, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
};

function startOfPeriod(period: Period): Date {
  const now = new Date();
  if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const d = new Date(now);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatHour(h: number) {
  return `${h}h`;
}

export const DashboardStats = ({ restaurant }: Props) => {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("day");

  useEffect(() => {
    fetchOrders(restaurant.id).then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }, [restaurant.id]);

  const stats = useMemo(() => {
    const start = startOfPeriod(period);
    const filtered = orders.filter((o) => new Date(o.created_at) >= start);
    const completed = filtered.filter((o) => o.status !== "done" || true); // all orders count
    const revenue = completed.reduce((s, o) => s + Number(o.total), 0);
    const count = completed.length;
    const avg = count > 0 ? revenue / count : 0;
    return { revenue, count, avg, filtered };
  }, [orders, period]);

  const chartData = useMemo(() => {
    if (period === "day") {
      const hours: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hours[h] = 0;
      stats.filtered.forEach((o) => {
        const h = new Date(o.created_at).getHours();
        hours[h] += Number(o.total);
      });
      return Object.entries(hours).map(([h, total]) => ({ label: formatHour(Number(h)), CA: +total.toFixed(2), Commandes: stats.filtered.filter((o) => new Date(o.created_at).getHours() === Number(h)).length }));
    }
    if (period === "week") {
      const days: { label: string; CA: number; Commandes: number }[] = [];
      const start = startOfPeriod("week");
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dayOrders = stats.filtered.filter((o) => new Date(o.created_at).toDateString() === d.toDateString());
        days.push({ label: d.toLocaleDateString("fr-FR", { weekday: "short" }), CA: +dayOrders.reduce((s, o) => s + Number(o.total), 0).toFixed(2), Commandes: dayOrders.length });
      }
      return days;
    }
    // month
    const days: { label: string; CA: number; Commandes: number }[] = [];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      const dayOrders = stats.filtered.filter((o) => new Date(o.created_at).toDateString() === d.toDateString());
      days.push({ label: `${i}`, CA: +dayOrders.reduce((s, o) => s + Number(o.total), 0).toFixed(2), Commandes: dayOrders.length });
    }
    return days;
  }, [stats, period]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const kpis = [
    { label: "Chiffre d'affaires", value: `${stats.revenue.toFixed(2)} €`, icon: Euro, accent: true },
    { label: "Commandes", value: stats.count, icon: ShoppingBag },
    { label: "Panier moyen", value: `${stats.avg.toFixed(2)} €`, icon: Receipt },
    { label: "Total commandes", value: orders.length, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList className="rounded-xl">
          {(["day", "week", "month"] as Period[]).map((p) => (
            <TabsTrigger key={p} value={p} className="rounded-lg text-sm">{periodLabels[p]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className={`text-2xl font-bold blur-sensitive ${kpi.accent ? "text-[hsl(var(--primary))]" : "text-foreground"}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Chiffre d'affaires - {periodLabels[period]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 blur-sensitive">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                <Bar dataKey="CA" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Nombre de commandes - {periodLabels[period]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52 blur-sensitive">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                <Line type="monotone" dataKey="Commandes" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Prevision de demande */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Prevision de demande</h3>
        <DemandTip />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DemandCalendar />
          <DemandHourlyChart />
        </div>
      </div>
    </div>
  );
};
