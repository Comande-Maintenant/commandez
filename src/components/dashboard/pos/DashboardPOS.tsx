import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check, Plus, Phone, ShoppingBag, UtensilsCrossed, Clock, Timer } from "lucide-react";
import { fetchMenuItems, createOrder, fetchOrders, fetchDemoOrders, updateOrderStatus, advanceDemoOrder, subscribeToOrders } from "@/lib/api";
import { buildOrderItems, calculateGrandTotal } from "@/lib/posHelpers";
import { formatDisplayNumber } from "@/lib/orderNumber";
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
import { POSSimple } from "./POSSimple";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CaisseTab = "commande" | "encaissement";

interface Props {
  restaurant: DbRestaurant;
  isDemo?: boolean;
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
  paymentMethod: "cash",
  displayNumber: "",
  submitting: false,
  prepMinutes: 10,
};

export const DashboardPOS = ({ restaurant, isDemo }: Props) => {
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [state, setState] = useState(initialState);
  const [readyOrders, setReadyOrders] = useState<DbOrder[]>([]);
  const [activeTab, setActiveTab] = useState<CaisseTab>("commande");

  useEffect(() => {
    fetchMenuItems(restaurant.id).then(setMenuItems);
  }, [restaurant.id]);

  // Fetch and subscribe to ready orders for "A encaisser" panel
  useEffect(() => {
    const fetchFn = isDemo ? fetchDemoOrders(restaurant.id) : fetchOrders(restaurant.id);
    fetchFn.then((orders) => {
      setReadyOrders(orders.filter((o) => o.status === "ready"));
    });

    if (isDemo) {
      const poll = setInterval(() => {
        fetchDemoOrders(restaurant.id).then((orders) => {
          setReadyOrders(orders.filter((o) => o.status === "ready"));
        });
      }, 5000);
      return () => clearInterval(poll);
    }

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
  }, [restaurant.id, isDemo]);

  const setScreen = (screen: POSScreen) =>
    setState((s) => ({ ...s, screen }));

  const reset = useCallback(() => setState(initialState), []);

  // Calculate default prep time based on persons count
  const calcDefaultPrepMinutes = (personCount: number) => {
    const cfg = restaurant.prep_time_config || { default_minutes: 10, per_item_minutes: 2, max_minutes: 60 };
    return Math.min(cfg.default_minutes + personCount * cfg.per_item_minutes, cfg.max_minutes);
  };

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

      const estimatedReadyAt = new Date(Date.now() + state.prepMinutes * 60000).toISOString();
      const order = await createOrder({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: "",
        order_type: state.orderType,
        source: isDemo ? "demo" : "pos",
        covers: personCount,
        items: allItems,
        subtotal: total,
        total,
        notes: state.notes || undefined,
        payment_method: state.paymentMethod,
        estimated_ready_at: estimatedReadyAt,
      });

      const dn = formatDisplayNumber(order);
      setState((s) => ({
        ...s,
        screen: "success",
        orderNumber: order.order_number,
        displayNumber: dn,
        submitting: false,
      }));
    } catch (e) {
      toast.error("Erreur lors de l'envoi de la commande");
      setState((s) => ({ ...s, submitting: false }));
    }
  };

  const markAsDone = async (orderId: string) => {
    try {
      if (isDemo) {
        await advanceDemoOrder(orderId, "done");
      } else {
        await updateOrderStatus(orderId, "done");
      }
      setReadyOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success("Commande encaissee");
    } catch {
      toast.error("Erreur lors de la mise a jour");
    }
  };

  const config = restaurant.customization_config;
  const [simpleSubmitting, setSimpleSubmitting] = useState(false);

  const handleSimpleSubmit = async (items: any[], total: number, orderType: string, customerName: string, covers: number, paymentMethod: string, estimatedMinutes: number) => {
    setSimpleSubmitting(true);
    try {
      const estimatedReadyAt = new Date(Date.now() + estimatedMinutes * 60000).toISOString();
      await createOrder({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: "",
        order_type: orderType,
        source: isDemo ? "demo" : "pos",
        covers,
        items,
        subtotal: total,
        total,
        payment_method: paymentMethod,
        estimated_ready_at: estimatedReadyAt,
      });
      toast.success("Commande envoyee !");
    } catch (e) {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSimpleSubmitting(false);
    }
  };

  const timeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "A l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    return `il y a ${Math.floor(mins / 60)}h`;
  };

  // Encaissement view - full order cards for ready orders
  const renderEncaissement = () => {
    if (readyOrders.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          <Check className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune commande a encaisser</p>
          <p className="text-xs mt-1">Les commandes marquees "prete" en cuisine apparaitront ici</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {readyOrders.map((order) => {
          const orderItems = (order.items as any[]) || [];
          const itemCount = orderItems.reduce((s, i) => s + (i.quantity || 1), 0);
          return (
            <div
              key={order.id}
              className="bg-card rounded-2xl border border-border border-l-4 border-l-emerald-500 p-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{formatDisplayNumber(order)}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Prete</span>
                  {(order as any).source === "pos" && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Caisse</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{timeSince(order.created_at)}</span>
              </div>

              {/* Client info */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <span className="font-medium text-foreground">{order.customer_name}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  {(order.order_type === "collect" || order.order_type === "a_emporter") && <><ShoppingBag className="h-3.5 w-3.5" /> A emporter</>}
                  {order.order_type === "sur_place" && <><UtensilsCrossed className="h-3.5 w-3.5" /> Sur place</>}
                  {order.order_type === "telephone" && <><Phone className="h-3.5 w-3.5" /> Tel</>}
                </span>
                {(order as any).covers && (
                  <span className="text-xs text-muted-foreground">({(order as any).covers} couverts)</span>
                )}
              </div>

              {/* Items detail */}
              <div className="space-y-1.5 mb-3">
                {orderItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground font-medium">
                        {item.quantity > 1 && `${item.quantity}x `}{item.name}
                      </span>
                      {item.viande_choice && (
                        <span className="text-muted-foreground text-xs ml-1">({item.viande_choice})</span>
                      )}
                      {item.sauces?.length > 0 && (
                        <p className="text-xs text-muted-foreground">Sauce : {item.sauces.join(", ")}</p>
                      )}
                      {item.summary && !item.sauces?.length && (
                        <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                      )}
                    </div>
                    <span className="text-foreground font-medium ms-2 flex-shrink-0 blur-sensitive">
                      {((item.price || 0) * (item.quantity || 1)).toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>

              {/* Payment method if set */}
              {order.payment_method && (
                <div className="mb-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground">
                    {order.payment_method === "cash" ? "Especes" : order.payment_method === "card" ? "CB" : order.payment_method === "ticket_restaurant" ? "Ticket resto" : order.payment_method}
                  </span>
                </div>
              )}

              {/* Total + action */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <span className="text-xl font-bold text-foreground blur-sensitive">{Number(order.total).toFixed(2)} €</span>
                  <span className="text-xs text-muted-foreground ms-2">{itemCount} article{itemCount > 1 ? "s" : ""}</span>
                </div>
                <Button
                  onClick={() => markAsDone(order.id)}
                  className="h-12 rounded-xl gap-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                >
                  <Check className="h-4 w-4" />
                  Encaisse
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // POS content (prise de commande)
  const renderPOS = () => {
    if (!config) {
      return (
        <POSSimple
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
          menuItems={menuItems}
          primaryColor={restaurant.primary_color || "#10B981"}
          availablePaymentMethods={restaurant.payment_methods || ["cash", "card"]}
          prepTimeConfig={restaurant.prep_time_config}
          onSubmit={handleSimpleSubmit}
          submitting={simpleSubmitting}
        />
      );
    }

    return (
      <AnimatePresence mode="wait">
        {state.screen === "order_type" && (
          <POSOrderType key="order_type" onSelect={handleSelectOrderType} />
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
            onNext={() => {
              const personCount = state.persons.filter((p) => p.customization).length;
              const itemCount = personCount + state.drinks.length + state.desserts.length;
              setState((s) => ({ ...s, screen: "recap", prepMinutes: calcDefaultPrepMinutes(itemCount) }));
            }}
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
            paymentMethod={state.paymentMethod}
            availablePaymentMethods={restaurant.payment_methods || ["cash", "card", "ticket_restaurant"]}
            onSetCustomerName={(name) => setState((s) => ({ ...s, customerName: name }))}
            onSetTableNumber={(num) => setState((s) => ({ ...s, tableNumber: num }))}
            onSetNotes={(notes) => setState((s) => ({ ...s, notes }))}
            onSetPaymentMethod={(method) => setState((s) => ({ ...s, paymentMethod: method }))}
            onEditPerson={handleEditPerson}
            onSubmit={handleSubmit}
            onBack={() => setScreen("desserts")}
            submitting={state.submitting}
            prepMinutes={state.prepMinutes}
            onSetPrepMinutes={(m) => setState((s) => ({ ...s, prepMinutes: m }))}
          />
        )}
        {state.screen === "success" && (
          <POSSuccess key="success" displayNumber={state.displayNumber} onReset={reset} />
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="relative">
      {/* Tabs: Prise de commande / A encaisser */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("commande")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px] ${
            activeTab === "commande"
              ? "bg-foreground text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Plus className="h-4 w-4" />
          Prise de commande
        </button>
        <button
          onClick={() => setActiveTab("encaissement")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px] relative ${
            activeTab === "encaissement"
              ? "bg-foreground text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Check className="h-4 w-4" />
          A encaisser
          {readyOrders.length > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
              activeTab === "encaissement"
                ? "bg-primary-foreground text-foreground"
                : "bg-emerald-500 text-white"
            }`}>
              {readyOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "commande" && renderPOS()}
      {activeTab === "encaissement" && renderEncaissement()}
    </div>
  );
};
