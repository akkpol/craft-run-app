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
