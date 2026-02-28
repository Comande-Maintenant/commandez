import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { fetchMenuItems, createOrder, fetchOrders, updateOrderStatus, subscribeToOrders } from "@/lib/api";
import type { DbRestaurant, DbMenuItem, DbOrder } from "@/types/database";
import type { POSOrderType as POSOrderTypeValue, POSScreen, POSPersonOrder, POSItem } from "@/types/pos";
import { POSOrderType } from "./POSOrderType";
import { POSCovers } from "./POSCovers";
import { POSItemBuilder } from "./POSItemBuilder";
import { POSUpsell } from "./POSUpsell";
import { POSRecap } from "./POSRecap";
import { POSSuccess } from "./POSSuccess";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
}

const initialState = {
  screen: "order_type" as POSScreen,
  orderType: "sur_place" as POSOrderTypeValue,
  covers: 1,
  persons: [] as POSPersonOrder[],
  currentPerson: 0,
  upsellItems: [] as POSItem[],
  notes: "",
  customerName: "",
  orderNumber: 0,
  submitting: false,
};

export const DashboardPOS = ({ restaurant }: Props) => {
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [state, setState] = useState(initialState);
  const [readyOrders, setReadyOrders] = useState<DbOrder[]>([]);
  const [readyExpanded, setReadyExpanded] = useState(true);

  useEffect(() => {
    fetchMenuItems(restaurant.id).then(setMenuItems);
  }, [restaurant.id]);

  // Fetch and subscribe to ready orders for "A encaisser" panel
  useEffect(() => {
    fetchOrders(restaurant.id).then((orders) => {
      setReadyOrders(orders.filter((o) => o.status === "ready"));
    });

    const unsub = subscribeToOrders(restaurant.id, (order) => {
      setReadyOrders((prev) => {
        if (order.status === "ready") {
          const exists = prev.find((o) => o.id === order.id);
          if (exists) return prev.map((o) => (o.id === order.id ? order : o));
          return [order, ...prev];
        }
        // Remove if status changed away from ready
        return prev.filter((o) => o.id !== order.id);
      });
    });

    return unsub;
  }, [restaurant.id]);

  const categories = useMemo(
    () => {
      const cats = restaurant.categories || [];
      const itemCats = new Set(menuItems.map((i) => i.category));
      return cats.filter((c) => itemCats.has(c));
    },
    [restaurant.categories, menuItems]
  );

  const setScreen = (screen: POSScreen) =>
    setState((s) => ({ ...s, screen }));

  const reset = useCallback(() => setState(initialState), []);

  const handleSelectOrderType = (orderType: POSOrderTypeValue) => {
    setState((s) => ({ ...s, orderType, screen: "covers" }));
  };

  const handleSelectCovers = (covers: number) => {
    const persons: POSPersonOrder[] = Array.from({ length: covers }, (_, i) => ({
      personIndex: i,
      label: `Personne ${i + 1}`,
      items: [],
    }));
    setState((s) => ({ ...s, covers, persons, currentPerson: 0, screen: "builder" }));
  };

  const handleUpdatePersons = (persons: POSPersonOrder[]) => {
    setState((s) => ({ ...s, persons }));
  };

  const handleSetCurrentPerson = (index: number) => {
    setState((s) => ({ ...s, currentPerson: index }));
  };

  const handleUpdateUpsell = (upsellItems: POSItem[]) => {
    setState((s) => ({ ...s, upsellItems }));
  };

  const handleSubmit = async () => {
    setState((s) => ({ ...s, submitting: true }));
    try {
      const allItems: any[] = [];
      for (const person of state.persons) {
        for (const item of person.items) {
          allItems.push({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: item.category,
            personLabel: person.label,
          });
        }
      }
      for (const item of state.upsellItems) {
        allItems.push({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category,
          personLabel: "Extras",
        });
      }

      const subtotal =
        state.persons.reduce(
          (sum, p) => sum + p.items.reduce((s, i) => s + i.price * i.quantity, 0),
          0
        ) + state.upsellItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

      const order = await createOrder({
        restaurant_id: restaurant.id,
        customer_name: state.customerName || `Caisse (${state.covers} couv.)`,
        customer_phone: "",
        order_type: state.orderType,
        source: "pos",
        covers: state.covers,
        items: allItems,
        subtotal,
        delivery_fee: 0,
        total: subtotal,
        notes: state.notes || undefined,
      });

      setState((s) => ({
        ...s,
        screen: "success",
        orderNumber: order.order_number,
        submitting: false,
      }));
    } catch (e) {
      toast.error("Erreur lors de l'envoi de la commande");
      setState((s) => ({ ...s, submitting: false }));
    }
  };

  const markAsDone = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, "done");
      setReadyOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success("Commande terminee");
    } catch {
      toast.error("Erreur lors de la mise a jour");
    }
  };

  return (
    <div className="relative">
      {/* A encaisser panel - visible on order_type screen */}
      {state.screen === "order_type" && readyOrders.length > 0 && (
        <div className="mb-6 bg-card rounded-2xl border border-border overflow-hidden">
          <button
            onClick={() => setReadyExpanded(!readyExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">A encaisser</span>
              <span className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-xs font-bold px-2 py-0.5 rounded-full">
                {readyOrders.length}
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${readyExpanded ? "rotate-180" : ""}`} />
          </button>
          {readyExpanded && (
            <div className="px-4 pb-3 space-y-2">
              {readyOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between bg-secondary/50 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
                    <span className="text-sm text-muted-foreground ml-2">{order.customer_name}</span>
                    <span className="text-sm font-medium text-foreground ml-2">{Number(order.total).toFixed(2)} EUR</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1 min-h-[36px] flex-shrink-0"
                    onClick={() => markAsDone(order.id)}
                  >
                    <Check className="h-4 w-4" />
                    Paye
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {state.screen === "order_type" && (
          <POSOrderType
            key="order_type"
            onSelect={handleSelectOrderType}
            onClose={() => {}}
          />
        )}
        {state.screen === "covers" && (
          <POSCovers
            key="covers"
            onSelect={handleSelectCovers}
            onBack={() => setScreen("order_type")}
          />
        )}
        {state.screen === "builder" && (
          <POSItemBuilder
            key="builder"
            persons={state.persons}
            currentPerson={state.currentPerson}
            menuItems={menuItems}
            categories={categories}
            onUpdatePersons={handleUpdatePersons}
            onSetCurrentPerson={handleSetCurrentPerson}
            onNext={() => setScreen("upsell")}
            onBack={() => setScreen("covers")}
          />
        )}
        {state.screen === "upsell" && (
          <POSUpsell
            key="upsell"
            upsellItems={state.upsellItems}
            menuItems={menuItems}
            onUpdateUpsell={handleUpdateUpsell}
            onNext={() => setScreen("recap")}
            onBack={() => setScreen("builder")}
          />
        )}
        {state.screen === "recap" && (
          <POSRecap
            key="recap"
            orderType={state.orderType}
            covers={state.covers}
            persons={state.persons}
            upsellItems={state.upsellItems}
            customerName={state.customerName}
            notes={state.notes}
            onSetCustomerName={(name) => setState((s) => ({ ...s, customerName: name }))}
            onSetNotes={(notes) => setState((s) => ({ ...s, notes }))}
            onSubmit={handleSubmit}
            onBack={() => setScreen("upsell")}
            submitting={state.submitting}
          />
        )}
        {state.screen === "success" && (
          <POSSuccess
            key="success"
            orderNumber={state.orderNumber}
            onReset={reset}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
