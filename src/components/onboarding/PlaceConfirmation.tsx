import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { GooglePlaceResult } from '@/types/onboarding';

interface PlaceConfirmationProps {
  place: GooglePlaceResult;
  onConfirm: (data: {
    name: string;
    address: string;
    city: string;
    phone: string;
    cuisine: string;
    website: string;
    hours: string;
    rating: number | null;
    google_place_id: string;
  }) => void;
  onBack: () => void;
}

// Extract city from formatted_address ("3 Rue X, 89470 Monéteau, France")
// or from vicinity ("3 Rue X, Monéteau")
function extractCity(address: string, isVicinity: boolean): string {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length === 0) return '';

  if (isVicinity) {
    // vicinity format: "3 Rue X, Monéteau" → city is the LAST part
    return parts[parts.length - 1];
  }

  // formatted_address: "3 Rue X, 89470 Monéteau, France" → city is second-to-last
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
  // Check Google types
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
  const [hours, setHours] = useState(
    place.opening_hours?.weekday_text?.join(' | ') ?? ''
  );

  const handleConfirm = () => {
    onConfirm({
      name,
      address,
      city,
      phone,
      cuisine,
      website,
      hours,
      rating: place.rating ?? null,
      google_place_id: place.place_id,
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

      <div>
        <Label>Horaires</Label>
        <Input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Lundi - Vendredi : 11h - 22h"
        />
      </div>

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
