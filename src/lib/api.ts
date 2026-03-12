import { supabase } from "@/integrations/supabase/client";
import type { DbRestaurant, DbMenuItem, DbOrder, DbCustomer, DbOwner, DbSubscription, DbPromoCode } from "@/types/database";
import { PLAN_PRICES } from "@/services/shopify-checkout";

// ── Demo mode RPCs ──

export async function fetchDemoRestaurant(slug: string): Promise<DbRestaurant | null> {
  const { data, error } = await supabase.rpc("get_demo_restaurant", { p_slug: slug });
  if (error) throw error;
  const rows = data as unknown as DbRestaurant[];
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function fetchDemoOrders(restaurantId: string): Promise<DbOrder[]> {
  const { data, error } = await supabase.rpc("get_demo_orders", { p_restaurant_id: restaurantId });
  if (error) throw error;
  return (data ?? []) as unknown as DbOrder[];
}

export async function fetchDemoCustomers(restaurantId: string): Promise<DbCustomer[]> {
  const { data, error } = await supabase.rpc("get_demo_customers", { p_restaurant_id: restaurantId });
  if (error) throw error;
  return (data ?? []) as unknown as DbCustomer[];
}

export async function advanceDemoOrder(orderId: string, newStatus: string): Promise<DbOrder> {
  const { data, error } = await supabase.rpc("advance_demo_order", {
    p_order_id: orderId,
    p_new_status: newStatus,
  });
  if (error) throw error;
  const rows = data as unknown as DbOrder[];
  return rows[0];
}

export async function fetchRestaurants(): Promise<DbRestaurant[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as DbRestaurant[];
}

export async function fetchRestaurantById(id: string): Promise<DbRestaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DbRestaurant | null;
}

export async function fetchRestaurantBySlug(slug: string): Promise<DbRestaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DbRestaurant | null;
}

export async function fetchMenuItems(restaurantId: string): Promise<DbMenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("enabled", true)
    .eq("is_alcohol", false)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as DbMenuItem[];
}

export async function fetchAllMenuItems(restaurantId: string): Promise<DbMenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as DbMenuItem[];
}

export async function fetchClientIp(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || null;
  } catch {
    return null;
  }
}

export async function createOrder(order: {
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  order_type: string;
  source?: string;
  covers?: number | null;
  items: any;
  subtotal: number;
  total: number;
  notes?: string;
  client_ip?: string | null;
  pickup_time?: string | null;
  payment_method?: string;
  estimated_ready_at?: string;
}): Promise<DbOrder> {
  // Server-side price validation (skip for demo orders)
  if (order.source !== "demo") {
    const { data: valid, error: validErr } = await supabase.rpc("validate_order_total", {
      p_items: order.items,
      p_claimed_total: order.total,
    });
    if (validErr || !valid) {
      throw new Error("Le total de la commande ne correspond pas aux prix du menu.");
    }

    // Alcohol validation: reject orders containing alcohol items
    const itemIds = (order.items as any[]).map((i: any) => i.id).filter(Boolean);
    if (itemIds.length > 0) {
      const { data: alcoholItems } = await supabase
        .from("menu_items")
        .select("id")
        .in("id", itemIds)
        .eq("is_alcohol", true);
      if (alcoholItems && alcoholItems.length > 0) {
        throw new Error("Les produits alcoolisés ne peuvent pas être commandés en ligne.");
      }
    }
  }
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DbOrder;
}

export async function fetchOrders(restaurantId: string): Promise<DbOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DbOrder[];
}

