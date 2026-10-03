import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDashboardAuth(isDemo: boolean) {
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    setAuthUserId(null); setAuthError(null); setAuthChecked(isDemo);
    if (isDemo) return;
    let disposed = false;
    let revision = 0;
    const apply = (id: string | null, error: string | null) => {
      setAuthUserId(id); setAuthError(error); setAuthChecked(true);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed || event === 'INITIAL_SESSION') return;
      revision++;
      apply(session?.user.id ?? null, session?.user ? null : 'not_logged_in');
    });
    const startedRevision = revision;
    supabase.auth.getUser().then(({ data, error }) => {
      if (disposed || revision !== startedRevision) return;
      apply(error ? null : data.user?.id ?? null, error ? 'unavailable' : data.user ? null : 'not_logged_in');
    }).catch(() => {
      if (!disposed && revision === startedRevision) apply(null, 'unavailable');
    });
    return () => { disposed = true; subscription.unsubscribe(); };
  }, [isDemo]);
  return { authChecked, authError, authUserId };
}
