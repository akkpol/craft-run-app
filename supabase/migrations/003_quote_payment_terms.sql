ALTER TABLE quotes
ADD COLUMN payment_terms TEXT NOT NULL DEFAULT 'prepaid'
  CHECK (payment_terms IN ('prepaid', 'deposit', 'credit')),
ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'not_required'));

CREATE INDEX idx_quotes_payment_terms ON quotes(payment_terms);
CREATE INDEX idx_quotes_payment_status ON quotes(payment_status);