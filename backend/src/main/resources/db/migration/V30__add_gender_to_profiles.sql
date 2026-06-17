CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE', 'OTHER');

ALTER TABLE elder_profiles ADD COLUMN gender gender_type;
ALTER TABLE helper_profiles ADD COLUMN gender gender_type;
