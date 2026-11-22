# SAIS STORE — Database Schema Specification

**Version:** 2.0 (Production Canonical Schema)  
**Target Engine:** PostgreSQL 15+ (Supabase)  
**Standard:** Strict Constraints, Row Level Security, Atomic RPCs

---

## 1. Tables Specification

### 1.1. `public.settings` (Store Configuration Singleton)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `integer` | `PRIMARY KEY DEFAULT 1 CHECK (id = 1)` | Enforces singleton record. |
| `store_name` | `text` | `NOT NULL DEFAULT 'SAIS Store'` | Branding name. |
| `whatsapp_phone` | `text` | `NOT NULL DEFAULT '212644816544'` | WhatsApp contact phone (E.164 without +). |
| `delivery_text` | `text` | `NOT NULL` | Promotional shipping notice. |
| `payment_text` | `text` | `NOT NULL` | Payment terms notice (COD). |
| `currency` | `text` | `NOT NULL DEFAULT 'MAD'` | Store currency. |
| `delivery_fee` | `numeric(10,2)` | `NOT NULL DEFAULT 22.00 CHECK (>= 0)` | Base delivery fee in MAD. |
| `free_delivery_min_items` | `integer` | `NOT NULL DEFAULT 3 CHECK (>= 0)` | Threshold for free delivery. |
| `storewide_discount_percent`| `numeric(5,2)` | `NOT NULL DEFAULT 0.00 CHECK (BETWEEN 0 AND 90)` | Global promotion percentage. |
| `discount_start_date` | `date` | `NULL` | Promotion activation start. |
| `discount_end_date` | `date` | `NULL` | Promotion activation end. |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last modification timestamp. |

### 1.2. `public.products` (Product Catalog)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Immutable internal identifier. |
| `title` | `text` | `NOT NULL` | Product name in French. |
| `slug` | `text` | `NOT NULL UNIQUE` | URL slug (e.g. `ensemble-velours-bleu`). |
| `slug_category` | `text` | `NOT NULL DEFAULT 'ensembles'` | Category identifier. |
| `category_name` | `text` | `NOT NULL DEFAULT 'Ensembles Hiver'` | Human-readable category title. |
| `price` | `numeric(10,2)` | `NOT NULL CHECK (>= 0)` | Regular selling price in MAD. |
| `original_price` | `numeric(10,2)` | `CHECK (NULL OR >= 0)` | Crossed-out compare-at price in MAD. |
| `image_url` | `text` | `NOT NULL` | Primary product photo URL. |
| `colors` | `jsonb` | `DEFAULT '[]'::jsonb` | Array of color objects `[{name, hex}]`. |
| `color_images` | `jsonb` | `DEFAULT '{}'::jsonb` | Map of color name to image URL. |
| `sizes` | `text[]` | `DEFAULT ARRAY['S','M','L','XL']` | Available size tags. |
| `fabric` | `text` | `NULL` | Material specification (e.g. 'Velours côtelé'). |
| `features` | `text[]` | `DEFAULT ARRAY[]::text[]` | Key bullet points. |
| `badge` | `text` | `NULL` | Merchandising badge ('Nouveau', 'Populaire'). |
| `ref` | `text` | `NULL` | Internal inventory reference code. |
| `description` | `text` | `NULL` | Marketing & fit copy. |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Controls public catalog visibility. |
| `stock` | `integer` | `NOT NULL DEFAULT 0 CHECK (>= 0)` | Master stock counter. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Row creation timestamp. |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Row update timestamp. |

### 1.3. `public.product_variants` (Variant-Level Stock)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Variant identifier. |
| `product_id` | `uuid` | `NOT NULL REFERENCES products(id) ON DELETE CASCADE` | Parent product link. |
| `size` | `text` | `NULL` | Size tag (e.g. 'M', 'L'). |
| `color` | `text` | `NULL` | Color name (e.g. 'Bleu nuit'). |
| `stock` | `integer` | `NOT NULL DEFAULT 0 CHECK (>= 0)` | Dedicated variant inventory. |
| `price_adjustment`| `numeric(10,2)` | `NOT NULL DEFAULT 0.00` | Price delta relative to base product. |
| `sku` | `text` | `NULL` | Stock Keeping Unit. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Update timestamp. |

*Constraint:* `UNIQUE (product_id, size, color)`