export async function updateOrderStatus(orderId: string, status: string, estimatedMinutes?: number) {
  const updates: Record<string, any> = { status };
  const now = new Date().toISOString();

  // Forward transitions: set timestamps
  if (status === "preparing") {
    updates.accepted_at = now;
    if (estimatedMinutes) {
      updates.estimated_ready_at = new Date(Date.now() + estimatedMinutes * 60000).toISOString();
    }
  }
  if (status === "ready") updates.ready_at = now;
  if (status === "done") updates.completed_at = now;

  // Backward transitions: clear future timestamps
  if (status === "ready") { updates.completed_at = null; }
  if (status === "preparing") { updates.ready_at = null; updates.completed_at = null; }
  if (status === "new") { updates.accepted_at = null; updates.ready_at = null; updates.completed_at = null; updates.estimated_ready_at = null; }

  const { error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateOrderItems(orderId: string, items: any[], total: number) {
  const { error } = await supabase
    .from("orders")
    .update({ items, subtotal: total, total })
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateOrderEstimatedReady(orderId: string, estimatedReadyAt: string | null) {
  const { error } = await supabase
    .from("orders")
    .update({ estimated_ready_at: estimatedReadyAt })
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateMenuItem(id: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from("menu_items")
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
}

export async function insertMenuItem(item: {
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  supplements?: any;
  sauces?: string[];
  variants?: Array<{ name: string; price: number }>;
}) {
  const { error } = await supabase
    .from("menu_items")
    .insert(item);
  if (error) throw error;
}

export async function deleteMenuItem(id: string) {
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateRestaurant(id: string, updates: Partial<DbRestaurant>) {
  const { error } = await supabase
    .from("restaurants")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function fetchRestaurantHours(restaurantId: string) {
  const { data, error } = await supabase
    .from("restaurant_hours")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week");
  if (error) throw error;
  return data ?? [];
}

export async function upsertRestaurantHours(restaurantId: string, hours: { day_of_week: number; is_open: boolean; open_time: string; close_time: string }[]) {
  const rows = hours.map((h) => ({ ...h, restaurant_id: restaurantId }));
  const { error } = await supabase
    .from("restaurant_hours")
    .upsert(rows, { onConflict: "restaurant_id,day_of_week" });
  if (error) throw error;
}

export async function batchUpdateSortOrder(items: { id: string; sort_order: number }[]) {
  for (const item of items) {
    const { error } = await supabase
      .from("menu_items")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw error;
  }
}

export async function updateRestaurantCategories(restaurantId: string, categories: string[]) {
  const { error } = await supabase
    .from("restaurants")
    .update({ categories })
    .eq("id", restaurantId);
  if (error) throw error;
}

export async function renameCategory(restaurantId: string, oldName: string, newName: string) {
  const { data, error: fetchError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("category", oldName);
  if (fetchError) throw fetchError;
  for (const item of data ?? []) {
    const { error } = await supabase
      .from("menu_items")
      .update({ category: newName })
      .eq("id", item.id);
    if (error) throw error;
  }
}

export async function uploadMenuItemImage(restaurantId: string, menuItemId: string, blob: Blob): Promise<string> {
  const path = `${restaurantId}/${menuItemId}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("menu-item-images")
    .upload(path, blob, { upsert: true, contentType: "image/webp" });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("menu-item-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteMenuItemImage(restaurantId: string, menuItemId: string): Promise<void> {
  const path = `${restaurantId}/${menuItemId}.webp`;
  await supabase.storage.from("menu-item-images").remove([path]);
}

export async function uploadRestaurantImage(restaurantId: string, file: File, type: "logo" | "cover"): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${restaurantId}/${type}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("restaurant-images")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("restaurant-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchOrderById(orderId: string): Promise<(DbOrder & { restaurant: Pick<DbRestaurant, 'name' | 'slug' | 'primary_color'> & { phone: string; is_demo?: boolean } }) | null> {
  const { data, error } = await supabase.rpc("get_order_for_tracking", { p_order_id: orderId });
  if (error) throw error;
  if (!data) return null;
  const raw = data as any;
  const rest = raw.restaurant;
  return {
    ...raw,
    restaurant: { name: rest.name, slug: rest.slug, primary_color: rest.primary_color, phone: rest.restaurant_phone, is_demo: rest.is_demo },
  };
}

export function subscribeToOrderStatus(orderId: string, callback: (order: DbOrder) => void): () => void {
  // Poll via RPC every 3s (orders SELECT is owner-only, anonymous can't use Realtime)
  let lastStatus: string | null = null;
  const poll = async () => {
    const { data } = await supabase.rpc("get_order_for_tracking", { p_order_id: orderId });
    if (data) {
      const order = data as any;
      if (order.status !== lastStatus) {
        lastStatus = order.status;
        callback(order as unknown as DbOrder);
      }
    }
  };
  poll(); // initial fetch
  const interval = setInterval(poll, 3000);
  return () => clearInterval(interval);
}

export async function incrementDeactivationVisits(restaurantId: string) {
  await supabase.rpc("increment_deactivation_visits", {
    p_restaurant_id: restaurantId,
  });
}

export async function fetchActiveOrderCount(restaurantId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_active_order_count", {
    p_restaurant_id: restaurantId,
  });
  if (error) return 0;
  return data ?? 0;
}

export function subscribeToOrders(restaurantId: string, callback: (order: DbOrder) => void) {
  const channel = supabase
    .channel(`orders-${restaurantId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => {
        callback(payload.new as unknown as DbOrder);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// --- Customers ---

export async function fetchCustomers(restaurantId: string): Promise<DbCustomer[]> {
  const { data, error } = await supabase
    .from("restaurant_customers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("last_order_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as DbCustomer[];
}

export async function fetchCustomerByPhone(restaurantId: string, phone: string): Promise<DbCustomer | null> {
  const { data, error } = await supabase
    .from("restaurant_customers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("customer_phone", phone)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DbCustomer | null;
}

export async function upsertCustomer(customer: {
  restaurant_id: string;
  customer_phone: string;
  customer_name: string;
  customer_email?: string;
}): Promise<DbCustomer> {
  const { data, error } = await supabase
    .from("restaurant_customers")
    .upsert(customer, { onConflict: "restaurant_id,customer_phone" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DbCustomer;
}

export async function updateCustomerStats(
  customerId: string,
  orderTotal: number,
  items: { name: string; quantity: number }[]
) {
  // Fetch current customer data
  const { data: current, error: fetchErr } = await supabase
    .from("restaurant_customers")
    .select("total_orders, total_spent, favorite_items, last_items, first_order_at")
    .eq("id", customerId)
    .single();
  if (fetchErr) throw fetchErr;

  const c = current as any;
  const newTotalOrders = (c.total_orders || 0) + 1;
  const newTotalSpent = Number(c.total_spent || 0) + orderTotal;
  const newAverage = newTotalSpent / newTotalOrders;

  // Calculate favorite items (top 3 by frequency)
  const itemCounts: Record<string, number> = {};
  const prevFavorites: string[] = c.favorite_items || [];
  for (const f of prevFavorites) itemCounts[f] = (itemCounts[f] || 0) + 5;
  for (const item of items) itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
  const favorites = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const lastItems = items.map((i) => i.name).slice(0, 5);

  const updates: Record<string, any> = {
    total_orders: newTotalOrders,
    total_spent: newTotalSpent.toFixed(2),
    average_basket: newAverage.toFixed(2),
    favorite_items: favorites,
    last_items: lastItems,
    last_order_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!c.first_order_at) {
    updates.first_order_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("restaurant_customers")
    .update(updates)
    .eq("id", customerId);
  if (error) throw error;
}

export async function banCustomer(
  customerId: string,
  reason: string,
  expiresAt: string | null,
  ip?: string
) {
  const { error } = await supabase
    .from("restaurant_customers")
    .update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      banned_reason: reason,
      ban_expires_at: expiresAt,
      banned_ip: ip || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);
  if (error) throw error;
}

export async function unbanCustomer(customerId: string) {
  const { error } = await supabase
    .from("restaurant_customers")
    .update({
      is_banned: false,
      banned_at: null,
      banned_reason: "",
      ban_expires_at: null,
      banned_ip: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);
  if (error) throw error;
}

export async function updateCustomerNote(
  customerId: string,
  note: string,
  flagged: boolean
) {
  const { error } = await supabase
    .from("restaurant_customers")
    .update({
      notes: note,
      flagged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);
  if (error) throw error;
}

export async function isCustomerBanned(
  restaurantId: string,
  phone: string,
  email?: string,
  ip?: string
): Promise<{ banned: boolean; reason?: string; expires?: string | null }> {
  // Check by phone
  const { data, error } = await supabase
    .from("restaurant_customers")
    .select("is_banned, banned_reason, ban_expires_at, banned_ip")
    .eq("restaurant_id", restaurantId)
    .eq("customer_phone", phone)
    .eq("is_banned", true)
    .maybeSingle();
  if (error || !data) {
    // Also check by IP if provided
    if (ip) {
      const { data: ipData } = await supabase
        .from("restaurant_customers")
        .select("is_banned, banned_reason, ban_expires_at")
        .eq("restaurant_id", restaurantId)
        .eq("banned_ip", ip)
        .eq("is_banned", true)
        .maybeSingle();
      if (ipData) {
        const d = ipData as any;
        if (d.ban_expires_at && new Date(d.ban_expires_at) < new Date()) {
          return { banned: false };
        }
        return { banned: true, reason: d.banned_reason, expires: d.ban_expires_at };
      }
    }
    return { banned: false };
  }
  const d = data as any;
  // Auto-unban if expired
  if (d.ban_expires_at && new Date(d.ban_expires_at) < new Date()) {
    // Don't await, fire-and-forget unban
    supabase
      .from("restaurant_customers")
      .update({ is_banned: false, banned_at: null, banned_reason: "", ban_expires_at: null, banned_ip: "" })
      .eq("restaurant_id", restaurantId)
      .eq("customer_phone", phone)
      .then(() => {});
    return { banned: false };
  }
  return { banned: true, reason: d.banned_reason, expires: d.ban_expires_at };
}

// --- Owner / Super Admin ---

export async function fetchOwner(userId: string): Promise<DbOwner | null> {
  const { data, error } = await supabase
    .from("owners")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DbOwner | null;
}

export async function fetchPlatformStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [restaurants, ordersMonth, ordersToday] = await Promise.all([
    supabase.from("restaurants").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("total").gte("created_at", monthStart),
    supabase.from("orders").select("total").gte("created_at", todayStart),
  ]);

  const monthOrders = (ordersMonth.data ?? []) as any[];
  const todayOrdersData = (ordersToday.data ?? []) as any[];

  return {
    totalRestaurants: restaurants.count ?? 0,
    ordersThisMonth: monthOrders.length,
    revenueThisMonth: monthOrders.reduce((s: number, o: any) => s + Number(o.total), 0),
    ordersToday: todayOrdersData.length,
    revenueToday: todayOrdersData.reduce((s: number, o: any) => s + Number(o.total), 0),
  };
}

export async function fetchAllRestaurantsWithStats(): Promise<
  (DbRestaurant & { order_count: number; revenue: number; last_order_at: string | null })[]
> {
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("name");
  if (error) throw error;

  const result: (DbRestaurant & { order_count: number; revenue: number; last_order_at: string | null })[] = [];
  for (const r of (restaurants ?? []) as any[]) {
    const { data: orders } = await supabase
      .from("orders")
      .select("total, created_at")
      .eq("restaurant_id", r.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    const orderList = orders ?? [];
    result.push({
      ...r,
      order_count: orderList.length,
      revenue: orderList.reduce((s: number, o: any) => s + Number(o.total), 0),
      last_order_at: orderList.length > 0 ? (orderList[0] as any).created_at : null,
    });
  }
  return result as any;
}

export async function fetchOrdersByPeriod(restaurantId: string, since: Date): Promise<DbOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DbOrder[];
}

// --- Customer Profiles ---

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  default_order_type: string;
  total_orders: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export async function fetchCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as CustomerProfile | null;
}

export async function upsertCustomerProfile(profile: {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}): Promise<CustomerProfile> {
  const { data, error } = await supabase
    .from("customer_profiles")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as CustomerProfile;
}

export async function updateCustomerProfile(userId: string, updates: Partial<Pick<CustomerProfile, "name" | "phone" | "default_order_type">>): Promise<void> {
  const { error } = await supabase
    .from("customer_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function deleteCustomerProfile(userId: string): Promise<void> {
  const { error } = await supabase
    .from("customer_profiles")
    .delete()
    .eq("id", userId);
  if (error) throw error;
}

export async function fetchCustomerOrders(userId: string): Promise<(DbOrder & { restaurant: { name: string; slug: string; primary_color: string } })[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, restaurant:restaurants(name, slug, primary_color)")
    .eq("customer_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (DbOrder & { restaurant: { name: string; slug: string; primary_color: string } })[];
}

export async function linkOrdersToUser(userId: string, email: string, phone?: string): Promise<void> {
  await supabase.rpc("link_orders_to_user", {
    p_user_id: userId,
    p_email: email || "",
    p_phone: phone || "",
  });
}

export async function incrementCustomerStats(userId: string, orderTotal: number): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from("customer_profiles")
    .select("total_orders, total_spent")
    .eq("id", userId)
    .single();
  if (fetchErr || !data) return;
  const c = data as any;
  const { error } = await supabase
    .from("customer_profiles")
    .update({
      total_orders: (c.total_orders || 0) + 1,
      total_spent: (Number(c.total_spent) || 0) + orderTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

// ── Super Admin KPIs ──

export interface SuperAdminKPIs {
  realRestaurants: number;
  activeSubscribers: number;
  monthlySubscribers: number;
  annualSubscribers: number;
  mrr: number;
  arr: number;
}

export async function fetchSuperAdminKPIs(): Promise<SuperAdminKPIs> {
  const [restaurantsRes, subscriptionsRes] = await Promise.all([
    supabase.from("restaurants").select("id", { count: "exact", head: true }).eq("is_demo", false),
    supabase.from("subscriptions").select("status, plan"),
  ]);

  const realRestaurants = restaurantsRes.count ?? 0;
  const subs = (subscriptionsRes.data ?? []) as unknown as Pick<DbSubscription, "status" | "plan">[];
  const activeSubs = subs.filter((s) => s.status === "active");
  const monthlySubs = activeSubs.filter((s) => s.plan === "monthly").length;
  const annualSubs = activeSubs.filter((s) => s.plan === "annual").length;

  const mrr = monthlySubs * PLAN_PRICES.monthly + annualSubs * (PLAN_PRICES.annual / 12);
  const arr = mrr * 12;

  return {
    realRestaurants,
    activeSubscribers: activeSubs.length,
    monthlySubscribers: monthlySubs,
    annualSubscribers: annualSubs,
    mrr,
    arr,
  };
}

// ── Acquisition Funnel ──

export interface AcquisitionFunnelData {
  accounts: number;
  withRestaurant: number;
  inTrial: number;
  paying: number;
  churned: number;
}

export async function fetchAcquisitionFunnel(): Promise<AcquisitionFunnelData> {
  const [ownersRes, restaurantsRes, subscriptionsRes] = await Promise.all([
    supabase.from("owners").select("id, role"),
    supabase.from("restaurants").select("id, is_demo, subscription_status, trial_end_date"),
    supabase.from("subscriptions").select("status, trial_end"),
  ]);

  const owners = (ownersRes.data ?? []) as unknown as { id: string; role: string }[];
  const accounts = owners.filter((o) => o.role !== "super_admin").length;

  const restaurants = (restaurantsRes.data ?? []) as unknown as Pick<DbRestaurant, "id" | "is_demo" | "subscription_status" | "trial_end_date">[];
  const realRestaurants = restaurants.filter((r) => !r.is_demo);
  const withRestaurant = realRestaurants.length;

  const subs = (subscriptionsRes.data ?? []) as unknown as Pick<DbSubscription, "status" | "trial_end">[];
  const now = new Date();

  // In trial: subscription status = trial, or restaurant subscription_status = trial/pending_payment with future trial_end
  const inTrialSubs = subs.filter((s) => s.status === "trial").length;
  const inTrialLegacy = realRestaurants.filter(
    (r) =>
      (r.subscription_status === "trial" || r.subscription_status === "pending_payment") &&
      r.trial_end_date &&
      new Date(r.trial_end_date) > now
  ).length;
  const inTrial = Math.max(inTrialSubs, inTrialLegacy);

  const paying = subs.filter((s) => s.status === "active").length;
  const churned = subs.filter((s) => s.status === "cancelled" || s.status === "expired").length;

  return { accounts, withRestaurant, inTrial, paying, churned };
}

// ── Prospect List ──

export interface ProspectItem {
  id: string;
  email: string;
  phone: string;
  restaurantName: string | null;
  restaurantSlug: string | null;
  restaurantId: string | null;
  createdAt: string;
  subscriptionStatus: string | null;
  trialEndDate: string | null;
  plan: string | null;
}

export async function fetchProspectList(): Promise<ProspectItem[]> {
  const [ownersRes, restaurantsRes, subscriptionsRes] = await Promise.all([
    supabase.from("owners").select("id, email, phone, role, created_at").order("created_at", { ascending: false }),
    supabase.from("restaurants").select("id, name, slug, owner_id, is_demo, subscription_status, trial_end_date"),
    supabase.from("subscriptions").select("restaurant_id, status, plan"),
  ]);

  const owners = (ownersRes.data ?? []) as unknown as (DbOwner & { created_at: string })[];
  const restaurants = (restaurantsRes.data ?? []) as unknown as (DbRestaurant & { owner_id: string })[];
  const subs = (subscriptionsRes.data ?? []) as unknown as Pick<DbSubscription, "restaurant_id" | "status" | "plan">[];

  const realRestaurants = restaurants.filter((r) => !r.is_demo);
  const subsByRestaurant = new Map(subs.map((s) => [s.restaurant_id, s]));

  return owners
    .filter((o) => o.role !== "super_admin")
    .map((owner) => {
      const resto = realRestaurants.find((r) => r.owner_id === owner.id);
      const sub = resto ? subsByRestaurant.get(resto.id) : undefined;
      return {
        id: owner.id,
        email: owner.email,
        phone: owner.phone,
        restaurantName: resto?.name ?? null,
        restaurantSlug: resto?.slug ?? null,
        restaurantId: resto?.id ?? null,
        createdAt: owner.created_at,
        subscriptionStatus: sub?.status ?? resto?.subscription_status ?? null,
        trialEndDate: resto?.trial_end_date ?? null,
        plan: sub?.plan ?? null,
      };
    });
}

// ── Demo Stats ──

export interface DemoStatsData {
  totalOrders: number;
  totalRevenue: number;
  lastOrderAt: string | null;
}

export async function fetchDemoStats(): Promise<DemoStatsData> {
  const { data, error } = await supabase
    .from("orders")
    .select("total, created_at")
    .eq("source", "demo")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const orders = (data ?? []) as unknown as { total: number; created_at: string }[];
  return {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((s, o) => s + Number(o.total), 0),
    lastOrderAt: orders.length > 0 ? orders[0].created_at : null,
  };
}

// ── Promo Codes ──

export async function fetchAllPromoCodes(): Promise<DbPromoCode[]> {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DbPromoCode[];
}

// ── Referrals ──

export interface ReferralCodeItem {
  restaurantId: string;
  restaurantName: string;
  referralCode: string;
}

export interface ReferralRecord {
  id: string;
  referrerName: string;
  refereeName: string | null;
  refereeEmail: string | null;
  status: string;
  bonusWeeks: number;
  createdAt: string;
}

export interface AllReferralsData {
  activeCodes: ReferralCodeItem[];
  referrals: ReferralRecord[];
}

export async function fetchAllReferrals(): Promise<AllReferralsData> {
  const [restaurantsRes, referralsRes] = await Promise.all([
    supabase.from("restaurants").select("id, name, referral_code, is_demo"),
    supabase.from("referrals").select("*").order("created_at", { ascending: false }),
  ]);

  const restaurants = (restaurantsRes.data ?? []) as unknown as Pick<DbRestaurant, "id" | "name" | "referral_code" | "is_demo">[];
  const referralsRaw = (referralsRes.data ?? []) as unknown as {
    id: string; referrer_id: string; referee_id: string | null; referee_email: string | null;
    status: string; bonus_weeks_granted: number; created_at: string;
  }[];

  const activeCodes: ReferralCodeItem[] = restaurants
    .filter((r) => r.referral_code && !r.is_demo)
    .map((r) => ({ restaurantId: r.id, restaurantName: r.name, referralCode: r.referral_code! }));

  const restaurantMap = new Map(restaurants.map((r) => [r.id, r.name]));

  const referrals: ReferralRecord[] = referralsRaw.map((ref) => ({
    id: ref.id,
    referrerName: restaurantMap.get(ref.referrer_id) ?? ref.referrer_id,
    refereeName: ref.referee_id ? (restaurantMap.get(ref.referee_id) ?? null) : null,
    refereeEmail: ref.referee_email,
    status: ref.status ?? "pending",
    bonusWeeks: ref.bonus_weeks_granted ?? 0,
    createdAt: ref.created_at,
  }));

  return { activeCodes, referrals };
}
