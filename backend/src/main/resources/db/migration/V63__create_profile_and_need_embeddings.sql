-- Semantic matching in discovery: every profile and every help request gets one
-- embedding, refreshed only when its text changes (content_hash). The extension
-- is installed by V62.
CREATE TABLE profile_embeddings (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_hash  TEXT NOT NULL,
    embedding     vector(1536) NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE need_embeddings (
    need_id       UUID PRIMARY KEY REFERENCES needs(id) ON DELETE CASCADE,
    content_hash  TEXT NOT NULL,
    embedding     vector(1536) NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
