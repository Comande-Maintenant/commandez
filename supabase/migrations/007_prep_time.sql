ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS prep_time_config jsonb DEFAULT '{"default_minutes": 15, "per_item_minutes": 2, "max_minutes": 45}';
