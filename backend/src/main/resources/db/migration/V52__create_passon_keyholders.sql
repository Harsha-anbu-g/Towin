-- "What I pass on" (2026-07-30): Keyholders, the people an elder asks to hold a key to
-- her Sealed box. Two-sided consent — nobody is conscripted into a duty about a death
-- without being asked, so a row starts INVITED and only the invitee moves it to ACTIVE.
--
-- INVITED -> ACTIVE | DECLINED. ACTIVE -> RESIGNED | REMOVED | ENDED. ENDED is set by
-- KeyholderService.onFamilyLinkEnded when the underlying family link is revoked, so an
-- elder never has to understand two different "remove this person" buttons.
--
-- A Keyholder counts toward the threshold only while ACTIVE *and* a matching ACTIVE
-- family link still exists — re-derived on every read, never snapshotted.
CREATE TABLE passon_keyholders (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL DEFAULT 'INVITED',
  invited_at TIMESTAMP NOT NULL DEFAULT now(),
  responded_at TIMESTAMP,
  CONSTRAINT uq_keyholder UNIQUE (owner_id, keyholder_id),
  CONSTRAINT ck_keyholder_self CHECK (owner_id <> keyholder_id),
  CONSTRAINT ck_keyholder_status CHECK (status IN ('INVITED','ACTIVE','DECLINED','RESIGNED','REMOVED','ENDED'))
);
