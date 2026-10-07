-- One row per write a client tagged with an Idempotency-Key header. A phone on a
-- weak signal sends "Thank you", the reply is lost, and the app retries: without
-- this table the retry runs again and the elder's helper gets the message twice.
-- With it, the retry finds the first attempt's saved answer and gets that back.
--
-- Scoped per user, so one person's key can never replay another person's answer.
-- Rows hold a copy of the first response, which can carry personal data, so they
-- go with the account (ON DELETE CASCADE) and are swept after 24 hours
-- (IdempotencyStore.sweepExpired).
CREATE TABLE idempotency_keys (
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idem_key        VARCHAR(100) NOT NULL,
    -- SHA-256 of method, path and body: the same key sent with a different
    -- request is refused instead of replaying an answer to another question.
    request_hash    VARCHAR(64)  NOT NULL,
    -- IN_PROGRESS while the first attempt runs, COMPLETED once it succeeded.
    -- A failed attempt deletes its row, so a retry runs the request again.
    state           VARCHAR(16)  NOT NULL,
    response_status INTEGER,
    content_type    VARCHAR(255),
    response_body   BYTEA,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, idem_key),
    CONSTRAINT ck_idempotency_state CHECK (state IN ('IN_PROGRESS', 'COMPLETED'))
);

CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);
