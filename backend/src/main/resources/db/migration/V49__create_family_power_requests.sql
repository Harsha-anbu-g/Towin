-- Consent flow (2026-07-26): a family member ASKS for a power; the elder answers.
-- One row per ask. PENDING rows drive the elder's approval card; APPROVED and
-- DECLINED rows stay as history and throttle re-asking (7-day cooldown off
-- responded_at, enforced in FamilyDelegationService). The grant itself still
-- lives only in family_delegated_powers — this table never authorizes anything.
CREATE TABLE family_power_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    power VARCHAR(30) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    responded_at TIMESTAMP
);

-- At most one open ask per (pair, power); history rows are unlimited.
CREATE UNIQUE INDEX uq_family_power_request_pending
    ON family_power_requests(elder_id, family_user_id, power)
    WHERE status = 'PENDING';

CREATE INDEX idx_power_requests_elder ON family_power_requests(elder_id);
CREATE INDEX idx_power_requests_family ON family_power_requests(family_user_id);
