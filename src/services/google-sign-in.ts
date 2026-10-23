import { supabase } from '@/integrations/supabase/client';
import { authRedirectUrl, isNative, openExternalUrl } from '@/lib/native';

export const googleSignInEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
export function safeAuthReturnPath(input: string | null | undefined): string | null {
  if (!input?.startsWith('/') || input.startsWith('//')) return null;
  if ([...input].some(character => character === '\\' || character.charCodeAt(0) <= 32)) return null;
  const destination = new URL(input, 'https://app.commandeici.com');
  if (destination.origin !== 'https://app.commandeici.com' || destination.pathname.startsWith('//')) return null;
  return destination.pathname + destination.search + destination.hash;
}

export async function signInWithGoogle(path: '/order' | '/profil' | '/inscription' | '/connexion', returnPath?: string | null) {
  const native = isNative();
  const target = safeAuthReturnPath(returnPath);
  const callbackPath = path === '/connexion' && target ? `${path}?${new URLSearchParams({ redirect: target })}` : path;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: authRedirectUrl(callbackPath), skipBrowserRedirect: native },
  });
  if (error) throw error;
  if (native) {
    if (!data.url) throw new Error('Google sign-in could not be opened');
    await openExternalUrl(data.url);
  }
}
