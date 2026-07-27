-- Seed the business owner admin account.
-- password_hash below is a BCrypt hash (cost 10) of the password: 0000000000
-- CHANGE THIS PASSWORD after first login via PATCH /api/admin/change-password.
INSERT INTO admin_users (email, password_hash, full_name)
VALUES (
    'franciskontoh4@gmail.com',
    '$2b$10$9byGEczKZAbVGCSp4yXAMOwwVaOFlEXvPMfnMjf7dZWv1kNNwnR0i',
    'Francis Kontoh'
);
