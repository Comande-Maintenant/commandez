import { supabase } from "@/integrations/supabase/client";
import type { DbRestaurant, DbMenuItem, DbOrder, DbTablet, DbCustomer, DbOwner } from "@/types/database";

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
}): Promise<DbOrder> {
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

export async function updateOrderStatus(orderId: string, status: string) {
  const updates: Record<string, any> = { status };
  const now = new Date().toISOString();
  if (status === "preparing") updates.accepted_at = now;
  if (status === "ready") updates.ready_at = now;
  if (status === "done") updates.completed_at = now;
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

export async function fetchOrderById(orderId: string): Promise<(DbOrder & { restaurant: Pick<DbRestaurant, 'name' | 'slug' | 'primary_color'> & { phone: string } }) | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, restaurant:restaurants(name, slug, primary_color, restaurant_phone)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Remap restaurant_phone -> phone for convenience
  const raw = data as any;
  const rest = raw.restaurant;
  return {
    ...raw,
    restaurant: { name: rest.name, slug: rest.slug, primary_color: rest.primary_color, phone: rest.restaurant_phone },
  };
}

export function subscribeToOrderStatus(orderId: string, callback: (order: DbOrder) => void): () => void {
  const channel = supabase
    .channel(`order-track-${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${orderId}`,
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

export async function incrementDeactivationVisits(restaurantId: string) {
  const { data } = await supabase
    .from("restaurants")
    .select("deactivation_visit_count")
    .eq("id", restaurantId)
    .single();
  const current = (data as any)?.deactivation_visit_count || 0;
  await supabase
    .from("restaurants")
    .update({ deactivation_visit_count: current + 1 })
    .eq("id", restaurantId);
}

export async function fetchActiveOrderCount(restaurantId: string): Promise<number> {
  const { count, error } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .in("status", ["new", "preparing"]);
  if (error) return 0;
  return count ?? 0;
}

// --- Tablets ---

export async function fetchTablets(restaurantId: string): Promise<DbTablet[]> {
  const { data, error } = await supabase
    .from("restaurant_tablets")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DbTablet[];
}

export async function insertTablet(tablet: {
  restaurant_id: string;
  serial_number: string;
  name?: string;
  usage_type: string;
  notes?: string;
}): Promise<DbTablet> {
  const { data, error } = await supabase
    .from("restaurant_tablets")
    .insert(tablet)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DbTablet;
}

export async function updateTablet(id: string, updates: Partial<DbTablet>) {
  const { error } = await supabase
    .from("restaurant_tablets")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
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
