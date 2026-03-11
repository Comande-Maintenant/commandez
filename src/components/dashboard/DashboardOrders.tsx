import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ShoppingBag, ChevronRight, Package, WifiOff, UtensilsCrossed, Plus, Clock, Timer, AlertTriangle, ShieldBan, Volume2 } from "lucide-react";
import { fetchOrders, fetchDemoOrders, fetchMenuItems, fetchAllMenuItems, updateOrderStatus, updateMenuItem, updateRestaurant, subscribeToOrders, upsertCustomer, updateCustomerStats, advanceDemoOrder, fetchCustomers, fetchDemoCustomers, fetchRestaurantHours } from "@/lib/api";
import { formatDisplayNumber } from "@/lib/orderNumber";
import { formatOrderTime } from "@/lib/formatOrderTime";
import { useLanguage } from "@/context/LanguageContext";
import type { DbRestaurant, DbMenuItem, DbOrder, DbCustomer } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { BanDialog } from "./BanDialog";
import { PrepSummaryBoard } from "./PrepSummaryBoard";
import { CustomerBadge } from "./CustomerBadge";
import { CustomerMiniProfile } from "./CustomerMiniProfile";
import { toast } from "sonner";

type OrderStatus = "new" | "preparing" | "ready" | "done";

const statusColors: Record<OrderStatus, string> = {
  new: "border-l-amber-500 bg-amber-50/50",
  preparing: "border-l-blue-500 bg-blue-50/30",
  ready: "border-l-emerald-500 bg-emerald-50/30",
  done: "border-l-gray-300 bg-card",
};

const statusBadgeClass: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-emerald-100 text-emerald-800",
  done: "bg-gray-100 text-gray-600",
};

type KitchenFilter = "active" | "new" | "preparing" | "done";

interface Props {
  restaurant: DbRestaurant;
  onNewOrderSound?: () => void;
  isDemo?: boolean;
}

