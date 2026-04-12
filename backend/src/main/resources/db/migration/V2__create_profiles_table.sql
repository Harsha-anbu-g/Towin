CREATE TYPE looking_for_type AS ENUM ('FRIENDSHIP', 'HELP', 'BOTH');
CREATE TYPE background_check_status_type AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE elder_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    photo_url VARCHAR(500),
    bio TEXT,
    interests TEXT[],
    languages TEXT[],
    looking_for looking_for_type NOT NULL DEFAULT 'BOTH',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE helper_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    photo_url VARCHAR(500),
    bio TEXT,
    skills_offered TEXT[],
    languages TEXT[],
    availability_days TEXT[],
    availability_times TEXT[],
    background_check_status background_check_status_type NOT NULL DEFAULT 'NONE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
