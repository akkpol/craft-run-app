create table if not exists public.quote_payment_records (
	id uuid primary key default gen_random_uuid(),
	quote_id uuid not null references public.quotes(id) on delete cascade,
	lead_id uuid not null references public.leads(id) on delete cascade,
	amount_due numeric not null default 0 check (amount_due >= 0),
	payment_terms text not null
		check (payment_terms in ('prepaid', 'deposit', 'credit')),
	payment_status text not null
		check (payment_status in ('unpaid', 'partial', 'paid', 'not_required')),
	payment_profile_snapshot jsonb,
	requires_action boolean not null default true,
	proof_reference text,
	proof_received_at timestamptz,
	note text,
	opened_at timestamptz not null default now(),
	last_status_changed_at timestamptz not null default now(),
	partially_paid_at timestamptz,
	paid_at timestamptz,
	closed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (quote_id)
);

create index if not exists idx_quote_payment_records_status
	on public.quote_payment_records(payment_status);

create index if not exists idx_quote_payment_records_opened_at
	on public.quote_payment_records(opened_at);

alter table public.quote_payment_records enable row level security;

comment on table public.quote_payment_records is 'Manual payment tracking records used for quote-level payment follow-up and monthly accounting export.';
comment on column public.quote_payment_records.amount_due is 'Current amount due for the quote when the record was last synchronized.';
comment on column public.quote_payment_records.payment_profile_snapshot is 'Point-in-time payment instruction snapshot aligned with the quote at the time the record was last synchronized.';
comment on column public.quote_payment_records.requires_action is 'True when the quote still needs payment follow-up from the team or customer.';
comment on column public.quote_payment_records.proof_reference is 'Optional reference to a slip, note, or external proof identifier captured manually by staff.';
comment on column public.quote_payment_records.opened_at is 'When the quote first entered explicit payment tracking.';
comment on column public.quote_payment_records.last_status_changed_at is 'When payment_status last changed in this tracking record.';
comment on column public.quote_payment_records.partially_paid_at is 'When the quote first reached partial payment status.';
comment on column public.quote_payment_records.paid_at is 'When the quote first reached paid status.';
comment on column public.quote_payment_records.closed_at is 'When payment follow-up was no longer required for the quote.';
