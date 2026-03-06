import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  Timer,
  Phone,
  ShoppingBag,
  UtensilsCrossed,
  Pencil,
  Trash2,
  Plus,
  Minus,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayNumber } from "@/lib/orderNumber";
import { updateOrderItems, updateOrderStatus, updateOrderEstimatedReady, advanceDemoOrder } from "@/lib/api";
import type { DbOrder, DbMenuItem } from "@/types/database";
import { toast } from "sonner";

type OrderStatus = "new" | "preparing" | "ready" | "done";

interface Props {
  order: DbOrder;
  orderIndex: number;
  totalOrders: number;
  menuItems: DbMenuItem[];
  prepTimeConfig?: { default_minutes: number; per_item_minutes: number; max_minutes: number } | null;
  isDemo?: boolean;
  onClose: () => void;
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onOrderUpdated: (order: DbOrder) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const statusActions: Record<OrderStatus, { next?: OrderStatus; label: string; rejectLabel?: string; color: string }> = {
  new: { next: "preparing", label: "Accepter la commande", rejectLabel: "Refuser", color: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800" },
  preparing: { next: "ready", label: "Commande prete", color: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800" },
  ready: { next: "done", label: "Commande terminee", color: "bg-foreground hover:bg-foreground/90" },
  done: { label: "Terminee", color: "bg-muted" },
};

const statusLabels: Record<OrderStatus, { text: string; color: string }> = {
  new: { text: "Nouvelle", color: "bg-amber-100 text-amber-800 border-amber-200" },
  preparing: { text: "En preparation", color: "bg-blue-100 text-blue-800 border-blue-200" },
  ready: { text: "Prete", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  done: { text: "Terminee", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

export const OrderDetailSheet = ({
  order,
  orderIndex,
  totalOrders,
  menuItems,
  prepTimeConfig,
  isDemo,
  onClose,
  onStatusChange,
  onOrderUpdated,
  onPrev,
  onNext,
}: Props) => {
  const [advancing, setAdvancing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editNotes, setEditNotes] = useState(order.notes || "");
  const [editTotal, setEditTotal] = useState(Number(order.total));
  const [manualTotalEdit, setManualTotalEdit] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [editingTimer, setEditingTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(15);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const status = order.status as OrderStatus;
  const action = statusActions[status];
  const statusLabel = statusLabels[status];
  const items = (order.items as any[]) || [];

  // Calculate default prep time from config
  const defaultPrepMinutes = useMemo(() => {
    if (!prepTimeConfig) return 15;
    const itemCount = items.reduce((s, i) => s + (i.quantity || 1), 0);
    return Math.min(
      prepTimeConfig.default_minutes + itemCount * prepTimeConfig.per_item_minutes,
      prepTimeConfig.max_minutes
    );
  }, [prepTimeConfig, items]);

  // Countdown timer
  useEffect(() => {
    if (!order.estimated_ready_at) {
      setRemainingSeconds(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(order.estimated_ready_at!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [order.estimated_ready_at]);

  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleSetTimer = async (minutes: number) => {
    const estimatedAt = new Date(Date.now() + minutes * 60000).toISOString();
    try {
      if (!isDemo) {
        await updateOrderEstimatedReady(order.id, estimatedAt);
      }
      onOrderUpdated({ ...order, estimated_ready_at: estimatedAt });
      setEditingTimer(false);
      toast.success(`Temps estime : ${minutes} min`);
    } catch {
      toast.error("Erreur");
    }
  };

  const timeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "A l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    return `il y a ${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${String(mins % 60).padStart(2, "0")}` : ""}`;
  };

  const orderTime = new Date(order.created_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleAdvance = async () => {
    if (!action.next) return;
    setAdvancing(true);
    try {
      if (isDemo) {
        await advanceDemoOrder(order.id, action.next);
        // Set timer locally for demo
        if (action.next === "preparing") {
          const estimatedAt = new Date(Date.now() + defaultPrepMinutes * 60000).toISOString();
          onOrderUpdated({ ...order, status: action.next, estimated_ready_at: estimatedAt });
        }
      } else {
        const estimatedMinutes = action.next === "preparing" ? defaultPrepMinutes : undefined;
        await updateOrderStatus(order.id, action.next, estimatedMinutes);
      }
      onStatusChange(order.id, action.next);
    } catch {
      toast.error("Erreur");
    }
    setAdvancing(false);
  };

  const handleReject = async () => {
    setAdvancing(true);
    try {
      if (isDemo) {
        await advanceDemoOrder(order.id, "done");
      } else {
        await updateOrderStatus(order.id, "done");
      }
      onStatusChange(order.id, "done");
    } catch {
      toast.error("Erreur");
    }
    setAdvancing(false);
  };

  // Edit mode
  const startEdit = () => {
    setEditItems(JSON.parse(JSON.stringify(items)));
    setEditNotes(order.notes || "");
    setEditTotal(Number(order.total));
    setManualTotalEdit(false);
    setEditing(true);
  };

  const recalcTotal = (updatedItems: any[]) => {
    if (manualTotalEdit) return;
    const t = updatedItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    setEditTotal(t);
  };

  const removeEditItem = (index: number) => {
    const updated = editItems.filter((_, i) => i !== index);
    setEditItems(updated);
    recalcTotal(updated);
  };

  const updateEditItemQty = (index: number, delta: number) => {
    const updated = [...editItems];
    const newQty = (updated[index].quantity || 1) + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index] = { ...updated[index], quantity: newQty };
    }
    setEditItems(updated);
    recalcTotal(updated);
  };

  const updateEditItemPrice = (index: number, newPrice: number) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], price: newPrice };
    setEditItems(updated);
    recalcTotal(updated);
  };

  const addMenuItem = (item: DbMenuItem) => {
    const newItem = {
      name: item.name,
      menu_item_id: item.id,
      quantity: 1,
      price: item.price,
      sauces: [],
      supplements: [],
    };
    const updated = [...editItems, newItem];
    setEditItems(updated);
    recalcTotal(updated);
    setAddingItem(false);
  };

  const saveEdit = async () => {
    setAdvancing(true);
    try {
      await updateOrderItems(order.id, editItems, editTotal);
      const updatedOrder = {
        ...order,
        items: editItems,
        total: editTotal,
        subtotal: editTotal,
        notes: editNotes,
      };
      onOrderUpdated(updatedOrder);
      setEditing(false);
      toast.success("Commande modifiee");
    } catch {
      toast.error("Erreur lors de la modification");
    }
    setAdvancing(false);
  };

  // Category grouping for add item
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.filter((m) => m.enabled).map((m) => m.category))];
    return cats;
  }, [menuItems]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="fixed inset-0 z-[70] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ms-2 rounded-xl hover:bg-secondary active:bg-secondary/80 transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <span className="text-lg font-bold text-foreground">{formatDisplayNumber(order)}</span>
            <span className={`ms-2 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusLabel.color}`}>
              {statusLabel.text}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Nav between orders */}
          {totalOrders > 1 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <button
                onClick={onPrev}
                disabled={orderIndex === 0}
                className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-medium min-w-[3rem] text-center">{orderIndex + 1}/{totalOrders}</span>
              <button
                onClick={onNext}
                disabled={orderIndex === totalOrders - 1}
                className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        {/* Customer info */}
        <div className="py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-foreground">{order.customer_name}</h2>
            <span className="text-sm text-muted-foreground">{orderTime} - {timeSince(order.created_at)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {order.customer_phone && (
              <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="h-4 w-4" />
                {order.customer_phone}
              </a>
            )}
            <span className="flex items-center gap-1">
              {(order.order_type === "collect" || order.order_type === "a_emporter") && (
                <><ShoppingBag className="h-4 w-4" /> A emporter</>
              )}
              {order.order_type === "sur_place" && (
                <><UtensilsCrossed className="h-4 w-4" /> Sur place</>
              )}
              {order.order_type === "telephone" && (
                <><Phone className="h-4 w-4" /> Telephone</>
              )}
            </span>
            {(order as any).covers && (
              <span>{(order as any).covers} couverts</span>
            )}
            {order.pickup_time && (
              <span className="flex items-center gap-1 font-semibold text-blue-700">
                <Clock className="h-4 w-4" />
                Retrait {new Date(order.pickup_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {order.payment_method && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-medium">
                {order.payment_method === "cash" ? "Especes" : order.payment_method === "card" ? "CB" : order.payment_method === "ticket_restaurant" ? "Ticket resto" : order.payment_method}
              </span>
            )}
          </div>
        </div>

        {/* Prep time timer */}
        {(status === "preparing" || status === "new") && (
          <div className="py-3 border-b border-border">
            {!editingTimer ? (
              <button
                onClick={() => {
                  setTimerMinutes(
                    remainingSeconds !== null
                      ? Math.max(1, Math.ceil(remainingSeconds / 60))
                      : defaultPrepMinutes
                  );
                  setEditingTimer(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-foreground" />
                  <span className="text-sm font-medium text-foreground">Temps de preparation</span>
                </div>
                {remainingSeconds !== null ? (
                  <span className={`text-lg font-bold tabular-nums ${remainingSeconds <= 60 ? "text-red-600" : remainingSeconds <= 180 ? "text-amber-600" : "text-foreground"}`}>
                    {formatCountdown(remainingSeconds)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Definir</span>
                )}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-secondary/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-foreground" />
                    <span className="text-sm font-medium text-foreground">Ajuster le temps</span>
                  </div>
                  <button
                    onClick={() => setEditingTimer(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Annuler
                  </button>
                </div>
                {/* Quick select buttons */}
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 25, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTimerMinutes(m)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all min-h-[44px] ${
                        timerMinutes === m
                          ? "border-foreground bg-foreground text-primary-foreground"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
                {/* Custom input */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTimerMinutes(Math.max(1, timerMinutes - 1))}
                    className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-secondary active:bg-secondary/80"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-foreground tabular-nums">{timerMinutes}</span>
                    <span className="text-sm text-muted-foreground ms-1">min</span>
                  </div>
                  <button
                    onClick={() => setTimerMinutes(timerMinutes + 1)}
                    className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-secondary active:bg-secondary/80"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={() => handleSetTimer(timerMinutes)}
                  className="w-full h-12 rounded-xl text-sm font-semibold"
                >
                  Valider - pret dans {timerMinutes} min
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Items - read only or edit mode */}
        {!editing ? (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Articles</h3>
              {status !== "done" && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-secondary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </button>
              )}
            </div>
            <div className="space-y-4">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground">
                      {item.quantity > 1 && <span className="text-muted-foreground me-1">x{item.quantity}</span>}
                      {item.name}
                    </p>
                    {/* Viande */}
                    {item.viande_choice && (
                      <p className="text-sm text-muted-foreground mt-0.5">{item.viande_choice}</p>
                    )}
                    {/* Garnitures */}
                    {item.garniture_choices && item.garniture_choices.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {item.garniture_choices.map((g: any) => typeof g === "string" ? g : `${g.name}${g.level === "x2" ? " x2" : ""}`).join(", ")}
                      </p>
                    )}
                    {/* Sauces */}
                    {item.sauces && item.sauces.length > 0 && (
                      <p className="text-sm text-muted-foreground">Sauce : {item.sauces.join(", ")}</p>
                    )}
                    {/* Supplements */}
                    {item.supplements && item.supplements.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {item.supplements.map((s: any) => typeof s === "string" ? s : `+${s.name}`).join(", ")}
                      </p>
                    )}
                    {/* Summary fallback */}
                    {item.summary && !item.sauces?.length && !item.supplements?.length && (
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                    )}
                    {/* Base choice */}
                    {item.base_choice && (
                      <p className="text-sm text-muted-foreground">Base : {item.base_choice}</p>
                    )}
                    {/* Accompagnement */}
                    {item.accompagnement_choice && (
                      <p className="text-sm text-muted-foreground">
                        Accompagnement : {typeof item.accompagnement_choice === "string" ? item.accompagnement_choice : item.accompagnement_choice.name}
                      </p>
                    )}
                  </div>
                  <p className="text-base font-semibold text-foreground tabular-nums flex-shrink-0 blur-sensitive">
                    {((item.price || 0) * (item.quantity || 1)).toFixed(2)} €
                  </p>
                </div>
              ))}
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800 font-medium">Note : {order.notes}</p>
              </div>
            )}

            {/* Total */}
            <div className="mt-6 pt-4 border-t-2 border-foreground/20 flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">TOTAL</span>
              <span className="text-2xl font-bold text-foreground tabular-nums blur-sensitive">
                {Number(order.total).toFixed(2)} €
              </span>
            </div>
          </div>
        ) : (
          /* EDIT MODE */
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Modifier la commande</h3>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-xl hover:bg-secondary"
              >
                Annuler
              </button>
            </div>

            <div className="space-y-3">
              {editItems.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    {item.sauces?.length > 0 && (
                      <p className="text-xs text-muted-foreground">{item.sauces.join(", ")}</p>
                    )}
                    {item.viande_choice && (
                      <p className="text-xs text-muted-foreground">{item.viande_choice}</p>
                    )}
                    {/* Editable price */}
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        step="0.50"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateEditItemPrice(i, parseFloat(e.target.value) || 0)}
                        className="h-8 w-24 text-sm rounded-lg"
                      />
                      <span className="text-xs text-muted-foreground">€/u</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateEditItemQty(i, -1)}
                      className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary active:bg-secondary/80"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity || 1}</span>
                    <button
                      onClick={() => updateEditItemQty(i, 1)}
                      className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary active:bg-secondary/80"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeEditItem(i)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 active:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add item button */}
            {!addingItem ? (
              <button
                onClick={() => setAddingItem(true)}
                className="w-full mt-3 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un article
              </button>
            ) : (
              <div className="mt-3 border border-border rounded-xl p-3 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">Choisir un article</h4>
                  <button onClick={() => setAddingItem(false)} className="text-xs text-muted-foreground hover:text-foreground">
                    Fermer
                  </button>
                </div>
                {categories.map((cat) => {
                  const catItems = menuItems.filter((m) => m.enabled && m.category === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{cat}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {catItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addMenuItem(item)}
                            className="text-left p-2 rounded-lg border border-border hover:bg-secondary active:bg-secondary/80 transition-colors"
                          >
                            <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} €</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes */}
            <div className="mt-4">
              <label className="text-sm font-medium text-foreground mb-1 block">Note</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Note pour cette commande..."
                className="rounded-xl resize-none text-sm"
                rows={2}
              />
            </div>

            {/* Total */}
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={editTotal.toFixed(2)}
                    onChange={(e) => {
                      setManualTotalEdit(true);
                      setEditTotal(parseFloat(e.target.value) || 0);
                    }}
                    className="h-9 w-28 text-right text-base font-bold rounded-lg"
                  />
                  <span className="text-base font-bold">€</span>
                </div>
              </div>
              {manualTotalEdit && (
                <button
                  onClick={() => {
                    setManualTotalEdit(false);
                    recalcTotal(editItems);
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Recalculer automatiquement
                </button>
              )}
            </div>

            <Button
              onClick={saveEdit}
              disabled={advancing}
              className="w-full mt-4 h-14 rounded-xl text-base font-semibold"
            >
              {advancing ? "..." : "Valider les modifications"}
            </Button>
          </div>
        )}
      </div>

      {/* Bottom action buttons - sticky */}
      {!editing && status !== "done" && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-[71] safe-area-bottom">
          <div className="max-w-2xl mx-auto flex gap-3">
            {status === "new" && (
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={advancing}
                className="h-14 rounded-xl text-base font-semibold flex-shrink-0 min-w-[120px] border-destructive text-destructive hover:bg-destructive/10"
              >
                <X className="h-5 w-5 me-1" />
                Refuser
              </Button>
            )}
            {action.next && (
              <Button
                onClick={handleAdvance}
                disabled={advancing}
                className={`flex-1 h-14 rounded-xl text-base font-semibold text-white ${action.color}`}
              >
                {advancing ? (
                  "..."
                ) : (
                  <>
                    <Check className="h-5 w-5 me-2" />
                    {action.label}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Done status - show close button */}
      {!editing && status === "done" && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-[71] safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full h-14 rounded-xl text-base font-semibold"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
