-- The business display name is "Qooka Qooks Restaurant". V9 seeded app_settings with
-- the older "QOOKA QOOKS", and V9 cannot be edited in place — Flyway validates its
-- checksum against what already ran, so an edit would break startup on the live
-- database. This corrects the stored value and the column default instead.
update app_settings
   set business_name = 'Qooka Qooks Restaurant'
 where business_name in ('QOOKA QOOKS', 'QuickChop');

alter table app_settings
  alter column business_name set default 'Qooka Qooks Restaurant';
