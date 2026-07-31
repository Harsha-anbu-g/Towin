-- "What I pass on" (2026-07-30): the elder's own rules for her Sealed box, plus the
-- record of every time it was opened.
--
-- Three constraints carry the whole safety argument, so they live in Postgres rather than
-- in a picker a later refactor could route around:
--   approvals_needed >= 2                     a box one person can open alone is not a lock
--   keyholder_target BETWEEN 3 AND 5          fewer than three is fragile, more is unmanageable
--   approvals_needed <= keyholder_target - 1  unanimity is a permanent deadlock the first
--                                             time one keyholder is unreachable
--
-- The ack columns store a hash of the exact wording shown, not just a timestamp. A bare
-- timestamp proves nothing once the copy changes, and "this is not a will" is precisely
-- the sentence someone will later dispute.
CREATE TABLE passon_settings (
  owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  approvals_needed SMALLINT NOT NULL,
  keyholder_target SMALLINT NOT NULL,
  armed_at TIMESTAMP,
  cooling_off_until TIMESTAMP,
  not_a_will_ack_at TIMESTAMP,
  not_a_will_ack_hash CHAR(64),
  key_truth_ack_at TIMESTAMP,
  key_truth_ack_hash CHAR(64),
  sheet_saved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_quorum_min CHECK (approvals_needed >= 2),
  CONSTRAINT ck_pool_range CHECK (keyholder_target BETWEEN 3 AND 5),
  CONSTRAINT ck_quorum_lt_pool CHECK (approvals_needed <= keyholder_target - 1)
);

-- Append-only by convention, not by trigger. An immutable trigger on a table carrying
-- identifiers would contradict the published promise in Privacy.jsx that personal data is
-- removed within 30 days; that contradiction gets resolved in copy before it is enforced
-- in Postgres.
--
-- Two deliberate choices: no release_id column, because in v1 the only opens are the
-- owner's; and the actor is a *label, not a user FK*, so the row survives that person
-- deleting their account instead of breaking DELETE /api/account.
--
-- kind: CREATED, OPENED_BY_OWNER, DELETED, KEYHOLDER_ACCEPTED, KEYHOLDER_RESIGNED,
-- BOX_ARMED, SETTINGS_CHANGED, MANUAL_RELEASE.
CREATE TABLE passon_opens (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL,
  sealed_item_id UUID REFERENCES passon_sealed_items(id) ON DELETE SET NULL,
  kind VARCHAR(24) NOT NULL,
  at TIMESTAMP NOT NULL DEFAULT now(),
  actor_label VARCHAR(60) NOT NULL,
  note VARCHAR(300)
);

CREATE INDEX ix_opens_owner ON passon_opens(owner_id, at DESC);
