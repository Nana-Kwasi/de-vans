-- QuickChop initial schema (PostgreSQL / Supabase)
-- Owned by Spring Boot + Flyway. Do NOT edit tables via the Supabase dashboard.

CREATE TABLE customers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_auth_id UUID UNIQUE NOT NULL,
    full_name        VARCHAR(120) NOT NULL,
    phone_number     VARCHAR(20) UNIQUE NOT NULL,
    default_address  TEXT,
    fcm_token        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(120) NOT NULL,
    description  TEXT,
    price        NUMERIC(10,2) NOT NULL,
    photo_url    TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number       VARCHAR(20) UNIQUE NOT NULL,
    customer_id        UUID NOT NULL REFERENCES customers(id),
    status             VARCHAR(30) NOT NULL DEFAULT 'ORDER_RECEIVED',
    delivery_address   TEXT NOT NULL,
    delivery_time_note VARCHAR(120),
    kitchen_note       TEXT,
    subtotal           NUMERIC(10,2) NOT NULL,
    delivery_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
    total              NUMERIC(10,2) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    quantity     INTEGER NOT NULL DEFAULT 1,
    unit_price   NUMERIC(10,2) NOT NULL,
    add_ons      TEXT
);

CREATE TABLE payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           UUID NOT NULL REFERENCES orders(id),
    method             VARCHAR(30) NOT NULL,
    amount             NUMERIC(10,2) NOT NULL,
    status             VARCHAR(20) NOT NULL,
    provider           VARCHAR(20) NOT NULL DEFAULT 'PAYSTACK',
    provider_reference VARCHAR(120),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_status_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status     VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(160) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(120),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
