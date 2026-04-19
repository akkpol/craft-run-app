-- FOGUS ERP — Action Log (Migration 010)
-- Tracks every state-changing action in the system.
-- Actor types: 'human' (customer/admin), 'ai' (AI agent), 'system' (webhook/scheduler/auto)
-- Format: ACT-YYYYMMDD-NNNN (e.g. ACT-20260419-0001)

-- Global sequence for action_ref numbering (never resets — date prefix provides human readability)
CREATE SEQUENCE IF NOT EXISTS action_log_seq START 1;

CREATE TABLE action_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_id       BIGINT      NOT NULL DEFAULT nextval('action_log_seq'),
  action_ref   TEXT        UNIQUE NOT NULL,

  -- Which entity this action affected
  entity_type  TEXT        NOT NULL
    CHECK (entity_type IN ('conversation', 'lead', 'quote', 'job', 'message', 'production_event', 'system')),
  entity_id    UUID,

  -- What happened
  action_type  TEXT        NOT NULL,   -- e.g. 'conversation.state_changed', 'quote.approved', 'job.status_changed', 'ai.preview_generated'

  -- Who did it
  actor_type   TEXT        NOT NULL
    CHECK (actor_type IN ('human', 'ai', 'system')),
  actor_id     TEXT,                   -- LINE user ID, admin email, or service name
  actor_label  TEXT,                   -- human-readable display name

  -- Optional context
  note         TEXT,
  payload      JSONB,                  -- from_state, to_state, payment_term, etc.

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_action_log_entity    ON action_log (entity_type, entity_id);
CREATE INDEX idx_action_log_action    ON action_log (action_type);
CREATE INDEX idx_action_log_actor     ON action_log (actor_type, actor_id);
CREATE INDEX idx_action_log_created   ON action_log (created_at DESC);
CREATE INDEX idx_action_log_ref       ON action_log (action_ref);

-- Trigger: auto-generate action_ref from Bangkok local date + global sequence
CREATE OR REPLACE FUNCTION fn_set_action_ref()
RETURNS TRIGGER AS $$
BEGIN
  NEW.action_ref := 'ACT-'
    || TO_CHAR((NOW() AT TIME ZONE 'Asia/Bangkok'), 'YYYYMMDD')
    || '-'
    || LPAD(NEW.seq_id::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_action_ref
  BEFORE INSERT ON action_log
  FOR EACH ROW EXECUTE FUNCTION fn_set_action_ref();

-- Enable Realtime for admin monitoring (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE action_log;

COMMENT ON TABLE action_log IS 'Immutable audit trail for all state-changing actions. Do not UPDATE or DELETE rows.';
COMMENT ON COLUMN action_log.action_ref IS 'ACT-YYYYMMDD-NNNN — human-readable sequential reference number.';
COMMENT ON COLUMN action_log.actor_type IS 'human = customer or admin; ai = AI agent; system = webhook/scheduler/auto-process.';
COMMENT ON COLUMN action_log.payload IS 'Structured context: from_state, to_state, payment_term, etc. No PII.';
