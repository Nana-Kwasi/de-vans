-- Restaurant-wide settings the admin controls from the dashboard and the mobile
-- app reads at launch (business name, open/closed, contact, announcement, delivery).
-- Single-row table: the CHECK (id = 1) keeps exactly one settings row.
create table app_settings (
    id                      smallint primary key default 1 check (id = 1),
    business_name           text          not null default 'QOOKA QOOKS',
    accepting_orders        boolean       not null default true,
    closed_message          text          not null default 'We are currently closed. Please check back soon.',
    contact_phone           text          not null default '',
    store_address           text          not null default 'Anyaa Last Stop, Accra',
    announcement_enabled    boolean       not null default false,
    announcement_text       text          not null default '',
    delivery_base_fee       numeric(10,2) not null default 5.00,
    delivery_per_km         numeric(10,2) not null default 1.50,
    delivery_max_fee        numeric(10,2) not null default 50.00,
    free_delivery_threshold numeric(10,2) not null default 0,   -- 0 = disabled
    min_order_amount        numeric(10,2) not null default 0,   -- 0 = no minimum
    updated_at              timestamptz   not null default now()
);

-- Seed the single row with defaults.
insert into app_settings (id) values (1);
