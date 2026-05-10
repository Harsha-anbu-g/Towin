CREATE TYPE need_category AS ENUM ('TRANSPORTATION', 'CLEANING', 'COMPANIONSHIP', 'ERRANDS', 'OTHER');
CREATE TYPE need_schedule AS ENUM ('ONE_TIME', 'WEEKLY', 'MONTHLY');
CREATE TYPE need_urgency AS ENUM ('NORMAL', 'URGENT');
CREATE TYPE need_status AS ENUM ('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED');

CREATE TABLE needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category need_category NOT NULL,
    description TEXT,
    schedule need_schedule NOT NULL DEFAULT 'ONE_TIME',
    urgency need_urgency NOT NULL DEFAULT 'NORMAL',
    status need_status NOT NULL DEFAULT 'OPEN',
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_needs_elder ON needs(elder_id);
CREATE INDEX idx_needs_status ON needs(status);
