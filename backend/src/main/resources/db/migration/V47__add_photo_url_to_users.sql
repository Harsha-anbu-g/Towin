-- Photos used to live only on elder and helper profiles. Family accounts have
-- neither, so a family member's face had nowhere to be stored at all — their
-- messages could only ever fall back to an initial.
--
-- The account is the right home for it: everyone has one, whatever their role.
-- Profile photos stay where they are; this is the fallback the resolver reaches
-- for when a person has no profile to carry one.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);
