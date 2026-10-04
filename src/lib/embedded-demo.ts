import { Capacitor } from '@capacitor/core';
import snapshot from './embedded-demo-catalogue.json';
import type { DbMenuItem, DbOrder, DbRestaurant } from '@/types/database';
import type { UniversalCustomizationData } from '@/types/customization';
import { createDemoOrder } from './demo-order';
import { readDemoOrders, storeDemoOrders } from './demo-order-store';

// Exact local identities keep simulated data out of real merchant requests.
export const embeddedDemoId = 'demo-restaurant-antalya';
export const embeddedDemoSlug = 'antalya-kebab-moneteau';
export const isEmbeddedDemo = (id: string | null | undefined) => Capacitor.isNativePlatform() && id === embeddedDemoId;
export const isEmbeddedDemoSlug = (slug: string) => Capacitor.isNativePlatform() && ['demo', embeddedDemoSlug].includes(slug);
export const isEmbeddedDemoOrder = (id: string) => Capacitor.isNativePlatform() && id.startsWith('demo-local-');
export function isEmbeddedDemoPath(path: string, cartRestaurantId?: string | null): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  if (['/demo', '/decouvrir', '/demo/epicerie', '/demo/fleuriste', '/admin/demo', '/' + embeddedDemoSlug].includes(path) || path.startsWith('/suivi/demo-local-')) return true;
  if (path !== '/order') return false;
  if (cartRestaurantId !== undefined) return isEmbeddedDemo(cartRestaurantId);
  try {
    const raw = localStorage.getItem('resto-order-cart');
    return Boolean(raw && raw.length <= 120000 && JSON.parse(raw).restaurantId === embeddedDemoId);
  } catch { return false; }
}
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const embeddedRestaurant = () => copy(snapshot.restaurant) as DbRestaurant;
export const embeddedMenu = () => copy(snapshot.menu) as DbMenuItem[];
export const embeddedCustomization = () => copy(snapshot.customization) as UniversalCustomizationData;

const requests = new Map<string, string>();
export function embeddedOrders(): DbOrder[] {
  return readDemoOrders(embeddedDemoId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(copy);
}
export function createEmbeddedOrder(payload: {
  request_id?: string; restaurant_id: string; customer_name: string; order_type: string;
  items: unknown; subtotal: number; total: number; notes?: string; pickup_time?: string | null;
  covers?: number | null; payment_method?: string; estimated_ready_at?: string;
}): DbOrder {
  if (!isEmbeddedDemo(payload.restaurant_id)) throw new Error('Unknown demonstration');
  if (typeof payload.customer_name !== 'string' || payload.customer_name.length > 120 ||
      !Array.isArray(payload.items) || payload.items.length > 30 ||
      !payload.items.every(item => item && typeof item.name === 'string' && item.name.length <= 160 && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100) ||
      !Number.isFinite(payload.total) || payload.total < 0 || !Number.isFinite(payload.subtotal) || payload.subtotal < 0 ||
      (payload.notes?.length ?? 0) > 3000) throw new Error('Invalid demonstration order');
  const orders = embeddedOrders();
  const existing = payload.request_id && orders.find(order => order.id === requests.get(payload.request_id!));
  if (existing) return existing;
  const next = Math.max(0, ...orders.map(order => order.order_number)) + 1;
  const order: DbOrder = {
    ...createDemoOrder(embeddedDemoId, next, { customer: payload.customer_name, notes: payload.notes || '' }),
    items: copy(payload.items), subtotal: payload.subtotal, total: payload.total,
    order_type: payload.order_type, pickup_time: payload.pickup_time || null,
    covers: payload.covers ?? null, payment_method: payload.payment_method || null,
    estimated_ready_at: payload.estimated_ready_at || null,
  };
  if (JSON.stringify(order).length > 120000) throw new Error('Demonstration order is too large');
  const updated = [order, ...orders].slice(0, 20);
  while (JSON.stringify(updated).length > 120000) updated.pop();
  storeDemoOrders(embeddedDemoId, updated);
  if (payload.request_id) requests.set(payload.request_id, order.id);
  for (const [key, id] of requests) if (!updated.some(order => order.id === id)) requests.delete(key);
  return copy(order);
}
export function embeddedTrackedOrder(id: string) {
  const order = embeddedOrders().find(order => order.id === id);
  if (!order) return null;
  return { ...order, restaurant: { name: snapshot.restaurant.name, slug: embeddedDemoSlug, primary_color: snapshot.restaurant.primary_color, phone: '', is_demo: true } };
}
