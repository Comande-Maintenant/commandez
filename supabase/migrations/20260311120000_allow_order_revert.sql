-- Allow backward status transitions for orders (revert feature)
-- Updates advance_demo_order to support both forward and backward transitions

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

  -- Validate status transition (forward + backward)
  IF NOT (
    -- Forward
    (current_status = 'new' AND p_new_status = 'preparing') OR
    (current_status = 'preparing' AND p_new_status = 'ready') OR
    (current_status = 'ready' AND p_new_status = 'done') OR
    -- Backward
    (current_status = 'done' AND p_new_status = 'ready') OR
    (current_status = 'ready' AND p_new_status = 'preparing') OR
    (current_status = 'preparing' AND p_new_status = 'new') OR
    -- Skip (reject)
    (current_status = 'new' AND p_new_status = 'done')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', current_status, p_new_status;
  END IF;

  -- Update status and timestamps
  UPDATE orders SET
    status = p_new_status,
    -- Forward: set timestamps
    accepted_at = CASE WHEN p_new_status = 'preparing' THEN COALESCE(accepted_at, NOW()) ELSE
                  CASE WHEN p_new_status = 'new' THEN NULL ELSE accepted_at END END,
    ready_at = CASE WHEN p_new_status = 'ready' THEN NOW() ELSE
               CASE WHEN p_new_status IN ('new', 'preparing') THEN NULL ELSE ready_at END END,
    completed_at = CASE WHEN p_new_status = 'done' THEN NOW() ELSE NULL END,
    estimated_ready_at = CASE WHEN p_new_status = 'new' THEN NULL ELSE estimated_ready_at END
  WHERE id = p_order_id;

  RETURN QUERY SELECT * FROM orders WHERE id = p_order_id;
END;
$$;
