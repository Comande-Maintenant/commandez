import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

export function EmailConfirmation({ email, redirect, onChangeEmail }: { email: string; redirect: string; onChangeEmail: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [resendAfter, setResendAfter] = useState(0);
  async function resend() {
    if (Date.now() < resendAfter) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirect } });
      setMessage(error ? t('auth.confirm.resend_error') : t('auth.confirm.resent'));
      setResendAfter(Date.now() + 60000);
    } catch {
      setMessage(t('auth.confirm.resend_error'));
    } finally {
      setBusy(false);
    }
  }
  return <div className="space-y-4" role="status">
    <h2 className="text-xl font-bold">{t('auth.confirm.title')}</h2>
    <p className="text-sm text-muted-foreground">{t('auth.confirm.description', { email })}</p>
    <p className="text-sm text-muted-foreground">{t('auth.confirm.spam')}</p>
    <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={resend}>{t('auth.confirm.resend')}</Button>
    {message && <p className="text-sm">{message}</p>}
    <button type="button" className="text-sm underline" onClick={onChangeEmail}>{t('auth.confirm.change_email')}</button>
  </div>;
}
