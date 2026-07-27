-- Customer help/support tickets, viewable in the admin dashboard.
CREATE TABLE support_tickets (
    id           UUID PRIMARY KEY,
    customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
    name         VARCHAR(120),
    email        VARCHAR(160),
    phone        VARCHAR(20),
    category     VARCHAR(60) NOT NULL,
    order_number VARCHAR(40),
    message      TEXT NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_status ON support_tickets (status);
CREATE INDEX idx_support_tickets_created_at ON support_tickets (created_at DESC);
