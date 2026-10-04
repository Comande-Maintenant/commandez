export function BrandLogo({compact=false}:{compact?:boolean}) {
 return <span className="inline-flex min-w-0 items-center gap-2">
  <img src="/images/brand/commandeici-mark.png" alt="" aria-hidden="true" width="40" height="40" className="h-10 w-10 shrink-0 object-contain"/>
  {!compact&&<span className="text-lg sm:text-xl font-black tracking-tight text-[#002D19]">Commande<span className="text-[#24851E]">ici</span></span>}
 </span>;
}
