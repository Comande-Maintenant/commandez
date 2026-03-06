-- Migration: Update validate_order_total to support configurator extras
-- The extra_cost field covers frites, extra viande, base price diff, drink, etc.

CREATE OR REPLACE FUNCTION public.validate_order_total(p_items jsonb, p_claimed_total numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  calculated_total NUMERIC := 0;
  item_price NUMERIC;
  supplement_total NUMERIC;
  extra_cost NUMERIC;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT price INTO item_price FROM menu_items WHERE id = (item.value->>'menu_item_id')::UUID;
    IF item_price IS NULL THEN RETURN FALSE; END IF;

    supplement_total := 0;
    IF item.value ? 'supplements' AND jsonb_array_length(item.value->'supplements') > 0 THEN
      SELECT COALESCE(SUM((s.value->>'price')::NUMERIC), 0) INTO supplement_total
      FROM jsonb_array_elements(item.value->'supplements') s;
    END IF;

    -- Support configurator extras (frites, extra viande, base price diff, drink, etc.)
    extra_cost := COALESCE((item.value->>'extra_cost')::NUMERIC, 0);

    calculated_total := calculated_total + ((item_price + supplement_total + extra_cost) * COALESCE((item.value->>'quantity')::INT, 1));
  END LOOP;

  RETURN ABS(calculated_total - p_claimed_total) < 0.02;
END;
$function$;
