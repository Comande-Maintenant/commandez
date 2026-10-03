// Only the isolated local PostgREST service is accepted. No production writes.
import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:55361';
const secret = 'local-functional-jwt-secret-20261003-only-qa';
const catalog = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (catalog.length !== 100) throw new Error('Exactly 100 local fixtures are required');
const uuid = (label) => {
 const h = createHash('md5').update(label).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
const jwt = (sub) => {
 const head = Buffer.from(JSON.stringify({ alg:'HS256',typ:'JWT' })).toString('base64url');
 const body = Buffer.from(JSON.stringify({sub,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 return `${head}.${body}.${createHmac('sha256',secret).update(`${head}.${body}`).digest('base64url')}`;
};
async function submit(row) {
 const token = jwt(uuid(`scalecustomer-${row.client_id}`));
 const before = performance.now();
 const response = await fetch(`${base}/rpc/place_order_once`, { method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({p_request_id:uuid(`scale-http-request-${row.client_id}`),p_order:{restaurant_id:row.restaurant_id,customer_name:'Scale HTTP Customer',customer_phone:`06${String(row.client_id).padStart(8,'0')}`,customer_email:`scale-${row.client_id}@example.test`,order_type:'collect',items:[{menu_item_id:row.menu_id,name:row.name,quantity:1,custom_choices:null,supplements:null,sauces:null}],subtotal:12,total:12}}),signal:AbortSignal.timeout(30000)});
 const data = await response.json();
 if (!response.ok || !data.id) throw new Error(`${row.client_id}: ${response.status} ${JSON.stringify(data)}`);
 return {id:data.id,restaurant_id:data.restaurant_id,ms:performance.now()-before};
}
const first = await Promise.all(catalog.map(submit));
const retry = await Promise.all(catalog.map(submit));
if (first.some((row,i)=>row.id!==retry[i].id || row.restaurant_id!==catalog[i].restaurant_id)) throw new Error('Retry or tenant mismatch');
const values=first.map(x=>x.ms).sort((a,b)=>a-b);
console.log(JSON.stringify({scope:'isolated local HTTP PostgREST, not production',requests:100,retries:100,uniqueOrders:new Set(first.map(x=>x.id)).size,retrySameIds:true,p50_ms:Math.round(values[49]),p95_ms:Math.round(values[94]),max_ms:Math.round(values[99])},null,2));
