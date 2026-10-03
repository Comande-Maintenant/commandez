// Local-only test: 100 isolated merchant subscriptions receive their own order.
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { RealtimeClient } from '@supabase/realtime-js';
import WebSocket from 'ws';
const secret = 'local-functional-jwt-secret-20261003-only-qa';
const rows = JSON.parse(await readFile(process.argv[2], 'utf8'));
if(rows.length !== 100) throw new Error('Exactly 100 local merchant fixtures required');
const uuid = label => {const h=createHash('md5').update(label).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
const token = sub => {const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const b=Buffer.from(JSON.stringify({sub,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${h}.${b}.${createHmac('sha256',secret).update(`${h}.${b}`).digest('base64url')}`;};
class LocalSocket extends WebSocket {constructor(url){super(url,{headers:{Host:'realtime-dev.localhost'}});}}
const clients=[];const received=new Map();const ready=[];const latencies=[];const started=new Map();let crossTenant=0;
try {
 for(const row of rows){
  const jwt=token(uuid(`scaleowner-${row.client_id}`));
  const client=new RealtimeClient('ws://127.0.0.1:55362/socket',{params:{apikey:jwt},accessToken:async()=>jwt,transport:LocalSocket,timeout:30000});clients.push(client);
  ready.push(new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Subscription ${row.client_id} timed out`)),35000);client.channel(`scale-${row.client_id}-${randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'orders',filter:`restaurant_id=eq.${row.restaurant_id}`},payload=>{if(payload.new.restaurant_id!==row.restaurant_id)crossTenant++;received.set(row.client_id,(received.get(row.client_id)||0)+1);if(started.has(row.client_id))latencies.push(performance.now()-started.get(row.client_id));}).subscribe((status,error)=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);reject(error||new Error(status));}});}));
 }
 await Promise.all(ready);
 const requests=rows.map(async row=>{started.set(row.client_id,performance.now());const response=await fetch('http://127.0.0.1:55361/rpc/place_order_once',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token(uuid(`scalecustomer-${row.client_id}`))}`},body:JSON.stringify({p_request_id:randomUUID(),p_order:{restaurant_id:row.restaurant_id,customer_name:'Local Realtime Customer',customer_phone:`06${String(row.client_id).padStart(8,'0')}`,order_type:'collect',items:[{menu_item_id:row.menu_id,name:row.name,quantity:1}],subtotal:12,total:12}}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`HTTP${response.status} ${await response.text()}`);return response.json();});
 const orders=await Promise.all(requests);
 const until=Date.now()+20000;while(received.size<100 && Date.now()<until)await new Promise(r=>setTimeout(r,50));
 if(received.size!==100||crossTenant||[...received.values()].some(n=>n!==1))throw new Error(JSON.stringify({receivedMerchants:received.size,crossTenant,duplicates:[...received.values()].filter(n=>n!==1)}));
 latencies.sort((a,b)=>a-b);
 console.log(JSON.stringify({scope:'isolated local PostgreSQL + PostgREST + Supabase Realtime, not production',subscriptions:100,orders:orders.length,receivedMerchants:received.size,crossTenant,duplicates:0,p50_delivery_ms:Math.round(latencies[49]),p95_delivery_ms:Math.round(latencies[94]),max_delivery_ms:Math.round(latencies[99])},null,2));
}finally{await Promise.allSettled(clients.map(c=>c.removeAllChannels()));clients.forEach(c=>c.disconnect());}
