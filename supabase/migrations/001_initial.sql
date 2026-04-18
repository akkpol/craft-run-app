-- FOGUS ERP 2026 - Database Schema
-- Run this in Supabase SQL Editor

-- 1. Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'NEW_MESSAGE'
    CHECK (state IN (
      'NEW_MESSAGE','COLLECTING_INFO','FORM_SUBMITTED',
      'QUOTE_DRAFTED','WAITING_CUSTOMER_APPROVAL',
      'JOB_CREATED','HUMAN_REVIEW_REQUIRED',
      'IN_PROGRESS','COMPLETED'
    )),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_line_user ON conversations(line_user_id);

-- 2. Messages (raw LINE messages)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','bot','admin')),
  raw_text TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- 3. Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_line_user ON customers(line_user_id);

-- 4. Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  customer_id UUID REFERENCES customers(id),
  product_type TEXT,
  width_mm NUMERIC,
  height_mm NUMERIC,
  qty INTEGER DEFAULT 1,
  due_date DATE,
  note_from_form TEXT,
  note_from_chat TEXT,
  reference_info TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','quoted','approved','in_progress','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  vat NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','rejected','expired')),
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  valid_until DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_token ON quotes(public_token);
CREATE INDEX idx_quotes_lead ON quotes(lead_id);

-- 6. Quote Items
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC GENERATED ALWAYS AS (qty * unit_price) STORED
);

-- 7. Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id),
  lead_id UUID REFERENCES leads(id),
  status TEXT NOT NULL DEFAULT 'JOB_CREATED'
    CHECK (status IN (
      'JOB_CREATED','IN_PROGRESS','COMPLETED','CANCELLED'
    )),
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_quote ON jobs(quote_id);

-- 8. Job Timeline
CREATE TABLE job_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_job ON job_timeline(job_id);

-- 9. Escalations
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_escalations_conversation ON escalations(conversation_id);

-- Enable Realtime for dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE escalations;
