
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- RESTAURANTS TABLE
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cuisine TEXT DEFAULT '',
  image TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  rating NUMERIC(2,1) DEFAULT 4.5,
  review_count INTEGER DEFAULT 0,
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  estimated_time TEXT DEFAULT '15-25 min',
  delivery_fee NUMERIC(5,2) DEFAULT 2.99,
  minimum_order NUMERIC(5,2) DEFAULT 10,
  is_open BOOLEAN DEFAULT true,
  is_accepting_orders BOOLEAN DEFAULT true,
  hours TEXT DEFAULT '11h00 - 23h00',
  categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Public read for restaurants
CREATE POLICY "Restaurants are publicly readable"
  ON public.restaurants FOR SELECT USING (true);

-- MENU ITEMS TABLE
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(6,2) NOT NULL,
  image TEXT DEFAULT '',
  category TEXT NOT NULL,
  popular BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  supplements JSONB DEFAULT '[]',
  sauces TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Public read for menu items
CREATE POLICY "Menu items are publicly readable"
  ON public.menu_items FOR SELECT USING (true);

-- ORDERS TABLE
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT DEFAULT '',
  order_type TEXT NOT NULL CHECK (order_type IN ('collect', 'delivery')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'ready', 'done')),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(8,2) NOT NULL,
  delivery_fee NUMERIC(5,2) DEFAULT 0,
  total NUMERIC(8,2) NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anyone can create an order (public ordering)
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT WITH CHECK (true);

-- Orders are publicly readable (for now, no auth)
CREATE POLICY "Orders are publicly readable"
  ON public.orders FOR SELECT USING (true);

-- Orders can be updated (status changes from admin)
CREATE POLICY "Orders can be updated"
  ON public.orders FOR UPDATE USING (true);

-- WEEKLY HOURS TABLE
CREATE TABLE public.restaurant_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN DEFAULT true,
  open_time TIME DEFAULT '11:00',
  close_time TIME DEFAULT '23:00',
  UNIQUE(restaurant_id, day_of_week)
);

ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant hours are publicly readable"
  ON public.restaurant_hours FOR SELECT USING (true);

CREATE POLICY "Restaurant hours can be updated"
  ON public.restaurant_hours FOR UPDATE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Indexes
CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_restaurant_hours_restaurant ON public.restaurant_hours(restaurant_id);
