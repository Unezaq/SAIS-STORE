-- ========================================================================
-- SAIS Store — Demo data (INSERTs only)
-- Schema is created by supabase/migrations/20261118_sais_store_schema.sql.
-- Run this in Supabase SQL Editor AFTER the migration.
-- ========================================================================

-- Default store settings (singleton, id = 1)
insert into public.settings (
  id, store_name, whatsapp_phone, delivery_text, payment_text, currency,
  delivery_fee, free_delivery_min_items, storewide_discount_percent
) values (
  1, 'SAIS Store', '212644816544', 'Livraison 24–48h partout au Maroc',
  'Paiement à la livraison', 'MAD', 22.00, 3, 0.00
) on conflict (id) do nothing;

-- Demo products (id = uuid; slug must be unique; stock > 0 so they can be ordered)
insert into public.products (
  id, title, slug, slug_category, category_name, price, original_price,
  image_url, colors, color_images, sizes, fabric, features, badge, ref, description, stock
) values
(
  gen_random_uuid(),
  'Pyjama Polaire Enfants',
  'pyjama-polaire-enfants',
  'pyjamas',
  'Pyjamas Polaires',
  299.00,
  null,
  '/products/sais-13.jpg',
  '[{"name":"Rose","hex":"#E91E63"},{"name":"Bleu","hex":"#3F51B5"}]',
  '{}',
  array['S','M','L','XL'],
  'Polaire',
  array['Doux','Chaud','Lavable'],
  null,
  'PYJ-01',
  'Pyjama polaire pour enfants, confortable et chaud.',
  50
),
(
  gen_random_uuid(),
  'Peignoir Satin Hiver',
  'peignoir-satin-hiver',
  'peignoirs',
  'Peignoirs',
  450.00,
  590.00,
  '/products/sais-04.jpg',
  '[{"name":"Crème","hex":"#FFF5E1"},{"name":"Vert","hex":"#1B4332"}]',
  '{}',
  array['M','L','XL'],
  'Satin',
  array['Léger','Élégant'],
  'Promo',
  'PEIG-02',
  'Peignoir en satin, idéal pour l’hiver.',
  30
),
(
  gen_random_uuid(),
  'Ensemble Hiver Femme',
  'ensemble-hiver-femme',
  'ensembles',
  'Ensembles Hiver',
  690.00,
  null,
  '/products/sais-17.jpg',
  '[{"name":"Noir","hex":"#1A1A1A"},{"name":"Beige","hex":"#F5F5DC"}]',
  '{}',
  array['S','M','L','XL'],
  'Laine',
  array['Chaud','Confortable'],
  null,
  'ENS-03',
  'Ensemble hiver deux pièces pour femme.',
  20
)
on conflict (slug) do nothing;

-- ========================================================================
-- End of demo data
-- ========================================================================
