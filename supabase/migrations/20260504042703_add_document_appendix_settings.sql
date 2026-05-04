alter table public.app_settings
	add column if not exists document_appendix_image_url text,
	add column if not exists document_appendix_image_name text;

comment on column public.app_settings.document_appendix_image_url is 'Public image URL printed as a trailing appendix page on commercial documents.';
comment on column public.app_settings.document_appendix_image_name is 'Original file name for the commercial document appendix image.';
