-- Switch customer sign-in from phone OTP to email/password + Google OAuth.
-- Phone number becomes optional; email becomes the primary contact identifier.
ALTER TABLE customers ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE customers ADD COLUMN email VARCHAR(160);
ALTER TABLE customers ADD CONSTRAINT uq_customers_email UNIQUE (email);
