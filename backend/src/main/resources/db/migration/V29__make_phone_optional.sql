-- Phone is no longer collected at sign-up; users add it later from their profile.
-- Drop the NOT NULL constraint. The UNIQUE constraint stays: Postgres allows
-- multiple NULLs, so accounts without a phone don't collide.
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
