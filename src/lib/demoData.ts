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
// Simulates a kebab restaurant with ~1247 total clients over 14 months
// We generate 50 visible customer cards (most recent/active) + global stats

const DEMO_CUSTOMER_NAMES = [
  // 50 realistic French names
  "Marie Dupont", "Thomas Martin", "Julie Bernard", "Lucas Petit",
  "Emma Moreau", "Hugo Leroy", "Lea Simon", "Nathan Robert",
  "Camille Laurent", "Theo Durand", "Manon Roux", "Antoine Fournier",
  "Chloe Girard", "Maxime Bonnet", "Sarah Lambert", "Romain Dubois",
  "Ines Garcia", "Alexandre Morel", "Laura Lefevre", "Quentin Andre",
  "Oceane Mercier", "Julien Blanc", "Margot Chevalier", "Bastien Faure",
  "Pauline Garnier", "Mathis Picard", "Clara Lemoine", "Dylan Perrot",
  "Amandine Caron", "Kevin Masson", "Elise Gauthier", "Florian Noel",
  "Melissa Roussel", "Adrien Perez", "Eva Clement", "Vincent Dufour",
  "Anais Henry", "Jordan Riviere", "Lucie Schmitt", "Arnaud Colin",
  "Marguerite Lemaire", "Pierre Guerin", "Nadia Benali", "Yann Moulin",
  "Fatima Diallo", "Sebastien Boyer", "Lina Marchand", "Nicolas Brun",
  "Sofia Hamidi", "Thibault Leclerc",
];

const DEMO_EMAIL_DOMAINS = ["gmail.com", "outlook.fr", "yahoo.fr", "free.fr", "orange.fr", "hotmail.fr", "proton.me"];

const DEMO_FAVORITE_ITEMS_POOL = [
  ["Kebab", "Barquette Frites", "Coca Cola 33cl"],
  ["Tacos", "Ayran"],
  ["Hamburger Double Steak", "Barquette Frites", "Redbull"],
  ["Sandwich", "Eau"],
  ["Galette", "Salade", "Cafe"],
  ["Assiette", "Ayran", "Barquette Frites"],
  ["6 Nuggets + frites", "Coca Cola 33cl"],
  ["Kebab", "Tacos", "Barquette Frites", "Coca Cola 33cl"],
  ["Hamburger", "Barquette Frites"],
  ["Salade", "Eau", "Cafe"],
  ["Kebab", "Coca Cola 33cl"],
  ["Tacos", "Barquette Frites", "Ayran"],
  ["Sandwich", "Barquette Frites", "Coca Cola 33cl"],
  ["Assiette", "Salade", "Eau"],
  ["Hamburger Double Steak", "6 Nuggets + frites", "Redbull"],
];

const DEMO_NOTES_POOL = [
  "", "", "", "", "", "", "", "", "", "", "", "", // most have no notes
  "Allergie gluten, toujours sans pain",
  "Demande toujours sauce blanche a part",
  "Client fidele, vient depuis l'ouverture",
  "Passe souvent le vendredi soir",
  "Commande pour le bureau (5-6 pers.)",
  "Prefere bien cuit",
  "Toujours en livraison",
  "Aime la sauce piquante",
  "Vient avec ses enfants le mercredi",
  "Commande 2x par semaine en moyenne",
];

export interface DemoCustomerStats {
  totalClients: number;
  regulars: number;
  banned: number;
}

export function generateDemoCustomerStats(): DemoCustomerStats {
  return { totalClients: 1247, regulars: 389, banned: 3 };
}

