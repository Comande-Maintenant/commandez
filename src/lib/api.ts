import { isEmbeddedDemo, isEmbeddedDemoSlug, isEmbeddedDemoOrder, embeddedRestaurant, embeddedMenu, embeddedOrders, createEmbeddedOrder, embeddedTrackedOrder } from './embedded-demo';
import { randomUuid } from '@/lib/uuid';
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DbRestaurant, DbMenuItem, DbOrder, DbCustomer, DbOwner, DbSubscription, DbPromoCode, DbTablet } from "@/types/database";
const PLAN_PRICES = { monthly: 29.99 } as const;

// ── Demo mode RPCs ──

export async function fetchDemoRestaurant(slug: string): Promise<DbRestaurant | null> {
  if (isEmbeddedDemoSlug(slug)) return embeddedRestaurant();
  const { data, error } = await supabase.rpc("get_demo_restaurant", { p_slug: slug });
  if (error) throw error;
  const rows = data as unknown as DbRestaurant[];
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function fetchDemoOrders(restaurantId: string): Promise<DbOrder[]> {
  if (isEmbeddedDemo(restaurantId)) return embeddedOrders();
  const { data, error } = await supabase.rpc("get_demo_orders", { p_restaurant_id: restaurantId });
  if (error) throw error;
  return (data ?? []) as unknown as DbOrder[];
}

export async function fetchDemoCustomers(restaurantId: string): Promise<DbCustomer[]> {
  if (isEmbeddedDemo(restaurantId)) return [];
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
  if (isEmbeddedDemo(id)) return embeddedRestaurant();
  const { data, error } = await supabase.rpc("get_public_restaurant_by_id", {
    p_id: id,
  });
  if (error) throw error;
  return data as unknown as DbRestaurant | null;
}

export async function fetchRestaurantBySlug(slug: string): Promise<DbRestaurant | null> {
  if (isEmbeddedDemoSlug(slug)) return embeddedRestaurant();
  const { data, error } = await supabase.rpc("get_public_restaurant_by_slug", {
    p_slug: slug,
  });
  if (error) throw error;
  return data as unknown as DbRestaurant | null;
}

export async function fetchMerchantRestaurantBySlug(slug: string): Promise<DbRestaurant | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DbRestaurant | null;
}

export async function fetchMenuItems(restaurantId: string): Promise<DbMenuItem[]> {
  if (isEmbeddedDemo(restaurantId)) return embeddedMenu().filter(item => item.enabled && !item.is_alcohol);
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
  if (isEmbeddedDemo(restaurantId)) return embeddedMenu();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as DbMenuItem[];
}

export async function createOrder(order: {
  request_id?: string;
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
  is_test?: boolean;
}): Promise<DbOrder> {
  if (isEmbeddedDemo(order.restaurant_id)) return createEmbeddedOrder(order);
  const { request_id, ...payload } = order;
  const { data, error } = await supabase.rpc("place_order_once" as never, {
    p_request_id: request_id || randomUuid(),
    p_order: { ...payload, client_ip: null },
  } as never);
  if (error) throw error;
  return data as unknown as DbOrder;
}

export async function fetchOrders(restaurantId: string, options?: { operational?: boolean; signal?: AbortSignal }): Promise<DbOrder[]> {
  if (options?.operational) {
    // Keep unfinished orders and orders created or completed today, including
    // overnight collections. Archive/statistics retain the unfiltered query below.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orders: DbOrder[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (options.signal?.aborted) abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 15000);
      try {
        const { data, error } = await supabase.from("orders").select("*")
          .eq("restaurant_id", restaurantId)
          .or(`status.in.(new,preparing,ready),created_at.gte.${today.toISOString()},completed_at.gte.${today.toISOString()}`)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .abortSignal(controller.signal).range(offset, offset + pageSize - 1);
        if (error) throw error;
        orders.push(...(data ?? []) as unknown as DbOrder[]);
        if (!data || data.length < pageSize) return orders;
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
      }
    }
  }
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
  enabled?: boolean;
  popular?: boolean;
  product_type?: string;
  sort_order?: number;
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
    .update(
      updates as unknown as Database["public"]["Tables"]["restaurants"]["Update"]
    )
    .eq("id", id);
  if (error) throw error;
}

