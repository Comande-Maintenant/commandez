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
  referral_code: string | null;
  referred_by: string | null;
  bonus_weeks: number;
  trial_end_date: string | null;
  subscription_status: string | null;
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

export interface DbTablet {
  id: string;
  restaurant_id: string;
  serial_number: string;
  name: string;
  usage_type: 'cuisine' | 'caisse' | 'service_client' | 'autre';
  status: 'active' | 'inactive' | 'maintenance';
  activated_at: string;
  deactivated_at: string | null;
  notes: string;
  created_at: string;
}

export interface DbOrder {
  id: string;
  restaurant_id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
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
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCustomer {
  id: string;
  restaurant_id: string;
  customer_phone: string;
  customer_name: string;
  customer_email: string;
  first_order_at: string | null;
  last_order_at: string | null;
  total_orders: number;
  total_spent: number;
  average_basket: number;
  favorite_items: string[];
  last_items: string[];
  is_banned: boolean;
  banned_at: string | null;
  banned_reason: string;
  ban_expires_at: string | null;
  banned_ip: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DbOwner {
  id: string;
  email: string;
  phone: string;
  role: 'owner' | 'super_admin';
  created_at: string;
}

export type SubscriptionStatus =
  | 'pending_payment'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'promo';

export interface DbSubscription {
  id: string;
  restaurant_id: string;
  status: SubscriptionStatus;
  plan: 'monthly' | 'annual';
  billing_day: number;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  shopify_contract_id: string | null;
  shopify_customer_id: string | null;
  shopify_order_id: string | null;
  bonus_days: number;
  promo_code_used: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPromoCode {
  id: string;
  code: string;
  type: 'free_days' | 'discount_percent' | 'discount_fixed' | 'free_trial_extension';
  value: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}
