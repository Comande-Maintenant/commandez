-- 024_demo_orders.sql
-- Enable full demo order flow: advance status via RPC, expose is_demo in tracking, auto-cleanup

-- 1. RPC to advance demo order status (SECURITY DEFINER to bypass RLS UPDATE)
CREATE OR REPLACE FUNCTION advance_demo_order(p_order_id UUID, p_new_status TEXT)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
  restaurant_demo BOOLEAN;
BEGIN
  -- Verify order belongs to a demo restaurant
  SELECT o.status, r.is_demo
  INTO current_status, restaurant_demo
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT restaurant_demo THEN
    RAISE EXCEPTION 'Not a demo order';
  END IF;

  -- Validate status transition
  IF NOT (
    (current_status = 'new' AND p_new_status = 'preparing') OR
    (current_status = 'preparing' AND p_new_status = 'ready') OR
    (current_status = 'ready' AND p_new_status = 'done')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', current_status, p_new_status;
  END IF;

  -- Update status and timestamps
  UPDATE orders SET
    status = p_new_status,
    accepted_at = CASE WHEN p_new_status = 'preparing' THEN NOW() ELSE accepted_at END,
    ready_at = CASE WHEN p_new_status = 'ready' THEN NOW() ELSE ready_at END,
    completed_at = CASE WHEN p_new_status = 'done' THEN NOW() ELSE completed_at END
  WHERE id = p_order_id;

  RETURN QUERY SELECT * FROM orders WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION advance_demo_order(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION advance_demo_order(UUID, TEXT) TO authenticated;

-- 2. Update get_order_for_tracking to include is_demo flag
CREATE OR REPLACE FUNCTION get_order_for_tracking(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'daily_number', o.daily_number,
    'payment_method', o.payment_method,
    'status', o.status,
    'items', o.items,
    'subtotal', o.subtotal,
    'total', o.total,
    'order_type', o.order_type,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'customer_email', o.customer_email,
    'pickup_time', o.pickup_time,
    'created_at', o.created_at,
    'accepted_at', o.accepted_at,
    'ready_at', o.ready_at,
    'completed_at', o.completed_at,
    'restaurant_id', o.restaurant_id,
    'restaurant', jsonb_build_object(
      'name', r.name,
      'slug', r.slug,
      'primary_color', r.primary_color,
      'restaurant_phone', r.restaurant_phone,
      'is_demo', r.is_demo
    )
  ) INTO result
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id;

  RETURN result;
END;
$$;

-- 3. Cleanup old demo orders (called by pg_cron)
CREATE OR REPLACE FUNCTION cleanup_demo_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM orders
  WHERE restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true)
    AND created_at < NOW() - INTERVAL '4 hours';

  DELETE FROM restaurant_customers
  WHERE restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true)
    AND created_at < NOW() - INTERVAL '4 hours';
END;
$$;

-- Schedule cleanup every 4 hours via pg_cron (if extension available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-demo-orders');
    PERFORM cron.schedule('cleanup-demo-orders', '0 */4 * * *', 'SELECT cleanup_demo_orders()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available, skip
  NULL;
END;
$$;