export const DashboardOrders = ({ restaurant, onNewOrderSound, isDemo }: Props) => {
  const { t, language } = useLanguage();

  const LOCALE_MAP: Record<string, string> = { fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT", nl: "nl-NL", ar: "ar-SA", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", tr: "tr-TR", vi: "vi-VN" };
  const locale = LOCALE_MAP[language] || "fr-FR";

  const statusBadge: Record<OrderStatus, { text: string; class: string }> = {
    new: { text: t("dashboard.orders.status_new"), class: statusBadgeClass.new },
    preparing: { text: t("dashboard.orders.status_preparing"), class: statusBadgeClass.preparing },
    ready: { text: t("dashboard.orders.status_ready"), class: statusBadgeClass.ready },
    done: { text: t("dashboard.orders.status_done"), class: statusBadgeClass.done },
  };

  const filterTabsDef: { id: KitchenFilter; label: string }[] = [
    { id: "active", label: t("dashboard.orders.filter_all") },
    { id: "new", label: t("dashboard.orders.filter_new") },
    { id: "preparing", label: t("dashboard.orders.filter_in_progress") },
    { id: "done", label: t("dashboard.orders.filter_done") },
  ];
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<DbMenuItem[]>([]);
  const [outOfStockIngredients, setOutOfStockIngredients] = useState<string[]>(restaurant.out_of_stock_ingredients ?? []);
  const [filter, setFilter] = useState<KitchenFilter>("active");
  const [loading, setLoading] = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);
  const [rupturesOpen, setRupturesOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{ customer_name: string; customer_phone: string; restaurant_id: string; id?: string } | null>(null);
  const [popupOrder, setPopupOrder] = useState<DbOrder | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customersMap, setCustomersMap] = useState<Map<string, DbCustomer>>(new Map());
  const [profileCustomer, setProfileCustomer] = useState<DbCustomer | null>(null);
  const [restaurantHours, setRestaurantHours] = useState<{ day_of_week: number; is_open: boolean; open_time: string; close_time: string }[]>([]);

  // Tick for countdown timers on cards (re-render every 5s)
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  // Demo auto-orders
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  const loadOrders = useCallback(async () => {
    const data = isDemo
      ? await fetchDemoOrders(restaurant.id)
      : await fetchOrders(restaurant.id);
    if (isDemo) {
      // Detect new orders for sound notification
      const newNewOrders = data.filter(
        (o) => o.status === "new" && !prevOrderIdsRef.current.has(o.id)
      );
      if (newNewOrders.length > 0 && prevOrderIdsRef.current.size > 0) {
        if (onNewOrderSound) onNewOrderSound();
        setPopupOrder(newNewOrders[0]);
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setPopupOrder(null), 12000);
      }
      prevOrderIdsRef.current = new Set(data.map((o) => o.id));

      // Preserve locally-set estimated_ready_at (not stored server-side for demo)
      setOrders((prev) => {
        const localEstimates = new Map<string, string>();
        prev.forEach((o) => {
          if (o.estimated_ready_at) localEstimates.set(o.id, o.estimated_ready_at);
        });
        return data.map((o) => {
          const localEst = localEstimates.get(o.id);
          if (!o.estimated_ready_at && localEst) {
            return { ...o, estimated_ready_at: localEst };
          }
          return o;
        });
      });
    } else {
      setOrders(data);
    }
    setLoading(false);
  }, [restaurant.id, isDemo, onNewOrderSound]);

  const loadCustomers = useCallback(async () => {
    try {
      const data = isDemo ? await fetchDemoCustomers(restaurant.id) : await fetchCustomers(restaurant.id);
      const map = new Map<string, DbCustomer>();
      data.forEach((c) => map.set(c.customer_phone, c));
      setCustomersMap(map);
    } catch {}
  }, [restaurant.id, isDemo]);

  useEffect(() => {
    fetchMenuItems(restaurant.id).then(setMenuItems);
    fetchAllMenuItems(restaurant.id).then(setAllMenuItems);
    loadCustomers();
    fetchRestaurantHours(restaurant.id).then((h) => {
      if (h.length > 0) {
        setRestaurantHours(h.map((r: any) => ({ day_of_week: r.day_of_week, is_open: r.is_open, open_time: r.open_time, close_time: r.close_time })));
      } else if (isDemo) {
        // Default kebab hours for demo: Mon-Sat 11:00-14:30 + 18:00-22:30, closed Sunday
        const demoHours = [
          { day_of_week: 0, is_open: false, open_time: "", close_time: "" },
          ...([1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, is_open: true, open_time: "11:00", close_time: "22:30" }))),
        ];
        setRestaurantHours(demoHours);
      }
    }).catch(() => {});
  }, [restaurant.id, loadCustomers]);

  useEffect(() => {
    loadOrders();
    if (isDemo) {
      const demoPoll = setInterval(() => {
        loadOrders().catch(() => {});
      }, 5000);
      return () => clearInterval(demoPoll);
    }
    const unsub = subscribeToOrders(restaurant.id, (newOrder) => {
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === newOrder.id);
        if (exists) {
          return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
        }
        if (newOrder.status === "new") {
          if (onNewOrderSound) onNewOrderSound();
          // Show popup
          setPopupOrder(newOrder);
          if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
          popupTimerRef.current = setTimeout(() => setPopupOrder(null), 12000);
        }
        return [newOrder, ...prev];
      });
      setDisconnected(false);
    });

    const healthCheck = setInterval(() => {
      loadOrders().catch(() => setDisconnected(true));
    }, 60000);

    return () => {
      unsub();
      clearInterval(healthCheck);
    };
  }, [restaurant.id, loadOrders]);

  // Auto-cancel stale pending orders for "always open" mode
  useEffect(() => {
    if (restaurant.availability_mode !== "always") return;
    const interval = setInterval(() => {
      const now = Date.now();
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status !== "new") return o;
          const elapsed = now - new Date(o.created_at).getTime();
          if (elapsed > 15 * 60 * 1000) {
            updateOrderStatus(o.id, "done").catch(() => {});
            return { ...o, status: "done" as const };
          }
          return o;
        })
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [restaurant.availability_mode]);

  // Get customer from map, or build a minimal fallback from order data
  const getCustomerForOrder = (order: DbOrder): DbCustomer | null => {
    const existing = customersMap.get(order.customer_phone);
    if (existing) return existing;
    if (!order.customer_phone) return null;
    return {
      id: "",
      restaurant_id: restaurant.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: (order as any).customer_email || "",
      total_orders: 1,
      total_spent: Number(order.total),
      average_basket: Number(order.total),
      first_order_at: order.created_at,
      last_order_at: order.created_at,
      favorite_items: [],
      last_items: [],
      notes: "",
      is_banned: false,
      banned_at: null,
      banned_reason: "",
      ban_expires_at: null,
      flagged: false,
      created_at: order.created_at,
      updated_at: order.created_at,
    } as DbCustomer;
  };

  // Kitchen only sees new + preparing (active). "ready" goes to caisse. "done" is archive.
  const kitchenOrders = orders.filter((o) => o.status === "new" || o.status === "preparing");
  const filtered = filter === "active"
    ? kitchenOrders
    : filter === "done"
      ? orders.filter((o) => o.status === "done" || o.status === "ready")
      : orders.filter((o) => o.status === filter);

  // Count by status
  const newCount = orders.filter((o) => o.status === "new").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;

  const todayOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayDoneOrders = todayOrders.filter((o) => o.status === "done");
  const todayRevenue = todayDoneOrders.reduce((s, o) => s + Number(o.total), 0);

  const timeSince = (dateStr: string) => formatOrderTime(dateStr, language, t);

  // Compute next opening message when no orders
  const getNextOpeningMessage = (): string | null => {
    if (restaurantHours.length === 0) return null;
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Check if currently within opening hours
    const todaySchedule = restaurantHours.find((h) => h.day_of_week === currentDay);
    if (todaySchedule?.is_open && todaySchedule.open_time && todaySchedule.close_time) {
      const [oh, om] = todaySchedule.open_time.split(":").map(Number);
      const [ch, cm] = todaySchedule.close_time.split(":").map(Number);
      const openMin = oh * 60 + om;
      const closeMin = ch * 60 + cm;
      if (currentMinutes >= openMin && currentMinutes < closeMin) return null; // we're open, no message needed
    }

    // Find next opening: check today (later slot) then next 7 days
    for (let offset = 0; offset <= 7; offset++) {
      const day = (currentDay + offset) % 7;
      const schedule = restaurantHours.find((h) => h.day_of_week === day);
      if (!schedule?.is_open || !schedule.open_time) continue;

      const [oh, om] = schedule.open_time.split(":").map(Number);
      const openMin = oh * 60 + om;

      // If today, only consider if opening is in the future
      if (offset === 0 && openMin <= currentMinutes) continue;

      const diffMin = offset === 0
        ? openMin - currentMinutes
        : (offset * 1440) + openMin - currentMinutes;

      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;

      const DAYS = [
        t("schedule.sunday"), t("schedule.monday"), t("schedule.tuesday"), t("schedule.wednesday"),
        t("schedule.thursday"), t("schedule.friday"), t("schedule.saturday"),
      ];

      if (offset === 0) {
        // Later today
        if (hours > 0) return t("dashboard.orders.next_opening_hours", { hours: String(hours), minutes: String(mins) });
        return t("dashboard.orders.next_opening_minutes", { minutes: String(mins) });
      }
      if (offset === 1) {
        return t("dashboard.orders.next_opening_tomorrow", { time: schedule.open_time });
      }
      return t("dashboard.orders.next_opening_day", { day: DAYS[day], time: schedule.open_time });
    }
    return null;
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));

    // Update customer stats when completing
    if (newStatus === "done" && !isDemo) {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        upsertCustomer({
          restaurant_id: restaurant.id,
          customer_phone: order.customer_phone,
          customer_name: order.customer_name,
          customer_email: (order as any).customer_email || undefined,
        }).then((customer) => {
          const orderItems = ((order.items as any[]) || []).map((i: any) => ({
            name: i.name,
            quantity: i.quantity || 1,
          }));
          updateCustomerStats(customer.id, Number(order.total), orderItems).catch(console.error);
        }).catch(console.error);
      }
    }

    // Auto-advance to next kitchen order or close detail
    // In kitchen: "ready" means the order leaves the kitchen → move to next
    const remaining = orders
      .filter((o) => o.id !== orderId && (o.status === "new" || o.status === "preparing"))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (newStatus === "ready" || newStatus === "done") {
      // Order left the kitchen → show next pending or close
      if (remaining.length > 0) {
        setSelectedOrder(remaining[0]);
      } else {
        setSelectedOrder(null);
      }
    } else if (newStatus === "preparing") {
      // Just accepted - update in place
      setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
    } else {
      setSelectedOrder(null);
    }
  };

  const handleOrderUpdated = (updatedOrder: DbOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    setSelectedOrder(updatedOrder);
  };

  // Calculate default prep time
  const getDefaultPrepMinutes = (order: DbOrder) => {
    const cfg = restaurant.prep_time_config;
    if (!cfg) return 15;
    const itemCount = ((order.items as any[]) || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0);
    return Math.min(cfg.default_minutes + itemCount * cfg.per_item_minutes, cfg.max_minutes);
  };

  // Quick advance from card (without opening detail)
  const quickAdvance = async (e: React.MouseEvent, order: DbOrder) => {
    e.stopPropagation();
    const statusFlow: Record<string, OrderStatus> = { new: "preparing", preparing: "ready", ready: "done" };
    const next = statusFlow[order.status];
    if (!next) return;

    try {
      const estimatedMinutes = next === "preparing" ? getDefaultPrepMinutes(order) : undefined;
      if (isDemo) {
        await advanceDemoOrder(order.id, next);
        if (next === "preparing") {
          const estAt = new Date(Date.now() + (estimatedMinutes || 15) * 60000).toISOString();
          setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, estimated_ready_at: estAt } : o));
        }
      } else {
        await updateOrderStatus(order.id, next, estimatedMinutes);
      }
      handleStatusChange(order.id, next);
    } catch {
      toast.error(t("common.error"));
    }
  };

  // Navigation in detail
  const selectedIndex = selectedOrder ? filtered.findIndex((o) => o.id === selectedOrder.id) : -1;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Connection lost banner */}
      {disconnected && (
        <div className="mb-4 p-3 bg-destructive/10 rounded-xl flex items-center gap-2 text-sm text-destructive">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          {t('dashboard.orders.connection_lost')}
        </div>
      )}

      {/* Stats counters - kitchen only sees new + preparing */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <button
          onClick={() => setFilter(newCount > 0 ? "new" : "active")}
          className={`bg-card rounded-2xl border border-border p-3 text-left transition-all hover:shadow-sm ${filter === "new" ? "ring-2 ring-amber-400" : ""}`}
        >
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t("dashboard.orders.filter_new")}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-0.5 ${newCount > 0 ? "text-amber-600" : "text-foreground"}`}>{newCount}</p>
        </button>
        <button
          onClick={() => setFilter(preparingCount > 0 ? "preparing" : "active")}
          className={`bg-card rounded-2xl border border-border p-3 text-left transition-all hover:shadow-sm ${filter === "preparing" ? "ring-2 ring-blue-400" : ""}`}
        >
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t("dashboard.orders.filter_in_progress")}</p>
          <p className="text-xl sm:text-2xl font-bold mt-0.5 text-foreground">{preparingCount}</p>
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`bg-card rounded-2xl border border-border p-3 text-left transition-all hover:shadow-sm ${filter === "done" ? "ring-2 ring-gray-400" : ""}`}
        >
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t("dashboard.orders.filter_done")}</p>
          <p className="text-xl sm:text-2xl font-bold mt-0.5 text-foreground">{todayDoneOrders.length}</p>
        </button>
      </div>

      {/* Prep summary for kitchen */}
      <PrepSummaryBoard orders={orders} nextOpeningMessage={getNextOpeningMessage()} />

      {/* Ruptures + info row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {todayDoneOrders.length > 0 && (
            <span>{todayDoneOrders.length} {t("dashboard.orders.status_done").toLowerCase()}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5"
          onClick={() => setRupturesOpen(true)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("dashboard.orders.out_of_stock")}
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {filterTabsDef.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px] ${filter === tab.id ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            {tab.id === "new" && newCount > 0 && (
              <span className="ms-1.5 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{newCount}</span>
            )}
            {tab.id === "preparing" && preparingCount > 0 && (
              <span className="ms-1.5 bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{preparingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Order cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (() => {
          const nextMsg = getNextOpeningMessage();
          return (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {t("dashboard.orders.no_orders_filtered")}
              </p>
              {nextMsg && (
                <p className="text-xs mt-2 text-muted-foreground/70">
                  <Clock className="h-3 w-3 inline -mt-0.5 mr-1" />
                  {nextMsg}
                </p>
              )}
            </div>
          );
        })()}
        {filtered.map((order) => {
          const st = order.status as OrderStatus;
          const badge = statusBadge[st];
          const orderItems = (order.items as any[]) || [];
          const itemCount = orderItems.reduce((s, i) => s + (i.quantity || 1), 0);
          const statusFlow: Record<string, string> = { new: t("dashboard.orders.action_accept"), preparing: t("dashboard.orders.action_ready"), ready: t("dashboard.orders.action_done") };
          const nextLabel = statusFlow[st];

          // Timer countdown for card
          const estReady = order.estimated_ready_at;
          let timerLabel: string | null = null;
          let timerUrgent = false;
          if (estReady && (st === "preparing" || st === "new")) {
            const remainSec = Math.max(0, Math.floor((new Date(estReady).getTime() - Date.now()) / 1000));
            const m = Math.floor(remainSec / 60);
            const s = remainSec % 60;
            timerLabel = `${m}:${String(s).padStart(2, "0")}`;
            if (remainSec <= 60) timerUrgent = true;
          }

          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedOrder(order)}
              className={`rounded-2xl border border-border border-l-4 p-3 sm:p-4 cursor-pointer hover:shadow-md active:shadow-sm transition-all ${statusColors[st]} ${st === "new" ? "animate-pulse-subtle" : ""}`}
            >
              {/* Top row: number + badge + timer + time */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-foreground">{formatDisplayNumber(order)}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.class}`}>{badge.text}</span>
                  {(order as any).source === "pos" && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{t("dashboard.orders.source_pos")}</span>
                  )}
                  {timerLabel && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                      timerUrgent ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      <Timer className="h-3 w-3" />
                      {timerLabel}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{timeSince(order.created_at)}</span>
              </div>

              {/* Client + order type */}
              <div className="flex items-center gap-2 mb-2 text-sm flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const c = getCustomerForOrder(order);
                    if (c) setProfileCustomer(c);
                  }}
                  className="font-medium text-foreground hover:text-primary hover:underline transition-colors inline-flex items-center"
                >
                  {order.customer_name}
                  <CustomerBadge customer={customersMap.get(order.customer_phone) ?? null} compact />
                </button>
                <span className="text-muted-foreground">-</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  {(order.order_type === "collect" || order.order_type === "a_emporter") && <><ShoppingBag className="h-3.5 w-3.5" /> {t("dashboard.orders.takeaway")}</>}
                  {order.order_type === "sur_place" && <><UtensilsCrossed className="h-3.5 w-3.5" /> {t("dashboard.orders.dine_in")}</>}
                  {order.order_type === "telephone" && <><Phone className="h-3.5 w-3.5" /> {t("dashboard.orders.phone")}</>}
                </span>
                {order.pickup_time && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(order.pickup_time).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {!order.pickup_time && (order.order_type === "collect" || order.order_type === "a_emporter") && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">{t("pickup.asap")}</span>
                )}
              </div>

              {/* Customer note visible on card */}
              {(() => {
                const cust = customersMap.get(order.customer_phone);
                if (!cust?.notes) return null;
                return (
                  <button
                    onClick={(e) => { e.stopPropagation(); setProfileCustomer(cust); }}
                    className={`mb-2 px-2.5 py-1.5 rounded-lg text-xs text-start w-full ${
                      cust.flagged ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {cust.flagged && <AlertTriangle className="inline h-3 w-3 me-1" />}
                    {cust.notes.length > 60 ? cust.notes.slice(0, 60) + "..." : cust.notes}
                  </button>
                );
              })()}

              {/* Items detail for kitchen - food items */}
              {(() => {
                const isDrink = (item: any) =>
                  item.type === "drink" ||
                  (item.name && /^(coca|fanta|sprite|orangina|perrier|evian|eau|ice tea|limonade|jus|cafe|the|redbull|ayran|schweppes|oasis|capri|pepsi|7up)/i.test(item.name?.trim())) ||
                  (item.category && /boisson|drink|beverage/i.test(item.category));
                const foodItems = orderItems.filter((i: any) => !isDrink(i));
                const drinkItems = orderItems.filter((i: any) => isDrink(i));
                const drinkCount = drinkItems.reduce((s: number, i: any) => s + (i.quantity || 1), 0);

                return (
                  <>
                    <div className="space-y-2 mb-2">
                      {foodItems.map((item: any, i: number) => (
                        <div key={i}>
                          <span className="text-foreground font-bold text-base">
                            {item.quantity > 1 && <span className="text-lg me-1">{item.quantity}x</span>}
                            {item.name}
                          </span>
                          {item.viande_choice && !item.name.toLowerCase().includes(item.viande_choice.toLowerCase()) && (
                            <span className="text-foreground font-semibold ms-1">- {item.viande_choice}</span>
                          )}
                          {item.garniture_choices?.length > 0 && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">
                              {item.garniture_choices.map((g: any) => typeof g === "string" ? g : g.name).join(", ")}
                            </p>
                          )}
                          {item.base_choice && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">{item.base_choice}</p>
                          )}
                          {item.frites_inside !== undefined && item.frites_inside !== null && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">
                              {item.frites_inside ? t("options.fries_inside_yes") : t("options.fries_inside_no")}
                            </p>
                          )}
                          {item.sauces?.length > 0 && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">
                              {t("item.sauces")} : {item.sauces.join(", ")}
                            </p>
                          )}
                          {item.supplements?.length > 0 && (
                            <p className="text-foreground text-sm ms-3 mt-0.5">
                              + {item.supplements.map((s: any) => typeof s === "string" ? s : s.name).join(", ")}
                            </p>
                          )}
                          {item.accompagnement_choice && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">
                              + {item.accompagnement_choice.name}
                              {item.accompagnement_choice.size ? ` (${item.accompagnement_choice.size})` : ""}
                              {item.accompagnement_choice.sauces?.length ? ` - ${item.accompagnement_choice.sauces.join(", ")}` : ""}
                            </p>
                          )}
                          {item.accompagnement_choices?.length > 0 && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">
                              + {item.accompagnement_choices.map((a: any) => a.name).join(", ")}
                            </p>
                          )}
                          {item.drink_choice && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">+ {item.drink_choice.name}</p>
                          )}
                          {item.dessert_choice && (
                            <p className="text-muted-foreground text-sm ms-3 mt-0.5">+ {item.dessert_choice.name}</p>
                          )}
                          {item.notes && (
                            <p className="text-amber-600 text-sm ms-3 italic font-medium mt-0.5">{item.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Beverages - collapsed, discrete */}
                    {drinkCount > 0 && (
                      <div className="px-2 py-1 rounded-lg bg-secondary/50 text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                        <span>☕</span>
                        <span>{t("dashboard.kitchen.beverages_counter", { count: drinkCount })}</span>
                        <span className="text-[10px]">({drinkItems.map((d: any) => `${d.quantity > 1 ? d.quantity + "x " : ""}${d.name}`).join(", ")})</span>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Bottom row: total + action button */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-foreground blur-sensitive">{Number(order.total).toFixed(2)} €</span>
                  <span className="text-xs text-muted-foreground">{t("cart.items").replace("{count}", String(itemCount))}</span>
                </div>
                {nextLabel && (
                  <Button
                    size="sm"
                    onClick={(e) => quickAdvance(e, order)}
                    className={`rounded-xl gap-1 min-h-[40px] text-sm font-semibold ${
                      st === "new" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                      st === "preparing" ? "bg-blue-600 hover:bg-blue-700 text-white" :
                      "bg-foreground hover:bg-foreground/90 text-primary-foreground"
                    }`}
                  >
                    {nextLabel}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Order detail sheet */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailSheet
            key={selectedOrder.id}
            order={selectedOrder}
            orderIndex={selectedIndex >= 0 ? selectedIndex : 0}
            totalOrders={filtered.length}
            menuItems={menuItems}
            prepTimeConfig={restaurant.prep_time_config}
            isDemo={isDemo}
            customer={getCustomerForOrder(selectedOrder)}
            onCustomerClick={(c) => { setSelectedOrder(null); setProfileCustomer(c); }}
            onClose={() => setSelectedOrder(null)}
            onStatusChange={handleStatusChange}
            onOrderUpdated={handleOrderUpdated}
            onPrev={() => {
              if (selectedIndex > 0) setSelectedOrder(filtered[selectedIndex - 1]);
            }}
            onNext={() => {
              if (selectedIndex < filtered.length - 1) setSelectedOrder(filtered[selectedIndex + 1]);
            }}
          />
        )}
      </AnimatePresence>

      {/* Ban dialog from order */}
      {banTarget && (
        <BanDialog
          customer={banTarget as any}
          open={!!banTarget}
          onClose={() => setBanTarget(null)}
          onBanned={() => {
            setBanTarget(null);
            toast.success(t("dashboard.orders.client_banned"));
          }}
          restaurantId={restaurant.id}
        />
      )}

      {/* New order popup (central, auto-dismiss 12s) */}
      <AnimatePresence>
        {popupOrder && (() => {
          const po = popupOrder;
          const poItems = (po.items as any[]) || [];
          const poItemCount = poItems.reduce((s, i) => s + (i.quantity || 1), 0);
          return (
            <motion.div
              key={po.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => { setPopupOrder(null); setFilter("active"); }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 cursor-pointer"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-3xl border-2 border-amber-400 shadow-2xl p-6 mx-4 max-w-sm w-full text-center"
              >
                <div className="text-4xl mb-3">🔔</div>
                <p className="text-2xl font-bold text-foreground mb-1">{t("dashboard.orders.new_order_popup")}</p>
                <p className="text-3xl font-extrabold text-amber-600 mb-3">{formatDisplayNumber(po)}</p>
                <div className="text-sm text-muted-foreground mb-1">
                  <span className="font-semibold text-foreground">{po.customer_name}</span>
                  {po.order_type === "sur_place" && <span className="ms-2">{t("dashboard.orders.dine_in")}</span>}
                  {(po.order_type === "collect" || po.order_type === "a_emporter") && <span className="ms-2">{t("dashboard.orders.takeaway")}</span>}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {poItemCount} {t("dashboard.orders.articles_label")} — {po.total.toFixed(2)} €
                </p>
                <button
                  onClick={() => { setPopupOrder(null); setFilter("active"); }}
                  className="w-full px-4 py-3 rounded-2xl bg-amber-500 text-white font-semibold text-sm"
                >
                  OK
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Ruptures drawer */}
      <Sheet open={rupturesOpen} onOpenChange={setRupturesOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("dashboard.orders.stock_management")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            {/* Section: Ingredients (sauces, supplements) */}
            {(() => {
              const ingredientSet = new Set<string>();
              allMenuItems.forEach((item) => {
                item.sauces?.forEach((s) => ingredientSet.add(s));
                item.supplements?.forEach((s) => ingredientSet.add(s.name));
              });
              const ingredients = [...ingredientSet].sort();
              if (ingredients.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("dashboard.orders.ingredients_stock")}
                  </p>
                  <div className="space-y-1.5">
                    {ingredients.map((name) => {
                      const isOut = outOfStockIngredients.includes(name);
                      return (
                        <div key={name} className={`flex items-center justify-between p-2.5 rounded-xl ${isOut ? "bg-red-50" : "bg-secondary/50"}`}>
                          <span className={`text-sm ${isOut ? "text-red-700 line-through" : "text-foreground"}`}>{name}</span>
                          <Switch
                            checked={!isOut}
                            onCheckedChange={async (available) => {
                              const updated = available
                                ? outOfStockIngredients.filter((i) => i !== name)
                                : [...outOfStockIngredients, name];
                              setOutOfStockIngredients(updated);
                              if (isDemo) {
                                toast.success(available ? t("dashboard.orders.item_available").replace("{name}", name) : t("dashboard.orders.item_out_of_stock").replace("{name}", name));
                                return;
                              }
                              try {
                                await updateRestaurant(restaurant.id, { out_of_stock_ingredients: updated } as any);
                                toast.success(available ? t("dashboard.orders.item_available").replace("{name}", name) : t("dashboard.orders.item_out_of_stock").replace("{name}", name));
                              } catch {
                                toast.error(t("common.error"));
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Section: Menu items */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {t("dashboard.orders.items_stock")}
              </p>
              {allMenuItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">{t("dashboard.orders.no_items")}</p>
              )}
              <div className="space-y-1.5">
                {allMenuItems.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-2.5 rounded-xl ${!item.enabled ? "bg-red-50" : "bg-secondary/50"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image && <img src={item.image} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />}
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${!item.enabled ? "text-red-700 line-through" : "text-foreground"}`}>{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                    </div>
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={async (val) => {
                        if (isDemo) {
                          setAllMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, enabled: val } : m));
                          setMenuItems((prev) => val ? [...prev, { ...item, enabled: val }] : prev.filter((m) => m.id !== item.id));
                          toast.success(val ? t("dashboard.orders.item_available").replace("{name}", item.name) : t("dashboard.orders.item_out_of_stock").replace("{name}", item.name));
                          return;
                        }
                        try {
                          await updateMenuItem(item.id, { enabled: val });
                          setAllMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, enabled: val } : m));
                          setMenuItems((prev) => val ? [...prev, { ...item, enabled: val }] : prev.filter((m) => m.id !== item.id));
                          toast.success(val ? t("dashboard.orders.item_available").replace("{name}", item.name) : t("dashboard.orders.item_out_of_stock").replace("{name}", item.name));
                        } catch {
                          toast.error(t("common.error"));
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Subtle pulse animation for new orders */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
          50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15); }
        }
        .animate-pulse-subtle { animation: pulse-subtle 2s ease-in-out infinite; }
      `}</style>

      {/* Customer mini profile panel */}
      <AnimatePresence>
        {profileCustomer && (
          <CustomerMiniProfile
            customer={profileCustomer}
            restaurantId={restaurant.id}
            onClose={() => setProfileCustomer(null)}
            onUpdated={(updated) => {
              setCustomersMap((prev) => {
                const next = new Map(prev);
                next.set(updated.customer_phone, updated);
                return next;
              });
              setProfileCustomer(updated);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
