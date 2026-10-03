import { suspendNativePushBeforeSignOut } from '@/services/native-push-client';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function DeleteAccountButton() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (confirmation !== 'DELETE' || busy) return;
    setBusy(true); setError('');
    try {
      const { data: before, error: beforeError } = await supabase.auth.getUser();
      if (beforeError || !before.user) throw new Error('Session unavailable');
      const leavingUserId = before.user.id;
      await suspendNativePushBeforeSignOut();
      const { data: current, error: currentError } = await supabase.auth.getUser();
      if (currentError || current.user?.id !== leavingUserId) {
        setConfirmation(''); throw new Error('Account changed');
      }
      const { data, error: deletionError } = await supabase.rpc('delete_own_account' as never, { p_confirmation: confirmation } as never);
      if (deletionError) {
        setError(deletionError.message.includes('cancel_subscription') ? t('account.cancel_first') : t('client.delete_error'));
        return;
      }
      if (!(data as { deleted?: boolean })?.deleted) throw new Error('Deletion unconfirmed');
      const { data: after, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (after.session?.user.id && after.session.user.id !== leavingUserId) {
        setConfirmation(''); throw new Error('Account changed');
      }
      await supabase.auth.signOut();
      for (const key of ['cm_customer','commandeici_onboarding_draft','commandeici_creation_key']) {
        try { localStorage.removeItem(key); } catch { /* deletion does not depend on preferences */ }
      }
      toast.success(t('account.deleted'));
      navigate('/', { replace: true });
    } catch {
      setError(t('client.delete_error'));
    } finally {
      setBusy(false);
    }
  }
  return <AlertDialog>
    <AlertDialogTrigger asChild><Button variant="outline" className="w-full text-destructive">{t('account.delete')}</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t('account.delete')}</AlertDialogTitle><AlertDialogDescription>{t('account.delete_note')}</AlertDialogDescription></AlertDialogHeader>
      <Input aria-label={t('account.confirm')} placeholder="DELETE" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel><Button variant="destructive" disabled={busy || confirmation !== 'DELETE'} onClick={remove}>{t('account.delete')}</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
