import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Phone, ShoppingBag, ChevronRight, Package, WifiOff, UtensilsCrossed, Plus, Clock, AlertTriangle, ShieldBan } from "lucide-react";
import { fetchOrders, fetchDemoOrders, fetchMenuItems, updateOrderStatus, updateMenuItem, subscribeToOrders, upsertCustomer, updateCustomerStats } from "@/lib/api";
import { formatDisplayNumber } from "@/lib/orderNumber";
import { useLanguage } from "@/context/LanguageContext";
import type { DbRestaurant, DbMenuItem, DbOrder } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { POSAddItemModal } from "./pos/POSAddItemModal";
import { BanDialog } from "./BanDialog";
import { toast } from "sonner";

type OrderStatus = "new" | "preparing" | "ready" | "done";

const statusConfigDef: Record<OrderStatus, { labelKey: string; color: string; next?: OrderStatus; nextLabelKey?: string }> = {
  new: { labelKey: "dashboard.orders.status_new", color: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]", next: "preparing", nextLabelKey: "dashboard.orders.action_accept" },
  preparing: { labelKey: "dashboard.orders.status_preparing", color: "bg-foreground text-primary-foreground", next: "ready", nextLabelKey: "dashboard.orders.action_ready" },
  ready: { labelKey: "dashboard.orders.status_ready", color: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]", next: "done", nextLabelKey: "dashboard.orders.action_done" },
  done: { labelKey: "dashboard.orders.status_done", color: "bg-muted text-muted-foreground" },
};

