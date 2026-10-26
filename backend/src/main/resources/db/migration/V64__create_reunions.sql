-- Reunions (2026-10-26): an elder meets old classmates or colleagues again.
-- A fully trusted helper or a family member organises; the elder approves
-- each of the seven steps (ReunionStep). Guests are names on the organiser's
-- list, never accounts. Enums are stored as their names, like family_alerts.
-- The elder's row goes with their account; an organiser who leaves Towinly is
-- unset, and the reunion returns to "Who plans".
CREATE TABLE reunions (
    id UUID PRIMARY KEY,
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organiser_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organiser_kind VARCHAR(10),
    institution VARCHAR(200) NOT NULL,
    years VARCHAR(60),
    city VARCHAR(120),
    note TEXT,
    planned_on VARCHAR(200),
    venue VARCHAR(300),
    rides TEXT,
    food TEXT,
    budget VARCHAR(120),
    thank_you TEXT,
    step VARCHAR(12) NOT NULL DEFAULT 'ORGANISER',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP
);
CREATE INDEX idx_reunions_elder ON reunions(elder_id);
CREATE INDEX idx_reunions_organiser ON reunions(organiser_id);

CREATE TABLE reunion_guests (
    id UUID PRIMARY KEY,
    reunion_id UUID NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40),
    note VARCHAR(300),
    state VARCHAR(12) NOT NULL DEFAULT 'REMEMBERED',
    arrived_at TIMESTAMP,
    home_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reunion_guests_reunion ON reunion_guests(reunion_id);
