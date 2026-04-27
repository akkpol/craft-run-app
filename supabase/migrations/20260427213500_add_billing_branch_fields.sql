ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS billing_branch_type TEXT
  CHECK (billing_branch_type IN ('head_office', 'branch')),
ADD COLUMN IF NOT EXISTS billing_branch_code TEXT;

COMMENT ON COLUMN public.leads.billing_branch_type IS 'Branch mode requested for billing documents: head office or branch.';
COMMENT ON COLUMN public.leads.billing_branch_code IS 'Branch code captured for company billing documents when the customer requests a branch document.';