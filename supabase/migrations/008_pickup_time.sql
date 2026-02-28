-- Add pickup_time column to orders for scheduled pickups
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time timestamptz DEFAULT NULL;

-- Remove delivery-related defaults (Click & Collect only)
ALTER TABLE restaurants ALTER COLUMN delivery_fee SET DEFAULT 0;
