import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>key==='common.close'?'Fermer':key})}));
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetTitle} from '@/components/ui/sheet';
afterEach(cleanup);
for(const type of ['dialog','sheet'])it(`provides a localized 44px exit for a ${type} with empty content`,()=>{
 const changed=vi.fn();
 render(type==='dialog'?<Dialog open onOpenChange={changed}><DialogContent aria-describedby={undefined}><DialogTitle>Vide</DialogTitle></DialogContent></Dialog>:<Sheet open onOpenChange={changed}><SheetContent aria-describedby={undefined}><SheetTitle>Vide</SheetTitle></SheetContent></Sheet>);
 const close=screen.getByRole('button',{name:'Fermer'});expect(close.className).toContain('min-h-11');expect(close.className).toContain('min-w-11');fireEvent.click(close);expect(changed).toHaveBeenCalledWith(false);
});
