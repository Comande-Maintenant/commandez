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

function extractCity(address: string): string {
  const parts = address.split(',').map((p) => p.trim());
  // Usually city is second-to-last in French addresses
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    // Remove postal code
    return candidate.replace(/\d{5}\s*/, '').trim();
  }
  return '';
}

export function PlaceConfirmation({ place, onConfirm, onBack }: PlaceConfirmationProps) {
  const fullAddress = place.formatted_address || place.vicinity || '';
  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(fullAddress);
  const [city, setCity] = useState(extractCity(fullAddress));
  const [phone, setPhone] = useState(place.formatted_phone_number || place.international_phone_number || '');
  const [cuisine, setCuisine] = useState('');
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
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div>
        <Label>Horaires</Label>
        <Input value={hours} onChange={(e) => setHours(e.target.value)} />
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
