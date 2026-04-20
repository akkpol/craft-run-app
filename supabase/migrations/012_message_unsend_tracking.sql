ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS line_message_id TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS unsent_at TIMESTAMPTZ;

UPDATE messages
SET line_message_id = raw_payload -> 'message' ->> 'id'
WHERE line_message_id IS NULL
  AND raw_payload ? 'message';

CREATE INDEX IF NOT EXISTS idx_messages_line_message_id
  ON messages(line_message_id);

CREATE INDEX IF NOT EXISTS idx_messages_unsent_at
  ON messages(unsent_at)
  WHERE unsent_at IS NOT NULL;