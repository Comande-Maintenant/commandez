import { useState, useCallback, useRef } from 'react';
import { Search, MapPin, Star, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchPlaces } from '@/services/google-places';
import { useLanguage } from '@/context/LanguageContext';
import type { GooglePlaceResult } from '@/types/onboarding';

interface GooglePlaceSearchProps {
  onSelect: (place: GooglePlaceResult) => void;
}

export function GooglePlaceSearch({ onSelect }: GooglePlaceSearchProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const searchPending = useRef(false);

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 3 || searchPending.current) return;
    searchPending.current = true;
    setLoading(true);
    setError('');
    setResults([]);
    setSearched(false);
    try {
      const places = await searchPlaces(query.trim());
      setResults(places);
      setSearched(true);
    } catch (err) {
      setError('La recherche Google est indisponible. Réessayez ou saisissez vos informations.');
    } finally {
      searchPending.current = false;
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
          placeholder={t('onboarding.place.search_placeholder')}
          disabled={loading}
          className="flex-1"
        />
        <Button aria-label="Rechercher mon établissement" onClick={handleSearch} disabled={loading || query.trim().length < 3}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {searched && results.length === 0 && <p role="status" className="text-sm text-muted-foreground">Aucun établissement trouvé. Ajoutez le nom de votre ville ou saisissez vos informations.</p>}
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
