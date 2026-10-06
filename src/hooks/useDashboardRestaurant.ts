import { useEffect, useState } from 'react';
import { fetchDemoRestaurant, fetchMerchantRestaurantBySlug } from '@/lib/api';
import type { DbRestaurant } from '@/types/database';

export function useDashboardRestaurant(slug: string | undefined, isDemo: boolean) {
  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setRestaurant(null); setLoading(Boolean(slug)); setError(false);
    if (!slug) return;
    void (isDemo ? fetchDemoRestaurant(slug) : fetchMerchantRestaurantBySlug(slug)).then(result => {
      if (!disposed) { setRestaurant(result); setLoading(false); }
    }).catch(() => {
      if (!disposed) { setError(true); setLoading(false); }
    });
    return () => { disposed = true; };
  }, [slug, isDemo, attempt]);
  return { restaurant, setRestaurant, loading, error, retry: () => setAttempt(previous => previous + 1) };
}
