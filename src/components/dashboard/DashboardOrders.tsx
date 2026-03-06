import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ShoppingBag, ChevronRight, Package, WifiOff, UtensilsCrossed, Plus, Clock, AlertTriangle, ShieldBan, Volume2 } from "lucide-react";
import { fetchOrders, fetchDemoOrders, fetchMenuItems, updateOrderStatus, updateMenuItem, subscribeToOrders, upsertCustomer, updateCustomerStats, advanceDemoOrder } from "@/lib/api";
import { formatDisplayNumber } from "@/lib/orderNumber";
import { useLanguage } from "@/context/LanguageContext";
import type { DbRestaurant, DbMenuItem, DbOrder } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { BanDialog } from "./BanDialog";
import { PrepSummaryBoard } from "./PrepSummaryBoard";
import { toast } from "sonner";

type OrderStatus = "new" | "preparing" | "ready" | "done";

const statusColors: Record<OrderStatus, string> = {
  new: "border-l-amber-500 bg-amber-50/50",
  preparing: "border-l-blue-500 bg-blue-50/30",
  ready: "border-l-emerald-500 bg-emerald-50/30",
  done: "border-l-gray-300 bg-card",
};

const statusBadge: Record<OrderStatus, { text: string; class: string }> = {
  new: { text: "Nouvelle", class: "bg-amber-100 text-amber-800" },
  preparing: { text: "En cours", class: "bg-blue-100 text-blue-800" },
  ready: { text: "Prete", class: "bg-emerald-100 text-emerald-800" },
  done: { text: "Terminee", class: "bg-gray-100 text-gray-600" },
};

const filterTabsDef: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "new", label: "Nouvelles" },
  { id: "preparing", label: "En cours" },
  { id: "ready", label: "Pretes" },
  { id: "done", label: "Terminees" },
];

interface Props {
  restaurant: DbRestaurant;
  onNewOrderSound?: () => void;
  isDemo?: boolean;
}

