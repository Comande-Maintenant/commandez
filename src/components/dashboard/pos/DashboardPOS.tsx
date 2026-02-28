import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { fetchMenuItems, createOrder } from "@/lib/api";
import type { DbRestaurant, DbMenuItem } from "@/types/database";
import type { POSOrderType as POSOrderTypeValue, POSScreen, POSPersonOrder, POSItem } from "@/types/pos";
import { POSOrderType } from "./POSOrderType";
import { POSCovers } from "./POSCovers";
import { POSItemBuilder } from "./POSItemBuilder";
import { POSUpsell } from "./POSUpsell";
import { POSRecap } from "./POSRecap";
import { POSSuccess } from "./POSSuccess";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
  onClose?: () => void;
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

export const DashboardPOS = ({ restaurant, onClose }: Props) => {
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [state, setState] = useState(initialState);

  useEffect(() => {
    fetchMenuItems(restaurant.id).then(setMenuItems);
  }, [restaurant.id]);

  const categories = useMemo(
    () => {
      const cats = restaurant.categories || [];
      // Filter to only categories that have enabled items
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
      // Build flat items array for the order
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

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {state.screen === "order_type" && (
          <POSOrderType
            key="order_type"
            onSelect={handleSelectOrderType}
            onClose={handleClose}
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