export async function fetchRestaurantHours(restaurantId: string) {
  if (isEmbeddedDemo(restaurantId)) return [];
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

export async function fetchTablets(restaurantId: string): Promise<DbTablet[]> {
  const { data, error } = await supabase
    .from("restaurant_tablets")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as DbTablet[];
}

export async function insertTablet(tablet: {
  restaurant_id: string;
  serial_number: string;
  name: string;
  usage_type: string;
  notes: string;
}): Promise<DbTablet> {
  const { data, error } = await supabase
    .from("restaurant_tablets")
    .insert(tablet)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DbTablet;
}

export async function updateTablet(
  id: string,
  updates: Partial<Pick<
    DbTablet,
    "serial_number" | "name" | "usage_type" | "notes" | "status" | "deactivated_at"
  >>
): Promise<void> {
  const { error } = await supabase
    .from("restaurant_tablets")
    .update(updates)
    .eq("id", id);
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
  if (isEmbeddedDemoOrder(orderId)) return embeddedTrackedOrder(orderId);
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
  if (isEmbeddedDemoOrder(orderId)) return () => {};
  // Tracking RPC preserves owner-only SELECT. Serialize reads, suspend hidden
  // screens and stop at completion; active screens receive updates within 5s.
  let lastSnapshot: string | null = null;
  let stopped = false;
  let completed = false;
  let pending = false;
  let delay = 5000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (stopped || completed || pending || document.hidden) return;
    if (timeout) clearTimeout(timeout);
    pending = true;
    try {
      const { data, error } = await supabase.rpc("get_order_for_tracking", { p_order_id: orderId });
      if (error || !data) delay = Math.min(delay * 2, 30000);
      else if (!stopped) {
        delay = 5000;
        const snapshot = JSON.stringify(data);
        const order = data as unknown as DbOrder;
        completed = order.status === "done";
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          callback(order);
        }
      }
    } catch { delay = Math.min(delay * 2, 30000); }
    finally {
      pending = false;
      if (!stopped && !completed && !document.hidden) timeout = setTimeout(() => { void poll(); }, delay);
    }
  };
  const resume = () => { void poll(); };
  const visible = () => {
    if (document.hidden) { if (timeout) clearTimeout(timeout); }
    else resume();
  };
  resume();
  window.addEventListener("online", resume);
  window.addEventListener("commandeici:resume", resume);
  document.addEventListener("visibilitychange", visible);
  return () => {
    stopped = true;
    if (timeout) clearTimeout(timeout);
    window.removeEventListener("online", resume);
    window.removeEventListener("commandeici:resume", resume);
    document.removeEventListener("visibilitychange", visible);
  };
}

export async function incrementDeactivationVisits(restaurantId: string) {
  await supabase.rpc("increment_deactivation_visits", {
    p_restaurant_id: restaurantId,
  });
}

export async function fetchActiveOrderCount(restaurantId: string): Promise<number> {
  if (isEmbeddedDemo(restaurantId)) return embeddedOrders().filter(order => order.status !== 'done').length;
  const { data, error } = await supabase.rpc("get_active_order_count", {
    p_restaurant_id: restaurantId,
  });
  if (error) return 0;
  return data ?? 0;
}

let orderSubscriptionId = 0;

