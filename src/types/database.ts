export interface Supplement {
  id: string;
  name: string;
  price: number;
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
  delivery_fee: number;
  minimum_order: number;
  is_open: boolean;
  is_accepting_orders: boolean;
  hours: string;
  categories: string[];
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
}

export interface DbOrder {
  id: string;
  restaurant_id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  order_type: 'collect' | 'delivery';
  status: 'new' | 'preparing' | 'ready' | 'done';
  items: any;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes: string;
  created_at: string;
  updated_at: string;
}
