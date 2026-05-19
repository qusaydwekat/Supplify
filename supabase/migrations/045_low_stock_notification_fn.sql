-- Re-apply low stock notify function so notifications always store title_key / message_key / params
-- (helps databases where an older trigger omitted i18n columns).

create or replace function public.notify_low_stock_on_variation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold int;
  v_supplier_user_id uuid;
  v_product_name text;
begin
  v_threshold := greatest(NEW.min_order_quantity * 2, 1);

  if NEW.stock_quantity > v_threshold then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.stock_quantity <= v_threshold then
      return NEW;
    end if;
  end if;

  select s.user_id, p.name
  into v_supplier_user_id, v_product_name
  from public.products p
  join public.suppliers s on s.id = p.supplier_id
  where p.id = NEW.product_id;

  if v_supplier_user_id is null then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, title, message, title_key, message_key, params, reference_id, reference_type)
  values (
    v_supplier_user_id,
    'low_stock',
    'Low stock alert',
    coalesce(v_product_name, 'A product') || ' — ' || NEW.name || ' is at ' || NEW.stock_quantity::text || ' units (threshold ' || v_threshold::text || ').',
    'lowStock.title',
    'lowStock.message',
    jsonb_build_object(
      'product', coalesce(v_product_name, 'A product'),
      'variation', NEW.name,
      'stock', NEW.stock_quantity,
      'threshold', v_threshold
    ),
    NEW.id,
    'variation'
  );

  return NEW;
end;
$$;
