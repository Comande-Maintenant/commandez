import { supabase } from '@/integrations/supabase/client';
import type { AnalyzedCategory, SubscriptionPlan } from '@/types/onboarding';

// Create owner record after auth signup
export async function createOwner(userId: string, email: string, phone: string) {
  // A confirmed user may return from the email link or retry a creation.
  // Never overwrite an existing profile when restoring a session.
  const { data: existing, error: readError } = await supabase.from('owners').select('id').eq('id', userId).maybeSingle();
  if (readError) throw readError;
  if (existing) return;
  const { error } = await supabase.from('owners').insert({
    id: userId,
    email,
    phone,
  });
  if (error && error.code !== '23505') throw error;
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
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Reserve collisions atomically in complete_onboarding, never via a client-side
// read of other merchants' private records. Keep candidates stable across retries.
const RESERVED_SLUGS = new Set([
  'demo', 'decouvrir', 'inscription', 'connexion', 'signup', 'order', 'profil', 'admin',
  'abonnement', 'choisir-plan', 'abonnement-confirme', 'suivi', 'super-admin',
  'unsubscribe', 'upload', 'mot-de-passe-oublie', 'reinitialiser-mot-de-passe',
]);

function slugPart(value: string): string {
  const ascii = slugify(value);
  if (ascii) return ascii;
  // Names in non-Latin scripts remain intact in the public title and schema.
  // A stable identifier keeps their ASCII URL valid without dropping them.
  let hash = 2166136261;
  for (const character of value.trim().normalize('NFC')) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return `restaurant-${(hash >>> 0).toString(36)}`;
}

export async function generateSlug(name: string, city?: string): Promise<string> {
  if (!name.trim()) throw new Error('Restaurant name is required');
  const namePart = slugPart(name);
  const cityPart = city?.trim() ? slugPart(city) : '';
  // Leave space for the server collision suffix, preserving the city on long names.
  const citySuffix = cityPart ? `-${cityPart.slice(0, 60).replace(/-+$/, '')}` : '';
  let base = `${namePart.slice(0, 140 - citySuffix.length).replace(/-+$/, '')}${citySuffix}`;
  if (RESERVED_SLUGS.has(base)) base = `restaurant-${base}`;
  return base;
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
  viandes: Array<{ name: string; name_translations: Record<string, string>; supplement: number }>;
  boissons: Array<{ name: string; price: number }>;
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
  viandes: [
    { name: 'Kebab', name_translations: { en: 'Doner kebab', es: 'Kebab', de: 'Doner Kebab' }, supplement: 0 },
    { name: 'Poulet', name_translations: { en: 'Chicken', es: 'Pollo', de: 'Huhn' }, supplement: 0 },
    { name: 'Merguez', name_translations: { en: 'Merguez', es: 'Merguez', de: 'Merguez' }, supplement: 0 },
    { name: 'Steak', name_translations: { en: 'Steak', es: 'Bistec', de: 'Steak' }, supplement: 0 },
    { name: 'Kofta', name_translations: { en: 'Kofta', es: 'Kofta', de: 'Kofta' }, supplement: 0 },
    { name: 'Cordon bleu', name_translations: { en: 'Cordon bleu', es: 'Cordon bleu', de: 'Cordon bleu' }, supplement: 0 },
    { name: 'Nuggets', name_translations: { en: 'Nuggets', es: 'Nuggets', de: 'Nuggets' }, supplement: 0 },
    { name: 'Tenders', name_translations: { en: 'Tenders', es: 'Tenders', de: 'Tenders' }, supplement: 0 },
  ],
  orderConfig: {
    free_sauces_sandwich: 3,
    free_sauces_frites: 2,
    extra_sauce_price: 0.50,
    suggest_sauce_from_sandwich: true,
    enable_boisson_upsell: true,
    enable_dessert_upsell: false,
  },
  boissons: [
    { name: 'Coca-Cola 33cl', price: 1.50 },
    { name: 'Coca Cherry 33cl', price: 1.50 },
    { name: 'Coca Zero 33cl', price: 1.50 },
    { name: 'Orangina 33cl', price: 1.50 },
    { name: 'Fanta Orange 33cl', price: 1.50 },
    { name: 'Fanta Citron 33cl', price: 1.50 },
    { name: 'Fanta Tropical 33cl', price: 1.50 },
    { name: 'Fanta Cassis 33cl', price: 1.50 },
    { name: 'Schweppes Agrumes 33cl', price: 1.50 },
    { name: 'Schweppes Lemon 33cl', price: 1.50 },
    { name: '7UP 33cl', price: 1.50 },
    { name: 'Oasis Tropical 33cl', price: 1.50 },
    { name: 'Oasis Fraise Framboise 33cl', price: 1.50 },
    { name: 'Ice Tea Peche 33cl', price: 1.50 },
    { name: 'Perrier 33cl', price: 1.50 },
    { name: 'Minute Maid Orange 33cl', price: 1.50 },
    { name: 'Cristaline 33cl', price: 1.50 },
    { name: 'Red Bull 25cl', price: 3.00 },
    { name: 'Eau', price: 1.00 },
    { name: 'Cafe', price: 1.50 },
    { name: 'Ayran', price: 1.50 },
  ],
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

  // Insert viandes
  if (defaults.viandes.length > 0) {
    await supabase.from('restaurant_viandes').insert(
      defaults.viandes.map((v, i) => ({
        restaurant_id: restaurantId,
        name: v.name,
        name_translations: v.name_translations,
        supplement: v.supplement,
        sort_order: i + 1,
        enabled: true,
      }))
    );
  }

  // Insert default boissons as menu items
  if (defaults.boissons.length > 0) {
    // Check if boissons already exist
    const { data: existingBoissons } = await supabase
      .from('menu_items')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('product_type', 'boisson')
      .limit(1);
    if (!existingBoissons || existingBoissons.length === 0) {
      await supabase.from('menu_items').insert(
        defaults.boissons.map((b, i) => ({
          restaurant_id: restaurantId,
          name: b.name,
          price: b.price,
          category: 'Boissons',
          product_type: 'boisson',
          enabled: true,
          sort_order: 200 + i,
        }))
      );
    }
  }

  // Insert order config
  await supabase.from('restaurant_order_config').upsert({
    restaurant_id: restaurantId,
    ...defaults.orderConfig,
  });
}

// One transaction publishes a complete restaurant; retries reuse the creation key.
export async function completeOnboarding(key: string, restaurant: Record<string, unknown>, categories: AnalyzedCategory[]) {
  const cuisine = String(restaurant.cuisine_type || 'generic');
  const defaults = CUISINE_DEFAULTS[cuisine];
  const menu = categories.flatMap(category => category.items.map(item => ({
    name: item.name, description: item.description || '', price: item.price,
    category: category.name,
    product_type: getProductType(category.name) === 'simple' ? getProductType(item.name) : getProductType(category.name),
    supplements: (item.supplements || []).map((supplement, i) => ({ id: `supp-${i}`, ...supplement })),
    variants: item.variants || [], tags: item.tags || [],
  })));
  if (defaults && !menu.some(item => item.product_type === 'boisson')) {
    menu.push(...defaults.boissons.map(item => ({ ...item, description: '', category: 'Boissons', product_type: 'boisson', supplements: [], variants: [], tags: [] })));
  }
  const { data, error } = await supabase.rpc('complete_onboarding' as never, {
    p_key: key, p_restaurant: restaurant, p_menu: menu, p_defaults: defaults || {},
  } as never);
  if (error) throw error;
  if (!data || !(data as { id?: string }).id) throw new Error('Restaurant creation failed');
  return data as { id: string; slug: string; name: string; created: boolean };
}
