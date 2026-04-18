ALTER TABLE leads
ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT
  CHECK (fulfillment_mode IN ('pickup', 'delivery')),
ADD COLUMN IF NOT EXISTS design_assignment_mode TEXT
  CHECK (design_assignment_mode IN ('auto', 'manual')),
ADD COLUMN IF NOT EXISTS design_executor TEXT
  CHECK (design_executor IN ('ai', 'human', 'unassigned')),
ADD COLUMN IF NOT EXISTS design_status TEXT
  CHECK (design_status IN ('not_started', 'drafting', 'preview_sent', 'revision_requested', 'approved')),
ADD COLUMN IF NOT EXISTS assigned_designer TEXT,
ADD COLUMN IF NOT EXISTS hold_reason TEXT,
ADD COLUMN IF NOT EXISTS human_review_reason TEXT;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS production_status TEXT
  CHECK (production_status IN ('queued', 'in_progress', 'qc', 'failed_qc', 'done')),
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT
  CHECK (fulfillment_status IN ('not_ready', 'ready', 'delivered', 'picked_up')),
ADD COLUMN IF NOT EXISTS completion_package_status TEXT
  CHECK (completion_package_status IN ('not_required', 'pending', 'sent')),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_state_check;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

UPDATE conversations
SET state = CASE state
  WHEN 'NEW_MESSAGE' THEN 'NEW_MESSAGE'
  WHEN 'COLLECTING_INFO' THEN 'COLLECTING_REQUIREMENTS'
  WHEN 'FORM_SUBMITTED' THEN 'REQUIREMENTS_REVIEW'
  WHEN 'QUOTE_DRAFTED' THEN 'WAITING_QUOTE_APPROVAL'
  WHEN 'WAITING_CUSTOMER_APPROVAL' THEN 'WAITING_QUOTE_APPROVAL'
  WHEN 'JOB_CREATED' THEN 'IN_DESIGN'
  WHEN 'IN_PROGRESS' THEN 'IN_PRODUCTION'
  WHEN 'COMPLETED' THEN 'COMPLETED'
  WHEN 'HUMAN_REVIEW_REQUIRED' THEN 'HUMAN_REVIEW_REQUIRED'
  ELSE state
END;

UPDATE jobs
SET status = CASE status
  WHEN 'JOB_CREATED' THEN 'IN_DESIGN'
  WHEN 'IN_PROGRESS' THEN 'IN_PRODUCTION'
  WHEN 'COMPLETED' THEN 'COMPLETED'
  WHEN 'CANCELLED' THEN 'CANCELLED'
  ELSE status
END;

UPDATE job_timeline
SET status = CASE status
  WHEN 'JOB_CREATED' THEN 'IN_DESIGN'
  WHEN 'IN_PROGRESS' THEN 'IN_PRODUCTION'
  WHEN 'COMPLETED' THEN 'COMPLETED'
  WHEN 'CANCELLED' THEN 'CANCELLED'
  ELSE status
END;

UPDATE leads
SET fulfillment_mode = COALESCE(fulfillment_mode, 'delivery'),
    design_assignment_mode = COALESCE(design_assignment_mode, 'manual'),
    design_executor = COALESCE(design_executor, 'unassigned'),
    design_status = COALESCE(
      design_status,
      CASE
        WHEN status IN ('approved', 'in_progress', 'completed') THEN 'approved'
        ELSE 'not_started'
      END
    ),
    human_review_reason = COALESCE(
      human_review_reason,
      CASE
        WHEN status = 'new' THEN hold_reason
        ELSE NULL
      END
    );

UPDATE jobs
SET production_status = COALESCE(
      production_status,
      CASE
        WHEN status = 'IN_PRODUCTION' THEN 'in_progress'
        WHEN status IN ('READY_FOR_FULFILLMENT', 'COMPLETED') THEN 'done'
        ELSE 'queued'
      END
    ),
    fulfillment_status = COALESCE(
      fulfillment_status,
      CASE
        WHEN status = 'READY_FOR_FULFILLMENT' THEN 'ready'
        WHEN status = 'COMPLETED' THEN 'delivered'
        ELSE 'not_ready'
      END
    ),
    completion_package_status = COALESCE(
      completion_package_status,
      CASE
        WHEN status = 'COMPLETED' THEN 'pending'
        ELSE 'not_required'
      END
    ),
    completed_at = COALESCE(
      completed_at,
      CASE
        WHEN status = 'COMPLETED' THEN NOW()
        ELSE NULL
      END
    );

ALTER TABLE conversations
ALTER COLUMN state SET DEFAULT 'NEW_MESSAGE',
ADD CONSTRAINT conversations_state_check
  CHECK (state IN (
    'NEW_MESSAGE',
    'COLLECTING_REQUIREMENTS',
    'REQUIREMENTS_REVIEW',
    'WAITING_QUOTE_APPROVAL',
    'WAITING_PAYMENT',
    'IN_DESIGN',
    'IN_PRODUCTION',
    'READY_FOR_FULFILLMENT',
    'COMPLETED',
    'ON_HOLD_CUSTOMER_INPUT',
    'HUMAN_REVIEW_REQUIRED',
    'CANCELLED'
  ));

ALTER TABLE jobs
ALTER COLUMN status SET DEFAULT 'IN_DESIGN',
ADD CONSTRAINT jobs_status_check
  CHECK (status IN (
    'IN_DESIGN',
    'IN_PRODUCTION',
    'READY_FOR_FULFILLMENT',
    'ON_HOLD_CUSTOMER_INPUT',
    'HUMAN_REVIEW_REQUIRED',
    'COMPLETED',
    'CANCELLED'
  ));

ALTER TABLE leads
ALTER COLUMN fulfillment_mode SET DEFAULT 'delivery',
ALTER COLUMN design_assignment_mode SET DEFAULT 'manual',
ALTER COLUMN design_executor SET DEFAULT 'unassigned',
ALTER COLUMN design_status SET DEFAULT 'not_started';

ALTER TABLE jobs
ALTER COLUMN production_status SET DEFAULT 'queued',
ALTER COLUMN fulfillment_status SET DEFAULT 'not_ready',
ALTER COLUMN completion_package_status SET DEFAULT 'not_required';
