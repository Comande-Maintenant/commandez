-- Extend order config for multi-select accompaniments
ALTER TABLE restaurant_order_config
ADD COLUMN IF NOT EXISTS free_accompagnements INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS extra_accompagnement_price DECIMAL(8,2) DEFAULT 0;

COMMENT ON COLUMN restaurant_order_config.free_accompagnements IS 'Number of free accompaniments included (for assiettes)';
COMMENT ON COLUMN restaurant_order_config.extra_accompagnement_price IS 'Price per extra accompaniment beyond free count';

-- Update Antalya Kebab demo: 2 free accompagnements, 1€ per extra
UPDATE restaurant_order_config
SET free_accompagnements = 2, extra_accompagnement_price = 1.00
WHERE restaurant_id = '769f54f9-09a6-40a9-a490-26597a717646';
