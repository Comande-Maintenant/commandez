-- Add dine-in capacity to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS dine_in_capacity integer;

-- Set demo restaurant to 15 covers and enable on_site + pickup
UPDATE restaurants
SET dine_in_capacity = 15,
    order_mode = 'on_site_pickup'
WHERE slug = 'antalya-kebab-moneteau';