### 1.4. `public.orders` (Purchase Orders)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('ord-' \|\| substr(replace(gen_random_uuid()::text,'-',''),1,12))` | Public order ID (e.g. `ord-1a2b3c4d5e6f`). |
| `order_number` | `text` | `NOT NULL UNIQUE` | Human-readable reference (`SAIS-XXXXXXXX`). |
| `tracking_token` | `text` | `NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-','')` | 128-bit unguessable public tracking token. |
| `idempotency_key`| `text` | `UNIQUE` | Unique token preventing double checkout submission. |
| `customer_name` | `text` | `NOT NULL` | Customer full name. |
| `phone` | `text` | `NOT NULL` | Normalized Moroccan phone (`+212XXXXXXXXX`). |
| `city` | `text` | `NOT NULL` | Delivery destination city. |
| `address` | `text` | `NOT NULL` | Full street delivery address. |
| `client_email` | `text` | `NULL` | Customer email if provided. |
| `client_name` | `text` | `NULL` | Secondary contact name. |
| `items` | `jsonb` | `NOT NULL DEFAULT '[]'::jsonb` | JSON snapshot of ordered line items. |
| `subtotal` | `numeric(10,2)` | `NOT NULL DEFAULT 0.00 CHECK (>= 0)` | Sum of line items before discounts. |
| `discount_total` | `numeric(10,2)` | `NOT NULL DEFAULT 0.00 CHECK (>= 0)` | Coupon + promotion discounts deducted. |
| `delivery_fee` | `numeric(10,2)` | `NOT NULL DEFAULT 0.00 CHECK (>= 0)` | Shipping charge applied. |
| `total` | `numeric(10,2)` | `NOT NULL DEFAULT 0.00 CHECK (>= 0)` | Final payable amount at delivery. |
| `status` | `text` | `NOT NULL DEFAULT 'en_attente' CHECK in ('en_attente','confirmee','expediee','livree','annulee')` | Order fulfillment status. |
| `payment_method` | `text` | `NOT NULL DEFAULT 'cod'` | Payment method. |
| `payment_status` | `text` | `NOT NULL DEFAULT 'unpaid'` | Payment status. |
| `note` | `text` | `NULL` | Customer delivery instruction or sizing note. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Order placement timestamp. |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last order update timestamp. |

### 1.5. `public.order_items` (Order Line Snapshots)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Line item ID. |
| `order_id` | `text` | `NOT NULL REFERENCES orders(id) ON DELETE CASCADE` | Parent order link. |
| `product_id` | `uuid` | `NOT NULL REFERENCES products(id)` | Product FK. |
| `variant` | `text` | `NULL` | Color / Size string snapshot. |
| `name_snapshot` | `text` | `NOT NULL` | Title snapshot at moment of purchase. |
| `unit_price` | `numeric(10,2)` | `NOT NULL CHECK (>= 0)` | Unit price charged in MAD. |
| `quantity` | `integer` | `NOT NULL CHECK (>= 1)` | Quantity purchased. |
| `line_total` | `numeric(10,2)` | `NOT NULL CHECK (>= 0)` | `unit_price * quantity`. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Snapshot timestamp. |

### 1.6. `public.order_status_history` (Order Timeline Audit)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | History entry ID. |
| `order_id` | `text` | `NOT NULL REFERENCES orders(id) ON DELETE CASCADE` | Parent order link. |
| `status` | `text` | `NOT NULL CHECK in ('en_attente','confirmee','expediee','livree','annulee')` | Status logged. |
| `note` | `text` | `NULL` | Status transition note. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Timestamp of transition. |

### 1.7. `public.clients` (Customer CRM Directory)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Client record ID. |
| `phone` | `text` | `NOT NULL UNIQUE` | Primary customer key (`+212XXXXXXXXX`). |
| `first_name` | `text` | `NOT NULL` | Customer first name. |
| `last_name` | `text` | `NOT NULL` | Customer last name. |
| `email` | `text` | `NULL` | Customer email address. |
| `city` | `text` | `NOT NULL DEFAULT 'Casablanca'` | Default shipping city. |
| `address` | `text` | `NULL` | Default shipping address. |
| `order_count` | `integer` | `NOT NULL DEFAULT 0 CHECK (>= 0)` | Cumulative order counter. |
| `total_spent` | `numeric(10,2)` | `NOT NULL DEFAULT 0.00 CHECK (>= 0)` | Lifetime spent in MAD. |
| `created_at` | `timestamptz` | `DEFAULT now()` | First seen timestamp. |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last activity timestamp. |

### 1.8. `public.coupons` (Discount Coupons)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Coupon ID. |
| `code` | `text` | `NOT NULL UNIQUE` | Promo code in lowercase. |
| `type` | `text` | `NOT NULL CHECK in ('percentage','fixed')` | Discount type. |
| `value` | `numeric(10,2)` | `NOT NULL CHECK (> 0)` | Percent (e.g. 15.00) or MAD amount (e.g. 50.00). |
| `min_order` | `numeric(10,2)` | `NOT NULL DEFAULT 0.00 CHECK (>= 0)` | Minimum basket subtotal required. |
| `starts_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Start of validity. |
| `expires_at` | `timestamptz` | `NULL` | Expiration timestamp. |
| `max_uses` | `integer` | `CHECK (NULL OR > 0)` | Global redemption quota. |
| `used_count` | `integer` | `NOT NULL DEFAULT 0 CHECK (>= 0)` | Enforced redemption counter. |
| `per_user_limit`| `integer` | `NULL` | Per-phone limit. |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Active flag. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Update timestamp. |

### 1.9. `public.profiles` (Administrator Profiles)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Links to Supabase Auth user. |
| `full_name` | `text` | `NULL` | Administrator name. |
| `phone` | `text` | `NULL` | Administrator phone. |
| `role` | `text` | `NOT NULL DEFAULT 'customer' CHECK in ('customer','admin')` | Authorization role. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Registration timestamp. |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Update timestamp. |
