-- Guardian mode (2026-07-19): the powers an elder has delegated to a family
-- member. One row per granted power; no row = not granted. The elder is the
-- only one who can create or remove these rows.
CREATE TABLE family_delegated_powers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    power VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_family_delegated_power UNIQUE (elder_id, family_user_id, power)
);

CREATE INDEX idx_delegated_powers_elder_family ON family_delegated_powers(elder_id, family_user_id);
CREATE INDEX idx_delegated_powers_family ON family_delegated_powers(family_user_id);
