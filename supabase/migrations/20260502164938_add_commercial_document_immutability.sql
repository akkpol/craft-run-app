-- Commercial Document Policy v1 - issued document immutability and FK index hygiene.

create or replace function public.prevent_issued_commercial_document_core_update()
returns trigger
language plpgsql
as $$
begin
	if old.status in ('ISSUED', 'PAID', 'VOID') then
		if new.order_id is distinct from old.order_id
			or new.quote_id is distinct from old.quote_id
			or new.payment_id is distinct from old.payment_id
			or new.issuer_entity_id is distinct from old.issuer_entity_id
			or new.customer_id is distinct from old.customer_id
			or new.customer_tax_profile_id is distinct from old.customer_tax_profile_id
			or new.document_type is distinct from old.document_type
			or new.document_number is distinct from old.document_number
			or new.vat_mode is distinct from old.vat_mode
			or new.vat_rate is distinct from old.vat_rate
			or new.subtotal is distinct from old.subtotal
			or new.discount_amount is distinct from old.discount_amount
			or new.vat_amount is distinct from old.vat_amount
			or new.grand_total is distinct from old.grand_total
			or new.issued_at is distinct from old.issued_at
			or new.locked_at is distinct from old.locked_at
			or new.snapshot_json is distinct from old.snapshot_json
		then
			raise exception
				'COMMERCIAL_DOCUMENT_IMMUTABLE: issued commercial document % core fields cannot be changed.',
				old.id
				using errcode = 'P0001';
		end if;

		if new.status = 'DRAFT' then
			raise exception
				'COMMERCIAL_DOCUMENT_IMMUTABLE: issued commercial document % cannot return to DRAFT.',
				old.id
				using errcode = 'P0001';
		end if;

		if old.status = 'VOID' and new.status is distinct from old.status then
			raise exception
				'COMMERCIAL_DOCUMENT_IMMUTABLE: voided commercial document % status cannot be changed.',
				old.id
				using errcode = 'P0001';
		end if;
	end if;

	return new;
end;
$$;

comment on function public.prevent_issued_commercial_document_core_update() is
	'Prevents silent edits to core fields of issued commercial documents. Corrections require VOID, CREDIT_NOTE, or DEBIT_NOTE behavior.';

drop trigger if exists trg_prevent_issued_commercial_document_core_update
	on public.commercial_documents;

create trigger trg_prevent_issued_commercial_document_core_update
	before update on public.commercial_documents
	for each row
	execute function public.prevent_issued_commercial_document_core_update();

create index if not exists idx_commercial_documents_quote_id
	on public.commercial_documents(quote_id);

create index if not exists idx_commercial_documents_customer_id
	on public.commercial_documents(customer_id);

create index if not exists idx_commercial_documents_customer_tax_profile_id
	on public.commercial_documents(customer_tax_profile_id);

create index if not exists idx_commercial_orders_selected_receiver_entity_id
	on public.commercial_orders(selected_receiver_entity_id);

create index if not exists idx_commercial_orders_customer_tax_profile_id
	on public.commercial_orders(customer_tax_profile_id);

create index if not exists idx_commercial_orders_job_id
	on public.commercial_orders(job_id);
