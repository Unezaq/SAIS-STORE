# SAIS STORE — Data Flow & Purchase Lifecycle

**Version:** 2.0  
**Updated:** November 21, 2026

---

## 1. The Guest Checkout Lifecycle (COD)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Guest Customer
    participant UI as Checkout Page (/checkout)
    participant Action as placeOrderAction (Server Action)
    participant Service as orders.service.ts
    participant DB as PostgreSQL (place_order_rpc)
    participant CRM as clients Table

    Customer->>UI: Fills form (Name, Phone, City, Address, Items, Coupon)
    UI->>Action: Submits FormData via POST (Server Action)
    
    rect rgb(240, 248, 255)
    note right of Action: Server-Side Validation & Security Checks
    Action->>Action: Normalize Moroccan Phone (+212...)
    Action->>Action: Validate Rate Limit (Phone / Window)
    Action->>Action: Parse with Zod (Name, Address, Items)
    end

    Action->>Service: createOrder(orderPayload, options)
    
    rect rgb(255, 250, 240)
    note right of DB: Single Atomic PostgreSQL Transaction
    Service->>DB: rpc('place_order_rpc', payload)
    DB->>DB: Check Idempotency Key (Return existing if found)
    DB->>DB: Lock Products & Variants FOR UPDATE (in slug order)
    DB->>DB: Check Stock & Decrement (UPDATE products SET stock = stock - qty)
    DB->>DB: If Coupon: Lock FOR UPDATE & Increment used_count
    DB->>DB: Recalculate Prices, Storewide Promos, Delivery Fees & Total
    DB->>DB: INSERT INTO orders
    DB->>DB: INSERT INTO order_items (price snapshot)
    DB->>DB: INSERT INTO order_status_history ('en_attente')
    DB-->>Service: Return { order_id, order_number, tracking_token, total, ... }
    end

    Service->>CRM: Upsert Client Record (Fold order into client phone stats)
    Service-->>Action: Return Order Confirmation Object
    Action-->>UI: Display Order Confirmation (Reference SAIS-XXXXXXXX, Tracking Link, WhatsApp Contact)
```

---

## 2. Public Order Tracking Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Guest Customer
    participant UI as Suivi Page (/suivre)
    participant Action as trackOrderAction
    participant DB as PostgreSQL (orders Table)

    Customer->>UI: Enters Phone (+212...) + Reference (SAIS-XXXXXXXX)
    UI->>Action: trackOrderAction(FormData)
    Action->>Action: Normalize Phone & Reference
    Action->>DB: Query orders WHERE phone = normalized_phone AND order_number = ref
    alt Order Found
        DB-->>Action: Return safe public projection (status, date, items, total)
        Action-->>UI: Display Timeline & Order Details
    else Not Found
        DB-->>Action: No rows
        Action-->>UI: Return friendly error + WhatsApp assistance link
    end
```

---

## 3. Direct Unguessable Token Tracking (`/suivre/[token]`)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Guest Customer
    participant Page as /suivre/[token] (Server Component)
    participant Service as orders.service.ts
    participant DB as PostgreSQL (orders Table)

    Customer->>Page: Visits link received after order (or in WhatsApp message)
    Page->>Service: getOrderByTrackingToken(token)
    Service->>DB: Query orders WHERE tracking_token = token
    alt Valid Token
        DB-->>Service: Return order data
        Service-->>Page: Render OrderTimeline & Summary
    else Invalid Token
        DB-->>Service: null
        Service-->>Page: notFound()
    end
```

---

## 4. Admin Management Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Store Administrator
    participant Browser as Admin Panel (/admin)
    participant Proxy as proxy.ts (Edge Middleware)
    participant Action as actions/admin.ts
    participant DB as PostgreSQL

    Admin->>Browser: Navigates to /admin/*
    Proxy->>Proxy: Check Session Cookie & claims.app_metadata.role
    alt Not Admin
        Proxy-->>Browser: Redirect to /admin/login
    else Authorized Admin
        Proxy-->>Browser: Allow navigation to Dashboard
    end

    Admin->>Browser: Update Order Status ('en_attente' -> 'confirmee')
    Browser->>Action: updateOrderStatusAction(FormData)
    Action->>Action: requireAdmin() (Verifies session + profiles.role)
    Action->>DB: UPDATE orders SET status = new_status
    Action->>DB: INSERT INTO order_status_history (order_id, status, note)
    Action-->>Browser: Revalidate Paths & Refresh UI
```
