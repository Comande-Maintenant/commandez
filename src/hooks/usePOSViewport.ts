import { useLayoutEffect, useRef } from 'react';
// The dashboard header can contain a demo banner and optional notices. Measure
// this screen's real top, rather than assuming the full viewport is available.
export function usePOSViewport() {
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const update=()=>{
      const element=ref.current;
      if(!element)return;
      const viewport=window.visualViewport?.height ?? window.innerHeight;
      const top=Math.max(0,element.getBoundingClientRect().top);
      const nav=document.querySelector('[data-dashboard-nav]');
      const navHeight=nav?.getBoundingClientRect().height ?? 0;
      element.style.height=`${Math.max(160,viewport-top-navHeight-16)}px`;
    };
    update();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);
    const header=document.querySelector('[data-dashboard-header]');
    const nav=document.querySelector('[data-dashboard-nav]');
    if(header)observer?.observe(header);
    if(nav)observer?.observe(nav);
    window.addEventListener('resize',update);
    window.visualViewport?.addEventListener('resize',update);
    return()=>{observer?.disconnect();window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);};
  },[]);
  return ref;
}
