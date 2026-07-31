-- "What I pass on" (2026-07-30): the Sealed box. Everything an elder would not want read
-- until it is needed, encrypted server-side under a Railway-held master key by
-- SealedCryptoService — the only class that touches that key.
--
-- There is deliberately no plaintext label column and no plaintext filename. A readable
-- "Where the cash is hidden" sitting beside the ciphertext, attached to a named elderly
-- person at a known address, turns a database leak into a burglary list and makes the
-- encryption decorative. `kind_hint` stays readable so the owner's own list can show a
-- chip without a decrypt; it carries no name, no address and no amount.
--
-- BYTEA is unprecedented in this schema. Map it in JPA as a bare `byte[]` — `@Lob byte[]`
-- maps to a Postgres large-object OID on Hibernate 6 and fails at runtime, not at compile
-- time.
CREATE TABLE passon_sealed_items (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label_cipher BYTEA NOT NULL,
  label_iv BYTEA NOT NULL,
  kind_hint VARCHAR(20) NOT NULL,
  body_cipher BYTEA NOT NULL,
  body_iv BYTEA NOT NULL,
  wrapped_key BYTEA NOT NULL,
  key_version SMALLINT NOT NULL DEFAULT 1,
  byte_size INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_sealed_kind CHECK (kind_hint IN ('MONEY','PASSWORDS','PAPERS','OTHER'))
);

CREATE INDEX ix_sealed_owner ON passon_sealed_items(owner_id, sort_order);
