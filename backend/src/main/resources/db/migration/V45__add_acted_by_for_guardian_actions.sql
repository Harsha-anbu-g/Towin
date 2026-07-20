-- Guardian mode (2026-07-19): who actually did the thing, when a family member
-- did it for the parent. The row still belongs to the parent — their help
-- request, their seat on the trust ladder, their review — so every existing
-- gate, score and history stays exactly as it was. acted_by_user_id is only
-- the honest label on top: "Sarah, for Margaret", never silent impersonation.
--
-- NULL = the person did it themselves, which is every row so far.

ALTER TABLE needs
    ADD COLUMN acted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reviews
    ADD COLUMN acted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE trust_progression_log
    ADD COLUMN acted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Partial indexes: delegated actions are the rare case, so only they are worth
-- indexing (e.g. "everything Sarah has done for her mother").
CREATE INDEX idx_needs_acted_by ON needs(acted_by_user_id) WHERE acted_by_user_id IS NOT NULL;
CREATE INDEX idx_reviews_acted_by ON reviews(acted_by_user_id) WHERE acted_by_user_id IS NOT NULL;
CREATE INDEX idx_trust_log_acted_by ON trust_progression_log(acted_by_user_id) WHERE acted_by_user_id IS NOT NULL;
