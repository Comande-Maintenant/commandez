import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGES } from "@/i18n";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const LanguageSelector = () => {
  const { language, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(240);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const updateHeight = () => {
      const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const nav = document.querySelector<HTMLElement>('[data-dashboard-nav]')?.getBoundingClientRect();
      const bottom = nav && nav.height > 0 ? Math.min(viewportBottom, nav.top) : viewportBottom;
      setAvailableHeight(Math.max(44, bottom - (ref.current?.getBoundingClientRect().bottom ?? 0) - 12));
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.addEventListener('scroll', updateHeight, true);
    viewport?.addEventListener('resize', updateHeight);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('scroll', updateHeight, true);
      viewport?.removeEventListener('resize', updateHeight);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={current.name}
        aria-expanded={open}
        className="flex items-center gap-1.5 min-h-11 min-w-11 px-2.5 py-2 rounded-xl bg-white text-slate-900 shadow-sm text-xs font-medium hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{current.code.toUpperCase()}</span>
      </button>
      </PopoverTrigger>

        <PopoverContent align="end" collisionPadding={12} dir={language === 'ar' ? 'rtl' : 'ltr'} aria-label={current.name} className="w-44 bg-card border border-border rounded-xl p-0 shadow-lg overflow-y-auto overscroll-contain" style={{maxHeight:`max(44px, min(24rem, calc(${availableHeight}px - env(safe-area-inset-bottom, 0px))))`}}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                changeLanguage(lang.code);
                setOpen(false);
              }}
              className={`w-full min-h-11 flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                language === lang.code
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <span className="w-7 text-xs font-semibold">{lang.code.toUpperCase()}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};
