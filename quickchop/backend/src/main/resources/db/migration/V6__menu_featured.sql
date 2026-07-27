-- "Hot meals" flag: items the admin features in the app's promo/featured section.
ALTER TABLE menu_items ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE;
