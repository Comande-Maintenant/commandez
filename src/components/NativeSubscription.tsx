import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function NativeSubscription() {
  const { t } = useLanguage();
  return (
    <main className="max-w-lg mx-auto px-5 py-8 space-y-6">
      <Button variant="ghost" asChild><Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />{t('auth.signup.back')}</Link></Button>
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-3">
        <Check className="h-8 w-8 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold">{t('native.free.title')}</h1>
        <p className="text-muted-foreground">{t('native.free.description')}</p>
      </div>
    </main>
  );
}