export function generateDemoCustomers(restaurantId: string): DbCustomer[] {
  const rand = seededRandom(99);
  const now = new Date();
  const customers: DbCustomer[] = [];

  // 50 visible customers - the most recent/active slice of a 1247-client base
  // Distribution mirrors a real kebab: lots of VIPs/regulars at the top when sorted
  const profiles: Array<{
    ordersMin: number; ordersMax: number;
    avgMin: number; avgMax: number;
    daysAgoFirst: number; daysAgoLast: number;
    banned?: boolean; banReason?: string;
  }> = [
    // Super VIPs (50+ orders, old clients) - 5
    { ordersMin: 85, ordersMax: 127, avgMin: 12, avgMax: 18, daysAgoFirst: 420, daysAgoLast: 0 },
    { ordersMin: 72, ordersMax: 98,  avgMin: 14, avgMax: 22, daysAgoFirst: 400, daysAgoLast: 0 },
    { ordersMin: 58, ordersMax: 80,  avgMin: 11, avgMax: 16, daysAgoFirst: 380, daysAgoLast: 1 },
    { ordersMin: 52, ordersMax: 71,  avgMin: 15, avgMax: 24, daysAgoFirst: 350, daysAgoLast: 1 },
    { ordersMin: 48, ordersMax: 65,  avgMin: 10, avgMax: 15, daysAgoFirst: 300, daysAgoLast: 2 },
    // VIPs (20-50 orders) - 8
    { ordersMin: 35, ordersMax: 48,  avgMin: 12, avgMax: 20, daysAgoFirst: 280, daysAgoLast: 0 },
    { ordersMin: 30, ordersMax: 42,  avgMin: 13, avgMax: 19, daysAgoFirst: 250, daysAgoLast: 1 },
    { ordersMin: 25, ordersMax: 38,  avgMin: 10, avgMax: 17, daysAgoFirst: 220, daysAgoLast: 2 },
    { ordersMin: 22, ordersMax: 33,  avgMin: 14, avgMax: 22, daysAgoFirst: 200, daysAgoLast: 3 },
    { ordersMin: 20, ordersMax: 30,  avgMin: 11, avgMax: 16, daysAgoFirst: 180, daysAgoLast: 1 },
    { ordersMin: 20, ordersMax: 28,  avgMin: 9,  avgMax: 14, daysAgoFirst: 160, daysAgoLast: 4 },
    { ordersMin: 18, ordersMax: 26,  avgMin: 15, avgMax: 25, daysAgoFirst: 150, daysAgoLast: 2 },
    { ordersMin: 15, ordersMax: 24,  avgMin: 12, avgMax: 18, daysAgoFirst: 140, daysAgoLast: 5 },
    // Regulars (5-15 orders) - 12
    { ordersMin: 12, ordersMax: 15,  avgMin: 10, avgMax: 16, daysAgoFirst: 120, daysAgoLast: 1 },
    { ordersMin: 10, ordersMax: 14,  avgMin: 13, avgMax: 20, daysAgoFirst: 100, daysAgoLast: 3 },
    { ordersMin: 9,  ordersMax: 13,  avgMin: 8,  avgMax: 14, daysAgoFirst: 90,  daysAgoLast: 2 },
    { ordersMin: 8,  ordersMax: 12,  avgMin: 11, avgMax: 18, daysAgoFirst: 85,  daysAgoLast: 4 },
    { ordersMin: 7,  ordersMax: 11,  avgMin: 14, avgMax: 22, daysAgoFirst: 75,  daysAgoLast: 1 },
    { ordersMin: 7,  ordersMax: 10,  avgMin: 9,  avgMax: 15, daysAgoFirst: 70,  daysAgoLast: 6 },
    { ordersMin: 6,  ordersMax: 9,   avgMin: 12, avgMax: 19, daysAgoFirst: 60,  daysAgoLast: 3 },
    { ordersMin: 6,  ordersMax: 9,   avgMin: 10, avgMax: 16, daysAgoFirst: 55,  daysAgoLast: 2 },
    { ordersMin: 5,  ordersMax: 8,   avgMin: 13, avgMax: 21, daysAgoFirst: 50,  daysAgoLast: 5 },
    { ordersMin: 5,  ordersMax: 8,   avgMin: 8,  avgMax: 13, daysAgoFirst: 45,  daysAgoLast: 1 },
    { ordersMin: 5,  ordersMax: 7,   avgMin: 11, avgMax: 17, daysAgoFirst: 40,  daysAgoLast: 7 },
    { ordersMin: 5,  ordersMax: 7,   avgMin: 15, avgMax: 24, daysAgoFirst: 35,  daysAgoLast: 0 },
    // Occasionals (2-4 orders) - 15
    { ordersMin: 3, ordersMax: 4, avgMin: 10, avgMax: 18, daysAgoFirst: 30, daysAgoLast: 2 },
    { ordersMin: 3, ordersMax: 4, avgMin: 8,  avgMax: 14, daysAgoFirst: 28, daysAgoLast: 4 },
    { ordersMin: 3, ordersMax: 4, avgMin: 12, avgMax: 20, daysAgoFirst: 25, daysAgoLast: 1 },
    { ordersMin: 2, ordersMax: 4, avgMin: 14, avgMax: 26, daysAgoFirst: 22, daysAgoLast: 3 },
    { ordersMin: 2, ordersMax: 3, avgMin: 9,  avgMax: 15, daysAgoFirst: 20, daysAgoLast: 6 },
    { ordersMin: 2, ordersMax: 3, avgMin: 11, avgMax: 18, daysAgoFirst: 18, daysAgoLast: 2 },
    { ordersMin: 2, ordersMax: 3, avgMin: 7,  avgMax: 12, daysAgoFirst: 15, daysAgoLast: 5 },
    { ordersMin: 2, ordersMax: 3, avgMin: 13, avgMax: 22, daysAgoFirst: 14, daysAgoLast: 1 },
    { ordersMin: 2, ordersMax: 3, avgMin: 10, avgMax: 16, daysAgoFirst: 12, daysAgoLast: 3 },
    { ordersMin: 2, ordersMax: 2, avgMin: 8,  avgMax: 14, daysAgoFirst: 10, daysAgoLast: 4 },
    { ordersMin: 2, ordersMax: 2, avgMin: 15, avgMax: 25, daysAgoFirst: 8,  daysAgoLast: 1 },
    { ordersMin: 2, ordersMax: 2, avgMin: 9,  avgMax: 13, daysAgoFirst: 7,  daysAgoLast: 2 },
    { ordersMin: 2, ordersMax: 2, avgMin: 11, avgMax: 17, daysAgoFirst: 6,  daysAgoLast: 0 },
    // Banned - 2
    { ordersMin: 8, ordersMax: 14, avgMin: 10, avgMax: 16, daysAgoFirst: 90, daysAgoLast: 12, banned: true, banReason: "Comportement agressif envers le personnel" },
    { ordersMin: 3, ordersMax: 5,  avgMin: 8,  avgMax: 12, daysAgoFirst: 45, daysAgoLast: 20, banned: true, banReason: "No-show repete (3 commandes non recuperees)" },
    // New (1 order, recent) - 5
    { ordersMin: 1, ordersMax: 1, avgMin: 8,  avgMax: 16, daysAgoFirst: 3, daysAgoLast: 3 },
    { ordersMin: 1, ordersMax: 1, avgMin: 10, avgMax: 20, daysAgoFirst: 2, daysAgoLast: 2 },
    { ordersMin: 1, ordersMax: 1, avgMin: 12, avgMax: 18, daysAgoFirst: 1, daysAgoLast: 1 },
    { ordersMin: 1, ordersMax: 1, avgMin: 7,  avgMax: 14, daysAgoFirst: 0, daysAgoLast: 0 },
    { ordersMin: 1, ordersMax: 1, avgMin: 14, avgMax: 22, daysAgoFirst: 0, daysAgoLast: 0 },
  ];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const name = DEMO_CUSTOMER_NAMES[i];
    // ~60% have email
    const hasEmail = rand() < 0.6;
    const nameParts = name.toLowerCase().split(" ");
    const emailDomain = DEMO_EMAIL_DOMAINS[Math.floor(rand() * DEMO_EMAIL_DOMAINS.length)];
    const email = hasEmail ? `${nameParts[0]}.${nameParts[1][0]}${Math.floor(rand() * 100)}@${emailDomain}` : "";
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
      is_banned: !!p.banned,
      banned_at: p.banned ? new Date(now.getTime() - 5 * 86400000).toISOString() : null,
      banned_reason: p.banReason || "",
      ban_expires_at: null,
      banned_ip: "",
      notes: DEMO_NOTES_POOL[noteIdx],
      flagged: i === 14,
      created_at: firstDate.toISOString(),
      updated_at: lastDate.toISOString(),
    });
  }

  return customers;
}
