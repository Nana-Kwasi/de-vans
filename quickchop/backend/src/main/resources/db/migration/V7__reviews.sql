-- Customer reviews/ratings for delivered orders, viewable in the admin dashboard.
CREATE TABLE reviews (
    id           UUID PRIMARY KEY,
    order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_number VARCHAR(40),
    name         VARCHAR(120),
    rating       INT NOT NULL,
    comment      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_created_at ON reviews (created_at DESC);
CREATE INDEX idx_reviews_order_id ON reviews (order_id);
