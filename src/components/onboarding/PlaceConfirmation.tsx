import { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { GooglePlaceResult } from '@/types/onboarding';
import { parseGoogleHours, formatParsedHours, type ParsedHour } from '@/utils/parse-google-hours';

export interface PlaceConfirmData {
  name: string;
  address: string;
  city: string;
  phone: string;
  cuisine: string;
  website: string;
  hours: string;
  rating: number | null;
  google_place_id: string;
  useAutoHours: boolean;
  parsedHours: ParsedHour[] | null;
}

interface PlaceConfirmationProps {
  place: GooglePlaceResult;
  onConfirm: (data: PlaceConfirmData) => void;
  onBack: () => void;
}

// Extract city from formatted_address ("3 Rue X, 89470 Moneteau, France")
// or from vicinity ("3 Rue X, Moneteau")
function extractCity(address: string, isVicinity: boolean): string {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length === 0) return '';

  if (isVicinity) {
    // vicinity format: "3 Rue X, Moneteau" -> city is the LAST part
    return parts[parts.length - 1];
  }

  // formatted_address: "3 Rue X, 89470 Moneteau, France" -> city is second-to-last
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    return candidate.replace(/\d{5}\s*/, '').trim();
  }
  return '';
}

// Cuisine keywords to detect from Google place name or types
const CUISINE_MAP: Record<string, string> = {
  kebab: 'Kebab',
  pizza: 'Pizzeria',
  pizzeria: 'Pizzeria',
  sushi: 'Sushi',
  japonais: 'Japonais',
  chinois: 'Chinois',
  indien: 'Indien',
  thai: 'Thaïlandais',
  burger: 'Burger',
  brasserie: 'Brasserie',
  creperie: 'Crêperie',
  boulangerie: 'Boulangerie',
  patisserie: 'Pâtisserie',
  traiteur: 'Traiteur',
  tacos: 'Tacos',
  istanbul: 'Kebab',
  antalya: 'Kebab',
  wok: 'Asiatique',
  poke: 'Poké',
  bagel: 'Bagel',
  sandwicherie: 'Sandwicherie',
};

function detectCuisine(name: string, types?: string[]): string {
  const lower = name.toLowerCase();
  for (const [keyword, cuisine] of Object.entries(CUISINE_MAP)) {
    if (lower.includes(keyword)) return cuisine;
  }
  if (types) {
    if (types.includes('bakery')) return 'Boulangerie';
    if (types.includes('cafe')) return 'Café';
    if (types.includes('bar')) return 'Bar';
  }
  return '';
}

export function PlaceConfirmation({ place, onConfirm, onBack }: PlaceConfirmationProps) {
  const hasFormattedAddress = !!place.formatted_address;
  const fullAddress = place.formatted_address || place.vicinity || '';
  const isVicinity = !hasFormattedAddress && !!place.vicinity;

  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(fullAddress);
  const [city, setCity] = useState(extractCity(fullAddress, isVicinity));
  const [phone, setPhone] = useState(
    place.formatted_phone_number || place.international_phone_number || ''
  );
  const [cuisine, setCuisine] = useState(detectCuisine(place.name, place.types));
  const [website, setWebsite] = useState(place.website ?? '');
  const [useAutoHours, setUseAutoHours] = useState(true);

  // Parse Google hours if available
  const weekdayText = place.opening_hours?.weekday_text;
  const parsedHours = useMemo(
    () => (weekdayText && weekdayText.length > 0 ? parseGoogleHours(weekdayText) : null),
    [weekdayText]
  );
  const formattedLines = useMemo(
    () => (parsedHours ? formatParsedHours(parsedHours) : []),
    [parsedHours]
  );

  const hoursString = weekdayText?.join(' | ') ?? '';

  const handleConfirm = () => {
    onConfirm({
      name,
      address,
      city,
      phone,
      cuisine,
      website,
      hours: hoursString,
      rating: place.rating ?? null,
      google_place_id: place.place_id,
      useAutoHours: useAutoHours && !!parsedHours,
      parsedHours: useAutoHours ? parsedHours : null,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Verifiez et completez les informations de votre restaurant.
      </p>

      <div>
        <Label>Nom</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <Label>Adresse</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div>
        <Label>Ville</Label>
        <Input value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div>
        <Label>Telephone</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div>
        <Label>Type de cuisine</Label>
        <Input
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          placeholder="Pizzeria, Kebab, Sushi..."
        />
      </div>

      <div>
        <Label>Site web</Label>
        <Input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://..."
        />
      </div>

      {/* Parsed hours display */}
      {parsedHours && formattedLines.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="mb-0">Horaires Google</Label>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {formattedLines.map((line) => {
              const isClosed = line.includes('Ferme');
              return (
                <div
                  key={line}
                  className={`text-sm px-2 py-1 rounded ${
                    isClosed
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                  }`}
                >
                  {line}
                </div>
              );
            })}
          </div>
          <label className="flex items-start gap-3 pt-2 border-t border-border cursor-pointer">
            <input
              type="checkbox"
              checked={useAutoHours}
              onChange={(e) => setUseAutoHours(e.target.checked)}
              className="mt-0.5 rounded border-muted-foreground"
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                Utiliser ces horaires sur ma page
              </p>
              <p className="text-xs text-muted-foreground">
                Votre page sera automatiquement ouverte/fermee selon ces horaires
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Fallback: manual hours input if Google hours not available */}
      {!parsedHours && (
        <div>
          <Label>Horaires</Label>
          <Input
            value={hoursString}
            readOnly
            placeholder="Lundi - Vendredi : 11h - 22h"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Vous pourrez configurer vos horaires dans le dashboard apres inscription.
          </p>
        </div>
      )}

      {place.rating && (
        <p className="text-sm text-muted-foreground">
          Note Google : {place.rating}/5
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Retour
        </Button>
        <Button onClick={handleConfirm} className="flex-1">
          Confirmer ces informations
        </Button>
      </div>
    </div>
  );
}
