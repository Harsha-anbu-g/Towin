ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Local-registered users are always complete (they signed up with all required fields)
UPDATE users SET setup_completed = TRUE WHERE auth_provider = 'LOCAL';

-- Guest users are also considered complete
UPDATE users SET setup_completed = TRUE WHERE username LIKE 'guest_%';
