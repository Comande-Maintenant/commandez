export type ProductType =
  | "sandwich_personnalisable"
  | "sandwich_simple"
  | "menu"
  | "accompagnement"
  | "boisson"
  | "dessert"
  | "supplement"
  | "simple";

export interface DbBase {
  id: string;
  restaurant_id: string;
  name: string;
  name_translations: Record<string, string>;
  price: number;
  max_viandes: number;
  image: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface DbViande {
  id: string;
  restaurant_id: string;
  name: string;
  name_translations: Record<string, string>;
  supplement: number;
  image: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface DbGarniture {
  id: string;
  restaurant_id: string;
  name: string;
  name_translations: Record<string, string>;
  is_default: boolean;
  price_x2: number;
  sort_order: number;
  enabled: boolean;
}

export interface DbSauce {
  id: string;
  restaurant_id: string;
  name: string;
  name_translations: Record<string, string>;
  is_for_sandwich: boolean;
  is_for_frites: boolean;
  sort_order: number;
  enabled: boolean;
}

export interface DbAccompagnement {
  id: string;
  restaurant_id: string;
  name: string;
  name_translations: Record<string, string>;
  has_sizes: boolean;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  price_default: number | null;
  has_sauce_option: boolean;
  sort_order: number;
  enabled: boolean;
}

export interface DbOrderConfig {
  id: string;
  restaurant_id: string;
  free_sauces_sandwich: number;
  free_sauces_frites: number;
  extra_sauce_price: number;
  suggest_sauce_from_sandwich: boolean;
  enable_boisson_upsell: boolean;
  enable_dessert_upsell: boolean;
  pain_supplement_price: number;
}

export interface CustomizationData {
  bases: DbBase[];
  viandes: DbViande[];
  garnitures: DbGarniture[];
  sauces: DbSauce[];
  accompagnements: DbAccompagnement[];
  config: DbOrderConfig | null;
}

// ============================================================
// Universal Order Engine types
// ============================================================

export type CuisineType =
  | 'kebab'
  | 'pizza'
  | 'burger'
  | 'sushi'
  | 'indian'
  | 'chinese'
  | 'bakery'
  | 'poke'
  | 'creperie'
  | 'coffee_shop'
  | 'tacos_fr'
  | 'generic';

export type StepType =
  | 'single_select'
  | 'multi_select'
  | 'toggle_group'
  | 'chip_select'
  | 'upsell'
  | 'recap';

export interface DbCuisineStepTemplate {
  id: string;
  cuisine_type: CuisineType;
  step_key: string;
  label_i18n: string;
  data_source: string;
  step_type: StepType;
  sort_order: number;
  required: boolean;
  config: Record<string, unknown>;
}

export interface StepSelection {
  stepKey: string;
  stepLabel: string;
  selections: Array<{
    id: string;
    name: string;
    price: number;
    meta?: Record<string, unknown>;
  }>;
}

export interface UniversalCustomizationData extends CustomizationData {
  cuisine_type: CuisineType;
  stepTemplates: DbCuisineStepTemplate[];
}
