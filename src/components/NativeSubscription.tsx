import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
export function NativeSubscription() {
  const { t } = useLanguage();
  return <main className="max-w-lg mx-auto p-6 space-y-4"><h1 className="text-xl font-bold">{t('subscription.monthly')}</h1><p>{t('native.subscription')}</p><Link to="/" className="underline">{t('auth.signup.back')}</Link></main>;
}
