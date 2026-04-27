-- Repair migration for hosted environments that have the production upload repair
-- history entry but are still missing the later LIFF, document, billing, and
-- runtime product catalog schema changes that exist locally.

alter table public.lead_media_assets
	add column if not exists storage_provider text,
	add column if not exists storage_bucket text;

update public.lead_media_assets
set
	storage_provider = coalesce(storage_provider, 'supabase'),
	storage_bucket = coalesce(storage_bucket, 'customer-media')
where storage_provider is null
	 or storage_bucket is null;

alter table public.lead_media_assets
	alter column storage_provider set default 'supabase',
	alter column storage_bucket set default 'customer-media';

alter table public.lead_media_assets
	alter column storage_provider set not null,
	alter column storage_bucket set not null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'lead_media_assets_storage_provider_check'
	) then
		alter table public.lead_media_assets
			add constraint lead_media_assets_storage_provider_check
			check (storage_provider in ('supabase', 'r2'));
	end if;
end
$$;

alter table public.leads
	add column if not exists design_brief text,
	add column if not exists requested_document_type text not null default 'quote'
		check (requested_document_type in ('quote', 'invoice', 'receipt', 'tax_invoice')),
	add column if not exists billing_entity_type text not null default 'person'
		check (billing_entity_type in ('person', 'company')),
	add column if not exists billing_name text,
	add column if not exists tax_id text;

comment on column public.leads.design_brief is 'Human-friendly design brief collected from the customer before composing or editing an AI prompt.';
comment on column public.leads.requested_document_type is 'Primary document the customer expects for this lead.';
comment on column public.leads.billing_entity_type is 'Whether billing should be issued to a person or company.';
comment on column public.leads.billing_name is 'Name or company name the customer wants on documents.';
comment on column public.leads.tax_id is 'Tax ID provided for tax invoice or company billing needs.';

alter table public.app_settings
	add column if not exists payment_qr_code_url text,
	add column if not exists payment_qr_code_label text,
	add column if not exists payment_display_mode text not null default 'all'
		check (payment_display_mode in ('all', 'account_only', 'qr_only', 'account_and_qr')),
	add column if not exists payment_secondary_account_name text,
	add column if not exists payment_secondary_bank_name text,
	add column if not exists payment_secondary_account_number text,
	add column if not exists payment_secondary_promptpay_id text,
	add column if not exists payment_secondary_qr_code_url text,
	add column if not exists payment_secondary_qr_code_label text,
	add column if not exists payment_secondary_display_mode text not null default 'all'
		check (payment_secondary_display_mode in ('all', 'account_only', 'qr_only', 'account_and_qr')),
	add column if not exists payment_secondary_instructions text,
	add column if not exists payment_secondary_max_quote_total numeric(12,2),
	add column if not exists payment_secondary_customer_scope text not null default 'none'
		check (payment_secondary_customer_scope in ('none', 'person', 'company', 'all')),
	add column if not exists payment_secondary_payment_terms_scope text not null default 'none'
		check (payment_secondary_payment_terms_scope in ('none', 'prepaid', 'deposit', 'credit', 'non_credit', 'all'));

alter table public.quotes
	add column if not exists payment_profile_snapshot jsonb;

comment on column public.app_settings.payment_qr_code_url is 'Public asset URL for the customer-facing payment QR code.';
comment on column public.app_settings.payment_qr_code_label is 'Optional caption shown below the payment QR code on quote surfaces.';
comment on column public.app_settings.payment_display_mode is 'Controls whether quotes show account details, QR code, or both.';
comment on column public.app_settings.payment_secondary_account_name is 'Secondary payment profile account name used by auto-routing rules.';
comment on column public.app_settings.payment_secondary_bank_name is 'Secondary payment profile bank name used by auto-routing rules.';
comment on column public.app_settings.payment_secondary_account_number is 'Secondary payment profile account number used by auto-routing rules.';
comment on column public.app_settings.payment_secondary_promptpay_id is 'Secondary payment profile PromptPay identifier.';
comment on column public.app_settings.payment_secondary_qr_code_url is 'Secondary payment profile QR code image URL.';
comment on column public.app_settings.payment_secondary_qr_code_label is 'Caption shown below the secondary payment QR code.';
comment on column public.app_settings.payment_secondary_display_mode is 'How the secondary payment profile should be shown on quote surfaces.';
comment on column public.app_settings.payment_secondary_instructions is 'Instructions shown when the auto-routing logic selects the secondary payment profile.';
comment on column public.app_settings.payment_secondary_max_quote_total is 'Use the secondary payment profile when quote total is at or below this amount.';
comment on column public.app_settings.payment_secondary_customer_scope is 'Use the secondary payment profile for matching billing entity types.';
comment on column public.app_settings.payment_secondary_payment_terms_scope is 'Use the secondary payment profile for matching customer payment terms from intake.';
comment on column public.quotes.payment_profile_snapshot is 'Resolved payment profile snapshot saved when the quote is created so published quotes stay deterministic.';

