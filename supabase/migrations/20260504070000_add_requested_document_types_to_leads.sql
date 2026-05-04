ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS requested_document_types TEXT[] NOT NULL DEFAULT ARRAY['quote']::TEXT[];

UPDATE public.leads
SET requested_document_types = ARRAY[COALESCE(requested_document_type, 'quote')]::TEXT[]
WHERE requested_document_types IS NULL
   OR requested_document_types = ARRAY['quote']::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_requested_document_types_valid'
      AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_requested_document_types_valid
      CHECK (
        cardinality(requested_document_types) > 0
        AND array_position(requested_document_types, NULL) IS NULL
        AND requested_document_types <@ ARRAY['quote', 'invoice', 'receipt', 'tax_invoice']::TEXT[]
      );
  END IF;
END $$;

COMMENT ON COLUMN public.leads.requested_document_types IS 'All document types requested by the customer during intake; requested_document_type remains the primary legacy document for workflow gates.';
