-- In-app notification when supplier marks a cheque as bounced (retailer).

do $nt$
begin
  alter type public.notification_type add value 'cheque_bounced';
exception
  when duplicate_object then null;
end
$nt$;
