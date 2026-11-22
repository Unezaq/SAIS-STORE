-- ========================================================================
-- SAIS Store — Canonical Baseline Seed Data
-- Database: PostgreSQL 15+ (Supabase)
-- Usage: Run in Supabase SQL Editor after 20261122_sais_store_production.sql
-- ========================================================================

-- 1. Default Store Settings
insert into public.settings (
  id, store_name, whatsapp_phone, delivery_text, payment_text, currency,
  delivery_fee, free_delivery_min_items, storewide_discount_percent
) values (
  1, 'SAIS Store', '212644816544', 'Livraison 24–48h partout au Maroc',
  'Paiement à la livraison', 'MAD', 22.00, 3, 0.00
) on conflict (id) do update set
  store_name = excluded.store_name,
  whatsapp_phone = excluded.whatsapp_phone,
  delivery_text = excluded.delivery_text,
  payment_text = excluded.payment_text,
  currency = excluded.currency,
  delivery_fee = excluded.delivery_fee,
  free_delivery_min_items = excluded.free_delivery_min_items;

-- 2. Welcome Coupon Code (10% off for orders over 200 MAD)
insert into public.coupons (
  id, code, type, value, min_order, starts_at, expires_at, max_uses, used_count, is_active
) values (
  gen_random_uuid(),
  'sais10',
  'percentage',
  10.00,
  200.00,
  now(),
  now() + interval '1 year',
  1000,
  0,
  true
) on conflict (code) do nothing;

-- 3. Core Seed Products
insert into public.products (
  id, title, slug, slug_category, category_name, price, original_price,
  image_url, colors, color_images, sizes, fabric, features, badge, ref, description, stock, is_active
) values
(
  gen_random_uuid(),
  'Pyjama Polaire Douceur',
  'pyjama-polaire-douceur',
  'pyjamas',
  'Pyjamas Polaires',
  299.00,
  null,
  '/products/sais-13.jpg',
  '[{"name":"Rose Poudré","hex":"#E8B4B8"},{"name":"Gris Perle","hex":"#C0C0C0"}]'::jsonb,
  '{}'::jsonb,
  array['S','M','L','XL'],
  'Polaire thermique',
  array['Chaleur douce','Tissu respirant','Toucher velours'],
  'Populaire',
  'PYJ-01',
  'Pyjama polaire ultra-doux conçu pour les soirées d’hiver au Maroc.',
  40,
  true
),
(
  gen_random_uuid(),
  'Peignoir Satin & Dentelle',
  'peignoir-satin-dentelle',
  'peignoirs',
  'Peignoirs',
  450.00,
  590.00,
  '/products/sais-04.jpg',
  '[{"name":"Crème","hex":"#FFF5E1"},{"name":"Vert Émeraude","hex":"#1B4332"}]'::jsonb,
  '{}'::jsonb,
  array['S','M','L','XL'],
  'Satin de soie',
  array['Coupe fluide','Finitions dentelle raffinée','Ceinture assortie'],
  'Promo',
  'PEIG-02',
  'Peignoir élégant en satin avec finitions dentelle délicate.',
  25,
  true
),
(
  gen_random_uuid(),
  'Ensemble Tricot Hivernal',
  'ensemble-tricot-hivernal',
  'ensembles',
  'Ensembles Hiver',
  690.00,
  null,
  '/products/sais-17.jpg',
  '[{"name":"Beige Sable","hex":"#D2B48C"},{"name":"Noir Profond","hex":"#1A1A1A"}]'::jsonb,
  '{}'::jsonb,
  array['S','M','L','XL'],
  'Maille tricotée douce',
  array['Maille côtelée','Pantalon fluide','Pull col rond chaud'],
  'Nouveau',
  'ENS-03',
  'Ensemble deux pièces en maille haut de gamme alliant confort et élégance.',
  30,
  true
)
on conflict (slug) do nothing;
