import type { DbOrder } from '@/types/database';
import { isLocalDemoOrder } from './demo-order';
const prefix='commandeici:demo-orders:';
const ttl=6*60*60*1000;
const maxOrders=20;
const maxBytes=120000;
const memory = new Map<string, { json: string; fallback: boolean }>();
function validOrder(value: unknown, restaurantId: string): value is DbOrder {
  if(!value || typeof value!=='object')return false;
  const order=value as DbOrder;
  const created=Date.parse(order.created_at);
  return typeof order.id==='string' && isLocalDemoOrder(order) && order.restaurant_id===restaurantId && order.source==='demo'
    && ['new','preparing','ready','done'].includes(order.status)
    && Number.isFinite(created) && created<=Date.now()+60000 && created>Date.now()-ttl
    && Number.isInteger(order.order_number) && order.order_number>0
    && (order.daily_number===null || Number.isInteger(order.daily_number))
    && typeof order.customer_name==='string' && order.customer_name.length<=120
    && typeof order.notes==='string' && order.notes.length<=3000
    && typeof order.total==='number' && Number.isFinite(order.total) && order.total>=0
    && ['collect','a_emporter','sur_place','telephone'].includes(order.order_type)
    && Array.isArray(order.items) && order.items.length<=30
    && order.items.every(item=>item && typeof item.name==='string' && item.name.length<=160 && Number.isInteger(item.quantity) && item.quantity>0 && item.quantity<=100);
}
export function readDemoOrders(restaurantId: string): DbOrder[] {
  let raw: string | null;
  try {
    raw=memory.get(restaurantId)?.fallback ? memory.get(restaurantId)!.json : sessionStorage.getItem(prefix+restaurantId);
  } catch { raw=memory.get(restaurantId)?.json ?? null; }
  try {
    if(!raw || raw.length>maxBytes)return [];
    const parsed:unknown=JSON.parse(raw);
    if(!Array.isArray(parsed))return [];
    return parsed.filter(order=>validOrder(order,restaurantId)).slice(0,maxOrders);
  } catch { return []; }
}
export function storeDemoOrders(restaurantId: string, orders: DbOrder[]): void {
  try {
    const local=orders.filter(order=>validOrder(order,restaurantId)).slice(0,maxOrders).map(order=>({...order,customer_phone:'',customer_email:'',client_ip:null}));
    const json=JSON.stringify(local);
    if(json.length<=maxBytes) {
      let fallback=false;
      try {sessionStorage.setItem(prefix+restaurantId,json);} catch {fallback=true;}
      memory.delete(restaurantId);memory.set(restaurantId,{json,fallback});
      while(memory.size>5)memory.delete(memory.keys().next().value!);
    }
  } catch { /* A blocked/full storage must not break the live demo. */ }
}
