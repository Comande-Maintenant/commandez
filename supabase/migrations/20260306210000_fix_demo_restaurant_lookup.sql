-- Fix: /admin/demo loads slug='demo' (old restaurant) but new orders go to
-- 'antalya-kebab-moneteau'. When slug='demo', return the demo restaurant
-- that has the most recent orders so the dashboard shows current activity.
CREATE OR REPLACE FUNCTION get_demo_restaurant(p_slug text)
RETURNS SETOF restaurants
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_slug = 'demo' THEN
    -- Return the demo restaurant with the most recent order
    RETURN QUERY
      SELECT r.* FROM restaurants r
      LEFT JOIN orders o ON o.restaurant_id = r.id
      WHERE r.is_demo = true
      GROUP BY r.id
      ORDER BY MAX(o.created_at) DESC NULLS LAST
      LIMIT 1;
  ELSE
    RETURN QUERY
      SELECT * FROM restaurants WHERE slug = p_slug AND is_demo = true LIMIT 1;
  END IF;
END;
$$;
