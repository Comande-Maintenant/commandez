import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>key})}));
import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {NewOrderAlert} from '@/components/dashboard/NewOrderAlert';
import type {DbOrder} from '@/types/database';
const order={id:'demo-local-alert',order_number:1,daily_number:1,customer_name:'Demo',order_type:'collect',total:6.5} as DbOrder;
afterEach(cleanup);
it('returns keyboard focus to the previous action when dismissed',async()=>{
 const view=render(<><button>receive</button><NewOrderAlert order={null} onClose={()=>{}} onOpenOrder={()=>{}}/></>);
 const receive=screen.getByRole('button',{name:'receive'});receive.focus();
 view.rerender(<><button>receive</button><NewOrderAlert order={order} onClose={()=>{}} onOpenOrder={()=>{}}/></>);
 expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
 view.rerender(<><button>receive</button><NewOrderAlert order={null} onClose={()=>{}} onOpenOrder={()=>{}}/></>);
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 expect(receive).toHaveFocus();
});
it('allows the detail sheet to take focus instead of stealing it back',async()=>{
 function Handoff(){const [open,setOpen]=useState(false);return <><button>receive</button><NewOrderAlert order={open?null:order} onClose={()=>{}} onOpenOrder={()=>setOpen(true)}/><Dialog open={open}><DialogContent><DialogTitle>Order detail</DialogTitle><button>prepare</button></DialogContent></Dialog></>;}
 render(<Handoff/>);fireEvent.click(screen.getByRole('button',{name:'cart.view'}));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 expect(screen.getByRole('dialog',{name:'Order detail'})).toContainElement(document.activeElement as HTMLElement);
});
