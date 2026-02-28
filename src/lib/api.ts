import { supabase } from "@/integrations/supabase/client";
import type { DbRestaurant, DbMenuItem, DbOrder } from "@/types/database";

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
  customer_address?: string;
  order_type: string;
  source?: string;
  covers?: number | null;
  items: any;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes?: string;
  client_ip?: string | null;
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
  const { error } = await supabase
    .from("orders")
    .update({ status })
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
