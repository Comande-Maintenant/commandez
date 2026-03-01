export type SubscriptionPlan = 'none' | 'monthly' | '6months' | '12months' | '18months';

export interface Owner {
  id: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  rating?: number;
  types?: string[];
  opening_hours?: { weekday_text?: string[]; open_now?: boolean };
  photos?: { photo_reference: string }[];
  website?: string;
  geometry?: { location: { lat: number; lng: number } };
}

export interface MenuVariant {
  name: string;
  price: number;
}

export interface MenuSupplement {
  name: string;
  price: number;
}

export interface AnalyzedItem {
  name: string;
  price: number;
  description: string;
  variants?: MenuVariant[];
  supplements?: MenuSupplement[];
  tags?: string[];
}

export interface AnalyzedCategory {
  name: string;
  items: AnalyzedItem[];
}

export interface AnalyzedMenu {
  categories: AnalyzedCategory[];
}

export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  price: number;
  discount?: string;
  badge?: string;
  features: string[];
}

export interface ExtractedColors {
  primary: string;
  secondary: string;
  background: string;
  palette: string[];
}