const filterTabsDef: { id: OrderStatus | "all"; labelKey: string }[] = [
  { id: "all", labelKey: "dashboard.orders.filter_all" },
  { id: "new", labelKey: "dashboard.orders.filter_new" },
  { id: "preparing", labelKey: "dashboard.orders.filter_in_progress" },
  { id: "ready", labelKey: "dashboard.orders.filter_ready" },
  { id: "done", labelKey: "dashboard.orders.filter_done" },
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
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [addItemOrder, setAddItemOrder] = useState<DbOrder | null>(null);
  const [rupturesOpen, setRupturesOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{ customer_name: string; customer_phone: string; restaurant_id: string; id?: string } | null>(null);

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
    // No realtime subscription in demo mode
    if (isDemo) return;
    const unsub = subscribeToOrders(restaurant.id, (newOrder) => {
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === newOrder.id);
        if (exists) {
          return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
        }
        // New order - play notification sound
        if (newOrder.status === "new" && onNewOrderSound) {
          onNewOrderSound();
        }
        return [newOrder, ...prev];
      });
      setDisconnected(false);
    });

    // Connection health check - reload orders every 60s to catch missed events
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
            // Auto-cancel after 15 min
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
  const newCount = orders.filter((o) => o.status === "new").length;

  const advanceStatus = async (orderId: string, currentStatus: OrderStatus) => {
    const cfg = statusConfigDef[currentStatus];
    if (!cfg.next) return;
    setAdvancing(orderId);

    if (isDemo) {
      // Interactive demo: update local state only, no DB write
      const now = new Date().toISOString();
      setOrders((prev) => prev.map((o) => {
        if (o.id !== orderId) return o;
        const updates: Partial<DbOrder> = { status: cfg.next! };
        if (cfg.next === "preparing") updates.accepted_at = now;
        if (cfg.next === "ready") updates.ready_at = now;
        if (cfg.next === "done") updates.completed_at = now;
        return { ...o, ...updates };
      }));
      setAdvancing(null);
      return;
    }

    try {
      await updateOrderStatus(orderId, cfg.next);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: cfg.next! } : o)));

      // When completing an order, update customer stats (fire-and-forget)
      if (cfg.next === "done") {
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          try {
            const customer = await upsertCustomer({
              restaurant_id: restaurant.id,
              customer_phone: order.customer_phone,
              customer_name: order.customer_name,
              customer_email: (order as any).customer_email || undefined,
            });
            const orderItems = ((order.items as any[]) || []).map((i: any) => ({
              name: i.name,
              quantity: i.quantity || 1,
            }));
            await updateCustomerStats(customer.id, Number(order.total), orderItems);
          } catch (e) {
            console.error("Customer stats update failed:", e);
          }
        }
      }
    } finally {
      setAdvancing(null);
    }
  };

  const timeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return t('time.just_now');
    if (mins < 60) return t('time.ago_min', { n: mins });
    return t('time.ago_hours', { n: Math.floor(mins / 60) });
  };

  const todayOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: t('dashboard.orders.filter_new'), value: orders.filter((o) => o.status === "new").length, accent: true },
          { label: t('dashboard.orders.filter_in_progress'), value: orders.filter((o) => o.status === "preparing").length },
          { label: t('dashboard.orders.filter_ready'), value: orders.filter((o) => o.status === "ready").length },
          { label: t('dashboard.orders.revenue_today'), value: `${todayOrders.reduce((s, o) => s + Number(o.total), 0).toFixed(2)} €`, sensitive: true },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-2xl border border-border p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${stat.accent ? "text-[hsl(var(--warning))]" : "text-foreground"} ${stat.sensitive ? "blur-sensitive" : ""}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Last order + Ruptures */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {(() => {
            const activeOrders = orders.filter((o) => o.status !== "done");
            if (activeOrders.length === 0) {
              const lastDone = orders.find((o) => o.status === "done");
              if (lastDone) {
                const mins = Math.floor((Date.now() - new Date(lastDone.created_at).getTime()) / 60000);
                if (mins > 30) return <span className="text-gray-400">{t('dashboard.orders.no_order_30min')}</span>;
                return <span>{t('dashboard.orders.last_order_ago', { n: mins < 1 ? t('dashboard.orders.less_than_1') : mins })}</span>;
              }
              return null;
            }
            const newest = activeOrders[0];
            const mins = Math.floor((Date.now() - new Date(newest.created_at).getTime()) / 60000);
            return <span>{t('dashboard.orders.last_order_ago', { n: mins < 1 ? t('dashboard.orders.less_than_1') : mins })}</span>;
          })()}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5"
          onClick={() => setRupturesOpen(true)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('dashboard.orders.out_of_stock')}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {filterTabsDef.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[44px] ${filter === tab.id ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {t(tab.labelKey)}
            {tab.id === "new" && newCount > 0 && (
              <span className="ms-1.5 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-xs font-bold px-1.5 py-0.5 rounded-full">{newCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {filter === "all" ? t('dashboard.orders.no_orders_today') : t('dashboard.orders.no_orders_filtered')}
            </p>
          </div>
        )}
        {filtered.map((order) => {
          const cfg = statusConfigDef[order.status as OrderStatus];
          const orderItems = (order.items as any[]) || [];
          return (
            <motion.div key={order.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-lg font-bold text-foreground">{formatDisplayNumber(order)}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>{t(cfg.labelKey)}</span>
                  {(order as any).source === "pos" && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{t('dashboard.orders.source_pos')}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{timeSince(order.created_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                <span className="font-medium text-foreground flex items-center gap-1">
                  {order.customer_name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBanTarget({
                        customer_name: order.customer_name,
                        customer_phone: order.customer_phone,
                        restaurant_id: restaurant.id,
                      });
                    }}
                    className="p-1 rounded hover:bg-destructive/10 transition-colors"
                    title={t('dashboard.orders.ban_client')}
                  >
                    <ShieldBan className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </span>
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{order.customer_phone}</span>
                <span className="flex items-center gap-1">
                  {(order.order_type === "collect" || order.order_type === "a_emporter") && <><ShoppingBag className="h-3.5 w-3.5" /> {t('dashboard.orders.takeaway')}</>}
                  {order.order_type === "sur_place" && <><UtensilsCrossed className="h-3.5 w-3.5" /> {t('dashboard.orders.dine_in')}</>}
                  {order.order_type === "telephone" && <><Phone className="h-3.5 w-3.5" /> {t('dashboard.orders.phone')}</>}
                </span>
                {(order as any).covers && (
                  <span className="text-xs text-muted-foreground">({(order as any).covers} {t('dashboard.orders.covers')})</span>
                )}
                {order.pickup_time ? (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    <Clock className="h-3 w-3" />
                    {t('dashboard.orders.pickup_at', { time: new Date(order.pickup_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })}
                  </span>
                ) : (order.order_type === "collect" || order.order_type === "a_emporter") ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">ASAP</span>
                ) : null}
              </div>
              <div className="space-y-1 mb-3">
                {orderItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground font-medium">{item.quantity}x {item.name}</span>
                      {item.summary && (
                        <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                      )}
                      {!item.summary && ((item.sauces?.length > 0) || (item.supplements?.length > 0)) && (
                        <p className="text-xs text-muted-foreground truncate">{[...(item.sauces || []), ...(item.supplements || [])].join(", ")}</p>
                      )}
                    </div>
                    <span className="text-foreground font-medium ms-2 flex-shrink-0 blur-sensitive">{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-base font-bold text-foreground blur-sensitive">{Number(order.total).toFixed(2)} €</span>
                <div className="flex items-center gap-2">
                  {(order.status === "new" || order.status === "preparing") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddItemOrder(order)}
                      className="rounded-xl gap-1 min-h-[36px] text-xs text-muted-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> {t('dashboard.orders.add_item')}
                    </Button>
                  )}
                  {cfg.next && (
                    <Button
                      size="sm"
                      onClick={() => advanceStatus(order.id, order.status as OrderStatus)}
                      disabled={advancing === order.id}
                      className="rounded-xl gap-1 min-h-[44px]"
                    >
                      {advancing === order.id ? "..." : t(cfg.nextLabelKey!)}<ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add item modal */}
      {addItemOrder && (
        <POSAddItemModal
          open={!!addItemOrder}
          onClose={() => setAddItemOrder(null)}
          order={addItemOrder}
          menuItems={menuItems}
          config={restaurant.customization_config}
          onUpdated={loadOrders}
        />
      )}

      {/* Ban dialog from order */}
      {banTarget && (
        <BanDialog
          customer={banTarget as any}
          open={!!banTarget}
          onClose={() => setBanTarget(null)}
          onBanned={() => {
            setBanTarget(null);
            toast.success(t('dashboard.orders.client_banned'));
          }}
          restaurantId={restaurant.id}
        />
      )}

      {/* Ruptures drawer */}
      <Sheet open={rupturesOpen} onOpenChange={setRupturesOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('dashboard.orders.stock_management')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {menuItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.orders.no_items')}</p>
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
                      toast.success(val ? t('dashboard.orders.item_available', { name: item.name }) : t('dashboard.orders.item_out_of_stock', { name: item.name }));
                      return;
                    }
                    try {
                      await updateMenuItem(item.id, { enabled: val });
                      setMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, enabled: val } : m));
                      toast.success(val ? t('dashboard.orders.item_available', { name: item.name }) : t('dashboard.orders.item_out_of_stock', { name: item.name }));
                    } catch {
                      toast.error(t('common.error'));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
