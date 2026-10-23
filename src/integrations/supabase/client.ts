import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isNative, nativeSessionStorage } from '@/lib/native';
import { cookieSessionStorage } from '@/lib/cookie-session-storage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Use cookie storage on commandeici.com domain, localStorage for local dev
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isCommandeiciDomain = hostname === 'commandeici.com' || hostname.endsWith('.commandeici.com');
const storage = isNative() ? nativeSessionStorage : isCommandeiciDomain ? cookieSessionStorage : localStorage;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'commandeici_auth',
    flowType: isNative() ? 'pkce' : 'implicit',
  },
});
