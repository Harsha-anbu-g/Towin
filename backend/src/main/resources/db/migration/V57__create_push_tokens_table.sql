-- One row per device that asked to be pinged. A device belongs to whoever is
-- signed in on it right now: the token column is unique, and a login on a
-- second account moves the row rather than duplicating it.
CREATE TABLE push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(300) NOT NULL UNIQUE,
    platform VARCHAR(16) NOT NULL DEFAULT 'ios',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
