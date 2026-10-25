-- The home-screen promo card was hardcoded in the app: changing "Gonna Be a Good Day!"
-- or its copy meant editing HomeScreen.tsx and shipping a new build. These make it
-- editable from the admin dashboard like every other customer-facing string.
--
-- promo_image_url null keeps the existing behaviour of showing the featured dish's own
-- photo, so nothing changes until an admin uploads something deliberately.
alter table app_settings
  add column promo_enabled   boolean not null default true,
  add column promo_title     varchar(120) not null default 'Gonna Be a Good Day!',
  add column promo_text      varchar(240) not null default 'Free delivery & 10% cashback on your first order.',
  add column promo_cta       varchar(40)  not null default 'Order Now',
  add column promo_image_url text;
