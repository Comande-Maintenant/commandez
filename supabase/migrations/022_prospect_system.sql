-- Prospect system: business_type, account_status, is_test

-- business_type on restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'restaurant';
COMMENT ON COLUMN restaurants.business_type IS 'Type de commerce : restaurant, boulangerie, boucherie, fleuriste, epicerie, traiteur, autre';

-- account_status on restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';
COMMENT ON COLUMN restaurants.account_status IS 'Statut du compte : prospect, active, suspended, archived';
CREATE INDEX IF NOT EXISTS idx_restaurants_account_status ON restaurants(account_status);

-- is_test flag on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_is_test ON orders(is_test);
