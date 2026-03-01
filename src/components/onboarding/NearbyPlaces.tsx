import { useState } from 'react';
import { MapPin, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchNearby } from '@/services/google-places';
import type { GooglePlaceResult } from '@/types/onboarding';

interface NearbyPlacesProps {
  onSelect: (place: GooglePlaceResult) => void;
}

export function NearbyPlaces({ onSelect }: NearbyPlacesProps) {
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('La geolocalisation n\'est pas supportee par votre navigateur.');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const places = await searchNearby(pos.coords.latitude, pos.coords.longitude);
          if (places.length === 0) {
            setError('Aucun restaurant trouve a proximite. Essayez la recherche par nom.');
          } else {
            setResults(places);
          }
        } catch (err: any) {
          console.error('[NearbyPlaces] Search error:', err);
          const msg = err?.message || '';
          setError(
            msg
              ? `Erreur : ${msg}`
              : 'Erreur lors de la recherche. Reessayez ou utilisez la recherche par nom.'
          );
        } finally {
          setLoading(false);
        }
      },
      (geoError) => {
        setLoading(false);
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError(
              'Acces a la position refuse. Autorisez la geolocalisation dans les parametres de votre navigateur, puis reessayez.'
            );
            break;
          case geoError.POSITION_UNAVAILABLE:
            setError('Position indisponible. Verifiez que la localisation est activee sur votre appareil.');
            break;
          case geoError.TIMEOUT:
            setError('La localisation a pris trop de temps. Reessayez ou utilisez la recherche par nom.');
            break;
          default:
            setError('Erreur de geolocalisation. Essayez la recherche par nom.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        onClick={handleGeolocate}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <MapPin className="h-4 w-4 mr-2" />
        )}
        {loading ? 'Localisation en cours...' : 'Utiliser ma position'}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            {results.length} restaurant{results.length > 1 ? 's' : ''} a proximite
          </p>
          {results.map((place) => (
            <button
              key={place.place_id}
              onClick={() => onSelect(place)}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium text-foreground">{place.name}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {place.formatted_address || place.vicinity || 'Adresse non disponible'}
                </span>
              </div>
              {place.rating && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
                  <span>{place.rating}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
