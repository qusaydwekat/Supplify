-- Supplier reviews: retailers rate suppliers after a delivered order.

-- Denormalized stats on suppliers (kept in sync by trigger below).
alter table public.suppliers
  add column if not exists avg_rating  numeric(2,1),
  add column if not exists review_count integer not null default 0;

-- Reviews table: one review per order.
create table if not exists public.supplier_reviews (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  supplier_id      uuid not null references public.suppliers(id) on delete cascade,
  retailer_id      uuid not null references public.users(id) on delete cascade,
  overall_rating   smallint not null check (overall_rating between 1 and 5),
  delivery_rating  smallint check (delivery_rating between 1 and 5),
  quality_rating   smallint check (quality_rating between 1 and 5),
  communication_rating smallint check (communication_rating between 1 and 5),
  comment          text,
  created_at       timestamptz not null default now(),
  constraint supplier_reviews_order_unique unique (order_id)
);

create index if not exists idx_supplier_reviews_supplier on public.supplier_reviews(supplier_id);
create index if not exists idx_supplier_reviews_retailer on public.supplier_reviews(retailer_id);

-- Trigger: recalc avg_rating + review_count on suppliers after insert.
create or replace function public.fn_update_supplier_rating_stats()
returns trigger language plpgsql security definer as $$
begin
  update public.suppliers
  set avg_rating   = (select round(avg(overall_rating)::numeric, 1) from public.supplier_reviews where supplier_id = NEW.supplier_id),
      review_count = (select count(*)::integer from public.supplier_reviews where supplier_id = NEW.supplier_id)
  where id = NEW.supplier_id;
  return NEW;
end;
$$;

drop trigger if exists trg_supplier_review_stats on public.supplier_reviews;
create trigger trg_supplier_review_stats
  after insert on public.supplier_reviews
  for each row execute function public.fn_update_supplier_rating_stats();

-- RLS
alter table public.supplier_reviews enable row level security;

-- Retailers can insert reviews for their own orders.
create policy "Retailers can insert own reviews"
  on public.supplier_reviews for insert
  with check (auth.uid() = retailer_id);

-- Retailers can read their own reviews.
create policy "Retailers can read own reviews"
  on public.supplier_reviews for select
  using (auth.uid() = retailer_id);

-- Suppliers can read reviews about them.
create policy "Suppliers can read reviews about them"
  on public.supplier_reviews for select
  using (
    supplier_id in (select id from public.suppliers where user_id = auth.uid())
  );

-- Anyone authenticated can read reviews (for storefront display).
create policy "Authenticated users can read reviews"
  on public.supplier_reviews for select
  using (auth.uid() is not null);
