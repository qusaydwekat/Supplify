-- Restrict app to ILS (Israeli shekel), USD, and JOD only; refresh FX rows and normalize legacy codes.

delete from public.currency_rates;

insert into public.currency_rates (currency_code, to_default_multiplier) values
  ('USD', 1),
  ('JOD', 1.41),
  ('ILS', 0.27);

update public.app_settings
set default_currency = 'USD'
where id = 1
  and (
    default_currency is null
    or length(trim(default_currency::text)) <> 3
    or upper(trim(default_currency::text)) not in ('USD', 'JOD', 'ILS')
  );

update public.suppliers
set currency_code = 'USD'
where currency_code is null
  or length(trim(currency_code)) <> 3
  or upper(trim(currency_code)) not in ('USD', 'JOD', 'ILS', 'NIS');

update public.suppliers
set currency_code = 'ILS'
where upper(trim(currency_code)) = 'NIS';

update public.invoices i
set currency_code = s.currency_code
from public.suppliers s
where i.supplier_id = s.id
  and (
    i.currency_code is null
    or length(trim(i.currency_code)) <> 3
    or upper(trim(i.currency_code)) not in ('USD', 'JOD', 'ILS', 'NIS')
  );

update public.invoices
set currency_code = 'ILS'
where upper(trim(currency_code)) = 'NIS';

update public.payments p
set payment_currency = case upper(trim(coalesce(i.currency_code, 'USD')))
  when 'NIS' then 'ILS'
  else upper(trim(coalesce(i.currency_code, 'USD')))
end
from public.invoices i
where p.invoice_id = i.id
  and (
    p.payment_currency is null
    or length(trim(p.payment_currency)) <> 3
    or upper(trim(p.payment_currency)) not in ('USD', 'JOD', 'ILS', 'NIS')
  );

update public.payments
set payment_currency = 'ILS'
where upper(trim(payment_currency)) = 'NIS';
