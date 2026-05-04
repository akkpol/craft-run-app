-- Commercial Document Policy v1 - Core schema bootstrap
-- Packet: plan/feature-commercial-documents-1.md
-- This migration is additive and does not alter existing quote/workflow behavior.

create table if not exists public.commercial_entities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('company', 'person')),
  role text not null check (role in ('MAIN_COMPANY', 'SUB_COMPANY', 'PERSONAL_ACCOUNT')),
  legal_name text not null,
  display_name text not null,
  tax_id text,
  is_vat_registered boolean not null default false,
  branch_type text not null check (branch_type in ('HEAD_OFFICE', 'BRANCH')),
  branch_code text,
  branch_name text,
  address text,
  bank_account_owner text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    branch_type = 'HEAD_OFFICE'
    or coalesce(nullif(trim(branch_code), ''), nullif(trim(branch_name), '')) is not null
  )
);

comment on table public.commercial_entities is 'Issuer/receiver entities for commercial documents. Core invariant: payment receiver entity equals document issuer entity.';

create table if not exists public.customer_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  legal_name text not null,
  tax_id text,
  branch_type text not null check (branch_type in ('HEAD_OFFICE', 'BRANCH')),
  branch_code text,
  branch_name text,
  address text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    branch_type = 'HEAD_OFFICE'
    or coalesce(nullif(trim(branch_code), ''), nullif(trim(branch_name), '')) is not null
  )
);

create index if not exists idx_customer_tax_profiles_customer_id
  on public.customer_tax_profiles(customer_id);

comment on table public.customer_tax_profiles is 'Normalized customer tax identity used for invoice/tax document issuance validation.';

create table if not exists public.commercial_orders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  selected_receiver_entity_id uuid references public.commercial_entities(id) on delete restrict,
  payment_receiver_locked_at timestamptz,
  customer_tax_profile_id uuid references public.customer_tax_profiles(id) on delete set null,
  customer_tax_profile_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_orders_lead_id
  on public.commercial_orders(lead_id);

create index if not exists idx_commercial_orders_customer_id
  on public.commercial_orders(customer_id);

comment on table public.commercial_orders is 'Commercial abstraction mapped 1:1 to a quote for v1; provides order_id anchor for policy-based payment/document lifecycle.';

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commercial_orders(id) on delete cascade,
  receiver_entity_id uuid not null references public.commercial_entities(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  currency text not null default 'THB' check (currency in ('THB')),
  status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'REJECTED', 'REFUNDED')),
  paid_at timestamptz,
  proof_url text,
  bank_account_owner text,
  reconciliation_status text not null default 'UNMATCHED'
    check (reconciliation_status in ('UNMATCHED', 'MATCHED', 'MISMATCHED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_order_id
  on public.payments(order_id);

create index if not exists idx_payments_receiver_entity_id
  on public.payments(receiver_entity_id);

create index if not exists idx_payments_status
  on public.payments(status);

comment on table public.payments is 'Commercial payments linked to commercial_orders with explicit receiver entity binding.';

create table if not exists public.commercial_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commercial_orders(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  issuer_entity_id uuid not null references public.commercial_entities(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_tax_profile_id uuid references public.customer_tax_profiles(id) on delete set null,
  document_type text not null check (
    document_type in (
      'QUOTATION',
      'BILLING_NOTE',
      'INVOICE',
      'RECEIPT',
      'TAX_INVOICE',
      'TAX_INVOICE_RECEIPT',
      'CREDIT_NOTE',
      'DEBIT_NOTE'
    )
  ),
  document_number text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ISSUED', 'PAID', 'VOID')),
  vat_mode text not null default 'NO_VAT' check (vat_mode in ('INCLUSIVE', 'EXCLUSIVE', 'NO_VAT')),
  vat_rate numeric not null default 0,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  grand_total numeric not null default 0,
  issued_at timestamptz,
  locked_at timestamptz,
  voided_at timestamptz,
  pdf_url text,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_number)
);

create index if not exists idx_commercial_documents_order_id
  on public.commercial_documents(order_id);

create index if not exists idx_commercial_documents_payment_id
  on public.commercial_documents(payment_id);

create index if not exists idx_commercial_documents_issuer_entity_id
  on public.commercial_documents(issuer_entity_id);

create index if not exists idx_commercial_documents_type_status
  on public.commercial_documents(document_type, status);

comment on table public.commercial_documents is 'Issued/draft commercial documents backed by immutable snapshots after issue.';

create table if not exists public.document_number_sequences (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.commercial_entities(id) on delete cascade,
  document_type text not null,
  year integer not null,
  current_number integer not null default 0 check (current_number >= 0),
  prefix text not null,
  updated_at timestamptz not null default now(),
  unique (entity_id, document_type, year)
);

create index if not exists idx_document_number_sequences_lookup
  on public.document_number_sequences(entity_id, document_type, year);

comment on table public.document_number_sequences is 'Per-entity, per-document-type, per-year sequence state for non-reusable document numbers.';

-- Keep new commercial tables out of browser access by default.
alter table public.commercial_entities enable row level security;
alter table public.customer_tax_profiles enable row level security;
alter table public.commercial_orders enable row level security;
alter table public.payments enable row level security;
alter table public.commercial_documents enable row level security;
alter table public.document_number_sequences enable row level security;
