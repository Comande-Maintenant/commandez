// Generate realistic demo order data for the last 30 days
// Used only for the demo dashboard - no DB writes needed

import type { DbOrder, DbCustomer } from "@/types/database";

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

    // Closed on Sunday
    if (dayOfWeek === 0) continue;

    // Base order count by day of week with realistic variation
    const dayBases: Record<number, number> = {
      1: 48, // Monday - quiet
      2: 52, // Tuesday - quiet
      3: 65, // Wednesday - average
      4: 72, // Thursday - picking up
      5: 95, // Friday - busy
      6: 88, // Saturday - busy
    };
    const baseOrders = dayBases[dayOfWeek] || 65;

    // High variance: some days are great, some are bad (-30% to +25%)
    // Use daysAgo as extra seed for day-level variation
    const dayVariance = Math.floor(rand() * 40) - 18; // -18 to +21
    const weatherPenalty = rand() < 0.12 ? -Math.floor(rand() * 20) - 10 : 0; // 12% bad weather days
    const eventBonus = rand() < 0.08 ? Math.floor(rand() * 25) + 10 : 0; // 8% event days (match, fete)
    const dayOrderCount = Math.max(20, baseOrders + dayVariance + weatherPenalty + eventBonus);

    // Lunch/dinner split varies by day
    const lunchRatio = 0.35 + rand() * 0.2; // 35-55% lunch

    for (let j = 0; j < dayOrderCount; j++) {
      // Distribute across lunch (11-14:30) and dinner (18-22:30) with variable peaks
      const isLunch = rand() < lunchRatio;
      let hour: number;
      let minute: number;

      if (isLunch) {
        // Lunch peak around 12:15 with gaussian-ish distribution
        const offset = (rand() + rand()) / 2; // pseudo-gaussian 0-1
        const totalMinutes = Math.floor(offset * 210); // span 3.5h = 210min from 11:00
        hour = 11 + Math.floor(totalMinutes / 60);
        minute = totalMinutes % 60;
      } else {
        // Dinner peak around 19:45
        const offset = (rand() + rand()) / 2;
        const totalMinutes = Math.floor(offset * 270); // span 4.5h = 270min from 18:00
        hour = 18 + Math.floor(totalMinutes / 60);
        minute = totalMinutes % 60;
      }

      const orderDate = new Date(date);
      orderDate.setHours(hour, minute, Math.floor(rand() * 60), 0);

      // Skip future times for today
      if (daysAgo === 0 && orderDate > now) continue;

      // Variable item count: some orders are small (1 item), some big (3-4 items for groups)
      const isGroup = rand() < 0.15; // 15% group orders
      const itemCount = isGroup ? 2 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
      const items: any[] = [];
      let total = 0;

      for (let k = 0; k < itemCount; k++) {
        const item = pick(DEMO_ITEMS, rand);
        const qty = isGroup && rand() < 0.3 ? 2 : rand() < 0.1 ? 2 : 1;
        items.push({
          name: item.name,
          quantity: qty,
          price: item.price,
        });
        total += item.price * qty;
      }

      // Frites: more likely with groups
      if (rand() < (isGroup ? 0.65 : 0.35)) {
        const fQty = isGroup && rand() < 0.4 ? 2 : 1;
        items.push({ name: "Barquette Frites", quantity: fQty, price: 3 });
        total += 3 * fQty;
      }

      // Drinks: groups almost always, solo sometimes
      if (rand() < (isGroup ? 0.9 : 0.6)) {
        const drink = pick(DEMO_DRINKS, rand);
        const dQty = isGroup ? 1 + Math.floor(rand() * 3) : rand() < 0.2 ? 2 : 1;
        items.push({ name: drink.name, quantity: dQty, price: drink.price });
        total += drink.price * dQty;
      }

      // Supplements: fromage, oeuf
      if (rand() < 0.25) {
        const suppName = rand() < 0.6 ? "Fromage" : "Oeuf";
        items.push({ name: suppName, quantity: 1, price: 1 });
        total += 1;
      }

      const name = pick(DEMO_NAMES, rand);
      const orderType = rand() < 0.35 ? "sur_place" : "collect";

      // Variable prep times: quick orders vs slow ones
      const basePrepMin = isGroup ? 12 + Math.floor(rand() * 10) : 6 + Math.floor(rand() * 12);
      const prepMs = basePrepMin * 60000;
      const acceptDelay = 30000 + Math.floor(rand() * 180000); // 30s to 3.5min to accept
      const acceptedAt = new Date(orderDate.getTime() + acceptDelay);
      const readyAt = new Date(acceptedAt.getTime() + prepMs);
      const pickupDelay = 30000 + Math.floor(rand() * 300000); // 30s to 5min to pick up
      const completedAt = new Date(readyAt.getTime() + pickupDelay);

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
        covers: orderType === "sur_place" ? 1 + Math.floor(rand() * (isGroup ? 6 : 3)) : null,
      } as any);
    }
  }

  return orders;
}

