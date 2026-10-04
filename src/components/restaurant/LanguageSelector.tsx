import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGES } from "@/i18n";

export const LanguageSelector = () => {
  const { language, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(240);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={current.name}
        aria-expanded={open}
        className="flex items-center gap-1.5 min-h-11 min-w-11 px-2.5 py-2 rounded-xl text-xs font-medium hover:bg-secondary transition-colors"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-foreground">{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute top-full end-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-lg overflow-y-auto overscroll-contain z-50 animate-in fade-in slide-in-from-top-2 duration-150" style={{maxHeight:`max(44px, min(24rem, calc(${availableHeight}px - env(safe-area-inset-bottom, 0px))))`}}>
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
        </div>
      )}
    </div>
  );
};