export function subscribeToOrders(restaurantId: string, callback: (order: DbOrder) => void, onStatus?: (status: string) => void) {
  let stopped = false;
  const receive = (payload: { new: unknown }) => { if (!stopped) callback(payload.new as DbOrder); };
  const channel = supabase
    .channel(`orders-${restaurantId}-${++orderSubscriptionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      receive
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, receive)
    .subscribe((status) => { if (!stopped) onStatus?.(status); });

  return () => {
    stopped = true;
    void supabase.removeChannel(channel);
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

export async function banCustomer(
  customerId: string,
  reason: string,
  expiresAt: string | null,
  ip?: string,
  expectedUserId: string | null = null
) {
  const { error } = await supabase.rpc("set_restaurant_customer_ban" as never, {
    p_customer_id: customerId,
    p_expected_user_id: expectedUserId,
    p_banned: true,
    p_reason: reason,
    p_expires_at: expiresAt,
    p_ip: ip || null,
  } as never);
  if (error) throw error;
}

export async function unbanCustomer(customerId: string, expectedUserId: string | null = null) {
  const { error } = await supabase.rpc("set_restaurant_customer_ban" as never, {
    p_customer_id: customerId,
    p_expected_user_id: expectedUserId,
    p_banned: false,
    p_reason: "",
    p_expires_at: null,
    p_ip: null,
  } as never);
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
  if (isEmbeddedDemo(restaurantId)) return { banned: false };
  const { data, error } = await supabase
    .rpc("check_customer_ban", {
      p_restaurant_id: restaurantId,
      p_phone: phone,
      p_email: email ?? null,
    });
  if (error || !data) {
    return { banned: false };
  }
  const result = data as {
    banned?: boolean;
    reason?: string;
    expires?: string | null;
  };
  return {
    banned: result.banned === true,
    reason: result.reason,
    expires: result.expires,
  };
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
  if (isEmbeddedDemo(restaurantId)) return embeddedOrders().filter(order => Date.parse(order.created_at) >= since.getTime());
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

// ── Super Admin KPIs ──

export interface SuperAdminKPIs {
  realRestaurants: number;
  activeSubscribers: number;
  monthlySubscribers: number;
  annualSubscribers: number;
  trialingCount: number;
  mrr: number;
  arr: number;
}

export async function fetchSuperAdminKPIs(): Promise<SuperAdminKPIs> {
  const [restaurantsRes, subscriptionsRes] = await Promise.all([
    supabase.from("restaurants").select("id", { count: "exact", head: true }).eq("is_demo", false),
    supabase.from("subscriptions").select("status, plan, created_at"),
  ]);

  const realRestaurants = restaurantsRes.count ?? 0;
  const subs = (subscriptionsRes.data ?? []) as unknown as { status: string; plan: string; created_at: string }[];
  const activeSubs = subs.filter((s) => s.status === "active");
  const trialingCount = subs.filter((s) => s.status === "trialing" || s.status === "trial").length;
  const now = Date.now();
  const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
  let mrr = 0;
  for (const s of activeSubs) {
    const age = now - new Date(s.created_at).getTime();
    mrr += age < threeMonthsMs ? 1 : PLAN_PRICES.monthly;
  }
  const arr = mrr * 12;

  return {
    realRestaurants,
    activeSubscribers: activeSubs.length,
    monthlySubscribers: activeSubs.length,
    annualSubscribers: 0,
    trialingCount,
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
    supabase.from("restaurants").select("id, is_demo"),
    supabase.from("subscriptions").select("status"),
  ]);

  const owners = (ownersRes.data ?? []) as unknown as { id: string; role: string }[];
  const accounts = owners.filter((o) => o.role !== "super_admin").length;

  const restaurants = (restaurantsRes.data ?? []) as unknown as { id: string; is_demo: boolean }[];
  const withRestaurant = restaurants.filter((r) => !r.is_demo).length;

  const subs = (subscriptionsRes.data ?? []) as unknown as { status: string }[];
  const inTrial = subs.filter((s) => s.status === "trialing" || s.status === "trial").length;
  const paying = subs.filter((s) => s.status === "active").length;
  const churned = subs.filter((s) => s.status === "cancelled" || s.status === "canceled" || s.status === "expired").length;

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
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  subCreatedAt: string | null;
}

export async function fetchProspectList(): Promise<ProspectItem[]> {
  const [ownersRes, restaurantsRes, subscriptionsRes] = await Promise.all([
    supabase.from("owners").select("id, email, phone, role, created_at").order("created_at", { ascending: false }),
    supabase.from("restaurants").select("id, name, slug, owner_id, is_demo, trial_end_date"),
    supabase.from("subscriptions").select("restaurant_id, status, plan, stripe_subscription_id, current_period_end, created_at"),
  ]);

  const owners = (ownersRes.data ?? []) as unknown as (DbOwner & { created_at: string })[];
  const restaurants = (restaurantsRes.data ?? []) as unknown as (DbRestaurant & { owner_id: string })[];
  const subs = (subscriptionsRes.data ?? []) as unknown as { restaurant_id: string; status: string; plan: string; stripe_subscription_id: string | null; current_period_end: string | null; created_at: string }[];

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
        subscriptionStatus: sub?.status ?? null,
        trialEndDate: resto?.trial_end_date ?? null,
        plan: sub?.plan ?? null,
        stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
        currentPeriodEnd: sub?.current_period_end ?? null,
        subCreatedAt: sub?.created_at ?? null,
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

// ── Prospects ──

export interface ProspectRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  business_type: string;
  account_status: string;
  created_at: string;
  image: string | null;
  menuItemCount: number;
}

export async function fetchAllProspects(): Promise<ProspectRow[]> {
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, city, business_type, account_status, created_at, image, is_demo")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const all = (restaurants ?? []) as unknown as (ProspectRow & { is_demo: boolean })[];
  const filtered = all.filter((r) => !r.is_demo);

  // Get menu item counts per restaurant
  const { data: counts } = await supabase
    .from("menu_items")
    .select("restaurant_id");
  const countMap = new Map<string, number>();
  for (const c of (counts ?? []) as unknown as { restaurant_id: string }[]) {
    countMap.set(c.restaurant_id, (countMap.get(c.restaurant_id) ?? 0) + 1);
  }

  return filtered.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    city: r.city,
    business_type: r.business_type ?? "restaurant",
    account_status: r.account_status ?? "active",
    created_at: r.created_at,
    image: r.image,
    menuItemCount: countMap.get(r.id) ?? 0,
  }));
}

export interface CreateProspectData {
  name: string;
  slug: string;
  address?: string;
  city?: string;
  restaurant_phone?: string;
  google_place_id?: string;
  rating?: number;
  website?: string;
  hours?: string;
  image?: string;
  business_type: string;
  primary_color?: string;
  owner_id: string;
  schedule?: any;
}

export async function createProspect(data: CreateProspectData): Promise<DbRestaurant> {
  const { data: result, error } = await supabase
    .from("restaurants")
    .insert({
      name: data.name,
      slug: data.slug,
      address: data.address ?? null,
      city: data.city ?? null,
      restaurant_phone: data.restaurant_phone ?? null,
      google_place_id: data.google_place_id ?? null,
      rating: data.rating ?? null,
      website: data.website ?? null,
      hours: data.hours ?? null,
      image: data.image ?? null,
      business_type: data.business_type,
      primary_color: data.primary_color ?? "#10B981",
      owner_id: data.owner_id,
      schedule: data.schedule ?? null,
      account_status: "prospect",
      subscription_status: "none",
      is_open: true,
      is_accepting_orders: true,
      estimated_time: "15-25 min",
      minimum_order: 0,
      categories: [],
    })
    .select()
    .single();
  if (error) throw error;
  return result as unknown as DbRestaurant;
}

// ── Acquisition Analytics ──

export interface AcquisitionStats {
  // Views
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  uniqueVisitors: number;
  uniqueSessions: number;
  // Breakdown
  viewsByPageType: { page_type: string; count: number }[];
  viewsBySide: { side: string; count: number }[];
  viewsByDevice: { device: string; count: number }[];
  viewsByLanguage: { language: string; count: number }[];
  // Top pages
  topPages: { page_path: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topUtmSources: { utm_source: string; count: number }[];
  // Per-day chart
  viewsPerDay: { date: string; count: number; unique_visitors: number }[];
}

export async function fetchAcquisitionStats(days: number = 30): Promise<AcquisitionStats> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Fetch all page views in the period
  const { data: views, error } = await supabase
    .from("page_views")
    .select("page_path, page_type, side, device, language, referrer, utm_source, visitor_id, session_id, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) throw error;
  const rows = views ?? [];

  const totalViews = rows.length;
  const viewsToday = rows.filter((r) => new Date(r.created_at) >= todayStart).length;
  const viewsThisWeek = rows.filter((r) => new Date(r.created_at) >= weekStart).length;
  const viewsThisMonth = rows.filter((r) => new Date(r.created_at) >= monthStart).length;
  const uniqueVisitors = new Set(rows.map((r) => r.visitor_id)).size;
  const uniqueSessions = new Set(rows.map((r) => r.session_id)).size;

  // Aggregate helpers
  function countBy<T extends string>(key: T) {
    const map = new Map<string, number>();
    for (const r of rows) {
      const val = (r as any)[key] || "unknown";
      map.set(val, (map.get(val) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([k, count]) => ({ [key]: k, count }) as any)
      .sort((a: any, b: any) => b.count - a.count);
  }

  // Views per day
  const dayMap = new Map<string, { count: number; visitors: Set<string> }>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    if (!dayMap.has(label)) dayMap.set(label, { count: 0, visitors: new Set() });
    const entry = dayMap.get(label)!;
    entry.count++;
    if (r.visitor_id) entry.visitors.add(r.visitor_id);
  }
  // Build array sorted by date
  const viewsPerDay: AcquisitionStats["viewsPerDay"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    const entry = dayMap.get(label);
    viewsPerDay.push({ date: label, count: entry?.count || 0, unique_visitors: entry?.visitors.size || 0 });
  }

  // Top pages (deduplicated by path)
  const pageMap = new Map<string, number>();
  for (const r of rows) {
    pageMap.set(r.page_path, (pageMap.get(r.page_path) || 0) + 1);
  }
  const topPages = Array.from(pageMap.entries())
    .map(([page_path, count]) => ({ page_path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top referrers (filter nulls)
  const refMap = new Map<string, number>();
  for (const r of rows) {
    if (r.referrer) refMap.set(r.referrer, (refMap.get(r.referrer) || 0) + 1);
  }
  const topReferrers = Array.from(refMap.entries())
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top UTM sources
  const utmMap = new Map<string, number>();
  for (const r of rows) {
    if (r.utm_source) utmMap.set(r.utm_source, (utmMap.get(r.utm_source) || 0) + 1);
  }
  const topUtmSources = Array.from(utmMap.entries())
    .map(([utm_source, count]) => ({ utm_source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalViews,
    viewsToday,
    viewsThisWeek,
    viewsThisMonth,
    uniqueVisitors,
    uniqueSessions,
    viewsByPageType: countBy("page_type"),
    viewsBySide: countBy("side"),
    viewsByDevice: countBy("device"),
    viewsByLanguage: countBy("language"),
    topPages,
    topReferrers,
    topUtmSources,
    viewsPerDay,
  };
}

/** Fetch live sessions: visitors active in the last 5 minutes */
export async function fetchLiveSessions(): Promise<{
  count: number;
  sessions: { visitor_id: string; page_path: string; device: string; language: string; side: string; created_at: string }[];
}> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("page_views")
    .select("visitor_id, page_path, device, language, side, created_at")
    .gte("created_at", fiveMinAgo)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];

  // Deduplicate by visitor_id (keep most recent)
  const seen = new Map<string, typeof rows[0]>();
  for (const r of rows) {
    if (r.visitor_id && !seen.has(r.visitor_id)) seen.set(r.visitor_id, r);
  }

  return {
    count: seen.size,
    sessions: Array.from(seen.values()),
  };
}

// ── Stock Photos Auto-Match ──

interface StockPhoto {
  id: string;
  keywords: string[];
  image_url: string;
}

export async function fetchStockPhotos(): Promise<StockPhoto[]> {
  const { data, error } = await supabase
    .from("stock_photos")
    .select("id, keywords, image_url")
    .not("image_url", "is", null);
  if (error) throw error;
  return (data ?? []) as unknown as StockPhoto[];
}

export function matchStockPhoto(itemName: string, itemCategory: string, stockPhotos: StockPhoto[]): StockPhoto | null {
  const nameLower = itemName.toLowerCase().trim();
  const catLower = (itemCategory || "").toLowerCase().trim();

  let bestMatch: StockPhoto | null = null;
  let bestScore = 0;

  for (const photo of stockPhotos) {
    let score = 0;
    const keywords = photo.keywords.map((k) => k.toLowerCase());

    for (const kw of keywords) {
      if (nameLower.includes(kw) && kw.length >= 3) score += 3;
      if (catLower.includes(kw) && kw.length >= 3) score += 1;
    }

    // Penalize if the photo category doesn't fit (e.g. tacos photo for a drink)
    const photoId = photo.id;
    if (photoId.startsWith("tacos") && !nameLower.includes("tacos")) score = Math.min(score, 2);
    if (photoId.startsWith("pizza") && !nameLower.includes("pizza")) score = Math.min(score, 2);

    if (score > bestScore && score >= 4) {
      bestScore = score;
      bestMatch = photo;
    }
  }
  return bestMatch;
}

export async function autoAssignStockPhotos(restaurantId: string): Promise<number> {
  const [stockPhotos, menuItems] = await Promise.all([
    fetchStockPhotos(),
    fetchAllMenuItems(restaurantId),
  ]);

  let assigned = 0;
  for (const item of menuItems) {
    if (item.image) continue; // Skip items that already have images
    const match = matchStockPhoto(item.name, item.category, stockPhotos);
    if (match) {
      await supabase
        .from("menu_items")
        .update({ image: match.image_url })
        .eq("id", item.id);
      assigned++;
    }
  }
  return assigned;
}
