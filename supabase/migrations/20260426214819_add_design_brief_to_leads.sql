ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS design_brief TEXT,
ADD COLUMN IF NOT EXISTS requested_document_type TEXT NOT NULL DEFAULT 'quote'
	CHECK (requested_document_type IN ('quote', 'invoice', 'receipt', 'tax_invoice')),
ADD COLUMN IF NOT EXISTS billing_entity_type TEXT NOT NULL DEFAULT 'person'
	CHECK (billing_entity_type IN ('person', 'company')),
ADD COLUMN IF NOT EXISTS billing_name TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT;

COMMENT ON COLUMN public.leads.design_brief IS 'Human-friendly design brief collected from the customer before composing or editing an AI prompt.';
COMMENT ON COLUMN public.leads.requested_document_type IS 'Primary document the customer expects for this lead.';
COMMENT ON COLUMN public.leads.billing_entity_type IS 'Whether billing should be issued to a person or company.';
COMMENT ON COLUMN public.leads.billing_name IS 'Name or company name the customer wants on documents.';
COMMENT ON COLUMN public.leads.tax_id IS 'Tax ID provided for tax invoice or company billing needs.';
