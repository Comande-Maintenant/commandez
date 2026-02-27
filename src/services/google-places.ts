import { supabase } from '@/integrations/supabase/client';
import type { GooglePlaceResult } from '@/types/onboarding';

export async function searchPlaces(query: string): Promise<GooglePlaceResult[]> {
  const { data, error } = await supabase.functions.invoke('google-places', {
    body: { action: 'search', query },
  });
  if (error) throw error;
  return data?.results ?? [];
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlaceResult> {
  const { data, error } = await supabase.functions.invoke('google-places', {
    body: { action: 'details', placeId },
  });
  if (error) throw error;
  return data?.result;
}

export async function searchNearby(lat: number, lng: number): Promise<GooglePlaceResult[]> {
  const { data, error } = await supabase.functions.invoke('google-places', {
    body: { action: 'nearby', lat, lng },
  });
  if (error) throw error;
  return data?.results ?? [];
}
