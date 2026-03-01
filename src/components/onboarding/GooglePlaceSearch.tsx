import { useState, useCallback } from 'react';
import { Search, MapPin, Star, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchPlaces } from '@/services/google-places';
import type { GooglePlaceResult } from '@/types/onboarding';

interface GooglePlaceSearchProps {
  onSelect: (place: GooglePlaceResult) => void;
}

export function GooglePlaceSearch({ onSelect }: GooglePlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 3) return;
    setLoading(true);
    try {
      const places = await searchPlaces(query);
      setResults(places);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Nom de votre restaurant..."
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading || query.trim().length < 3}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {results.map((place) => (
            <button
              key={place.place_id}
              onClick={() => onSelect(place)}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium text-foreground">{place.name}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{place.formatted_address || place.vicinity || ''}</span>
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
