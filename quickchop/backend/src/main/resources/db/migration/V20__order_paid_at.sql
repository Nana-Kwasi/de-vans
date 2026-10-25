-- When the customer's payment was confirmed. Null = not paid yet: such orders get no
-- "confirmed" email, no kitchen alert, and cannot be sent to riders.
alter table orders add column paid_at timestamptz;

-- Backfill from payments already confirmed by Paystack.
update orders o set paid_at = p.first_paid
from (select order_id, min(created_at) as first_paid from payments where status = 'SUCCESS' group by order_id) p
where p.order_id = o.id;
