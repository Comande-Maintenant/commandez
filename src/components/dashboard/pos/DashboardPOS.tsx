import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { fetchMenuItems, createOrder, fetchOrders, updateOrderStatus, subscribeToOrders } from "@/lib/api";
import { buildOrderItems, calculateGrandTotal } from "@/lib/posHelpers";
import type { DbRestaurant, DbMenuItem, DbOrder } from "@/types/database";
import type {
  POSOrderType as POSOrderTypeValue,
  POSScreen,
  POSPersonOrder,
  POSDrinkItem,
  POSDessertItem,
  POSCustomization,
} from "@/types/pos";
import { POSOrderType } from "./POSOrderType";
import { POSPersonBuilder } from "./POSPersonBuilder";
import { POSBoissons } from "./POSBoissons";
import { POSDesserts } from "./POSDesserts";
import { POSRecap } from "./POSRecap";
import { POSSuccess } from "./POSSuccess";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
}

const createEmptyPerson = (index: number): POSPersonOrder => ({
  personIndex: index,
  label: `Personne ${index + 1}`,
  customization: null,
  itemPrice: 0,
});

const initialState = {
  screen: "order_type" as POSScreen,
  orderType: "sur_place" as POSOrderTypeValue,
  persons: [] as POSPersonOrder[],
  currentPerson: 0,
  drinks: [] as POSDrinkItem[],
  desserts: [] as POSDessertItem[],
  dessertPending: false,
  notes: "",
  customerName: "",
  tableNumber: "",
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
        return prev.filter((o) => o.id !== order.id);
      });
    });

    return unsub;
  }, [restaurant.id]);

  const setScreen = (screen: POSScreen) =>
    setState((s) => ({ ...s, screen }));

  const reset = useCallback(() => setState(initialState), []);

  const handleSelectOrderType = (orderType: POSOrderTypeValue) => {
    const persons: POSPersonOrder[] = [createEmptyPerson(0)];
    setState((s) => ({
      ...s,
      orderType,
      persons,
      currentPerson: 0,
      drinks: [],
      desserts: [],
      dessertPending: false,
      notes: "",
      customerName: "",
      tableNumber: "",
      screen: "person_builder",
    }));
  };

  const handleSavePerson = useCallback(
    (customization: POSCustomization, price: number) => {
      setState((s) => {
        const persons = [...s.persons];
        persons[s.currentPerson] = {
          ...persons[s.currentPerson],
          customization,
          itemPrice: price,
        };
        return { ...s, persons };
      });
    },
    []
  );

  const handleAddPerson = useCallback(() => {
    setState((s) => {
      const newIndex = s.persons.length;
      const persons = [...s.persons, createEmptyPerson(newIndex)];
      return { ...s, persons, currentPerson: newIndex, screen: "person_builder" };
    });
  }, []);

  const handleEditPerson = useCallback((index: number) => {
    setState((s) => ({ ...s, currentPerson: index, screen: "person_builder" }));
  }, []);

  const handleGoBoissons = useCallback(() => {
    setScreen("boissons");
  }, []);

  const handleUpdateDrinks = useCallback((drinks: POSDrinkItem[]) => {
    setState((s) => ({ ...s, drinks }));
  }, []);

  const handleUpdateDesserts = useCallback((desserts: POSDessertItem[]) => {
    setState((s) => ({ ...s, desserts }));
  }, []);

  const handleSetDessertPending = useCallback((pending: boolean) => {
    setState((s) => ({ ...s, dessertPending: pending }));
  }, []);

  const handleSubmit = async () => {
    setState((s) => ({ ...s, submitting: true }));
    try {
      const allItems = buildOrderItems(state.persons, state.drinks, state.desserts);
      const total = calculateGrandTotal(state.persons, state.drinks, state.desserts);

      const personCount = state.persons.filter((p) => p.customization).length;
      const customerName =
        state.customerName ||
        `Caisse${state.tableNumber ? ` T${state.tableNumber}` : ""} (${personCount} pers.)`;

      const order = await createOrder({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: "",
        order_type: state.orderType,
        source: "pos",
        covers: personCount,
        items: allItems,
        subtotal: total,
        total,
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

  const config = restaurant.customization_config;

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
          />
        )}
        {state.screen === "person_builder" && config && (
          <POSPersonBuilder
            key={`person_builder_${state.currentPerson}`}
            config={config}
            personIndex={state.currentPerson}
            personLabel={state.persons[state.currentPerson]?.label || "Personne 1"}
            totalPersons={state.persons.length}
            existingCustomization={state.persons[state.currentPerson]?.customization}
            onSave={handleSavePerson}
            onAddPerson={handleAddPerson}
            onGoBoissons={handleGoBoissons}
            onBack={() => {
              if (state.currentPerson > 0) {
                setState((s) => ({ ...s, currentPerson: s.currentPerson - 1 }));
              } else {
                setScreen("order_type");
              }
            }}
          />
        )}
        {state.screen === "boissons" && (
          <POSBoissons
            key="boissons"
            drinks={state.drinks}
            menuItems={menuItems}
            onUpdateDrinks={handleUpdateDrinks}
            onNext={() => setScreen("desserts")}
            onBack={() => {
              const lastPerson = state.persons.length - 1;
              setState((s) => ({ ...s, currentPerson: lastPerson, screen: "person_builder" }));
            }}
          />
        )}
        {state.screen === "desserts" && (
          <POSDesserts
            key="desserts"
            desserts={state.desserts}
            menuItems={menuItems}
            onUpdateDesserts={handleUpdateDesserts}
            onSetDessertPending={handleSetDessertPending}
            onNext={() => setScreen("recap")}
            onBack={() => setScreen("boissons")}
          />
        )}
        {state.screen === "recap" && (
          <POSRecap
            key="recap"
            orderType={state.orderType}
            persons={state.persons}
            drinks={state.drinks}
            desserts={state.desserts}
            dessertPending={state.dessertPending}
            customerName={state.customerName}
            tableNumber={state.tableNumber}
            notes={state.notes}
            onSetCustomerName={(name) => setState((s) => ({ ...s, customerName: name }))}
            onSetTableNumber={(num) => setState((s) => ({ ...s, tableNumber: num }))}
            onSetNotes={(notes) => setState((s) => ({ ...s, notes }))}
            onEditPerson={handleEditPerson}
            onSubmit={handleSubmit}
            onBack={() => setScreen("desserts")}
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
