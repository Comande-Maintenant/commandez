BEGIN;
-- Old clients serialize absent choices as JSON null. Treat only absent/null as an empty array; malformed objects remain invalid.
CREATE OR REPLACE FUNCTION public.calculate_order_total(
  p_restaurant_id UUID,
  p_items JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  item_row public.menu_items%ROWTYPE;
  choice JSONB;
  selection JSONB;
  canonical JSONB;
  choices JSONB;
  selections JSONB;
  restaurant_cuisine TEXT;
  step_key TEXT;
  selection_id TEXT;
  selection_name TEXT;
  selection_size TEXT;
  unit_total NUMERIC;
  calculated_total NUMERIC := 0;
  canonical_price NUMERIC;
  config_free_sauces INTEGER := 3;
  config_free_frites_sauces INTEGER := 2;
  config_extra_sauce NUMERIC := 0.50;
  config_free_accomp INTEGER := 1;
  config_extra_accomp NUMERIC := 0;
  base_max_viandes INTEGER := 1;
  selection_count INTEGER;
  sauce_count INTEGER;
  quantity INTEGER;
  has_custom_sauces BOOLEAN;
  seen_ids TEXT[];
BEGIN
  SELECT cuisine_type
  INTO restaurant_cuisine
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN NULL;
  END IF;

  SELECT
    coalesce(free_sauces_sandwich, 3),
    coalesce(free_sauces_frites, 2),
    coalesce(extra_sauce_price, 0.50),
    coalesce(free_accompagnements, 1),
    coalesce(extra_accompagnement_price, 0)
  INTO
    config_free_sauces,
    config_free_frites_sauces,
    config_extra_sauce,
    config_free_accomp,
    config_extra_accomp
  FROM public.restaurant_order_config
  WHERE restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    config_free_sauces:=3; config_free_frites_sauces:=2;
    config_extra_sauce:=0.50; config_free_accomp:=1; config_extra_accomp:=0;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    quantity := coalesce((item->>'quantity')::INTEGER, 1);
    SELECT *
    INTO item_row
    FROM public.menu_items
    WHERE id = (item->>'menu_item_id')::UUID
      AND restaurant_id = p_restaurant_id
      AND enabled = true
      AND coalesce(is_alcohol, false) = false;

    IF NOT FOUND OR quantity < 1 OR quantity > 50 THEN
      RETURN NULL;
    END IF;

    unit_total := item_row.price;
    base_max_viandes := 1;
    choices := coalesce(nullif(item->'custom_choices', 'null'::jsonb), '[]'::jsonb);
    IF jsonb_typeof(choices) <> 'array' OR jsonb_array_length(choices) > 30 THEN
      RETURN NULL;
    END IF;

    -- Reject duplicate step objects, which would otherwise permit ambiguous bills.
    IF (
      SELECT count(*) <> count(DISTINCT value->>'stepKey')
      FROM jsonb_array_elements(choices)
    ) THEN
      RETURN NULL;
    END IF;

    -- A unit price has one source: a variant or a base, never both.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(choices) WHERE value->>'stepKey' = 'variant')
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(choices) WHERE value->>'stepKey' = 'base')
    THEN
      RETURN NULL;
    END IF;

    has_custom_sauces := EXISTS (
      SELECT 1 FROM jsonb_array_elements(choices)
      WHERE value->>'stepKey' = 'sauce'
    );

    -- Resolve the unit price and meat capacity before additive extras. The client
    -- controls array order and must not be able to reset an already added price.
    FOR choice IN
      SELECT value FROM jsonb_array_elements(choices) WITH ORDINALITY AS entry(value, position)
      ORDER BY CASE WHEN value->>'stepKey' IN ('base', 'variant') THEN 0 ELSE 1 END, position
    LOOP
      step_key := choice->>'stepKey';
      selections := coalesce(choice->'selections', '[]'::jsonb);
      IF step_key IS NULL
        OR jsonb_typeof(selections) <> 'array'
        OR jsonb_array_length(selections) > 50
      THEN
        RETURN NULL;
      END IF;
      selection_count := jsonb_array_length(selections);

      IF step_key = 'variant' THEN
        IF selection_count <> 1 THEN RETURN NULL; END IF;
        selection := selections->0;
        SELECT value INTO canonical
        FROM jsonb_array_elements(coalesce(item_row.variants, '[]'::jsonb))
        WHERE value->>'name' = coalesce(selection->>'name', selection->>'id')
        LIMIT 1;
        IF canonical IS NULL THEN RETURN NULL; END IF;
        unit_total := (canonical->>'price')::NUMERIC;

      ELSIF step_key = 'base' THEN
        IF selection_count <> 1 THEN RETURN NULL; END IF;
        selection := selections->0;
        SELECT price, max_viandes
        INTO canonical_price, base_max_viandes
        FROM public.restaurant_bases
        WHERE id = (selection->>'id')::UUID
          AND restaurant_id = p_restaurant_id
          AND enabled = true
          AND ("group" IS NULL OR "group" = item_row.product_type)
        LIMIT 1;
        IF NOT FOUND THEN RETURN NULL; END IF;
        unit_total := canonical_price;

      ELSIF step_key = 'viande' THEN
        IF selection_count > base_max_viandes THEN RETURN NULL; END IF;
        selection_count := 0;
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          SELECT supplement INTO canonical_price
          FROM public.restaurant_viandes
          WHERE id = (split_part(selection->>'id', '__', 1))::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + canonical_price;
          IF selection_count > 0 THEN
            SELECT coalesce((config->>'extra_viande_price')::NUMERIC, 0)
            INTO canonical_price
            FROM public.cuisine_step_templates template
            WHERE template.cuisine_type = restaurant_cuisine
              AND template.step_key = 'viande'
            ORDER BY template.sort_order
            LIMIT 1;
            unit_total := unit_total + coalesce(canonical_price, 0);
          END IF;
          selection_count := selection_count + 1;
        END LOOP;

      ELSIF step_key = 'sauce' OR step_key = 'frites_sauce' THEN
        seen_ids := ARRAY[]::TEXT[];
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := selection->>'id';
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          IF NOT EXISTS (
            SELECT 1 FROM public.restaurant_sauces
            WHERE id = selection_id::UUID
              AND restaurant_id = p_restaurant_id
              AND enabled = true
              AND CASE WHEN step_key = 'frites_sauce'
                THEN is_for_frites ELSE is_for_sandwich END
          ) THEN RETURN NULL; END IF;
        END LOOP;
        sauce_count := selection_count;
        IF step_key = 'frites_sauce' THEN
          unit_total := unit_total
            + greatest(0, sauce_count - config_free_frites_sauces) * config_extra_sauce;
        ELSE
          unit_total := unit_total
            + greatest(0, sauce_count - config_free_sauces) * config_extra_sauce;
        END IF;

      ELSIF step_key = 'frites' THEN
        IF selection_count > 1 THEN RETURN NULL; END IF;
        IF selection_count = 1 THEN
          selection := selections->0;
          SELECT option.value INTO canonical
          FROM public.cuisine_step_templates template,
            LATERAL jsonb_array_elements(coalesce(template.config->'options', '[]'::jsonb)) AS option(value)
          WHERE template.cuisine_type = restaurant_cuisine
            AND template.step_key = 'frites'
            AND option->>'id' = selection->>'id'
          LIMIT 1;
          IF canonical IS NULL THEN RETURN NULL; END IF;
          unit_total := unit_total + (canonical->>'price')::NUMERIC;
        END IF;

      ELSIF step_key IN ('supplement', 'boisson', 'dessert') THEN
        IF step_key IN ('boisson', 'dessert') AND selection_count > 1 THEN
          RETURN NULL;
        END IF;
        seen_ids := ARRAY[]::TEXT[];
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := split_part(selection->>'id', '__', 1);
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          SELECT price INTO canonical_price
          FROM public.menu_items
          WHERE id = selection_id::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true
            AND coalesce(is_alcohol, false) = false
            AND product_type = step_key;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + canonical_price;
        END LOOP;

      ELSIF step_key = 'accompagnement' THEN
        seen_ids := ARRAY[]::TEXT[];
        selection_count := 0;
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := selection->>'id';
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          selection_size := coalesce(selection#>>'{meta,size}', 'default');
          SELECT CASE selection_size
            WHEN 'small' THEN price_small
            WHEN 'medium' THEN price_medium
            WHEN 'large' THEN price_large
            ELSE price_default
          END
          INTO canonical_price
          FROM public.restaurant_accompagnements
          WHERE id = selection_id::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + coalesce(canonical_price, 0);
          IF selection_count >= config_free_accomp THEN
            unit_total := unit_total + config_extra_accomp;
          END IF;
          selection_count := selection_count + 1;
        END LOOP;

      ELSIF step_key = 'garniture' THEN
        seen_ids := ARRAY[]::TEXT[];
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := selection->>'id';
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          SELECT CASE WHEN selection#>>'{meta,level}' = 'x2'
            THEN price_x2 ELSE 0 END
          INTO canonical_price
          FROM public.restaurant_garnitures
          WHERE id = selection_id::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + coalesce(canonical_price, 0);
        END LOOP;
      ELSE
        RETURN NULL;
      END IF;
    END LOOP;

    -- Legacy/simple-item sauces are whitelisted by the menu item itself. The
    -- configurable flow already supplied canonical sauce UUIDs above.
    IF NOT has_custom_sauces AND jsonb_array_length(coalesce(nullif(item->'sauces', 'null'::jsonb), '[]'::jsonb)) > 0 THEN
      seen_ids := ARRAY[]::TEXT[];
      FOR selection IN SELECT value FROM jsonb_array_elements(item->'sauces')
      LOOP
        selection_name := trim(both '"' from selection::TEXT);
        IF selection_name = ANY(seen_ids)
          OR NOT selection_name = ANY(coalesce(item_row.sauces, ARRAY[]::TEXT[]))
        THEN RETURN NULL; END IF;
        seen_ids := array_append(seen_ids, selection_name);
      END LOOP;
      unit_total := unit_total
        + greatest(0, cardinality(seen_ids) - config_free_sauces) * config_extra_sauce;
    END IF;

    -- Legacy/simple-item supplements are matched by name and repriced from the
    -- menu item's own JSON catalogue.
    IF jsonb_array_length(coalesce(nullif(item->'supplements', 'null'::jsonb), '[]'::jsonb)) > 0 THEN
      seen_ids := ARRAY[]::TEXT[];
      FOR selection IN SELECT value FROM jsonb_array_elements(item->'supplements')
      LOOP
        selection_name := selection->>'name';
        IF selection_name = ANY(seen_ids) THEN RETURN NULL; END IF;
        seen_ids := array_append(seen_ids, selection_name);
        SELECT value INTO canonical
        FROM jsonb_array_elements(coalesce(item_row.supplements, '[]'::jsonb))
        WHERE value->>'name' = selection_name
        LIMIT 1;
        IF canonical IS NULL THEN RETURN NULL; END IF;
        unit_total := unit_total + (canonical->>'price')::NUMERIC;
      END LOOP;
    END IF;

    calculated_total := calculated_total + unit_total * quantity;
  END LOOP;

  RETURN round(calculated_total, 2);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
