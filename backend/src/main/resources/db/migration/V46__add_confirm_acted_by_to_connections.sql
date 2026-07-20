-- Guardian mode (2026-07-19): a trust step takes two confirms, one from each
-- seat, and only the FIRST of them can ever be a family member's — by the time
-- the second lands, the step is finished and the history row is written. So
-- without somewhere to keep it, the fact that a daughter took the step for her
-- mother was thrown away between the two presses, and the history said nobody
-- had acted for anyone. That is the silent stand-in we promised never to allow.
--
-- One column per seat, sitting beside the confirm flag it belongs to: who really
-- pressed this seat's button, when it was not that seat's own person. It is
-- cleared with the flags at the end of every step, so a stamp can never linger
-- onto a later one.
--
-- NULL = that person pressed their own button, which is every row so far.

ALTER TABLE connections
    ADD COLUMN confirm_acted_by_a UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN confirm_acted_by_b UUID REFERENCES users(id) ON DELETE SET NULL;
