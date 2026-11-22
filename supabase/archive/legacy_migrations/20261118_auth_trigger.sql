-- ========================================================================
-- SAIS Store — Auth trigger: create profiles row on Supabase Auth signup
-- Run AFTER supabase/migrations/20261118_sais_store_schema.sql
-- ========================================================================

-- Ajout des colonnes city/address à profiles (si absent)
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists address text;

-- Fonction trigger: crée une ligne profiles (role='customer') quand un nouvel
-- utilisateur s'inscrit via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Déclencheur sur auth.users après chaque insertion (signup)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========================================================================
-- End
-- ========================================================================
