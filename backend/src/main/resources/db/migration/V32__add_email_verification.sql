-- Email verification: new signups must verify; everything that exists now is grandfathered.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP;

-- Grandfather: every account that exists at ship time is treated as verified
-- so demo accounts and current test users keep working.
UPDATE users SET email_verified = TRUE;
