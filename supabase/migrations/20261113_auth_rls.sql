begin;

alter table public.clients
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

alter table public.orders
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists idx_clients_auth_user_id
  on public.clients(auth_user_id);
create index if not exists idx_orders_auth_user_id
  on public.orders(auth_user_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.clients enable row level security;
alter table public.client_accounts enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.settings enable row level security;

drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products
  for select to anon, authenticated using (true);

drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "Users can read own client account" on public.client_accounts;
drop policy if exists "Users can read own clients profile" on public.clients;
create policy "Users can read own clients profile" on public.clients
  for select to authenticated using (auth_user_id = (select auth.uid()));

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders" on public.orders
  for select to authenticated using (auth_user_id = (select auth.uid()));

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products" on public.products
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders" on public.orders
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage clients" on public.clients;
create policy "Admins can manage clients" on public.clients
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage settings" on public.settings;
create policy "Admins can manage settings" on public.settings
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

commit;
