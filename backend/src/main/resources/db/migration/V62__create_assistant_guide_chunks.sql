-- Ask AI answers "how do I" questions from the user guide. The guide is far too
-- long to send whole, so it is kept here as chunks with an embedding each, and
-- the few chunks nearest to a question are sent. pgvector 0.8.6 is available on
-- the Railway Postgres (checked 2026-10-19, pg_available_extensions).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE assistant_guide_chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part          TEXT NOT NULL,
    chapter       TEXT NOT NULL,
    heading       TEXT NOT NULL,
    roles         TEXT NOT NULL,            -- comma-separated: elder,helper,family
    content       TEXT NOT NULL,
    content_hash  TEXT NOT NULL UNIQUE,     -- sha256 of content; the indexer's change detector
    embedding     vector(1536) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No vector index: a few hundred rows scan in under a millisecond.
