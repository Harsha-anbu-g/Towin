ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30);

-- Generate default usernames from email prefix (lowercase, non-alphanumeric → underscore)
UPDATE users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-z0-9]', '_', 'g'))
WHERE username IS NULL;

-- Resolve duplicates by appending first 4 chars of the UUID
UPDATE users u
SET username = u.username || '_' || SUBSTRING(u.id::text, 1, 4)
WHERE u.id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at) AS rn
        FROM users
    ) ranked
    WHERE rn > 1
);

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
