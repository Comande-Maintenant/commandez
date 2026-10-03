import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';

// Old billing URLs stay usable on web and iOS while merchant access is free.
export function FreeAccessRedirect({ title = 'commerce.free_title', description = 'commerce.free_desc' }: { title?: string; description?: string }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    async function openRestaurant() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) { navigate('/connexion', { replace: true }); return; }
        const { data: restaurant, error } = await supabase.from('restaurants')
          .select('slug').eq('owner_id', user.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!active) return;
        if (error) throw error;
        navigate(restaurant?.slug ? `/admin/${encodeURIComponent(restaurant.slug)}` : '/inscription', { replace: true });
      } catch {
        if (active) setFailed(true);
      }
    }
    openRestaurant();
    return () => { active = false; };
  }, [navigate, attempt]);

  return <main className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="max-w-sm text-center space-y-4">
      <h1 className="text-xl font-semibold text-foreground">{t(title)}</h1>
      <p className="text-sm text-muted-foreground">{t(description)}</p>
      {failed ? <>
        <p role="alert" className="text-sm text-destructive">{t('commerce.load_error')}</p>
        <Button onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</Button>
      </> : <>
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p role="status" className="text-sm text-muted-foreground">{t('commerce.redirect')}</p>
      </>}
    </div>
  </main>;
}
