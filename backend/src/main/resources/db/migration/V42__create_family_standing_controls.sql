-- Trust inheritance (2026-07-19): the family member's side of an inherited
-- standing. The standing itself is DERIVED (family link + elder's shared
-- connection at MESSAGING or beyond) and never stored — this table only holds
-- the family member's opt-outs. No row = standing active.
CREATE TABLE family_standing_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    elder_connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    state VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_family_standing UNIQUE (family_user_id, elder_connection_id)
);

CREATE INDEX idx_standing_controls_family ON family_standing_controls(family_user_id);
