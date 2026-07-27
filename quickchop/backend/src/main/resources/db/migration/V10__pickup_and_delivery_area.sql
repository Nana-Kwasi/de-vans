-- Self-pickup vs delivery is now a first-class field on the order (drives a
-- different status flow: Received -> Processing -> Ready, no delivery legs).
alter table orders add column pickup boolean not null default false;

-- Backfill: earlier pickup orders were only tagged in the address/kitchen note.
update orders set pickup = true
where delivery_address ilike 'Self-pickup%' or kitchen_note ilike '%[SELF-PICKUP]%';

-- Max delivery radius from the store (km). Delivery is only offered within this
-- distance (Accra); beyond it, customers get self-pickup only.
alter table app_settings add column max_delivery_km numeric(10,2) not null default 25;
