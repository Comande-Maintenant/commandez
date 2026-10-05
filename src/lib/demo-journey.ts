import type {DbOrder} from '@/types/database';
import {isLocalDemoOrder} from '@/lib/demo-order';
export type DemoStage = 'start'|'received'|'preparing'|'ready'|'done';
export function demoJourney(restaurantId: string, orders: DbOrder[]): {stage:DemoStage;order?:DbOrder} {
  const order = orders.filter(order => order.restaurant_id === restaurantId && isLocalDemoOrder(order) && ['new','preparing','ready','done'].includes(order.status))
    .sort((a,b) => b.created_at.localeCompare(a.created_at) || b.order_number-a.order_number)[0];
  if (!order) return {stage:'start'};
  return {stage:order.status === 'new'?'received':order.status as Exclude<DemoStage,'start'|'received'>,order};
}