export const DashboardOrders = ({ restaurant, onNewOrderSound, isDemo }: Props) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);
  const [rupturesOpen, setRupturesOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{ customer_name: string; customer_phone: string; restaurant_id: string; id?: string } | null>(null);

  // Demo auto-orders
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async () => {
    const data = isDemo
      ? await fetchDemoOrders(restaurant.id)
      : await fetchOrders(restaurant.id);
    setOrders(data);
    setLoading(false);
  }, [restaurant.id, isDemo]);

  useEffect(() => {
    fetchMenuItems(restaurant.id).then(setMenuItems);
  }, [restaurant.id]);

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
        if (newOrder.status === "new" && onNewOrderSound) {
          onNewOrderSound();
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

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const activeOrders = filtered.filter((o) => o.status !== "done");
  const doneOrders = filtered.filter((o) => o.status === "done");

  // Count by status
  const newCount = orders.filter((o) => o.status === "new").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;
  const readyCount = orders.filter((o) => o.status === "ready").length;

  const todayOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayDoneOrders = todayOrders.filter((o) => o.status === "done");
  const todayRevenue = todayDoneOrders.reduce((s, o) => s + Number(o.total), 0);

  const timeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return t('time.just_now');
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
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

    // Auto-advance to next order or close detail
    const remaining = orders
      .filter((o) => o.id !== orderId && o.status !== "done")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (remaining.length > 0 && (newStatus === "done" || newStatus === "ready")) {
      // Move to next pending order
      setSelectedOrder(remaining[0]);
    } else if (newStatus !== "done") {
      // Update selected order in place
      setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
    } else {
      setSelectedOrder(null);
    }
  };

  const handleOrderUpdated = (updatedOrder: DbOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    setSelectedOrder(updatedOrder);
  };

  // Quick advance from card (without opening detail)
  const quickAdvance = async (e: React.MouseEvent, order: DbOrder) => {
    e.stopPropagation();
    const statusFlow: Record<string, OrderStatus> = { new: "preparing", preparing: "ready", ready: "done" };
    const next = statusFlow[order.status];
    if (!next) return;

    try {
      if (isDemo) {
        await advanceDemoOrder(order.id, next);
      } else {
        await updateOrderStatus(order.id, next);
      }
      handleStatusChange(order.id, next);
    } catch {
      toast.error("Erreur");
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

      {/* Stats counters */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
        <button
          onClick={() => setFilter(newCount > 0 ? "new" : "all")}
          className={`bg-card rounded-2xl border border-border p-3 text-left transition-all hover:shadow-sm ${filter === "new" ? "ring-2 ring-amber-400" : ""}`}
        >
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">Nouvelles</p>
          <p className={`text-xl sm:text-2xl font-bold mt-0.5 ${newCount > 0 ? "text-amber-600" : "text-foreground"}`}>{newCount}</p>
        </button>
        <button
          onClick={() => setFilter(preparingCount > 0 ? "preparing" : "all")}
          className={`bg-card rounded-2xl border border-border p-3 text-left transition-all hover:shadow-sm ${filter === "preparing" ? "ring-2 ring-blue-400" : ""}`}
        >
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">En cours</p>
          <p className="text-xl sm:text-2xl font-bold mt-0.5 text-foreground">{preparingCount}</p>
        </button>
        <button
          onClick={() => setFilter(readyCount > 0 ? "ready" : "all")}
          className={`bg-card rounded-2xl border border-border p-3 text-left transition-all hover:shadow-sm ${filter === "ready" ? "ring-2 ring-emerald-400" : ""}`}
        >
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">Pretes</p>
          <p className={`text-xl sm:text-2xl font-bold mt-0.5 ${readyCount > 0 ? "text-emerald-600" : "text-foreground"}`}>{readyCount}</p>
        </button>
        <div className="bg-card rounded-2xl border border-border p-3">
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">CA jour</p>
          <p className="text-lg sm:text-xl font-bold mt-0.5 text-foreground blur-sensitive">{todayRevenue.toFixed(0)} €</p>
        </div>
      </div>

      {/* Prep summary for kitchen */}
      <PrepSummaryBoard orders={orders} />

      {/* Ruptures + info row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {todayDoneOrders.length > 0 && (
            <span>{todayDoneOrders.length} commande{todayDoneOrders.length > 1 ? "s" : ""} terminee{todayDoneOrders.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5"
          onClick={() => setRupturesOpen(true)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Ruptures
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
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {filter === "all" ? "Aucune commande" : "Aucune commande dans cette categorie"}
            </p>
          </div>
        )}
        {filtered.map((order) => {
          const st = order.status as OrderStatus;
          const badge = statusBadge[st];
          const orderItems = (order.items as any[]) || [];
          const itemCount = orderItems.reduce((s, i) => s + (i.quantity || 1), 0);
          const statusFlow: Record<string, string> = { new: "Accepter", preparing: "Prete", ready: "Terminee" };
          const nextLabel = statusFlow[st];

          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedOrder(order)}
              className={`rounded-2xl border border-border border-l-4 p-3 sm:p-4 cursor-pointer hover:shadow-md active:shadow-sm transition-all ${statusColors[st]} ${st === "new" ? "animate-pulse-subtle" : ""}`}
            >
              {/* Top row: number + badge + time */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-foreground">{formatDisplayNumber(order)}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.class}`}>{badge.text}</span>
                  {(order as any).source === "pos" && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Caisse</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{timeSince(order.created_at)}</span>
              </div>

              {/* Client + order type */}
              <div className="flex items-center gap-2 mb-2 text-sm">
                <span className="font-medium text-foreground">{order.customer_name}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  {(order.order_type === "collect" || order.order_type === "a_emporter") && <><ShoppingBag className="h-3.5 w-3.5" /> A emporter</>}
                  {order.order_type === "sur_place" && <><UtensilsCrossed className="h-3.5 w-3.5" /> Sur place</>}
                  {order.order_type === "telephone" && <><Phone className="h-3.5 w-3.5" /> Tel</>}
                </span>
                {order.pickup_time && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(order.pickup_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {!order.pickup_time && (order.order_type === "collect" || order.order_type === "a_emporter") && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Des que possible</span>
                )}
              </div>

              {/* Items summary (compact) */}
              <div className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {orderItems.map((item: any, i: number) => (
                  <span key={i}>
                    {i > 0 && " - "}
                    <span className="text-foreground font-medium">{item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}</span>
                  </span>
                ))}
              </div>

              {/* Bottom row: total + action button */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-foreground blur-sensitive">{Number(order.total).toFixed(2)} €</span>
                  <span className="text-xs text-muted-foreground">{itemCount} article{itemCount > 1 ? "s" : ""}</span>
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
            isDemo={isDemo}
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
            toast.success("Client banni");
          }}
          restaurantId={restaurant.id}
        />
      )}

      {/* Ruptures drawer */}
      <Sheet open={rupturesOpen} onOpenChange={setRupturesOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Gestion des ruptures</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {menuItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun produit</p>
            )}
            {menuItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3 min-w-0">
                  {item.image && <img src={item.image} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                </div>
                <Switch
                  checked={item.enabled}
                  onCheckedChange={async (val) => {
                    if (isDemo) {
                      setMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, enabled: val } : m));
                      toast.success(val ? `${item.name} disponible` : `${item.name} en rupture`);
                      return;
                    }
                    try {
                      await updateMenuItem(item.id, { enabled: val });
                      setMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, enabled: val } : m));
                      toast.success(val ? `${item.name} disponible` : `${item.name} en rupture`);
                    } catch {
                      toast.error("Erreur");
                    }
                  }}
                />
              </div>
            ))}
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
    </div>
  );
};
