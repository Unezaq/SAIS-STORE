begin;

alter table public.settings
  add column if not exists delivery_fee integer not null default 22 check (delivery_fee >= 0),
  add column if not exists free_delivery_min_items integer not null default 3 check (free_delivery_min_items >= 0),
  add column if not exists storewide_discount_percent integer not null default 0 check (storewide_discount_percent between 0 and 90),
  add column if not exists discount_start_date date,
  add column if not exists discount_end_date date;

alter table public.orders
  add column if not exists subtotal integer not null default 0,
  add column if not exists delivery_fee integer not null default 0;

update public.orders
set subtotal = total
where subtotal = 0 and total > 0;

update public.settings
set whatsapp_phone = '212644816544'
where id = 1 and whatsapp_phone = '212600000000';

commit;
