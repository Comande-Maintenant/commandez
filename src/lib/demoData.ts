// Generate realistic demo order data for the last 30 days
// Used only for the demo dashboard - no DB writes needed

import type { DbOrder } from "@/types/database";

const DEMO_ITEMS = [
  { name: "Kebab", price: 6.5 },
  { name: "Sandwich", price: 7 },
  { name: "Hamburger", price: 5.5 },
  { name: "Hamburger Double Steak", price: 8 },
  { name: "Tacos", price: 7.5 },
  { name: "Galette", price: 6 },
  { name: "Barquette Frites", price: 3 },
  { name: "6 Nuggets + frites", price: 7 },
  { name: "Salade", price: 7 },
  { name: "Assiette", price: 9 },
];

const DEMO_DRINKS = [
  { name: "Coca Cola 33cl", price: 1.5 },
  { name: "Eau", price: 1 },
  { name: "Ayran", price: 1.5 },
  { name: "Redbull", price: 3 },
  { name: "Café", price: 1.5 },
];

const DEMO_NAMES = [
  "Marie Dupont", "Thomas Martin", "Julie Bernard", "Lucas Petit",
  "Emma Moreau", "Hugo Leroy", "Lea Simon", "Nathan Robert",
  "Camille Laurent", "Theo Durand", "Manon Roux", "Antoine Fournier",
  "Chloe Girard", "Maxime Bonnet", "Sarah Lambert", "Romain Dubois",
  "Ines Garcia", "Alexandre Morel", "Laura Lefevre", "Quentin Andre",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function generateDemoOrders(restaurantId: string): DbOrder[] {
  const rand = seededRandom(42); // deterministic for consistency
  const orders: DbOrder[] = [];
  const now = new Date();

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dayOfWeek = date.getDay();

    // Target ~25K CA over 30 days = ~833/day, ticket moyen ~12 = ~70 orders/day
    // Weekends busier, Mon-Tue quieter, Sunday closed
    if (dayOfWeek === 0) continue; // Closed on Sunday
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isQuiet = dayOfWeek === 1 || dayOfWeek === 2;
    const baseOrders = isWeekend ? 85 : isQuiet ? 55 : 70;
    const variance = Math.floor(rand() * 12) - 5;
    const dayOrderCount = Math.max(30, baseOrders + variance);

    for (let j = 0; j < dayOrderCount; j++) {
      // Distribute across lunch (11-14) and dinner (18-22) peaks
      const isLunch = rand() < 0.45;
      const hour = isLunch
        ? 11 + Math.floor(rand() * 3)
        : 18 + Math.floor(rand() * 4);
      const minute = Math.floor(rand() * 60);

      const orderDate = new Date(date);
      orderDate.setHours(hour, minute, Math.floor(rand() * 60), 0);

      // Skip future times for today
      if (daysAgo === 0 && orderDate > now) continue;

      // 1-3 main items per order + sides + drinks for ~12 EUR average
      const itemCount = 1 + Math.floor(rand() * 2);
      const items: any[] = [];
      let total = 0;

      for (let k = 0; k < itemCount; k++) {
        const item = pick(DEMO_ITEMS, rand);
        const qty = rand() < 0.15 ? 2 : 1;
        items.push({
          name: item.name,
          quantity: qty,
          price: item.price,
        });
        total += item.price * qty;
      }

      // 40% chance of frites side
      if (rand() < 0.4) {
        items.push({ name: "Barquette Frites", quantity: 1, price: 3 });
        total += 3;
      }

      // 70% chance of a drink
      if (rand() < 0.7) {
        const drink = pick(DEMO_DRINKS, rand);
        const dQty = rand() < 0.3 ? 2 : 1;
        items.push({ name: drink.name, quantity: dQty, price: drink.price });
        total += drink.price * dQty;
      }

      // 20% chance supplement (fromage/oeuf)
      if (rand() < 0.2) {
        items.push({ name: "Fromage", quantity: 1, price: 1 });
        total += 1;
      }

      const name = pick(DEMO_NAMES, rand);
      const orderType = rand() < 0.35 ? "sur_place" : "collect";
      const prepMs = (8 + Math.floor(rand() * 15)) * 60000;
      const acceptedAt = new Date(orderDate.getTime() + 60000 + Math.floor(rand() * 120000));
      const readyAt = new Date(acceptedAt.getTime() + prepMs);
      const completedAt = new Date(readyAt.getTime() + 60000 + Math.floor(rand() * 180000));

      orders.push({
        id: `demo-${daysAgo}-${j}`,
        restaurant_id: restaurantId,
        order_number: orders.length + 1,
        customer_name: name,
        customer_phone: `06 ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")}`,
        order_type: orderType,
        status: "done",
        items,
        subtotal: total,
        total: +total.toFixed(2),
        source: "demo",
        created_at: orderDate.toISOString(),
        accepted_at: acceptedAt.toISOString(),
        ready_at: readyAt.toISOString(),
        completed_at: completedAt.toISOString(),
        covers: orderType === "sur_place" ? 1 + Math.floor(rand() * 4) : null,
      } as any);
    }
  }

  return orders;
}
