-- Store location (where orders are cooked/dispatched) is now admin-editable, so
-- delivery distance/fee recalculate if the restaurant relocates. Defaults =
-- Anyaa Last Stop, Accra (previously hardcoded in application.yml / mobile).
alter table app_settings add column store_lat numeric(9,6) not null default 5.6072;
alter table app_settings add column store_lng numeric(9,6) not null default -0.2838;
