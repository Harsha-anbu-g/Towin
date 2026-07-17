CREATE TABLE family_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    body VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_alerts_elder ON family_alerts(elder_id);
CREATE INDEX idx_family_alerts_created_at ON family_alerts(created_at);

ALTER TABLE connections
    ADD COLUMN shared_with_family BOOLEAN NOT NULL DEFAULT FALSE;
