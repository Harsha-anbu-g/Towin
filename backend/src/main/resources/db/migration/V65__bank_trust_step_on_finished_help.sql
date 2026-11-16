-- Trust tiers step 1 (2026-11-15): a friendship counts toward the trust score only
-- after the elder has ended a help between the two people. banked_trust_level is the
-- ladder step the pair had reached when that help ended; NULL = no finished help yet.
ALTER TABLE connections ADD COLUMN banked_trust_level INTEGER;

-- Going live: the step at the time was never stored, so a pair that already has a
-- finished help banks the step it is on today. Only live, trust-earning friendships:
-- a declined or ended row must not carry points into a later fresh start, and
-- family or chat-only rows never earn any (ConnectionType.earnsTrust).
UPDATE connections c
SET banked_trust_level = c.current_trust_level
WHERE c.status IN ('ACTIVE', 'PAUSED')
  AND (c.type IS NULL OR c.type IN ('SOCIAL', 'SERVICE'))
  AND EXISTS (
    SELECT 1
    FROM needs n
    JOIN need_applications a ON a.need_id = n.id
    WHERE n.status = 'COMPLETED'
      AND a.status = 'ACCEPTED'
      AND ((n.elder_id = c.user_a AND a.helper_id = c.user_b)
        OR (n.elder_id = c.user_b AND a.helper_id = c.user_a))
);

-- Stored scores were computed under the old rule. Existing rows are stamped 3 so
-- TrustScoreRebase recalculates each once; rows created from now on start at 4.
ALTER TABLE users ADD COLUMN trust_score_version INTEGER NOT NULL DEFAULT 3;
ALTER TABLE users ALTER COLUMN trust_score_version SET DEFAULT 4;
