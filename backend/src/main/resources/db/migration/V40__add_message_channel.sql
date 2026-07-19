-- Family Step 3 (US-001): messages carry a channel so the shared family
-- updates thread can live beside the private chat. Existing rows stay MAIN.
ALTER TABLE messages ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'MAIN';

CREATE INDEX idx_messages_connection_channel ON messages(connection_id, channel);
