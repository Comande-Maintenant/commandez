import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from '../../src/context/LanguageContext';
import {POSAddItemModal} from '../../src/components/dashboard/pos/POSAddItemModal';
import {MenuImportModal} from '../../src/components/dashboard/MenuImportModal';
import {NewOrderAlert} from '../../src/components/dashboard/NewOrderAlert';
import type {DbMenuItem,DbOrder,DbRestaurant} from '../../src/types/database';
import '../../src/index.css';
const order={id:'fixture-local-order',order_number:1,status:'ready',total:13,customer_name:'Client de démonstration',items:[],order_type:'collect'} as DbOrder;
const menu=Array.from({length:40},(_,index)=>({id:'fixture-drink-'+index,name:'Boisson de démonstration '+index,price:2,category:'Boissons',enabled:true} as DbMenuItem));
export function App(){const [panel,setPanel]=useState('');return <LanguageProvider><main><button onClick={()=>setPanel('pos')}>Ouvrir compléments</button><button onClick={()=>setPanel('import')}>Ouvrir import</button><button onClick={()=>setPanel('alert')}>Ouvrir notification</button></main><POSAddItemModal open={panel==='pos'} onClose={()=>setPanel('')} order={order} menuItems={menu} config={null} onUpdated={()=>{}}/><MenuImportModal open={panel==='import'} onOpenChange={open=>{if(!open)setPanel('');}} restaurant={{id:'fixture-restaurant',categories:[]} as unknown as DbRestaurant} existingItems={[]} onImportComplete={()=>{}}/><NewOrderAlert order={panel==='alert'?order:null} onClose={()=>setPanel('')} onOpenOrder={()=>setPanel('')}/></LanguageProvider>;}
createRoot(document.getElementById('root')!).render(<App/>);
