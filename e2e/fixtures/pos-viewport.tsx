import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from '../../src/context/LanguageContext';
import {POSBoissons} from '../../src/components/dashboard/pos/POSBoissons';
import {POSOrderType} from '../../src/components/dashboard/pos/POSOrderType';
import type {DbMenuItem} from '../../src/types/database';
import type {POSDrinkItem} from '../../src/types/pos';
import '../../src/index.css';
const menu=Array.from({length:12},(_,index)=>({id:String(index),name:index%2?'Coca-Cola 33 cl':'Eau',price:2,category:'Boissons',image:null} as DbMenuItem));
function App(){const [drinks,setDrinks]=useState<POSDrinkItem[]>([]);const [done,setDone]=useState(false);const [type,setType]=useState(false);return <LanguageProvider><header data-dashboard-header style={{height:100,background:'#fff'}}>CommandeIci</header><main style={{padding:16}}>{done?<p role="status">Étape suivante</p>:type?<POSOrderType onSelect={()=>setDone(true)}/>:<POSBoissons drinks={drinks} menuItems={menu} onUpdateDrinks={setDrinks} onNext={()=>setDone(true)} onBack={()=>setType(true)}/>}</main><nav data-dashboard-nav style={{height:56,paddingBottom:'env(safe-area-inset-bottom)',position:'fixed',bottom:0,left:0,right:0,background:'#fff'}}>Cuisine · Caisse · Gérer</nav></LanguageProvider>;}
createRoot(document.getElementById('root')!).render(<App/>);