// ── Demo customers ──

const DEMO_EMAILS = [
  "marie.dupont@gmail.com", "thomas.m@outlook.fr", "julie.b89@gmail.com", "",
  "emma.moreau@yahoo.fr", "h.leroy@free.fr", "lea.simon@gmail.com", "",
  "camille.l@hotmail.fr", "theo.durand@gmail.com", "", "a.fournier@orange.fr",
  "chloe.g@gmail.com", "maxime.bonnet@outlook.fr", "", "romain.d@gmail.com",
  "ines.garcia@gmail.com", "alex.morel@proton.me", "laura.lf@gmail.com", "",
];

const DEMO_FAVORITE_ITEMS_POOL = [
  ["Kebab", "Barquette Frites", "Coca Cola 33cl"],
  ["Tacos", "Ayran"],
  ["Hamburger Double Steak", "Barquette Frites", "Redbull"],
  ["Sandwich", "Eau"],
  ["Galette", "Salade", "Café"],
  ["Assiette", "Ayran", "Barquette Frites"],
  ["6 Nuggets + frites", "Coca Cola 33cl"],
  ["Kebab", "Tacos", "Barquette Frites", "Coca Cola 33cl"],
  ["Hamburger", "Barquette Frites"],
  ["Salade", "Eau", "Café"],
];

const DEMO_NOTES_POOL = [
  "", "", "", "", "", "", "", // most have no notes
  "Allergie gluten - toujours sans pain",
  "Demande toujours sauce blanche a part",
  "Client fidele, vient depuis l'ouverture",
  "Passe souvent le vendredi soir",
  "Commande pour le bureau (5-6 pers.)",
  "Prefere bien cuit",
];

