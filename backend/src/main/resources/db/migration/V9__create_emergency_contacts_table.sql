CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    relationship VARCHAR(100),
    inactivity_days INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT max_contacts_per_elder CHECK (true)
);

CREATE INDEX idx_emergency_contacts_elder ON emergency_contacts(elder_id);
