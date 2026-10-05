import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import {clearEntryRole, rememberEntryRole} from '@/lib/entry-preferences';
import {BrandLogo} from '@/components/BrandLogo';

const MerchantEntryPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(true);

  // Auto-redirect if restaurateur is already logged in
  useEffect(() => {
    let disposed = false;
    document.title = t('home.page_title');

    supabase.auth.getUser().then(async ({ data }) => {
      if (disposed) return;
      if (data.user) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("slug")
          .eq("owner_id", data.user.id)
          .limit(1);
        if (disposed) return;

        if (restaurants && restaurants.length > 0) {
          navigate(`/admin/${restaurants[0].slug}`, { replace: true });
          return;
        }
      }
      setChecking(false);
    }).catch(() => { if (!disposed) setChecking(false); });
    return () => { disposed = true; };
  }, [navigate, t]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto px-5 min-h-16 py-2 flex flex-wrap items-center justify-between gap-3">
          <a href="https://commandeici.com" aria-label="commandeici"><BrandLogo/></a>
          <div className="flex flex-wrap justify-end gap-1"><Button variant="ghost" className="min-h-12 rounded-xl text-sm px-2" onClick={() => { rememberEntryRole("client"); navigate("/espace/client"); }}>{t("entry.switch_client")}</Button><Button variant="ghost" className="min-h-12 rounded-xl text-sm px-2" onClick={() => navigate("/connexion")}>{t('home.login')}</Button></div>
        </div>
      </header>
      <nav className="w-full max-w-5xl mx-auto px-5"><Button variant="ghost" className="min-h-12 text-sm px-0 gap-2" onClick={() => { clearEntryRole(); navigate("/", { state: { chooseRole: true } }); }}><ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />{t("entry.change_path")}</Button></nav>
      <main className="flex-1 w-full max-w-5xl mx-auto px-5 pt-6 pb-8 sm:py-12 grid md:grid-cols-2 md:items-center gap-6 sm:gap-10">
        <div className="order-2 md:order-1">
          {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label={t('common.loading')} />}
          <h1 className="text-[30px] sm:text-4xl leading-tight font-bold tracking-tight text-slate-900 max-w-lg">{t('journey.home_title')}</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 max-w-md">{t('entry.pro_pickup')}</p><p className="mt-2 text-sm text-slate-600">{t('entry.no_delivery')}</p>
          <div className="mt-6 space-y-3">
            <Button data-primary-action="demo" onClick={() => navigate("/decouvrir")} className="w-full h-auto min-h-12 py-3 whitespace-normal text-start rounded-2xl bg-primary hover:bg-primary/90 text-base font-semibold justify-between px-5">{t('journey.home_demo')}<ArrowRight className="h-5 w-5 shrink-0 rtl:rotate-180" aria-hidden="true"/></Button>
            <Button variant="outline" onClick={() => navigate("/inscription")} className="w-full h-auto min-h-12 py-3 whitespace-normal rounded-2xl text-base font-semibold border-slate-200">{t('home.create_free')}</Button>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true"/>{t('journey.home_free')}</p>
        </div>
        <div className="order-1 md:order-2 relative overflow-hidden rounded-3xl bg-slate-100">
          <img src="/images/menu/kebab.webp" alt={t('journey.home_photo')} width="480" height="480" loading="eager" className="w-full h-[180px] sm:h-[280px] md:h-[430px] object-cover"/>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pt-10 pb-4 text-white"><p className="text-sm font-semibold">{t('demo.page_title')}</p><p className="text-xs mt-1 text-white/90">{t('menu.illustration')}</p></div>
        </div>
      </main>
      <footer className="w-full max-w-5xl mx-auto flex flex-wrap justify-between gap-3 px-5 pb-6 text-xs text-slate-500"><a className="min-h-11 flex items-center underline underline-offset-4" href="mailto:contact@commandeici.com">contact@commandeici.com</a><a className="min-h-11 flex items-center underline underline-offset-4" href="https://commandeici.com">{t('home.back_to_site')}</a></footer>
    </div>
  );
};
export default MerchantEntryPage;
