export interface Supplement {
  id: string;
  name: string;
  price: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  price_modifier: number;
  image: string | null;
  allow_multi_meat?: boolean;
  portion_options?: { id: string; label: string; price_modifier: number }[];
  has_sub_sauce?: boolean;
}

export interface CustomizationStep {
  id: string;
  title: string;
  title_translations?: Record<string, string>;
  type: "single" | "multiple" | "custom_garniture" | "multiple_with_quantity" | "single_or_multi";
  required: boolean;
  max_selections?: number;
  options: CustomizationOption[];
  levels?: string[];
  shortcut_label?: string;
  shortcut_sets?: Record<string, { include: string[]; exclude?: string[] }>;
  max_qty_per_option?: number;
  skip_label?: string;
  sub_sauce_step?: string;
}

export interface CustomizationConfig {
  enabled: boolean;
  base_price: number;
  steps: CustomizationStep[];
}

export interface DbRestaurant {
  id: string;
  slug: string;
  name: string;
  description: string;
  cuisine: string;
  image: string;
  cover_image: string;
  rating: number;
  review_count: number;
  address: string;
  city: string;
  estimated_time: string;
  minimum_order: number;
  is_open: boolean;
  is_accepting_orders: boolean;
  hours: string;
  categories: string[];
  primary_color: string;
  bg_color: string;
  payment_methods: string[];
  website: string;
  category_translations: Record<string, Record<string, string>> | null;
  restaurant_phone: string;
  availability_mode: string;
  schedule: any;
  order_mode: string;
  notification_sound: string;
  prep_time_config: {
    default_minutes: number;
    per_item_minutes: number;
    max_minutes: number;
  };
  customization_config: CustomizationConfig | null;
  deactivated_at: string | null;
  scheduled_deletion_at: string | null;
  deactivation_visit_count: number;
}

export interface DbMenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  popular: boolean;
  enabled: boolean;
  supplements: Supplement[];
  sauces: string[];
  sort_order: number;
  translations?: Record<string, { name: string; description?: string }>;
}

export interface DbOrder {
  id: string;
  restaurant_id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  order_type: string;
  source: string;
  covers: number | null;
  status: 'new' | 'preparing' | 'ready' | 'done';
  items: any;
  subtotal: number;
  total: number;
  notes: string;
  client_ip: string | null;
  pickup_time: string | null;
  created_at: string;
  updated_at: string;
}
