-- Fix low-stock notification i18n keys/params (058 regression used notifications.low_stock.*).

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
  v_threshold := public.variation_low_stock_threshold(NEW.min_order_quantity, NEW.reorder_point);

  if NEW.stock_quantity > v_threshold then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.stock_quantity <= public.variation_low_stock_threshold(OLD.min_order_quantity, OLD.reorder_point) then
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
    NEW.product_id,
    'product'
  );

  return NEW;
end;
$$;

-- Backfill existing unread low-stock notifications with correct keys/params.
update public.notifications n
set
  title_key = 'lowStock.title',
  message_key = 'lowStock.message',
  params = jsonb_build_object(
    'product', coalesce(n.params->>'product', n.params->>'productName', 'Product'),
    'variation', coalesce(n.params->>'variation', n.params->>'variationName', ''),
    'stock', coalesce((n.params->>'stock')::int, (n.params->>'quantity')::int, 0),
    'threshold', coalesce((n.params->>'threshold')::int, 0)
  )
where n.type = 'low_stock'
  and (
    n.title_key in ('notifications.low_stock.title', 'Notifications.notifications.low_stock.title')
    or n.message_key in ('notifications.low_stock.message', 'Notifications.notifications.low_stock.message')
    or n.params ? 'productName'
    or n.params ? 'quantity'
  );
