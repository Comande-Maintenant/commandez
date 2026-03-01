import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Cross-subdomain cookie storage for commandeici.com + app.commandeici.com
const cookieStorage = {
  getItem: (key: string): string | null => {
    const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },
  setItem: (key: string, value: string): void => {
    document.cookie = `${key}=${encodeURIComponent(value)}; domain=.commandeici.com; path=/; secure; samesite=lax; max-age=2592000`;
  },
  removeItem: (key: string): void => {
    document.cookie = `${key}=; domain=.commandeici.com; path=/; max-age=0`;
  },
};

// Use cookie storage on commandeici.com domain, localStorage for local dev
const isCommandeiciDomain = typeof window !== 'undefined' && window.location.hostname.endsWith('commandeici.com');
const storage = isCommandeiciDomain ? cookieStorage : localStorage;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'commandeici_auth',
  },
});