export function generateDemoCustomers(restaurantId: string): DbCustomer[] {
  const rand = seededRandom(99);
  const now = new Date();
  const customers: DbCustomer[] = [];

  // Profiles: varied order frequencies and spending
  const profiles = [
    // VIPs (10+ orders) - 3 customers
    { ordersMin: 24, ordersMax: 47, avgMin: 12, avgMax: 22, daysAgoFirst: 180, daysAgoLast: 0 },
    { ordersMin: 15, ordersMax: 32, avgMin: 10, avgMax: 18, daysAgoFirst: 150, daysAgoLast: 1 },
    { ordersMin: 12, ordersMax: 20, avgMin: 14, avgMax: 25, daysAgoFirst: 120, daysAgoLast: 2 },
    // Regulars (5-9 orders) - 5 customers
    { ordersMin: 6, ordersMax: 9, avgMin: 9, avgMax: 16, daysAgoFirst: 90, daysAgoLast: 3 },
    { ordersMin: 5, ordersMax: 8, avgMin: 11, avgMax: 20, daysAgoFirst: 75, daysAgoLast: 5 },
    { ordersMin: 5, ordersMax: 7, avgMin: 8, avgMax: 14, daysAgoFirst: 60, daysAgoLast: 4 },
    { ordersMin: 5, ordersMax: 9, avgMin: 13, avgMax: 22, daysAgoFirst: 100, daysAgoLast: 7 },
    { ordersMin: 6, ordersMax: 8, avgMin: 10, avgMax: 15, daysAgoFirst: 45, daysAgoLast: 1 },
    // Occasionals (2-4 orders) - 7 customers
    { ordersMin: 2, ordersMax: 4, avgMin: 8, avgMax: 18, daysAgoFirst: 40, daysAgoLast: 8 },
    { ordersMin: 3, ordersMax: 4, avgMin: 10, avgMax: 16, daysAgoFirst: 30, daysAgoLast: 3 },
    { ordersMin: 2, ordersMax: 3, avgMin: 12, avgMax: 22, daysAgoFirst: 25, daysAgoLast: 12 },
    { ordersMin: 2, ordersMax: 4, avgMin: 7, avgMax: 13, daysAgoFirst: 50, daysAgoLast: 15 },
    { ordersMin: 3, ordersMax: 4, avgMin: 9, avgMax: 15, daysAgoFirst: 20, daysAgoLast: 2 },
    { ordersMin: 2, ordersMax: 3, avgMin: 14, avgMax: 28, daysAgoFirst: 35, daysAgoLast: 6 },
    { ordersMin: 2, ordersMax: 2, avgMin: 8, avgMax: 12, daysAgoFirst: 14, daysAgoLast: 10 },
    // New (1 order) - 3 customers
    { ordersMin: 1, ordersMax: 1, avgMin: 7, avgMax: 15, daysAgoFirst: 3, daysAgoLast: 3 },
    { ordersMin: 1, ordersMax: 1, avgMin: 10, avgMax: 20, daysAgoFirst: 1, daysAgoLast: 1 },
    { ordersMin: 1, ordersMax: 1, avgMin: 12, avgMax: 18, daysAgoFirst: 0, daysAgoLast: 0 },
  ];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const name = DEMO_NAMES[i];
    const email = DEMO_EMAILS[i] || "";
    const phone = `06 ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")}`;

    const totalOrders = p.ordersMin + Math.floor(rand() * (p.ordersMax - p.ordersMin + 1));
    const avgBasket = +(p.avgMin + rand() * (p.avgMax - p.avgMin)).toFixed(2);
    const totalSpent = +(totalOrders * avgBasket).toFixed(2);

    const firstDate = new Date(now);
    firstDate.setDate(firstDate.getDate() - p.daysAgoFirst);
    const lastDate = new Date(now);
    lastDate.setDate(lastDate.getDate() - p.daysAgoLast);
    lastDate.setHours(11 + Math.floor(rand() * 10), Math.floor(rand() * 60));

    const favIdx = Math.floor(rand() * DEMO_FAVORITE_ITEMS_POOL.length);
    const favorites = DEMO_FAVORITE_ITEMS_POOL[favIdx];
    const lastIdx = Math.floor(rand() * DEMO_FAVORITE_ITEMS_POOL.length);
    const lastItems = DEMO_FAVORITE_ITEMS_POOL[lastIdx].slice(0, 1 + Math.floor(rand() * 3));

    const noteIdx = Math.floor(rand() * DEMO_NOTES_POOL.length);

    // 1 banned customer (index 11 = Antoine Fournier)
    const isBanned = i === 11;

    customers.push({
      id: `demo-cust-${i}`,
      restaurant_id: restaurantId,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      first_order_at: firstDate.toISOString(),
      last_order_at: lastDate.toISOString(),
      total_orders: totalOrders,
      total_spent: totalSpent,
      average_basket: avgBasket,
      favorite_items: favorites,
      last_items: lastItems,
      is_banned: isBanned,
      banned_at: isBanned ? new Date(now.getTime() - 5 * 86400000).toISOString() : null,
      banned_reason: isBanned ? "Comportement agressif envers le personnel" : "",
      ban_expires_at: null,
      banned_ip: "",
      notes: DEMO_NOTES_POOL[noteIdx],
      flagged: i === 14, // 1 flagged customer
      created_at: firstDate.toISOString(),
      updated_at: lastDate.toISOString(),
    });
  }

  return customers;
}
