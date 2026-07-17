CREATE TABLE family_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES users(id),
    relationship VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP,
    revoked_at TIMESTAMP,
    CONSTRAINT unique_family_link UNIQUE (elder_id, family_user_id),
    CONSTRAINT no_self_family_link CHECK (elder_id <> family_user_id)
);

CREATE UNIQUE INDEX idx_family_links_one_primary_per_elder
    ON family_links(elder_id)
    WHERE is_primary AND status = 'ACTIVE';

CREATE INDEX idx_family_links_elder ON family_links(elder_id);
CREATE INDEX idx_family_links_family_user ON family_links(family_user_id);
CREATE INDEX idx_family_links_status ON family_links(status);
