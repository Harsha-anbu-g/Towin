-- Guardian mode (2026-07-19): who actually typed a message that was sent on
-- someone else's behalf. sender_id stays the parent, so the chat, its trust
-- gates and its history are unchanged; acted_by_user_id is the family member
-- who wrote it, and the helper reads "Sarah, for Margaret".
--
-- NULL = the sender wrote it themselves, which is every message so far.
ALTER TABLE messages
    ADD COLUMN acted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_messages_acted_by ON messages(acted_by_user_id) WHERE acted_by_user_id IS NOT NULL;
