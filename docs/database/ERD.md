# SAIS STORE — Entity Relationship Diagram (ERD)

**Version:** 2.0 (Production Canonical Schema)  
**Database:** PostgreSQL 15+ (Supabase)

---

## 1. Visual Entity Relationship Diagram

```mermaid
erDiagram
    SETTINGS {
        integer id PK "1 (singleton)"
        text store_name
        text whatsapp_phone
        text delivery_text
        text payment_text
        text currency "MAD"
        numeric delivery_fee "22.00"
        integer free_delivery_min_items "3"
        numeric storewide_discount_percent "0.00"
        date discount_start_date
        date discount_end_date
        timestamptz updated_at
    }

    PRODUCTS {
        uuid id PK
        text title
        text slug UK
        text slug_category
        text category_name
        numeric price
        numeric original_price
        text image_url
        jsonb colors
        jsonb color_images
        text_array sizes
        text fabric
        text_array features
        text badge
        text ref
        text description
        boolean is_active
        integer stock
        timestamptz created_at
        timestamptz updated_at
    }

    PRODUCT_VARIANTS {
        uuid id PK
        uuid product_id FK
        text size
        text color
        integer stock
        numeric price_adjustment
        text sku
        timestamptz created_at
        timestamptz updated_at
    }

    ORDERS {
        text id PK "ord-..."
        text order_number UK "SAIS-XXXXXXXX"
        text tracking_token UK "unguessable token"
        text idempotency_key UK
        text customer_name
        text phone "normalized +212..."
        text city
        text address
        text client_email
        text client_name
        jsonb items
        numeric subtotal
        numeric discount_total
        numeric delivery_fee
        numeric total
        text status "en_attente|confirmee|expediee|livree|annulee"
        text payment_method "cod"
        text payment_status "unpaid"
        text note
        timestamptz created_at
        timestamptz updated_at
    }

    ORDER_ITEMS {
        uuid id PK
        text order_id FK
        uuid product_id FK
        text variant
        text name_snapshot
        numeric unit_price
        integer quantity
        numeric line_total
        timestamptz created_at
    }

    ORDER_STATUS_HISTORY {
        uuid id PK
        text order_id FK
        text status
        text note
        timestamptz created_at
    }

    CLIENTS {
        uuid id PK
        text phone UK "+212..."
        text first_name
        text last_name
        text email
        text city
        text address
        integer order_count
        numeric total_spent
        timestamptz created_at
        timestamptz updated_at
    }

    COUPONS {
        uuid id PK
        text code UK "lowercase"
        text type "percentage|fixed"
        numeric value
        numeric min_order
        timestamptz starts_at
        timestamptz expires_at
        integer max_uses
        integer used_count
        integer per_user_limit
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    AUTH_USERS {
        uuid id PK
        text email
    }

    PROFILES {
        uuid id PK,FK "references auth.users"
        text full_name
        text phone
        text role "admin|customer"
        timestamptz created_at
        timestamptz updated_at
    }

    PRODUCTS ||--o{ PRODUCT_VARIANTS : "has variants"
    PRODUCTS ||--o{ ORDER_ITEMS : "referenced in lines"
    ORDERS ||--|{ ORDER_ITEMS : "contains"
    ORDERS ||--|{ ORDER_STATUS_HISTORY : "tracks timeline"
    AUTH_USERS ||--o| PROFILES : "admin profile"
```

---

## 2. Key Relationship Rules

1. **`PRODUCTS` → `PRODUCT_VARIANTS`:** `ON DELETE CASCADE`. If a product is deleted, its size/color variants are purged.
2. **`ORDERS` → `ORDER_ITEMS`:** `ON DELETE CASCADE`. If an order is purged, its line item snapshots are removed.
3. **`ORDERS` → `ORDER_STATUS_HISTORY`:** `ON DELETE CASCADE`. Tracks timestamped state transitions for the order timeline.
4. **`CLIENTS`:** De-normalized guest CRM directory indexed by unique phone number. Each order updates the client's `order_count`, `total_spent`, and latest address.
5. **`AUTH_USERS` → `PROFILES`:** 1-to-1 extension of Supabase Auth users. Admin role verification derives from `profiles.role = 'admin'` or JWT claims.
