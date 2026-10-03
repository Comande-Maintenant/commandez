import { supabase } from '@/integrations/supabase/client';
import { authRedirectUrl, isNative, openExternalUrl } from '@/lib/native';

export const googleSignInEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
export async function signInWithGoogle(path: '/order' | '/profil' | '/inscription' | '/connexion') {
  const native = isNative();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: authRedirectUrl(path), skipBrowserRedirect: native },
  });
  if (error) throw error;
  if (native) {
    if (!data.url) throw new Error('Google sign-in could not be opened');
    await openExternalUrl(data.url);
  }
}
