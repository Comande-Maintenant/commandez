import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Shield, Loader2, Store, Users, Euro, TrendingUp, TrendingDown,
  AlertTriangle, Clock, Trash2, CreditCard, UserX, Search, Mail, Send,
  RefreshCw, Ticket, Gift, ShoppingBag, ChevronDown, ChevronUp,
  BarChart3, ArrowRight, ExternalLink, Plus, Eye, Pencil, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOwner, fetchOrders, fetchCustomers,
  fetchSuperAdminKPIs, fetchAcquisitionFunnel, fetchProspectList,
  fetchDemoStats, fetchAllPromoCodes, fetchAllReferrals,
  fetchAllProspects, createProspect,
  type SuperAdminKPIs, type AcquisitionFunnelData, type ProspectItem,
  type DemoStatsData, type AllReferralsData, type ProspectRow,
} from "@/lib/api";
import type { DbOrder, DbCustomer, DbPromoCode, DbRestaurant } from "@/types/database";
import { searchPlaces, getPlaceDetails } from "@/services/google-places";
import QRCode from "qrcode";
import type { GooglePlaceResult } from "@/types/onboarding";
import { generateSlug } from "@/services/onboarding";
import { detectBusinessType, BUSINESS_TYPES, getBusinessEmoji } from "@/utils/detect-business-type";
import { DashboardMaCarte } from "@/components/dashboard/DashboardMaCarte";
import { MenuReviewEditor } from "@/components/onboarding/MenuReviewEditor";
import { insertMenuItem, updateRestaurantCategories, fetchAllMenuItems as fetchAllItems } from "@/lib/api";
import type { AnalyzedCategory } from "@/types/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── Constants ──

const TABS = [
  { key: "overview", label: "Vue d'ensemble", icon: BarChart3 },
  { key: "prospects", label: "Prospects", icon: UserPlus },
  { key: "restaurants", label: "Restaurants", icon: Store },
  { key: "revenue", label: "Revenue", icon: Euro },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "tools", label: "Outils", icon: Gift },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-emerald-100 text-emerald-800" },
  trialing: { label: "Essai", className: "bg-blue-100 text-blue-800" },
  trial: { label: "Essai", className: "bg-blue-100 text-blue-800" },
  past_due: { label: "Impaye", className: "bg-orange-100 text-orange-800" },
  canceled: { label: "Annule", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Annule", className: "bg-red-100 text-red-800" },
  expired: { label: "Expire", className: "bg-red-100 text-red-800" },
  pending_payment: { label: "En attente", className: "bg-amber-100 text-amber-800" },
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  trial_expiring: "Essai expire bientot",
  trial_expired: "Essai expire",
  referral_completed_referrer: "Parrainage (parrain)",
  referral_completed_referee: "Parrainage (filleul)",
  subscription_activated: "Abonnement active",
  payment_failed: "Paiement echoue",
  subscription_cancelled: "Abonnement annule",
  promo_applied: "Code promo",
  comeback_3days: "Comeback J+3",
  comeback_7days: "Comeback J+7",
  prospection_send: "Prospection B2B",
};

const PROMO_TYPE_LABELS: Record<string, string> = {
  free_days: "Jours gratuits",
  discount_percent: "Remise %",
  discount_fixed: "Remise fixe",
  free_trial_extension: "Extension essai",
};

const PLAN_PRICES = { monthly: 29.99, annual: 239.88 };

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function aggregateByDay(items: { created_at: string }[], days: number) {
  const result: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const count = items.filter((it) => {
      const t = new Date(it.created_at).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;
    result.push({ date: label, count });
  }
  return result;
}

// ── Interfaces ──

interface Alert {
  type: string;
  message: string;
  detail: string;
  severity: "warning" | "danger";
}

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  sent_at: string;
}

// ── Component ──

