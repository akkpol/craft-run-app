-- Update conversation states to refined primary states for clarity
-- Migration: Rename states to match approved workflow model

-- Backfill existing rows to new state names
UPDATE conversations
SET state = CASE state
  WHEN 'WAITING_QUOTE_APPROVAL' THEN 'QUOTE_PENDING_APPROVAL'
  WHEN 'WAITING_PAYMENT' THEN 'PAYMENT_PENDING'
  WHEN 'ON_HOLD_CUSTOMER_INPUT' THEN 'ON_HOLD'
  ELSE state
END
WHERE state IN ('WAITING_QUOTE_APPROVAL', 'WAITING_PAYMENT', 'ON_HOLD_CUSTOMER_INPUT');

-- Drop old check constraint
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_state_check;

-- Add new check constraint with updated state names
ALTER TABLE conversations ADD CONSTRAINT conversations_state_check
  CHECK (state IN (
    'NEW_MESSAGE',
    'COLLECTING_REQUIREMENTS',
    'REQUIREMENTS_REVIEW',
    'QUOTE_PENDING_APPROVAL',
    'PAYMENT_PENDING',
    'IN_DESIGN',
    'IN_PRODUCTION',
    'READY_FOR_FULFILLMENT',
    'ON_HOLD',
    'HUMAN_REVIEW_REQUIRED',
    'COMPLETED',
    'CANCELLED'
  ));