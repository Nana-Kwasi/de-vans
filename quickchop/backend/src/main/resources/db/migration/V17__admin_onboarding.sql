-- Onboarding a second admin previously meant inserting a bcrypt hash by hand. An admin
-- can now invite another, who receives a generated temporary password by email.
--
-- must_change_password forces that temporary password to be replaced on first sign-in.
-- Existing admins are false: they chose their own password and should not be prompted.
alter table admin_users
  add column must_change_password boolean not null default false,
  add column created_by uuid references admin_users(id) on delete set null;
