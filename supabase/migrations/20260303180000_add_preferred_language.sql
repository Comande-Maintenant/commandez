-- Add preferred_language column to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr';
