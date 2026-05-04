-- Commercial Document Policy v1 - harden database function search paths.

alter function public.allocate_commercial_document_number(uuid, text, timestamptz, text)
	set search_path = public, pg_temp;

alter function public.prevent_issued_commercial_document_core_update()
	set search_path = public, pg_temp;
