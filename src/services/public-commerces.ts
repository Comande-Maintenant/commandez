import { supabase } from '@/integrations/supabase/client';

export interface PublicCommerce { slug: string; name: string; city: string; image: string | null; cover_image: string | null; cuisine: string | null; cuisine_type: string | null; business_type: string | null }
export interface PublicCommerceResult { items: PublicCommerce[]; has_more: boolean }

export function validateCity(input: string): string | null {
  if (/[\p{C}]/u.test(input) || input.length > 240) return null;
  const city = input.trim().normalize('NFC').replace(/ +/g, ' ');
  return city.length > 0 && city.length <= 80 && /\p{L}/u.test(city) && /^[\p{L}\p{M}\p{N} .’'-]+$/u.test(city) ? city : null;
}
const fields = ['slug', 'name', 'city', 'image', 'cover_image', 'cuisine', 'cuisine_type', 'business_type'];
export const normalizedCity = (city: string) => validateCity(city)?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'");
function validImage(value: unknown): boolean {
  if (value === null || value === '') return true;
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function isCommerce(value: unknown, city: string): value is PublicCommerce {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== fields.length || Object.keys(row).some(key => !fields.includes(key))) return false;
  if (typeof row.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug) || row.slug.length > 200) return false;
  if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 200) return false;
  if (typeof row.city !== 'string' || normalizedCity(row.city) !== normalizedCity(city)) return false;
  if (!validImage(row.image) || !validImage(row.cover_image)) return false;
  return ['cuisine', 'cuisine_type', 'business_type'].every(key => row[key] === null || (typeof row[key] === 'string' && (row[key] as string).length <= 200));
}

export async function findPublicCommerces(input: string, signal: AbortSignal = new AbortController().signal): Promise<PublicCommerceResult> {
  const city = validateCity(input);
  if (!city) throw new Error('Invalid city');
  const { data, error } = await supabase.rpc('list_public_commerces_by_city', { p_city: city }).abortSignal(signal);
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Directory unavailable');
  const result = data as Record<string, unknown>;
  if (Object.keys(result).length !== 2 || !Array.isArray(result.items) || result.items.length > 100 || typeof result.has_more !== 'boolean'
    || (result.has_more && result.items.length !== 100) || !result.items.every(item => isCommerce(item, city))
    || new Set(result.items.map(item => (item as PublicCommerce).slug)).size !== result.items.length) throw new Error('Invalid directory response');
  return { items: result.items as PublicCommerce[], has_more: result.has_more };
}
