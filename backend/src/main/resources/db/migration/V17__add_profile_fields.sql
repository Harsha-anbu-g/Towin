ALTER TABLE helper_profiles
    ADD COLUMN IF NOT EXISTS hobbies         TEXT[],
    ADD COLUMN IF NOT EXISTS occupation      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS facebook_url    VARCHAR(500),
    ADD COLUMN IF NOT EXISTS instagram_url   VARCHAR(500),
    ADD COLUMN IF NOT EXISTS date_of_birth   DATE;
