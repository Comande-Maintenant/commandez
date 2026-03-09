-- Add flagged column for "client a surveiller" feature
ALTER TABLE restaurant_customers
ADD COLUMN IF NOT EXISTS flagged boolean DEFAULT false;

-- Index for quick lookup of flagged customers
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_flagged
ON restaurant_customers(restaurant_id, flagged) WHERE flagged = true;
