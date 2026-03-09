-- Add alcohol flag to menu items for legal compliance
-- Products marked as alcohol are hidden from online ordering (age verification impossible)
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS is_alcohol boolean DEFAULT false;

COMMENT ON COLUMN menu_items.is_alcohol IS 'True if product contains alcohol - hidden from online/kiosk ordering';

-- Index for fast filtering on customer-facing queries
CREATE INDEX IF NOT EXISTS idx_menu_items_alcohol ON menu_items (restaurant_id, enabled, is_alcohol);
