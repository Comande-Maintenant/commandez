-- Add ingredient-level stock management
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS out_of_stock_ingredients jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN restaurants.out_of_stock_ingredients IS 'Array of ingredient/sauce/supplement names currently out of stock';
