create or replace function public.allocate_commercial_document_number(
  p_entity_id uuid,
  p_document_type text,
  p_issued_at timestamptz default now(),
  p_prefix text default null
)
returns table (
  document_number text,
  next_number integer,
  sequence_year integer,
  prefix text
)
language plpgsql
as $$
declare
  v_year integer := extract(year from timezone('UTC', p_issued_at));
  v_prefix text := nullif(trim(coalesce(p_prefix, '')), '');
  v_next_number integer;
  v_stored_prefix text;
begin
  if v_prefix is null then
    v_prefix := case p_document_type
      when 'RECEIPT' then 'RE'
      when 'TAX_INVOICE_RECEIPT' then 'TAXRE'
      else upper(left(regexp_replace(p_document_type, '[^A-Z]', '', 'g'), 6))
    end;
  end if;

  insert into public.document_number_sequences (
    entity_id,
    document_type,
    year,
    current_number,
    prefix,
    updated_at
  )
  values (
    p_entity_id,
    p_document_type,
    v_year,
    0,
    v_prefix,
    now()
  )
  on conflict (entity_id, document_type, year) do nothing;

  update public.document_number_sequences as dns
  set current_number = dns.current_number + 1,
      updated_at = now()
  where dns.entity_id = p_entity_id
    and dns.document_type = p_document_type
    and dns.year = v_year
  returning dns.current_number, dns.prefix
  into v_next_number, v_stored_prefix;

  if v_next_number is null then
    raise exception 'DOCUMENT_NUMBER_CONFLICT: failed to allocate a sequence row for entity % and type %', p_entity_id, p_document_type
      using errcode = 'P0001';
  end if;

  return query
  select
    format('%s-%s-%s', v_stored_prefix, v_year, lpad(v_next_number::text, 5, '0')),
    v_next_number,
    v_year,
    v_stored_prefix;
end;
$$;

comment on function public.allocate_commercial_document_number(uuid, text, timestamptz, text)
is 'Allocates a non-reusable commercial document number per entity, document type, and year using an atomic row update.';

create unique index if not exists idx_commercial_documents_payment_id_unique
  on public.commercial_documents(payment_id)
  where payment_id is not null;