-- Security fix: the admin@towin.com account was seeded by V15 and had its password
-- set by V35 using a bcrypt hash committed to the (public) repository. A committed
-- hash is a usable credential — anyone can crack it offline and log in as admin.
--
-- The real admin is now bootstrapped from ADMIN_EMAIL / ADMIN_PASSWORD at startup
-- (see AdminSeeder), so no admin credential needs to live in the repo. This migration
-- neutralizes the seeded account so the committed hash is dead even before the seeder
-- runs, and even in an environment where the admin env vars are never set:
--   * scrub the committed password hash (a non-bcrypt sentinel never matches),
--   * drop the ADMIN role,
--   * deactivate the row.
--
-- Self-healing: Flyway runs before AdminSeeder. If ADMIN_EMAIL is admin@towin.com,
-- the seeder immediately re-promotes this row to ADMIN, reactivates it, and sets a
-- fresh password from ADMIN_PASSWORD on the same boot. If ADMIN_EMAIL is a different
-- address, this row simply stays a disabled, password-less, non-admin account.
UPDATE users
SET password_hash       = 'disabled-no-login',
    role                = 'ELDER'::user_role,
    is_active           = false,
    verification_status = 'NONE'::verification_status,
    updated_at          = NOW()
WHERE email = 'admin@towin.com';