alter table public.customers
	add column if not exists line_email text,
	add column if not exists line_picture_url text,
	add column if not exists line_status_message text,
	add column if not exists line_friendship_status boolean,
	add column if not exists last_liff_profile jsonb,
	add column if not exists last_liff_context jsonb;

alter table public.leads
	add column if not exists billing_address text,
	add column if not exists liff_profile_snapshot jsonb,
	add column if not exists liff_context_snapshot jsonb;

comment on column public.customers.line_email is 'Latest email address returned from LINE Login ID token verification when the email scope is granted.';
comment on column public.customers.line_picture_url is 'Latest LINE main profile image URL verified from the LINE platform.';
comment on column public.customers.line_status_message is 'Latest LINE profile status message retrieved from the LINE platform via access token.';
comment on column public.customers.line_friendship_status is 'Friendship state between the customer and the linked LINE Official Account.';
comment on column public.customers.last_liff_profile is 'Latest verified LINE profile snapshot captured during LIFF intake without storing raw tokens.';
comment on column public.customers.last_liff_context is 'Latest LIFF runtime context and granted-scope snapshot captured during intake.';
comment on column public.leads.billing_address is 'Billing or document address captured from the customer during intake.';
comment on column public.leads.liff_profile_snapshot is 'Point-in-time verified LINE profile snapshot captured when the lead was submitted.';
comment on column public.leads.liff_context_snapshot is 'Point-in-time LIFF runtime context snapshot captured when the lead was submitted.';

alter table public.leads
	add column if not exists billing_branch_type text
		check (billing_branch_type in ('head_office', 'branch')),
	add column if not exists billing_branch_code text;

comment on column public.leads.billing_branch_type is 'Branch mode requested for billing documents: head office or branch.';
comment on column public.leads.billing_branch_code is 'Branch code captured for company billing documents when the customer requests a branch document.';

create table if not exists public.product_catalog_items (
	value text primary key,
	label text not null,
	category text not null,
	category_label text not null,
	description text,
	keywords text[] not null default array[]::text[],
	per_sqm numeric(12,2) not null default 0,
	min_charge numeric(12,2) not null default 0,
	active boolean not null default true,
	sort_order integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.product_catalog_items enable row level security;

create index if not exists product_catalog_items_active_sort_idx
	on public.product_catalog_items (active, sort_order, label);

alter table public.leads
	add column if not exists product_label_snapshot text,
	add column if not exists product_category_snapshot text,
	add column if not exists product_category_label_snapshot text;

comment on table public.product_catalog_items is 'Runtime-managed product catalog used by LIFF intake and document surfaces.';
comment on column public.product_catalog_items.value is 'Stable machine key for the product, used as product_type in leads.';
comment on column public.product_catalog_items.label is 'Customer-facing product label.';
comment on column public.product_catalog_items.category is 'Machine category key used for grouping/filtering.';
comment on column public.product_catalog_items.category_label is 'Customer-facing category label.';
comment on column public.product_catalog_items.description is 'Optional short product description shown in selection UIs.';
comment on column public.product_catalog_items.keywords is 'Optional search keywords for the LIFF picker and future matching.';
comment on column public.product_catalog_items.per_sqm is 'Price rate per square meter used for auto-quote calculation.';
comment on column public.product_catalog_items.min_charge is 'Minimum charge applied when auto-pricing the product.';
comment on column public.product_catalog_items.active is 'Whether the product is selectable in runtime surfaces.';
comment on column public.product_catalog_items.sort_order is 'Sort order for customer-facing product lists.';
comment on column public.leads.product_label_snapshot is 'Point-in-time product label captured when the lead was submitted.';
comment on column public.leads.product_category_snapshot is 'Point-in-time product category key captured when the lead was submitted.';
comment on column public.leads.product_category_label_snapshot is 'Point-in-time product category label captured when the lead was submitted.';

notify pgrst, 'reload schema';
