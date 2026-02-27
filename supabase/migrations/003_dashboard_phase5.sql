-- Phase 5: Dashboard settings columns
alter table public.restaurants
  add column if not exists availability_mode text default 'manual',
  add column if not exists schedule jsonb default '[]',
  add column if not exists order_mode text default 'pickup_delivery',
  add column if not exists notification_sound text default 'default',
  add column if not exists prep_time_config jsonb default '{"default_minutes":20,"per_item_minutes":3,"max_minutes":90}';

-- Storage bucket for restaurant images (logo, cover)
insert into storage.buckets (id, name, public) values ('restaurant-images', 'restaurant-images', true)
on conflict (id) do nothing;

create policy "restaurant_images_public_read" on storage.objects for select using (bucket_id = 'restaurant-images');
create policy "restaurant_images_auth_upload" on storage.objects for insert with check (bucket_id = 'restaurant-images' and auth.role() = 'authenticated');
create policy "restaurant_images_auth_update" on storage.objects for update using (bucket_id = 'restaurant-images' and auth.role() = 'authenticated');
create policy "restaurant_images_auth_delete" on storage.objects for delete using (bucket_id = 'restaurant-images' and auth.role() = 'authenticated');
