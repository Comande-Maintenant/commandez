import type { DbOrder } from '@/types/database';
import { randomUuid } from '@/lib/uuid';
export const isLocalDemoOrder = (order: Pick<DbOrder, 'id' | 'is_test'>) => order.is_test === true && order.id.startsWith('demo-local-');
export function createDemoOrder(restaurantId: string, number: number, labels: {customer:string;notes:string}): DbOrder {
  const now=new Date().toISOString();
  return {id:`demo-local-${randomUuid()}`,restaurant_id:restaurantId,order_number:number,daily_number:number,
    payment_method:null,customer_name:labels.customer,customer_phone:'',customer_email:'',order_type:'collect',source:'demo',covers:1,status:'new',
    items:[{name:'Kebab',quantity:1,price:6.5,total:6.5,customizations:{garniture:'Complet',sauces:['Blanche']}}],subtotal:6.5,total:6.5,notes:labels.notes,client_ip:null,pickup_time:null,accepted_at:null,ready_at:null,completed_at:null,estimated_ready_at:null,created_at:now,updated_at:now,is_test:true};
}
