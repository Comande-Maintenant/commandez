import { Check } from 'lucide-react';
interface StepIndicatorProps { steps: number; current: number; labels: string[]; }
export function StepIndicator({ steps, current, labels }: StepIndicatorProps) {
 return <div className="mx-auto w-full max-w-3xl px-4 py-4">
  <ol className="flex items-start gap-2">
   {Array.from({ length: steps }, (_, index) => {
    const number=index+1, active=number===current, done=number<current;
    return <li key={number} aria-label={labels[index]} aria-current={active?'step':undefined} className="flex min-w-0 flex-1 flex-col items-center gap-2">
     <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done?'bg-primary text-white':active?'bg-foreground text-background':'bg-muted text-muted-foreground'}`}>
      {done?<Check className="h-4 w-4"/>:number}
     </span>
     <span className={`hidden w-full break-words text-center text-xs leading-snug sm:block ${active?'font-medium text-foreground':'text-muted-foreground'}`}>{labels[index]}</span>
    </li>;
   })}
  </ol>
  <p className="mt-3 break-words text-center text-sm font-medium text-foreground sm:hidden">{labels[current-1]}</p>
 </div>;
}
