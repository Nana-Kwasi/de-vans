-- Delivery pricing was seeded at 5.00 + 1.50/km capped at 50.00, which undercharges
-- badly once a trip leaves the immediate area: Anyaa Last Stop to Sapeiman came out at
-- GHS 26 for what is roughly 18 km of driving.
--
-- Two of the three causes are rates, corrected here. The third is that the fee is
-- measured as a straight line; see quickchop.delivery.road-factor, which scales that
-- up to a realistic driving distance.
update app_settings
   set delivery_base_fee = 10.00,
       delivery_per_km   = 4.00,
       delivery_max_fee  = 120.00
 where delivery_base_fee = 5.00
   and delivery_per_km   = 1.50
   and delivery_max_fee  = 50.00;

alter table app_settings alter column delivery_base_fee set default 10.00;
alter table app_settings alter column delivery_per_km   set default 4.00;
alter table app_settings alter column delivery_max_fee  set default 120.00;
