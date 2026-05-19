-- Storage buckets for product images and supplier logos (fixes "Bucket not found").
-- Create in Dashboard: Storage → New bucket, or run this in the SQL Editor / `supabase db push`.

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('supplier-logos', 'supplier-logos', true)
on conflict (id) do update set
  public = excluded.public,
  name = excluded.name;

-- RLS on storage.objects (required for uploads with the anon/authenticated API keys)

drop policy if exists "product_images_select" on storage.objects;
create policy "product_images_select"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "supplier_logos_select" on storage.objects;
create policy "supplier_logos_select"
  on storage.objects for select
  using (bucket_id = 'supplier-logos');

drop policy if exists "supplier_logos_insert" on storage.objects;
create policy "supplier_logos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'supplier-logos');

drop policy if exists "supplier_logos_update" on storage.objects;
create policy "supplier_logos_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'supplier-logos')
  with check (bucket_id = 'supplier-logos');

drop policy if exists "supplier_logos_delete" on storage.objects;
create policy "supplier_logos_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'supplier-logos');
