-- The first few kilometres are covered by the base fee, so the per-km rate only starts
-- beyond them: fee = base + perKm * max(0, ceil(km) - includedKm).
--
-- Without this, base 10 + 4/km charged GHS 22 to deliver 1.6km down the road, which
-- prices the business out of exactly the short, frequent orders it should want. Bolt
-- Food delivers free inside 3km in Accra; 3 is the same idea, charged at base rate.
alter table app_settings
  add column delivery_included_km numeric(10,2) not null default 3;
