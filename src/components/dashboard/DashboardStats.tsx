import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";
import { TrendingUp, ShoppingBag, Receipt, Euro, Clock, Flame, Trophy } from "lucide-react";
import { fetchOrders, fetchDemoOrders } from "@/lib/api";
import { generateDemoOrders } from "@/lib/demoData";
import { useLanguage } from "@/context/LanguageContext";
import type { DbRestaurant, DbOrder } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DemandCalendar } from "@/components/dashboard/DemandCalendar";
import { DemandHourlyChart } from "@/components/dashboard/DemandHourlyChart";
import { DemandTip } from "@/components/dashboard/DemandTip";

type Period = "day" | "week" | "30days" | "month";
type KpiKey = "revenue" | "orders" | "avg" | "time";

interface Props {
  restaurant: DbRestaurant;
  isDemo?: boolean;
}

const periodLabelKeys: Record<Period, string> = {
  day: "dashboard.stats.today",
  week: "dashboard.stats.this_week",
  "30days": "dashboard.stats.last_30_days",
  month: "dashboard.stats.this_month",
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
  if (period === "30days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatShortDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
}

function formatHour(h: number, hourFormat: string) {
  return hourFormat.replace("{h}", String(h));
}

/** Format number with space as thousands separator: 26346.00 -> 26 346.00 */
function formatMoney(n: number, decimals = 2): string {
  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${withSpaces}.${decPart}` : withSpaces;
}

const LOCALE_MAP: Record<string, string> = {
  fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT",
  pt: "pt-PT", nl: "nl-NL", ar: "ar-SA", zh: "zh-CN", ja: "ja-JP",
  ko: "ko-KR", ru: "ru-RU", tr: "tr-TR", vi: "vi-VN",
};

export const DashboardStats = ({ restaurant, isDemo }: Props) => {
  const { t, language } = useLanguage();
  const locale = LOCALE_MAP[language] || "fr-FR";
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30days");
  const [selectedKpi, setSelectedKpi] = useState<KpiKey>("revenue");

  useEffect(() => {
    const fetchFn = isDemo ? fetchDemoOrders(restaurant.id) : fetchOrders(restaurant.id);
    fetchFn.then((data) => {
      if (isDemo) {
        const generated = generateDemoOrders(restaurant.id);
        const realIds = new Set(data.map((o: any) => o.id));
        const merged = [...generated.filter((g) => !realIds.has(g.id)), ...data];
        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(merged);
      } else {
        setOrders(data);
      }
      setLoading(false);
    });
  }, [restaurant.id, isDemo]);

  const stats = useMemo(() => {
    const start = startOfPeriod(period);
    const filtered = orders.filter((o) => new Date(o.created_at) >= start);
    const revenue = filtered.reduce((s, o) => s + Number(o.total), 0);
    const count = filtered.length;
    const avg = count > 0 ? revenue / count : 0;

    let avgPrepTime = 0;
    const withTimestamps = filtered.filter(
      (o) => (o as any).accepted_at && (o as any).completed_at
    );
    if (withTimestamps.length > 0) {
      const totalMins = withTimestamps.reduce((s, o) => {
        const accepted = new Date((o as any).accepted_at).getTime();
        const completed = new Date((o as any).completed_at).getTime();
        return s + (completed - accepted) / 60000;
      }, 0);
      avgPrepTime = totalMins / withTimestamps.length;
    }

    const hourCounts: Record<number, number> = {};
    filtered.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    let peakHour = -1;
    let peakCount = 0;
    for (const [h, c] of Object.entries(hourCounts)) {
      if (c > peakCount) {
        peakCount = c;
        peakHour = Number(h);
      }
    }

    const itemCounts: Record<string, number> = {};
    filtered.forEach((o) => {
      const items = (o.items as any[]) || [];
      items.forEach((i: any) => {
        itemCounts[i.name] = (itemCounts[i.name] || 0) + (i.quantity || 1);
      });
    });
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const dayCounts: Record<string, number> = {};
    filtered.forEach((o) => {
      const d = new Date(o.created_at).toLocaleDateString(locale, { weekday: "long" });
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    });
    let busiestDay = "";
    let busiestCount = 0;
    for (const [d, c] of Object.entries(dayCounts)) {
      if (c > busiestCount) {
        busiestCount = c;
        busiestDay = d;
      }
    }

    return { revenue, count, avg, filtered, avgPrepTime, peakHour, topItems, busiestDay, busiestCount };
  }, [orders, period, locale]);

  // Build chart data with all metrics
  const chartData = useMemo(() => {
    const buildBucket = (bucketOrders: DbOrder[]) => {
      const ca = bucketOrders.reduce((s, o) => s + Number(o.total), 0);
      const count = bucketOrders.length;
      const avg = count > 0 ? ca / count : 0;
      const withTime = bucketOrders.filter((o) => (o as any).accepted_at && (o as any).completed_at);
      let avgTime = 0;
      if (withTime.length > 0) {
        avgTime = withTime.reduce((s, o) => s + (new Date((o as any).completed_at).getTime() - new Date((o as any).accepted_at).getTime()) / 60000, 0) / withTime.length;
      }
      return { revenue: +ca.toFixed(2), orders: count, avg: +avg.toFixed(2), time: +avgTime.toFixed(0) };
    };

    if (period === "day") {
      const result: any[] = [];
      for (let h = 0; h < 24; h++) {
        const bucket = stats.filtered.filter((o) => new Date(o.created_at).getHours() === h);
        result.push({ label: formatHour(h, t("dashboard.stats.hour_format", { h: String(h) })), ...buildBucket(bucket) });
      }
      return result;
    }
    if (period === "week") {
      const result: any[] = [];
      const start = startOfPeriod("week");
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const bucket = stats.filtered.filter((o) => new Date(o.created_at).toDateString() === d.toDateString());
        result.push({ label: d.toLocaleDateString(locale, { weekday: "short" }), ...buildBucket(bucket) });
      }
      return result;
    }
    if (period === "30days") {
      const result: any[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const bucket = stats.filtered.filter((o) => new Date(o.created_at).toDateString() === d.toDateString());
        result.push({ label: formatShortDate(d, locale), ...buildBucket(bucket) });
      }
      return result;
    }
    // month
    const result: any[] = [];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      const bucket = stats.filtered.filter((o) => new Date(o.created_at).toDateString() === d.toDateString());
      result.push({ label: `${i}`, ...buildBucket(bucket) });
    }
    return result;
  }, [stats, period, locale, t]);

  const kpiChartConfig: Record<KpiKey, { dataKey: string; color: string; label: string; unit: string; type: "bar" | "line" | "area" }> = {
    revenue: { dataKey: "revenue", color: "hsl(var(--primary))", label: t("dashboard.stats.revenue_short"), unit: " €", type: "bar" },
    orders: { dataKey: "orders", color: "#3B82F6", label: t("dashboard.stats.orders_label"), unit: "", type: "area" },
    avg: { dataKey: "avg", color: "#8B5CF6", label: t("dashboard.stats.avg_basket"), unit: " €", type: "line" },
    time: { dataKey: "time", color: "#F59E0B", label: t("dashboard.stats.avg_time"), unit: ` ${t("dashboard.stats.min_suffix")}`, type: "line" },
  };

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

  const hasTime = stats.avgPrepTime > 0 && stats.count >= 10;

  const kpis: { key: KpiKey; label: string; value: string; icon: any; accent?: boolean }[] = [
    { key: "revenue", label: t('dashboard.stats.revenue'), value: `${formatMoney(stats.revenue)} €`, icon: Euro, accent: true },
    { key: "orders", label: t('dashboard.stats.orders'), value: formatMoney(stats.count, 0), icon: ShoppingBag },
    { key: "avg", label: t('dashboard.stats.avg_basket'), value: `${formatMoney(stats.avg)} €`, icon: Receipt },
    {
      key: "time",
      label: hasTime ? t('dashboard.stats.avg_time') : t('dashboard.stats.total_orders'),
      value: hasTime ? `${Math.round(stats.avgPrepTime)} ${t("dashboard.stats.min_suffix")}` : formatMoney(orders.length, 0),
      icon: hasTime ? Clock : TrendingUp,
    },
  ];

  const activeChart = kpiChartConfig[selectedKpi];

  return (
    <div className="space-y-6">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList className="rounded-xl">
          {(["day", "week", "30days", "month"] as Period[]).map((p) => (
            <TabsTrigger key={p} value={p} className="rounded-lg text-sm">{t(periodLabelKeys[p])}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* KPI cards - clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            onClick={() => setSelectedKpi(kpi.key)}
            className={`text-left rounded-2xl border p-4 transition-all hover:shadow-sm ${
              selectedKpi === kpi.key
                ? "border-foreground/30 ring-2 ring-foreground/10 bg-card shadow-sm"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`h-4 w-4 ${selectedKpi === kpi.key ? "text-foreground" : "text-muted-foreground"}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold blur-sensitive ${kpi.accent ? "text-[hsl(var(--primary))]" : "text-foreground"}`}>{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Dynamic chart based on selected KPI */}
      <Card className="rounded-2xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {activeChart.label} - {t(periodLabelKeys[period])}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 blur-sensitive">
            <ResponsiveContainer width="100%" height="100%">
              {activeChart.type === "bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    formatter={(value: any) => [`${value}${activeChart.unit}`, activeChart.label]}
                  />
                  <Bar dataKey={activeChart.dataKey} fill={activeChart.color} radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : activeChart.type === "area" ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    formatter={(value: any) => [`${value}${activeChart.unit}`, activeChart.label]}
                  />
                  <Area type="monotone" dataKey={activeChart.dataKey} stroke={activeChart.color} fill={activeChart.color} fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    formatter={(value: any) => [`${value}${activeChart.unit}`, activeChart.label]}
                  />
                  <Line type="monotone" dataKey={activeChart.dataKey} stroke={activeChart.color} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top items + insights */}
      {stats.count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.topItems.length > 0 && (
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  {t('dashboard.stats.top_5')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topItems.map(([name, count], i) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        {name}
                      </span>
                      <span className="text-muted-foreground font-medium">{count}x</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                {t('dashboard.stats.insights')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {stats.peakHour >= 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('dashboard.stats.peak_hour')}</span>
                    <span className="font-medium text-foreground">{t("dashboard.stats.hour_format", { h: String(stats.peakHour) })} - {t("dashboard.stats.hour_format", { h: String(stats.peakHour + 1) })}</span>
                  </div>
                )}
                {stats.busiestDay && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('dashboard.stats.busiest_day')}</span>
                    <span className="font-medium text-foreground capitalize">{stats.busiestDay}</span>
                  </div>
                )}
                {stats.avgPrepTime > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('dashboard.stats.avg_prep_time')}</span>
                    <span className="font-medium text-foreground">{Math.round(stats.avgPrepTime)} {t("dashboard.stats.min_suffix")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.stats.total_historical')}</span>
                  <span className="font-medium text-foreground">{formatMoney(orders.length, 0)} {t('dashboard.stats.orders_suffix')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Prevision de demande */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">{t('dashboard.stats.demand_forecast')}</h3>
        <DemandTip />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DemandCalendar />
          <DemandHourlyChart />
        </div>
      </div>
    </div>
  );
};
