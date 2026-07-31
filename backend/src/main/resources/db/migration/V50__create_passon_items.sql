-- "What I pass on" (2026-07-30): the stories and letters an elder leaves behind.
-- One table, `kind` discriminates — a story is written to a group, a letter to one named
-- person. Visibility is decided server-side by PassOnVisibilityService and re-derived on
-- every read; `audience` here is the elder's stated intent, never a cached answer.
CREATE TABLE passon_items (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  photo_url VARCHAR(500),
  audience VARCHAR(12) NOT NULL,
  audience_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  release_when VARCHAR(6) NOT NULL DEFAULT 'NOW',
  first_read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_passon_kind CHECK (kind IN ('STORY','LETTER')),
  CONSTRAINT ck_passon_audience CHECK (audience IN ('EVERYONE','FAMILY','HELPERS','PERSON')),
  CONSTRAINT ck_passon_release CHECK (release_when IN ('NOW','AFTER')),
  -- One-directional on purpose. Written the other way round ("audience = 'PERSON' implies
  -- audience_user_id IS NOT NULL"), the ON DELETE SET NULL above would violate this very
  -- check the moment a named person deleted their account, and break DELETE /api/account.
  CONSTRAINT ck_passon_person CHECK (audience_user_id IS NULL OR audience = 'PERSON'),
  CONSTRAINT ck_passon_letter CHECK (kind <> 'LETTER' OR audience = 'PERSON'),
  -- 'AFTER' is legal in the schema so phase 2 needs no migration, but a story is always
  -- readable now; only letters may ever be held back.
  CONSTRAINT ck_passon_story CHECK (kind <> 'STORY' OR release_when = 'NOW')
);

CREATE INDEX ix_passon_owner_kind ON passon_items(owner_id, kind);
CREATE INDEX ix_passon_audience_user ON passon_items(audience_user_id) WHERE audience_user_id IS NOT NULL;
