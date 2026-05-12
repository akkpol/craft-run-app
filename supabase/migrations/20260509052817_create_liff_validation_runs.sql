create table if not exists public.liff_validation_runs (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default timezone('utc', now()),
	run_by_line_user_id_hash text not null,
	environment jsonb not null default '{}'::jsonb,
	liff_is_in_client boolean,
	liff_logged_in boolean,
	line_version text,
	checks_json jsonb not null default '[]'::jsonb,
	passed boolean not null default false,
	failed_checks text[] not null default '{}'::text[],
	notes text
);

create index if not exists liff_validation_runs_created_at_idx
	on public.liff_validation_runs (created_at desc);

create index if not exists liff_validation_runs_passed_idx
	on public.liff_validation_runs (passed, created_at desc);

create index if not exists liff_validation_runs_user_hash_idx
	on public.liff_validation_runs (run_by_line_user_id_hash, created_at desc);

alter table public.liff_validation_runs enable row level security;

comment on table public.liff_validation_runs is
	'LIFF validation harness runs captured from real LINE WebView devices.';

comment on column public.liff_validation_runs.run_by_line_user_id_hash is
	'SHA-256 hash of the verified LINE user ID. Raw LINE identifiers are never stored.';

comment on column public.liff_validation_runs.environment is
	'Sanitized LIFF runtime environment captured on the device, excluding raw tokens.';

comment on column public.liff_validation_runs.checks_json is
	'Per-check LIFF validation results with screenshot-friendly summaries.';

comment on column public.liff_validation_runs.failed_checks is
	'Stable LIFF validation check identifiers that failed during this run.';
