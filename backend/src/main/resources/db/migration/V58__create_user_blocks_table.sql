-- One row per "I never want to see this person again" (HARD-106). Until this
-- table existed a block lived in SecureStore on one phone: it did not survive a
-- reinstall, did not reach a second device, and did not apply on the web build.
-- Both directions are honoured when filtering, so a row hides each person from
-- the other. The blocked person is never told; nothing here is ever sent to them.
CREATE TABLE user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_blocks_pair UNIQUE (blocker_user_id, blocked_user_id),
    CONSTRAINT ck_user_blocks_not_self CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_user_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_user_id);
