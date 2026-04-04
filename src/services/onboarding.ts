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
  cuisine_type?: string;
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
  preferred_language?: string;
}) {
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .insert({
      name: data.name,
      slug: data.slug,
      address: data.address ?? null,
      city: data.city ?? null,
      cuisine: data.cuisine ?? null,
      cuisine_type: data.cuisine_type ?? 'generic',
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
      subscription_status: 'pending_payment',
      payment_methods: data.payment_methods ?? [],
      owner_id: data.owner_id ?? null,
      preferred_language: data.preferred_language ?? 'fr',
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

// Determine product_type based on category name
function getProductType(categoryName: string): string {
  const cat = categoryName.toLowerCase();
  if (cat.includes('sandwich') || cat.includes('kebab') || cat.includes('burger') || cat.includes('wrap') || cat.includes('panini') || cat.includes('galette') || cat.includes('tacos')) {
    return 'sandwich_personnalisable';
  }
  if (cat.includes('assiette')) {
    return 'assiette';
  }
  if (cat.includes('boisson') || cat.includes('drink')) {
    return 'boisson';
  }
  if (cat.includes('dessert')) {
    return 'dessert';
  }
  if (cat.includes('accompagnement')) {
    return 'accompagnement';
  }
  return 'simple';
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

    // Auto-assign product_type based on category
    const productType = getProductType(category.name);

    for (const item of category.items) {
      const supplements = (item.supplements ?? []).map((s, i) => ({
        id: `supp-${i}`,
        name: s.name,
        price: s.price,
      }));

      // For individual items, check item name too for more specific typing
      let itemProductType = productType;
      if (productType === 'simple') {
        const itemName = item.name.toLowerCase();
        if (itemName.includes('kebab') || itemName.includes('sandwich') || itemName.includes('burger') || itemName.includes('tacos') || itemName.includes('galette') || itemName.includes('panini') || itemName.includes('wrap')) {
          itemProductType = 'sandwich_personnalisable';
        } else if (itemName.includes('assiette')) {
          itemProductType = 'assiette';
        }
      }

      const { error } = await supabase.from('menu_items').insert({
        restaurant_id: restaurantId,
        name: item.name,
        description: item.description || null,
        price: item.price,
        category: category.name,
        product_type: itemProductType,
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

// ============================================================
// Seed default customization data based on cuisine type
// Called after restaurant creation to set up the ordering flow
// ============================================================

interface CuisineDefaults {
  garnitures: Array<{ name: string; name_translations: Record<string, string>; is_default: boolean }>;
  sauces: Array<{ name: string; name_translations: Record<string, string>; is_for_sandwich: boolean; is_for_frites: boolean }>;
  orderConfig: {
    free_sauces_sandwich: number;
    free_sauces_frites: number;
    extra_sauce_price: number;
    suggest_sauce_from_sandwich: boolean;
    enable_boisson_upsell: boolean;
    enable_dessert_upsell: boolean;
  };
}

const KEBAB_DEFAULTS: CuisineDefaults = {
  garnitures: [
    { name: 'Salade', name_translations: { en: 'Lettuce', es: 'Lechuga', de: 'Salat' }, is_default: true },
    { name: 'Tomates', name_translations: { en: 'Tomatoes', es: 'Tomates', de: 'Tomaten' }, is_default: true },
    { name: 'Oignons', name_translations: { en: 'Onions', es: 'Cebollas', de: 'Zwiebeln' }, is_default: true },
  ],
  sauces: [
    { name: 'Algerienne', name_translations: { en: 'Algerian', es: 'Argelina', de: 'Algerische' }, is_for_sandwich: true, is_for_frites: true },
    { name: 'Blanche', name_translations: { en: 'White sauce', es: 'Salsa blanca', de: 'Weisse Sosse' }, is_for_sandwich: true, is_for_frites: true },
    { name: 'Samourai', name_translations: { en: 'Samurai', es: 'Samurai', de: 'Samurai' }, is_for_sandwich: true, is_for_frites: true },
    { name: 'Ketchup', name_translations: { en: 'Ketchup', es: 'Ketchup', de: 'Ketchup' }, is_for_sandwich: true, is_for_frites: true },
    { name: 'Harissa', name_translations: { en: 'Harissa', es: 'Harissa', de: 'Harissa' }, is_for_sandwich: true, is_for_frites: true },
    { name: 'Mayonnaise', name_translations: { en: 'Mayonnaise', es: 'Mayonesa', de: 'Mayonnaise' }, is_for_sandwich: true, is_for_frites: true },
    { name: 'Barbecue', name_translations: { en: 'BBQ', es: 'Barbacoa', de: 'BBQ' }, is_for_sandwich: true, is_for_frites: true },
  ],
  orderConfig: {
    free_sauces_sandwich: 3,
    free_sauces_frites: 2,
    extra_sauce_price: 0.50,
    suggest_sauce_from_sandwich: true,
    enable_boisson_upsell: true,
    enable_dessert_upsell: false,
  },
};

const CUISINE_DEFAULTS: Partial<Record<string, CuisineDefaults>> = {
  kebab: KEBAB_DEFAULTS,
  tacos_fr: KEBAB_DEFAULTS, // French tacos shops have the same base setup
};

export async function seedCuisineDefaults(restaurantId: string, cuisineType: string): Promise<void> {
  const defaults = CUISINE_DEFAULTS[cuisineType];
  if (!defaults) return;

  // Check if already seeded (idempotent)
  const { data: existing } = await supabase
    .from('restaurant_garnitures')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .limit(1);
  if (existing && existing.length > 0) return;

  // Insert garnitures
  if (defaults.garnitures.length > 0) {
    await supabase.from('restaurant_garnitures').insert(
      defaults.garnitures.map((g, i) => ({
        restaurant_id: restaurantId,
        name: g.name,
        name_translations: g.name_translations,
        is_default: g.is_default,
        price_x2: 0,
        sort_order: i + 1,
        enabled: true,
      }))
    );
  }

  // Insert sauces
  if (defaults.sauces.length > 0) {
    await supabase.from('restaurant_sauces').insert(
      defaults.sauces.map((s, i) => ({
        restaurant_id: restaurantId,
        name: s.name,
        name_translations: s.name_translations,
        is_for_sandwich: s.is_for_sandwich,
        is_for_frites: s.is_for_frites,
        sort_order: i + 1,
        enabled: true,
      }))
    );
  }

  // Insert order config
  await supabase.from('restaurant_order_config').upsert({
    restaurant_id: restaurantId,
    ...defaults.orderConfig,
  });
}
