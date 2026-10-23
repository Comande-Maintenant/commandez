import {useRef,type ReactNode} from 'react';
import {ArrowLeft,X} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {useLanguage} from '@/context/LanguageContext';

/** Every state keeps its exit outside the scrolling content. */
export function CommerceSheet({open,onClose,title,description,children,footer,returnFocus}: {
 open:boolean;onClose:()=>void;title:string;description:string;children:ReactNode;
 footer?:ReactNode;returnFocus:HTMLElement|null;
}) {
 const {t}=useLanguage();const back=useRef<HTMLButtonElement>(null);
 return <Sheet open={open} onOpenChange={value=>{if(!value)onClose();}}>
  <SheetContent showClose={false} className="flex h-[100dvh] w-full flex-col gap-0 break-words p-0 sm:max-w-md motion-reduce:animate-none motion-reduce:transition-none"
   style={{paddingTop:'env(safe-area-inset-top,0px)',paddingBottom:'env(safe-area-inset-bottom,0px)'}}
   onOpenAutoFocus={event=>{event.preventDefault();back.current?.focus();}}
   onCloseAutoFocus={event=>{event.preventDefault();const target=returnFocus?.isConnected?returnFocus:document.getElementById('view-client');target?.focus();}}>
   <header className="shrink-0 border-b border-slate-100 px-4 pb-3">
    <div className="flex items-center justify-between gap-2">
     <button ref={back} type="button" onClick={onClose} className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true"/>{t('nav.back')}</button>
     <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-slate-100"><X className="h-5 w-5" aria-hidden="true"/></button>
    </div>
    <SheetTitle className="text-start text-xl">{title}</SheetTitle>
    <SheetDescription className="mt-1 text-start text-sm leading-relaxed">{description}</SheetDescription>
   </header>
   <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
   {footer&&<footer className="shrink-0 border-t border-slate-100 bg-white p-4">{footer}</footer>}
  </SheetContent>
 </Sheet>;
}
