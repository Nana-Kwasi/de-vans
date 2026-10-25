-- Password reset for admins. Until now an admin could only change a password while
-- already signed in, so a forgotten one meant editing the database by hand.
--
-- Only a SHA-256 hash of the token is stored: the raw token exists in the email and
-- nowhere else, so a leaked database dump cannot be used to seize an account.
CREATE TABLE admin_password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id   UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_reset_tokens_admin ON admin_password_reset_tokens (admin_id);
CREATE INDEX idx_admin_reset_tokens_expires ON admin_password_reset_tokens (expires_at);
