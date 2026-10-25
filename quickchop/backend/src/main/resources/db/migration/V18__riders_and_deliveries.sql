-- Rider module: admin-managed riders, a dispatch pool of deliveries that any rider can
-- claim (once), and a location trail so customers and admins can follow each delivery.

-- The drop-off point was used to price delivery and then thrown away. A rider needs it
-- to navigate, so it is now kept on the order, with the GPS accuracy it was taken at.
-- The contact phone was only ever embedded in kitchen_note ("☎ +233…"); it gets a column.
alter table orders
  add column delivery_lat        double precision,
  add column delivery_lng        double precision,
  add column delivery_accuracy_m double precision,
  add column contact_phone       varchar(20);

-- Riders cannot sign themselves up: every row here is created by an admin.
create table riders (
    id                   uuid primary key default gen_random_uuid(),
    full_name            varchar(120) not null,
    phone_number         varchar(20)  not null unique,  -- login id, normalised to +233…
    email                varchar(160) unique,
    password_hash        varchar(100) not null,
    must_change_password boolean      not null default true,
    vehicle_type         varchar(30)  not null default 'MOTORBIKE',
    vehicle_plate        varchar(20),
    notes                text,
    active               boolean      not null default true,
    online               boolean      not null default false,
    last_lat             double precision,
    last_lng             double precision,
    last_accuracy_m      double precision,
    last_location_at     timestamptz,
    -- Bumped on deactivate / password reset / sign-out: every token carrying an older
    -- value stops working at once, without waiting for it to expire.
    token_version        integer      not null default 0,
    failed_login_count   integer      not null default 0,
    locked_until         timestamptz,
    created_by           uuid references admin_users(id) on delete set null,
    created_at           timestamptz  not null default now()
);

create table deliveries (
    id              uuid primary key default gen_random_uuid(),
    order_id        uuid not null unique references orders(id) on delete cascade,
    rider_id        uuid references riders(id) on delete set null,
    status          varchar(20) not null,  -- OPEN, ASSIGNED, PICKED_UP, ARRIVED, DELIVERED, CANCELLED
    rider_fee       numeric(10,2) not null default 0,
    dispatch_note   text,
    -- 4-digit code the customer reads out to the rider at hand-over (proof of delivery).
    delivery_pin    varchar(6) not null,
    pin_attempts    integer not null default 0,
    dispatched_by   uuid references admin_users(id) on delete set null,
    dispatched_at   timestamptz not null default now(),
    accepted_at     timestamptz,
    picked_up_at    timestamptz,
    arrived_at      timestamptz,
    delivered_at    timestamptz,
    cancelled_at    timestamptz,
    completed_by_admin boolean not null default false,
    version         bigint not null default 0
);

create index idx_deliveries_status on deliveries(status);
create index idx_deliveries_rider on deliveries(rider_id, status);

create table delivery_locations (
    id           uuid primary key default gen_random_uuid(),
    delivery_id  uuid not null references deliveries(id) on delete cascade,
    lat          double precision not null,
    lng          double precision not null,
    accuracy_m   double precision,
    recorded_at  timestamptz not null default now()
);

create index idx_delivery_locations_delivery on delivery_locations(delivery_id, recorded_at);

-- Brute-force protection for the admin login, matching the rider one.
alter table admin_users
  add column failed_login_count integer not null default 0,
  add column locked_until       timestamptz;
