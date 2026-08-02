-- "What I pass on" (2026-08-01): the one release event.
--
-- One nullable timestamp, and it is the whole switch. Null means nothing has opened, which is
-- where every row starts and where almost every row will stay forever.
--
-- ONE column, not two, on purpose. The same timestamp opens the elder's Sealed box and makes
-- the letters she addressed "after I am gone" readable by the people she named. A grieving
-- family goes through the release procedure once, not once per thing she left behind.
--
-- NOTHING IN THE CODE EVER WRITES THIS. There is no scheduler, no timer, no cron, no admin
-- screen and no endpoint that sets it — the same deliberate absence as the rest of this
-- feature. It is set by a person, by hand, at the last step of
-- docs/operations/sealed-box-release.md: after a death certificate has been read by someone
-- with their eyes, after the elder's own quorum of Keyholders has each agreed separately, and
-- after thirty days in which Towinly tried and failed to reach her.
--
--   UPDATE passon_settings SET released_at = now(), updated_at = now() WHERE owner_id = '<uuid>';
--
-- Until a person runs that line, nothing opens.
ALTER TABLE passon_settings ADD COLUMN released_at TIMESTAMP;

COMMENT ON COLUMN passon_settings.released_at IS
  'Set by hand by a person at the end of docs/operations/sealed-box-release.md, never by code. '
  'Non-null opens both the Sealed box and this owner''s after-death letters.';