const SuperAdminPage = () => {
  // Auth
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // UI
  const [tab, setTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [kpis, setKpis] = useState<SuperAdminKPIs | null>(null);
  const [funnel, setFunnel] = useState<AcquisitionFunnelData | null>(null);
  const [prospects, setProspects] = useState<ProspectItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [unsubCount, setUnsubCount] = useState(0);
  const [promoCodes, setPromoCodes] = useState<DbPromoCode[]>([]);
  const [referralsData, setReferralsData] = useState<AllReferralsData | null>(null);
  const [demoStats, setDemoStats] = useState<DemoStatsData | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  // Prospects
  const [prospectRows, setProspectRows] = useState<ProspectRow[]>([]);
  const [prospectSearch, setProspectSearch] = useState("");
  const [showCreateProspect, setShowCreateProspect] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<GooglePlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceResult | null>(null);
  const [prospectBusinessType, setProspectBusinessType] = useState("restaurant");
  const [prospectSlug, setProspectSlug] = useState("");
  const [prospectColor, setProspectColor] = useState("#10B981");
  const [creatingProspect, setCreatingProspect] = useState(false);
  const [editingProspect, setEditingProspect] = useState<DbRestaurant | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [selectedUploadIndexes, setSelectedUploadIndexes] = useState<Set<number>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedCategories, setAnalyzedCategories] = useState<AnalyzedCategory[] | null>(null);
  const [savingMenu, setSavingMenu] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // Conversion
  const [convertingProspect, setConvertingProspect] = useState<ProspectRow | null>(null);
  const [convertEmail, setConvertEmail] = useState("");
  const [converting, setConverting] = useState(false);

  // Restaurant detail
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [detailOrders, setDetailOrders] = useState<DbOrder[]>([]);
  const [detailCustomers, setDetailCustomers] = useState<DbCustomer[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Auth check ──
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setAuthUserId(user.id);
        const owner = await fetchOwner(user.id);
        if (owner?.role === "super_admin") setAuthorized(true);
      } catch {}
      setLoading(false);
    })();
  }, []);

  // ── Load all data ──
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [k, f, p, demo, promos, refs, emailRes, unsubRes, prospectData] = await Promise.all([
        fetchSuperAdminKPIs(),
        fetchAcquisitionFunnel(),
        fetchProspectList(),
        fetchDemoStats(),
        fetchAllPromoCodes(),
        fetchAllReferrals(),
        supabase.from("email_logs").select("id, email_type, recipient_email, sent_at").order("sent_at", { ascending: false }).limit(200),
        supabase.from("user_email_preferences").select("id", { count: "exact" }).not("unsubscribed_at", "is", null),
        fetchAllProspects(),
      ]);
      setKpis(k);
      setFunnel(f);
      setProspects(p);
      setDemoStats(demo);
      setPromoCodes(promos);
      setProspectRows(prospectData);
      setReferralsData(refs);
      setEmailLogs((emailRes.data ?? []) as unknown as EmailLog[]);
      setUnsubCount(unsubRes.count ?? 0);
    } catch (e) {
      console.error("loadData error:", e);
    }
    setRefreshing(false);
  }, []);

  // ── Load alerts ──
  const loadAlerts = useCallback(async () => {
    const result: Alert[] = [];
    try {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: staleOrders } = await supabase
        .from("orders").select("id, order_number, customer_name, created_at")
        .eq("status", "new").lt("created_at", tenMinAgo).limit(10);

      for (const o of staleOrders ?? []) {
        const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
        result.push({
          type: "stale_order", severity: mins > 20 ? "danger" : "warning",
          message: `Commande #${o.order_number} non acceptee depuis ${mins} min`,
          detail: o.customer_name,
        });
      }

      const { data: restaurants } = await supabase
        .from("restaurants").select("id, name, slug, is_demo, trial_end_date, subscription_status, scheduled_deletion_at")
        .is("deactivated_at", null);
      const real = (restaurants ?? []).filter((r: any) => !r.is_demo);

      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      for (const r of real) {
        const { count } = await supabase.from("orders")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", (r as any).id).gte("created_at", sevenDaysAgo);
        if (count === 0) {
          result.push({
            type: "inactive_restaurant", severity: "warning",
            message: `${(r as any).name} : aucune commande depuis 7+ jours`,
            detail: (r as any).slug,
          });
        }
      }

      for (const r of real) {
        const ra = r as any;
        if (ra.scheduled_deletion_at) {
          const daysLeft = Math.ceil((new Date(ra.scheduled_deletion_at).getTime() - Date.now()) / 86400000);
          if (daysLeft > 0 && daysLeft <= 30) {
            result.push({
              type: "deletion_pending", severity: daysLeft <= 7 ? "danger" : "warning",
              message: `${ra.name} : suppression dans ${daysLeft} jours`,
              detail: `Prevue le ${new Date(ra.scheduled_deletion_at).toLocaleDateString("fr-FR")}`,
            });
          }
        }
        if (ra.trial_end_date) {
          const now = Date.now();
          const end = new Date(ra.trial_end_date).getTime();
          const daysLeft = Math.ceil((end - now) / 86400000);
          if (daysLeft > 0 && daysLeft <= 7) {
            result.push({
              type: "trial_expiring", severity: daysLeft <= 3 ? "danger" : "warning",
              message: `${ra.name} : essai expire dans ${daysLeft}j`,
              detail: `Fin le ${new Date(ra.trial_end_date).toLocaleDateString("fr-FR")}`,
            });
          }
        }
      }

      const { data: owners } = await supabase.from("owners").select("id, email, role");
      const ownerIds = new Set(real.map((r: any) => r.owner_id).filter(Boolean));
      for (const o of (owners ?? []) as any[]) {
        if (o.role !== "super_admin" && !ownerIds.has(o.id)) {
          result.push({
            type: "no_restaurant", severity: "warning",
            message: `${o.email} : compte sans restaurant`,
            detail: "Inscrit mais n'a pas cree de restaurant",
          });
        }
      }
    } catch (e) { console.error("loadAlerts error:", e); }
    setAlerts(result);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadData();
    loadAlerts();
    const interval = setInterval(() => { loadData(); loadAlerts(); }, 30000);
    return () => clearInterval(interval);
  }, [authorized, loadData, loadAlerts]);

  // ── Restaurant detail ──
  const openDetail = async (resto: any) => {
    setSelectedRestaurant(resto);
    setDetailLoading(true);
    try {
      const [o, c] = await Promise.all([
        fetchOrders(resto.id),
        fetchCustomers(resto.id).catch(() => [] as DbCustomer[]),
      ]);
      setDetailOrders(o);
      setDetailCustomers(c);
    } catch {}
    setDetailLoading(false);
  };

  // ── Computed ──
  const filteredProspects = useMemo(() => {
    if (!search.trim()) return prospects;
    const q = search.toLowerCase();
    return prospects.filter((p) =>
      p.email.toLowerCase().includes(q) ||
      p.restaurantName?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  }, [prospects, search]);

  const signupsPerDay = useMemo(() => {
    return aggregateByDay(prospects.map((p) => ({ created_at: p.createdAt })), 30);
  }, [prospects]);

  // ── Auth guards ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acces refuse</h1>
          <p className="text-muted-foreground mb-4">Cette page est reservee aux super administrateurs.</p>
          <Link to="/" className="text-sm text-foreground underline">Retour</Link>
        </div>
      </div>
    );
  }

  // ── Restaurant Detail View ──
  if (selectedRestaurant) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayOrders = detailOrders.filter((o) => new Date(o.created_at) >= todayStart);
    const monthOrders = detailOrders.filter((o) => new Date(o.created_at) >= monthStart);
    const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
    const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);

    return (
      <div className="min-h-screen bg-secondary/50">
        <header className="bg-background border-b border-border sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => setSelectedRestaurant(null)} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex items-center gap-3">
              {selectedRestaurant.image && <img src={selectedRestaurant.image} alt="" className="h-8 w-8 rounded-lg object-cover" />}
              <h1 className="text-base font-semibold text-foreground">{selectedRestaurant.name}</h1>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {detailLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Commandes", value: detailOrders.length, icon: ShoppingBag },
                  { label: "CA total", value: `${detailOrders.reduce((s, o) => s + Number(o.total), 0).toFixed(2)} EUR`, icon: Euro },
                  { label: "Clients", value: detailCustomers.length, icon: Users },
                  { label: "Panier moyen", value: detailOrders.length > 0 ? `${(detailOrders.reduce((s, o) => s + Number(o.total), 0) / detailOrders.length).toFixed(2)} EUR` : "N/A", icon: TrendingUp },
                ].map((kpi) => (
                  <Card key={kpi.label} className="rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <kpi.icon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      </div>
                      <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { title: "Aujourd'hui", orders: todayOrders, revenue: todayRevenue },
                  { title: "Ce mois", orders: monthOrders, revenue: monthRevenue },
                ].map((period) => (
                  <Card key={period.title} className="rounded-2xl">
                    <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">{period.title}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Commandes</span><span className="font-medium">{period.orders.length}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">CA</span><span className="font-medium">{period.revenue.toFixed(2)} EUR</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Panier moyen</span><span className="font-medium">{period.orders.length > 0 ? (period.revenue / period.orders.length).toFixed(2) : "0.00"} EUR</span></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Dernieres commandes</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {detailOrders.slice(0, 15).map((order) => (
                      <div key={order.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                        <div>
                          <span className="font-medium">#{order.order_number}</span>
                          <span className="text-muted-foreground ml-2">{order.customer_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{Number(order.total).toFixed(2)} EUR</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {detailOrders.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune commande</p>}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    );
  }

  // ── Main Dashboard ──
  const alertIcon: Record<string, any> = {
    stale_order: Clock, inactive_restaurant: Store, deletion_pending: Trash2,
    trial_expiring: Clock, pending_payment: CreditCard, no_restaurant: UserX,
  };

  // Email computed
  const now = new Date();
  const todayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgoISO = new Date(now.getTime() - 7 * 86400000).toISOString();
  const emailsToday = emailLogs.filter((l) => l.sent_at >= todayISO).length;
  const emailsWeek = emailLogs.filter((l) => l.sent_at >= weekAgoISO).length;
  const emailTypeCounts: Record<string, number> = {};
  emailLogs.forEach((l) => { emailTypeCounts[l.email_type] = (emailTypeCounts[l.email_type] || 0) + 1; });
  const emailTypeStats = Object.entries(emailTypeCounts).sort((a, b) => b[1] - a[1]);

  // Revenue computed
  const monthlyMRR = kpis ? (() => {
    const threeMonthsMs = 90 * 86400000;
    const nowMs = Date.now();
    let couponCount = 0;
    let fullCount = 0;
    for (const p of prospects) {
      if (p.subscriptionStatus === "active" && p.plan === "monthly" && p.subCreatedAt) {
        if (nowMs - new Date(p.subCreatedAt).getTime() < threeMonthsMs) couponCount++;
        else fullCount++;
      }
    }
    return { couponCount, fullCount, couponMRR: couponCount * 1, fullMRR: fullCount * PLAN_PRICES.monthly };
  })() : null;

  const activeSubscriptions = prospects.filter((p) => p.subscriptionStatus === "active");

  return (
    <div className="min-h-screen bg-secondary/50">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <Shield className="h-5 w-5 text-foreground" />
            <h1 className="text-base font-semibold text-foreground">Super Admin</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => { loadData(); loadAlerts(); }} disabled={refreshing} className="rounded-xl">
            <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-background border-b border-border overflow-x-auto">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? "border-[hsl(var(--primary))] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ════════ TAB: VUE D'ENSEMBLE ════════ */}
        {tab === "overview" && (
          <>
            {/* KPIs */}
            {!kpis ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Restaurants", value: kpis.realRestaurants, icon: Store },
                  { label: "Abonnes", value: `${kpis.activeSubscribers} (${kpis.monthlySubscribers}m + ${kpis.annualSubscribers}a)`, sub: kpis.trialingCount > 0 ? `+ ${kpis.trialingCount} en essai` : undefined, icon: Users },
                  { label: "MRR", value: `${kpis.mrr.toFixed(0)} EUR`, icon: Euro, accent: true },
                  { label: "ARR", value: `${kpis.arr.toFixed(0)} EUR`, icon: TrendingUp },
                ].map((kpi) => (
                  <Card key={kpi.label} className="rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <kpi.icon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      </div>
                      <p className={`text-xl font-bold ${(kpi as any).accent ? "text-[hsl(var(--primary))]" : "text-foreground"}`}>
                        {kpi.value}
                      </p>
                      {(kpi as any).sub && <p className="text-xs text-muted-foreground mt-0.5">{(kpi as any).sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Funnel */}
            {funnel && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    Funnel d'acquisition
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Comptes crees", value: funnel.accounts },
                      { label: "Restaurant cree", value: funnel.withRestaurant },
                      { label: "En essai", value: funnel.inTrial },
                      { label: "Abonnes payants", value: funnel.paying },
                      { label: "Churn", value: funnel.churned, isChurn: true },
                    ].map((step, i, arr) => {
                      const maxVal = Math.max(funnel.accounts, 1);
                      const prev = i > 0 ? arr[i - 1].value : null;
                      return (
                        <div key={step.label}>
                          {prev !== null && prev > 0 && (
                            <p className="text-[11px] text-muted-foreground ml-1 mb-1">{Math.round((step.value / prev) * 100)}%</p>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="w-32 sm:w-40 text-xs text-muted-foreground truncate flex-shrink-0">{step.label}</div>
                            <div className="flex-1 h-7 bg-secondary rounded-lg overflow-hidden">
                              <div
                                className={`h-full rounded-lg flex items-center px-2 text-xs font-semibold text-white ${step.isChurn ? "bg-red-400" : "bg-[hsl(var(--primary))]"}`}
                                style={{ width: `${Math.max((step.value / maxVal) * 100, 4)}%`, minWidth: "2rem" }}
                              >
                                {step.value}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chart inscriptions/jour */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Inscriptions / jour (30j)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={signupsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Inscriptions" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Alerts */}
            {alerts.length > 0 && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Alertes ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alerts.map((alert, i) => {
                      const Icon = alertIcon[alert.type] || AlertTriangle;
                      return (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${alert.severity === "danger" ? "bg-destructive/5" : "bg-amber-50"}`}>
                          <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${alert.severity === "danger" ? "text-destructive" : "text-amber-600"}`} />
                          <div>
                            <p className={`text-sm font-medium ${alert.severity === "danger" ? "text-destructive" : "text-amber-900"}`}>{alert.message}</p>
                            <p className="text-xs text-muted-foreground">{alert.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ════════ TAB: RESTAURANTS ════════ */}
        {tab === "restaurants" && (
          <>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher par email, nom, telephone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2">Email</th>
                        <th className="px-4 py-2">Restaurant</th>
                        <th className="px-4 py-2">Statut</th>
                        <th className="px-4 py-2">Plan</th>
                        <th className="px-4 py-2">Inscription</th>
                        <th className="px-4 py-2">Prochaine facture</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProspects.map((p) => {
                        const badge = STATUS_BADGES[p.subscriptionStatus ?? ""];
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors"
                            onClick={() => p.restaurantId && openDetail({ id: p.restaurantId, name: p.restaurantName, slug: p.restaurantSlug })}
                          >
                            <td className="px-4 py-3 font-medium truncate max-w-[200px]">{p.email}</td>
                            <td className="px-4 py-3">{p.restaurantName || <span className="text-muted-foreground italic">Aucun</span>}</td>
                            <td className="px-4 py-3">
                              {badge ? (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                              ) : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground capitalize">{p.plan ?? "-"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("fr-FR")}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {p.currentPeriodEnd ? new Date(p.currentPeriodEnd).toLocaleDateString("fr-FR") : "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredProspects.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Aucun prospect trouve</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Mobile */}
                <div className="sm:hidden space-y-2 p-4">
                  {filteredProspects.map((p) => {
                    const badge = STATUS_BADGES[p.subscriptionStatus ?? ""];
                    return (
                      <div key={p.id} onClick={() => p.restaurantId && openDetail({ id: p.restaurantId, name: p.restaurantName, slug: p.restaurantSlug })} className="bg-secondary/30 rounded-xl p-3 space-y-1 cursor-pointer">
                        <p className="text-sm font-medium truncate">{p.email}</p>
                        <p className="text-xs text-muted-foreground">{p.restaurantName || "Pas de restaurant"}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {badge && <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>{badge.label}</span>}
                          {p.plan && <span className="text-[11px] text-muted-foreground capitalize">{p.plan}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ════════ TAB: REVENUE ════════ */}
        {tab === "revenue" && (
          <>
            {/* Revenue breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "MRR total", value: kpis ? `${kpis.mrr.toFixed(0)} EUR` : "-", icon: Euro, accent: true },
                { label: "Mensuel", value: monthlyMRR ? `${(monthlyMRR.couponMRR + monthlyMRR.fullMRR).toFixed(0)} EUR` : "-", sub: monthlyMRR ? `${monthlyMRR.couponCount} a 1EUR + ${monthlyMRR.fullCount} a 29.99EUR` : undefined, icon: CreditCard },
                { label: "Annuel", value: kpis ? `${(kpis.annualSubscribers * (PLAN_PRICES.annual / 12)).toFixed(0)} EUR/mois` : "-", sub: kpis && kpis.annualSubscribers > 0 ? `${kpis.annualSubscribers} abonnes` : undefined, icon: TrendingUp },
                { label: "Churn", value: funnel ? `${funnel.churned}` : "-", sub: funnel && funnel.paying > 0 ? `${Math.round((funnel.churned / (funnel.paying + funnel.churned)) * 100)}% du total` : undefined, icon: TrendingDown },
              ].map((kpi) => (
                <Card key={kpi.label} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <kpi.icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </div>
                    <p className={`text-xl font-bold ${(kpi as any).accent ? "text-[hsl(var(--primary))]" : "text-foreground"}`}>{kpi.value}</p>
                    {(kpi as any).sub && <p className="text-xs text-muted-foreground mt-0.5">{(kpi as any).sub}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Active subscriptions list */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Abonnements Stripe actifs ({activeSubscriptions.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activeSubscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 px-4">Aucun abonnement actif</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2">Restaurant</th>
                          <th className="px-4 py-2">Plan</th>
                          <th className="px-4 py-2">Montant reel</th>
                          <th className="px-4 py-2">Debut</th>
                          <th className="px-4 py-2">Prochaine facture</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSubscriptions.map((p) => {
                          const threeMonths = 90 * 86400000;
                          const isCoupon = p.plan === "monthly" && p.subCreatedAt && (Date.now() - new Date(p.subCreatedAt).getTime()) < threeMonths;
                          const amount = p.plan === "annual" ? "239.88 EUR/an" : isCoupon ? "1 EUR/mois (coupon)" : "29.99 EUR/mois";
                          return (
                            <tr key={p.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-3 font-medium">{p.restaurantName || p.email}</td>
                              <td className="px-4 py-3 capitalize">{p.plan}</td>
                              <td className="px-4 py-3">
                                <span className={isCoupon ? "text-blue-600 font-medium" : ""}>{amount}</span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {p.subCreatedAt ? new Date(p.subCreatedAt).toLocaleDateString("fr-FR") : "-"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {p.currentPeriodEnd ? new Date(p.currentPeriodEnd).toLocaleDateString("fr-FR") : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ════════ TAB: EMAILS ════════ */}
        {tab === "emails" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total envoyes", value: emailLogs.length, icon: Send },
                { label: "Aujourd'hui", value: emailsToday, icon: Clock },
                { label: "Cette semaine", value: emailsWeek, icon: Mail },
                { label: "Desinscrits", value: unsubCount, icon: UserX },
              ].map((kpi) => (
                <Card key={kpi.label} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <kpi.icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Par type</CardTitle></CardHeader>
                <CardContent>
                  {emailTypeStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Aucun email envoye</p>
                  ) : (
                    <div className="space-y-1.5">
                      {emailTypeStats.map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between py-1 border-b last:border-0">
                          <span className="text-sm">{EMAIL_TYPE_LABELS[type] || type}</span>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Derniers envois</CardTitle></CardHeader>
                <CardContent>
                  {emailLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Aucun email envoye</p>
                  ) : (
                    <div className="space-y-1.5">
                      {emailLogs.slice(0, 12).map((l) => (
                        <div key={l.id} className="flex items-center justify-between py-1 border-b last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{l.recipient_email}</p>
                            <p className="text-xs text-muted-foreground">{EMAIL_TYPE_LABELS[l.email_type] || l.email_type}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(l.sent_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ════════ TAB: PROSPECTS ════════ */}
        {tab === "prospects" && !editingProspect && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Prospects</h2>
              <Button size="sm" className="rounded-xl" onClick={() => { setShowCreateProspect(true); setSelectedPlace(null); setPlaceQuery(""); setPlaceResults([]); setProspectSlug(""); }}>
                <Plus className="h-4 w-4 mr-1" /> Nouveau
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={prospectSearch} onChange={(e) => setProspectSearch(e.target.value)} className="pl-10 rounded-xl" />
            </div>

            {/* Prospect list */}
            <div className="space-y-2">
              {prospectRows
                .filter((r) => {
                  if (!prospectSearch.trim()) return true;
                  const q = prospectSearch.toLowerCase();
                  return r.name.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q);
                })
                .map((r) => (
                  <Card key={r.id} className="rounded-2xl">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getBusinessEmoji(r.business_type)}</span>
                          <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${r.account_status === "prospect" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {r.account_status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.city ?? "Ville non renseignee"} · {r.menuItemCount} produit{r.menuItemCount !== 1 ? "s" : ""} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a href={`https://app.commandeici.com/${r.slug}`} target="_blank" rel="noopener noreferrer nofollow">
                          <Button variant="outline" size="sm" className="rounded-lg h-8 w-8 p-0" title={`Apercu : /${r.slug}`}><Eye className="h-3.5 w-3.5" /></Button>
                        </a>
                        <Button variant="outline" size="sm" className="rounded-lg h-8 w-8 p-0" onClick={async () => {
                          const { data } = await supabase.from("restaurants").select("*").eq("id", r.id).single();
                          if (data) {
                            setEditingProspect(data as unknown as DbRestaurant);
                          }
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => {
                          if (r.account_status === "prospect") {
                            // For now just open the edit menu
                            (async () => {
                              const { data } = await supabase.from("restaurants").select("*").eq("id", r.id).single();
                              if (data) setEditingProspect(data as unknown as DbRestaurant);
                            })();
                          }
                        }}>
                          Continuer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              {prospectRows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun prospect. Cliquez sur "+ Nouveau" pour commencer.</p>
              )}
            </div>

            {/* Create prospect dialog */}
            {showCreateProspect && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateProspect(false); }}>
                <div className="bg-background rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Creer un prospect</h3>

                  {/* Google Places search */}
                  <div>
                    <label className="text-sm font-medium text-foreground">Rechercher un commerce</label>
                    <div className="flex gap-2 mt-1">
                      <Input value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="Boulangerie Martin Strasbourg..." className="rounded-xl"
                        onKeyDown={(e) => { if (e.key === "Enter") searchPlaces(placeQuery).then(setPlaceResults).catch(() => {}); }}
                      />
                      <Button size="sm" className="rounded-xl" onClick={() => searchPlaces(placeQuery).then(setPlaceResults).catch(() => {})}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Results */}
                  {placeResults.length > 0 && !selectedPlace && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {placeResults.map((p) => (
                        <button key={p.place_id} className="w-full text-left p-3 rounded-xl hover:bg-secondary transition-colors border border-border"
                          onClick={async () => {
                            const details = await getPlaceDetails(p.place_id);
                            const merged = { ...p, ...details };
                            setSelectedPlace(merged);
                            const detected = detectBusinessType(merged.types ?? []);
                            setProspectBusinessType(detected);
                            const slug = await generateSlug(merged.name);
                            setProspectSlug(slug);
                          }}
                        >
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.formatted_address ?? p.vicinity}</p>
                          {p.rating && <p className="text-xs text-muted-foreground">⭐ {p.rating}</p>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected place details */}
                  {selectedPlace && (
                    <div className="space-y-4">
                      <Card className="rounded-xl bg-secondary/30">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-sm font-semibold">{selectedPlace.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedPlace.formatted_address}</p>
                          {selectedPlace.formatted_phone_number && <p className="text-xs text-muted-foreground">Tel: {selectedPlace.formatted_phone_number}</p>}
                          {selectedPlace.rating && <p className="text-xs text-muted-foreground">⭐ {selectedPlace.rating}</p>}
                          {selectedPlace.opening_hours?.weekday_text && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-muted-foreground">Horaires :</p>
                              {selectedPlace.opening_hours.weekday_text.map((line: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground">{line}</p>
                              ))}
                            </div>
                          )}
                          <button className="text-xs text-blue-600 underline mt-2" onClick={() => { setSelectedPlace(null); setPlaceResults([]); }}>
                            Changer de commerce
                          </button>
                        </CardContent>
                      </Card>

                      {/* Business type */}
                      <div>
                        <label className="text-sm font-medium text-foreground">Type de commerce</label>
                        <select value={prospectBusinessType} onChange={(e) => setProspectBusinessType(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm bg-background">
                          {BUSINESS_TYPES.map((bt) => (
                            <option key={bt.value} value={bt.value}>{bt.emoji} {bt.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Detecte automatiquement, modifiable</p>
                      </div>

                      {/* Slug */}
                      <div>
                        <label className="text-sm font-medium text-foreground">Slug (URL)</label>
                        <Input value={prospectSlug} onChange={(e) => setProspectSlug(e.target.value)} className="mt-1 rounded-xl" />
                        <p className="text-xs text-muted-foreground mt-1">commandeici.com/{prospectSlug}</p>
                      </div>

                      {/* Color */}
                      <div>
                        <label className="text-sm font-medium text-foreground">Couleur principale</label>
                        <input type="color" value={prospectColor} onChange={(e) => setProspectColor(e.target.value)} className="mt-1 h-10 w-20 rounded-lg border border-border cursor-pointer" />
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowCreateProspect(false)} className="rounded-xl">Annuler</Button>
                        <Button disabled={creatingProspect || !prospectSlug} className="rounded-xl" onClick={async () => {
                          if (!authUserId || !selectedPlace) return;
                          setCreatingProspect(true);
                          try {
                            const city = selectedPlace.formatted_address?.split(",").slice(-2, -1)[0]?.trim() ?? "";
                            await createProspect({
                              name: selectedPlace.name,
                              slug: prospectSlug,
                              address: selectedPlace.formatted_address ?? "",
                              city,
                              restaurant_phone: selectedPlace.formatted_phone_number ?? "",
                              google_place_id: selectedPlace.place_id,
                              rating: selectedPlace.rating ?? undefined,
                              website: selectedPlace.website ?? "",
                              hours: selectedPlace.opening_hours?.weekday_text?.join("\n") ?? "",
                              business_type: prospectBusinessType,
                              primary_color: prospectColor,
                              owner_id: authUserId,
                            });
                            setShowCreateProspect(false);
                            loadData();
                          } catch (e: any) {
                            alert("Erreur : " + (e.message ?? e));
                          }
                          setCreatingProspect(false);
                        }}>
                          {creatingProspect ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                          Creer le prospect
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Convert dialog */}
            {convertingProspect && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setConvertingProspect(null); }}>
                <div className="bg-background rounded-2xl max-w-md w-full p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Convertir en compte actif</h3>
                  <div className="space-y-1">
                    <p className="text-sm"><span className="font-medium">{convertingProspect.name}</span></p>
                    <p className="text-xs text-muted-foreground">commandeici.com/{convertingProspect.slug}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email du commercant *</label>
                    <Input value={convertEmail} onChange={(e) => setConvertEmail(e.target.value)} placeholder="email@commerce.fr" className="mt-1 rounded-xl" />
                    <p className="text-xs text-muted-foreground mt-1">Un email d'invitation sera envoye</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setConvertingProspect(null)} className="rounded-xl">Annuler</Button>
                    <Button disabled={converting || !convertEmail.includes("@")} className="rounded-xl" onClick={async () => {
                      setConverting(true);
                      try {
                        const { error } = await supabase.functions.invoke("convert-prospect", {
                          body: { restaurantId: convertingProspect.id, email: convertEmail },
                        });
                        if (error) throw error;
                        setConvertingProspect(null);
                        loadData();
                      } catch (e: any) {
                        alert("Erreur : " + (e.message ?? e));
                      }
                      setConverting(false);
                    }}>
                      {converting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                      Convertir et inviter
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Editing prospect menu */}
        {tab === "prospects" && editingProspect && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setEditingProspect(null); setQrCodeDataUrl(null); setUploadedPhotos([]); loadData(); }} className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <h2 className="text-lg font-semibold">{getBusinessEmoji(editingProspect.business_type ?? "restaurant")} {editingProspect.name} - Catalogue</h2>
            </div>

            {/* QR Code + Uploaded photos */}
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-2 sm:w-48 flex-shrink-0">
                    {!qrCodeDataUrl ? (
                      <Button variant="outline" className="rounded-xl w-full" onClick={async () => {
                        const key = editingProspect.id.slice(0, 8).split("").reverse().join("");
                        const url = `https://app.commandeici.com/upload/${editingProspect.id}?key=${key}`;
                        const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 1 });
                        setQrCodeDataUrl(dataUrl);
                        // Also load existing uploads
                        const { data } = await supabase.storage.from("prospect-uploads").list(editingProspect.id, { limit: 50 });
                        if (data) {
                          setUploadedPhotos(data.map((f) => `https://rbqgsxhkccbhqdmdtxwr.supabase.co/storage/v1/object/public/prospect-uploads/${editingProspect.id}/${f.name}`));
                        }
                      }}>
                        Generer QR Code
                      </Button>
                    ) : (
                      <>
                        <img src={qrCodeDataUrl} alt="QR Code" className="w-40 h-40 rounded-lg border border-border" />
                        <p className="text-[11px] text-muted-foreground text-center">Scannez pour envoyer des photos depuis le telephone</p>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={async () => {
                          // Refresh uploaded photos
                          const { data } = await supabase.storage.from("prospect-uploads").list(editingProspect.id, { limit: 50 });
                          if (data) {
                            setUploadedPhotos(data.map((f) => `https://rbqgsxhkccbhqdmdtxwr.supabase.co/storage/v1/object/public/prospect-uploads/${editingProspect.id}/${f.name}`));
                          }
                        }}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Actualiser les photos
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Uploaded photos grid */}
                  <div className="flex-1">
                    {uploadedPhotos.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-foreground">{uploadedPhotos.length} photo{uploadedPhotos.length > 1 ? "s" : ""} recue{uploadedPhotos.length > 1 ? "s" : ""}</p>
                          {selectedUploadIndexes.size > 0 && !analyzing && (
                            <Button size="sm" className="rounded-xl text-xs" onClick={async () => {
                              setAnalyzing(true);
                              setAnalyzedCategories(null);
                              try {
                                const urls = Array.from(selectedUploadIndexes).map((i) => uploadedPhotos[i]);
                                const { data, error } = await supabase.functions.invoke("analyze-menu", {
                                  body: { imageUrls: urls },
                                });
                                if (error) throw error;
                                setAnalyzedCategories(data?.categories ?? []);
                              } catch (e: any) {
                                alert("Erreur analyse : " + (e.message ?? e));
                              }
                              setAnalyzing(false);
                            }}>
                              Analyser la selection ({selectedUploadIndexes.size})
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {uploadedPhotos.map((url, i) => {
                            const selected = selectedUploadIndexes.has(i);
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  setSelectedUploadIndexes((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(i)) next.delete(i);
                                    else next.add(i);
                                    return next;
                                  });
                                }}
                                className={`relative block aspect-square rounded-lg overflow-hidden border-2 transition-all ${selected ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]" : "border-border hover:border-muted-foreground"}`}
                              >
                                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                {selected && (
                                  <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">{Array.from(selectedUploadIndexes).sort((a, b) => a - b).indexOf(i) + 1}</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {analyzing && (
                          <div className="flex items-center gap-2 mt-3 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
                            <p className="text-sm text-muted-foreground">Nous sommes en train de lire votre carte, comprendre vos produits et vos prix. Ca prend quelques secondes...</p>
                          </div>
                        )}
                        {!analyzing && selectedUploadIndexes.size === 0 && (
                          <p className="text-[11px] text-muted-foreground mt-2">Selectionnez les photos de carte/menu a analyser</p>
                        )}
                      </div>
                    ) : qrCodeDataUrl ? (
                      <div className="flex items-center justify-center h-full text-center py-8">
                        <div>
                          <p className="text-sm text-muted-foreground">En attente de photos...</p>
                          <p className="text-xs text-muted-foreground mt-1">Scannez le QR code avec votre telephone</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Menu review after analysis */}
            {analyzedCategories && analyzedCategories.length > 0 && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Resultat de l'analyse - Verifiez et ajustez</CardTitle>
                </CardHeader>
                <CardContent>
                  <MenuReviewEditor
                    menu={analyzedCategories}
                    onConfirm={async (cats) => {
                      setSavingMenu(true);
                      try {
                        const existing = await fetchAllItems(editingProspect.id);
                        const existingKeys = new Set(existing.map((i) => `${i.name.toLowerCase().trim()}::${i.category.toLowerCase().trim()}`));
                        const existingCats = new Set((editingProspect.categories ?? []).map((c: string) => c.toLowerCase().trim()));
                        const newCats: string[] = [];
                        let added = 0;
                        let maxSort = existing.reduce((m, i) => Math.max(m, i.sort_order ?? 0), 0);

                        for (const cat of cats) {
                          const catName = cat.name.trim();
                          if (!catName) continue;
                          if (!existingCats.has(catName.toLowerCase())) {
                            newCats.push(catName);
                            existingCats.add(catName.toLowerCase());
                          }
                          for (const item of cat.items) {
                            const key = `${item.name.toLowerCase().trim()}::${catName.toLowerCase()}`;
                            if (existingKeys.has(key)) continue;
                            const supps = (item.supplements ?? []).map((s, si) => ({ id: `s-${Date.now()}-${si}`, name: s.name, price: s.price }));
                            await insertMenuItem({
                              restaurant_id: editingProspect.id,
                              name: item.name.trim(),
                              description: item.description || "",
                              price: item.price,
                              category: catName,
                              enabled: true,
                              popular: false,
                              sort_order: ++maxSort,
                              supplements: supps.length > 0 ? supps : undefined,
                            });
                            added++;
                          }
                        }
                        if (newCats.length > 0) {
                          await updateRestaurantCategories(editingProspect.id, [...(editingProspect.categories ?? []), ...newCats]);
                          // Refresh the prospect data
                          const { data } = await supabase.from("restaurants").select("*").eq("id", editingProspect.id).single();
                          if (data) setEditingProspect(data as unknown as DbRestaurant);
                        }
                        setAnalyzedCategories(null);
                        setSelectedUploadIndexes(new Set());
                        alert(`${added} produit${added > 1 ? "s" : ""} ajoute${added > 1 ? "s" : ""} au catalogue`);
                      } catch (e: any) {
                        alert("Erreur sauvegarde : " + (e.message ?? e));
                      }
                      setSavingMenu(false);
                    }}
                    onBack={() => setAnalyzedCategories(null)}
                  />
                </CardContent>
              </Card>
            )}

            <DashboardMaCarte
              restaurant={editingProspect}
              isDemo={false}
            />
          </div>
        )}

        {/* ════════ TAB: OUTILS ════════ */}
        {tab === "tools" && (
          <>
            {/* Demo stats */}
            {demoStats && (
              <Card className="rounded-2xl">
                <button onClick={() => setDemoOpen(!demoOpen)} className="w-full flex items-center justify-between p-4 text-left">
                  <p className="text-sm font-semibold text-foreground">Demo ({demoStats.totalOrders} commandes)</p>
                  {demoOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {demoOpen && (
                  <CardContent className="pt-0 pb-4 px-4">
                    <p className="text-[11px] text-muted-foreground mb-3 italic">Commandes de demonstration, pas du revenu commandeici.</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Commandes", value: demoStats.totalOrders, icon: ShoppingBag },
                        { label: "CA demo", value: `${demoStats.totalRevenue.toFixed(2)} EUR`, icon: Euro },
                        { label: "Derniere", value: demoStats.lastOrderAt ? timeAgo(demoStats.lastOrderAt) : "Jamais", icon: Clock },
                      ].map((s) => (
                        <div key={s.label} className="bg-secondary/50 rounded-xl p-3 text-center">
                          <s.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                          <p className="text-lg font-bold text-foreground">{s.value}</p>
                          <p className="text-[11px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Promo codes */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  Codes promo ({promoCodes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {promoCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 px-4">Aucun code promo</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2">Code</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Valeur</th>
                          <th className="px-4 py-2">Utilisations</th>
                          <th className="px-4 py-2">Actif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoCodes.map((code) => (
                          <tr key={code.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-mono font-medium">{code.code}</td>
                            <td className="px-4 py-3 text-muted-foreground">{PROMO_TYPE_LABELS[code.type] ?? code.type}</td>
                            <td className="px-4 py-3">{code.type === "discount_percent" ? `${code.value}%` : code.type === "discount_fixed" ? `${code.value} EUR` : `${code.value}j`}</td>
                            <td className="px-4 py-3 text-muted-foreground">{code.current_uses}{code.max_uses !== null ? `/${code.max_uses}` : ""}</td>
                            <td className="px-4 py-3"><span className={`inline-block h-2 w-2 rounded-full ${code.active ? "bg-emerald-500" : "bg-red-400"}`} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Referrals */}
            {referralsData && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    Parrainages
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Codes actifs ({referralsData.activeCodes.length})</p>
                    {referralsData.activeCodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucun code de parrainage</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {referralsData.activeCodes.map((c) => (
                          <div key={c.restaurantId} className="bg-secondary/50 rounded-lg px-3 py-1.5 text-xs">
                            <span className="font-mono font-semibold">{c.referralCode}</span>
                            <span className="text-muted-foreground ml-1.5">{c.restaurantName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {referralsData.referrals.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Parrainages ({referralsData.referrals.length})</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                              <th className="px-3 py-2">Parrain</th>
                              <th className="px-3 py-2">Filleul</th>
                              <th className="px-3 py-2">Statut</th>
                              <th className="px-3 py-2">Bonus</th>
                              <th className="px-3 py-2">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {referralsData.referrals.map((ref) => {
                              const badge = STATUS_BADGES[ref.status] ?? { label: ref.status, className: "bg-gray-100 text-gray-800" };
                              return (
                                <tr key={ref.id} className="border-b border-border last:border-0">
                                  <td className="px-3 py-2.5">{ref.referrerName}</td>
                                  <td className="px-3 py-2.5 text-muted-foreground">{ref.refereeName ?? ref.refereeEmail ?? "-"}</td>
                                  <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>{badge.label}</span></td>
                                  <td className="px-3 py-2.5 text-muted-foreground">{ref.bonusWeeks > 0 ? `+${ref.bonusWeeks} sem.` : "-"}</td>
                                  <td className="px-3 py-2.5 text-muted-foreground">{new Date(ref.createdAt).toLocaleDateString("fr-FR")}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SuperAdminPage;
