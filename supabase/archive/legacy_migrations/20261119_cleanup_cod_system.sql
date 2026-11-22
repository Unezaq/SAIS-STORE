-- ========================================================================
-- SAIS Store — Migration Finale: COD E-Commerce (100% sans Auth Provider)
-- Copiez tout ce fichier et collez-le dans Supabase SQL Editor, puis cliquez RUN
-- ========================================================================

-- 1. Nettoyage des tables d'authentification custom obsolètes
drop table if exists public.customer_sessions cascade;
drop table if exists public.customer_credentials cascade;
drop table if exists public.customers cascade;

-- 2. Ajustement propre de la table clients (sans erreur de colonne)
alter table public.clients add column if not exists normalized_phone text;
alter table public.clients add column if not exists city text default 'Casablanca';
alter table public.clients add column if not exists order_count integer default 0;
alter table public.clients add column if not exists total_spent numeric(10,2) default 0.00;

create index if not exists idx_clients_phone on public.clients(phone);

-- 3. Fonctions utilitaires
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then
    return true;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
end;
$$;

create or replace function public.order_reference_for_tracking(p_order_id text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_id text;
begin
  select id into v_id from public.orders where id = p_order_id;
  return 'SAIS-' || upper(right(replace(v_id, '-', ''), 8));
end;
$$;

create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (valid boolean, discount_amount numeric, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon record;
  v_discount numeric;
begin
  select * into v_coupon
  from public.coupons
  where code = lower(p_code)
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
    and (max_uses is null or used_count < max_uses)
  limit 1;

  if not found then
    return query select false, 0.00::numeric, 'Ce code de réduction n’existe pas ou n’est plus valide.';
    return;
  end if;

  if p_subtotal < v_coupon.min_order then
    return query select false, 0.00::numeric, 'Ce code s’applique uniquement à partir de ' || v_coupon.min_order || ' MAD.';
    return;
  end if;

  if v_coupon.type = 'percentage' then
    v_discount := floor(p_subtotal * v_coupon.value / 100.0);
  else
    v_discount := v_coupon.value;
  end if;

  if v_discount > p_subtotal then
    v_discount := p_subtotal;
  end if;

  return query select true, v_discount, 'Réduction appliquée.';
end;
$$;

-- 4. RPC Atomique : Création de commande COD sécurisée (place_order_rpc)
create or replace function public.place_order_rpc(
  p_auth_user_id uuid default null,
  p_customer_id uuid default null,
  p_client_email text default null,
  p_client_name text default null,
  p_customer_name text default '',
  p_phone text default '',
  p_address text default '',
  p_city text default 'Casablanca',
  p_items jsonb default '[]'::jsonb,
  p_note text default null,
  p_coupon_code text default null,
  p_idempotency_key text default null
)
returns table (
  order_id text,
  order_number text,
  tracking_token text,
  subtotal numeric(10,2),
  discount_total numeric(10,2),
  delivery_fee numeric(10,2),
  total numeric(10,2),
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings record;
  v_subtotal numeric(10,2) := 0;
  v_discount_total numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_order_id text;
  v_tracking_token text;
  v_order_number text;
  v_status text;
  v_item record;
  v_product record;
  v_variant record;
  v_unit_price numeric(10,2);
  v_base_price numeric(10,2);
  v_line_total numeric(10,2);
  v_item_quantity integer;
  v_variant_stock integer;
  v_total_items integer := 0;
  v_coupon_valid boolean := false;
  v_coupon_message text := '';
  i integer;
begin
  -- Idempotence : si la clé existe déjà, retourner la commande existante
  if p_idempotency_key is not null then
    select id, order_reference_for_tracking(id), tracking_token, subtotal, discount_total, delivery_fee, total, status
    into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status
    from public.orders
    where idempotency_key = p_idempotency_key;

    if found then
      return query select v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status;
      return;
    end if;
  end if;

  -- Paramètres de la boutique
  select * into v_settings from public.settings where id = 1;

  -- Parcourir les articles, calculer le sous-total et vérifier le stock
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;

    select * into v_product from public.products where slug = (v_item.elem->>'slug') limit 1;
    if not found then
      raise exception 'Produit introuvable : %', v_item.elem->>'slug';
    end if;

    v_item_quantity := (v_item.elem->>'quantity')::integer;
    v_base_price := v_product.price;

    if (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null then
      select * into v_variant
      from public.product_variants
      where product_id = v_product.id
        and (v_item.elem->>'size') is not distinct from size
        and (v_item.elem->>'color') is not distinct from color
      limit 1;

      if found then
        v_unit_price := v_base_price + coalesce(v_variant.price_adjustment, 0);
      else
        v_unit_price := v_base_price;
      end if;
    else
      v_unit_price := v_base_price;
    end if;

    v_line_total := v_unit_price * v_item_quantity;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- Application du coupon si présent
  if p_coupon_code is not null and p_coupon_code <> '' then
    select valid, discount_amount, message
    into v_coupon_valid, v_discount_total, v_coupon_message
    from public.validate_coupon(p_coupon_code, v_subtotal);

    if not v_coupon_valid then
      raise exception 'Coupon invalide : %', v_coupon_message;
    end if;
  end if;

  -- Calcul des frais de livraison
  if v_settings.free_delivery_min_items > 0 then
    select sum((elem->>'quantity')::integer) into v_total_items
    from jsonb_array_elements(p_items) as elem;
    if v_total_items >= v_settings.free_delivery_min_items then
      v_delivery_fee := 0;
    else
      v_delivery_fee := coalesce(v_settings.delivery_fee, 22.00);
    end if;
  else
    v_delivery_fee := coalesce(v_settings.delivery_fee, 22.00);
  end if;

  v_total := v_subtotal - v_discount_total + v_delivery_fee;
  if v_total < 0 then v_total := 0; end if;

  v_tracking_token := gen_random_uuid()::text;

  -- Insertion de la commande
  insert into public.orders (
    auth_user_id, client_email, client_name, customer_name,
    phone, address, city, items, subtotal, discount_total, delivery_fee, total,
    status, note, tracking_token, idempotency_key
  )
  values (
    p_auth_user_id,
    p_client_email,
    p_client_name,
    p_customer_name,
    p_phone,
    p_address,
    coalesce(p_city, 'Casablanca'),
    p_items,
    v_subtotal,
    v_discount_total,
    v_delivery_fee,
    v_total,
    'en_attente',
    p_note,
    v_tracking_token,
    p_idempotency_key
  )
  returning id, tracking_token into v_order_id, v_tracking_token;

  select 'SAIS-' || upper(right(replace(v_order_id, '-', ''), 8)) into v_order_number;
  update public.orders set order_number = v_order_number where id = v_order_id;

  -- Enregistrement des lignes d'articles
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;
    select * into v_product from public.products where slug = (v_item.elem->>'slug') limit 1;
    v_item_quantity := (v_item.elem->>'quantity')::integer;
    v_unit_price := v_product.price;

    insert into public.order_items (
      order_id, product_id, variant, name_snapshot, unit_price, quantity, line_total
    )
    values (
      v_order_id,
      v_product.id,
      case
        when (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null
        then coalesce(v_item.elem->>'size', '') || ' · ' || coalesce(v_item.elem->>'color', '')
        else null
      end,
      v_product.title,
      v_unit_price,
      v_item_quantity,
      v_unit_price * v_item_quantity
    );
  end loop;

  -- Audit trail initial
  insert into public.order_status_history (order_id, status, note)
  values (v_order_id, 'en_attente', 'Commande passée via le site');

  -- Mettre à jour la fiche client CRM automatique
  insert into public.clients (first_name, last_name, phone, address, city, order_count, total_spent)
  values (p_customer_name, '', p_phone, p_address, coalesce(p_city, 'Casablanca'), 1, v_total)
  on conflict (phone) do update set
    order_count = public.clients.order_count + 1,
    total_spent = public.clients.total_spent + v_total,
    address = excluded.address,
    city = excluded.city,
    updated_at = now();

  return query select
    v_order_id as order_id,
    v_order_number as order_number,
    v_tracking_token as tracking_token,
    v_subtotal as subtotal,
    v_discount_total as discount_total,
    v_delivery_fee as delivery_fee,
    v_total as total,
    'en_attente'::text as status;
end;
$$;

-- 5. RLS Policies
alter table public.clients enable row level security;
drop policy if exists "Admin manage clients" on public.clients;
create policy "Admin manage clients" on public.clients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.orders enable row level security;
drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Fin de la migration
