import { supabase } from '@/integrations/supabase/client';
import type { AnalyzedCategory, SubscriptionPlan } from '@/types/onboarding';

// Create owner record after auth signup
export async function createOwner(userId: string, email: string, phone: string) {
  const { error } = await supabase.from('owners').insert({
    id: userId,
    email,
    phone,
  });
  if (error) throw error;
}

// Create restaurant with all onboarding data
export async function createRestaurantFromOnboarding(data: {
  name: string;
  slug: string;
  address?: string;
  city?: string;
  cuisine?: string;
  description?: string;
  image?: string;
  cover_image?: string;
  restaurant_phone?: string;
  rating?: number;
  google_place_id?: string;
  website?: string;
  hours?: string;
  categories?: string[];
  primary_color?: string;
  bg_color?: string;
  subscription_plan?: SubscriptionPlan;
  payment_methods?: string[];
  owner_id?: string;
}) {
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .insert({
      name: data.name,
      slug: data.slug,
      address: data.address ?? null,
      city: data.city ?? null,
      cuisine: data.cuisine ?? null,
      description: data.description ?? null,
      image: data.image ?? null,
      cover_image: data.cover_image ?? null,
      hours: data.hours ?? null,
      categories: data.categories ?? [],
      is_open: true,
      is_accepting_orders: true,
      estimated_time: '15-25 min',
      minimum_order: 10,
      rating: data.rating ?? null,
      review_count: 0,
      // New columns from migration
      restaurant_phone: data.restaurant_phone ?? null,
      google_place_id: data.google_place_id ?? null,
      website: data.website ?? null,
      primary_color: data.primary_color ?? '#000000',
      bg_color: data.bg_color ?? '#ffffff',
      subscription_plan: data.subscription_plan ?? 'none',
      payment_methods: data.payment_methods ?? [],
      owner_id: data.owner_id ?? null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return restaurant;
}

// Generate a URL-safe slug from restaurant name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Generate a unique slug, appending -2, -3 etc. if needed
export async function generateSlug(name: string): Promise<string> {
  const base = slugify(name);
  const { data } = await supabase
    .from('restaurants')
    .select('slug')
    .like('slug', `${base}%`);
  const existing = new Set((data ?? []).map((r: any) => r.slug));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// Create menu items from analyzed OCR data
export async function createMenuItemsFromAnalysis(
  restaurantId: string,
  categories: AnalyzedCategory[]
) {
  let sortOrder = 0;
  const allCategories: string[] = [];

  for (const category of categories) {
    allCategories.push(category.name);

    for (const item of category.items) {
      const supplements = (item.supplements ?? []).map((s, i) => ({
        id: `supp-${i}`,
        name: s.name,
        price: s.price,
      }));

      const { error } = await supabase.from('menu_items').insert({
        restaurant_id: restaurantId,
        name: item.name,
        description: item.description || null,
        price: item.price,
        category: category.name,
        enabled: true,
        popular: false,
        sort_order: sortOrder++,
        supplements: supplements.length > 0 ? supplements : null,
        variants: (item.variants ?? []).length > 0 ? item.variants : null,
        tags: (item.tags ?? []).length > 0 ? item.tags : null,
      } as any);

      if (error) {
        console.error('Error creating menu item:', error);
      }
    }
  }

  // Update restaurant categories array
  if (allCategories.length > 0) {
    await supabase
      .from('restaurants')
      .update({ categories: allCategories })
      .eq('id', restaurantId);
  }

  return allCategories;
}
