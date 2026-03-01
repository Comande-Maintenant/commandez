import { supabase } from '@/integrations/supabase/client';
import type { GooglePlaceResult } from '@/types/onboarding';

async function invokeGooglePlaces(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('google-places', { body });

  if (error) {
    // Log full error for debugging
    console.error('[google-places] Edge function error:', {
      message: error.message,
      name: error.name,
      context: (error as any).context,
    });
    throw new Error(error.message || 'Edge function error');
  }

  // Check if data itself contains an error (edge function returned 500)
  if (data?.error) {
    console.error('[google-places] API error:', data.error);
    throw new Error(data.error);
  }

  return data;
}

export async function searchPlaces(query: string): Promise<GooglePlaceResult[]> {
  const data = await invokeGooglePlaces({ action: 'search', query });
  return data?.results ?? [];
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlaceResult> {
  const data = await invokeGooglePlaces({ action: 'details', placeId });
  return data?.result;
}

export async function searchNearby(lat: number, lng: number): Promise<GooglePlaceResult[]> {
  const data = await invokeGooglePlaces({ action: 'nearby', lat, lng });
  return data?.results ?? [];
}
