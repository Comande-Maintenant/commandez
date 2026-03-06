-- Migration: Fix SEO for demo restaurant
-- Set is_demo = true on Antalya Kebab to trigger demo mode UI and SEO changes

UPDATE restaurants SET is_demo = true
WHERE id = '769f54f9-09a6-40a9-a490-26597a717646';
