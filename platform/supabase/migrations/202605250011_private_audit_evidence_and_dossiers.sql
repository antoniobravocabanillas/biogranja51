-- Private documentary dossiers: evidence metadata, immutable voiding and protected storage.

create table if not exists public.audit_evidence (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in (
      'inventory_lot', 'bird_batch', 'layer_flock', 'feed_input_lot',
      'mill_batch', 'order', 'order_payment', 'sales_receipt'
    )
  ),
  entity_id uuid not null,
  category text not null check (
    category in (
      'supplier_document', 'temperature_record', 'sanitary_release',
      'payment_proof', 'sales_receipt', 'delivery_proof',
      'production_record', 'other'
    )
  ),
  title text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text not null default '',
  uploaded_by uuid references auth.users(id),
  voided_by uuid references auth.users(id),
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists audit_evidence_entity_idx
  on public.audit_evidence (entity_type, entity_id, created_at desc);

alter table public.audit_evidence enable row level security;

drop policy if exists "staff manage audit evidence" on public.audit_evidence;
drop policy if exists "staff reads audit evidence" on public.audit_evidence;
create policy "staff reads audit evidence"
on public.audit_evidence for select to authenticated
using ((select public.is_staff()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audit-evidence',
  'audit-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff reads audit evidence files" on storage.objects;
drop policy if exists "staff uploads audit evidence files" on storage.objects;
drop policy if exists "staff updates audit evidence files" on storage.objects;
drop policy if exists "staff deletes audit evidence files" on storage.objects;

create policy "staff reads audit evidence files"
on storage.objects for select to authenticated
using (bucket_id = 'audit-evidence' and (select public.is_staff()));

create policy "staff uploads audit evidence files"
on storage.objects for insert to authenticated
with check (bucket_id = 'audit-evidence' and (select public.is_staff()));

create policy "staff updates audit evidence files"
on storage.objects for update to authenticated
using (bucket_id = 'audit-evidence' and (select public.is_staff()))
with check (bucket_id = 'audit-evidence' and (select public.is_staff()));

create policy "staff deletes audit evidence files"
on storage.objects for delete to authenticated
using (bucket_id = 'audit-evidence' and (select public.is_staff()));

create or replace function public.register_audit_evidence(
  p_entity_type text,
  p_entity_id uuid,
  p_category text,
  p_title text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size integer,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evidence_id uuid;
  v_exists boolean := false;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if p_entity_type not in (
      'inventory_lot', 'bird_batch', 'layer_flock', 'feed_input_lot',
      'mill_batch', 'order', 'order_payment', 'sales_receipt'
    ) or p_category not in (
      'supplier_document', 'temperature_record', 'sanitary_release',
      'payment_proof', 'sales_receipt', 'delivery_proof',
      'production_record', 'other'
    ) or p_entity_id is null
    or length(trim(coalesce(p_title, ''))) < 3
    or length(trim(coalesce(p_storage_path, ''))) < 3
    or length(trim(coalesce(p_file_name, ''))) < 1
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    or p_file_size is null or p_file_size <= 0 or p_file_size > 10485760 then
    raise exception 'Completa un documento valido para el expediente.';
  end if;

  case p_entity_type
    when 'inventory_lot' then select exists(select 1 from public.inventory_lots where id = p_entity_id) into v_exists;
    when 'bird_batch' then select exists(select 1 from public.bird_batches where id = p_entity_id) into v_exists;
    when 'layer_flock' then select exists(select 1 from public.layer_flocks where id = p_entity_id) into v_exists;
    when 'feed_input_lot' then select exists(select 1 from public.feed_input_lots where id = p_entity_id) into v_exists;
    when 'mill_batch' then select exists(select 1 from public.mill_batches where id = p_entity_id) into v_exists;
    when 'order' then select exists(select 1 from public.orders where id = p_entity_id) into v_exists;
    when 'order_payment' then select exists(select 1 from public.order_payments where id = p_entity_id) into v_exists;
    when 'sales_receipt' then select exists(select 1 from public.sales_receipts where id = p_entity_id) into v_exists;
  end case;
  if not v_exists then raise exception 'El registro asociado no existe.'; end if;

  insert into public.audit_evidence (
    entity_type, entity_id, category, title, storage_path, file_name,
    mime_type, file_size, notes, uploaded_by
  ) values (
    p_entity_type, p_entity_id, p_category, trim(p_title), trim(p_storage_path),
    trim(p_file_name), p_mime_type, p_file_size, trim(coalesce(p_notes, '')), auth.uid()
  ) returning id into v_evidence_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'audit_evidence.registered', 'audit_evidence', v_evidence_id,
    jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id, 'category', p_category)
  );
  return v_evidence_id;
end;
$$;

create or replace function public.void_audit_evidence(
  p_evidence_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evidence public.audit_evidence;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Documenta el motivo de anulacion.';
  end if;
  select * into v_evidence from public.audit_evidence where id = p_evidence_id for update;
  if v_evidence.id is null or v_evidence.status <> 'active' then
    raise exception 'La evidencia ya fue anulada o no existe.';
  end if;
  update public.audit_evidence
  set status = 'voided',
      void_reason = trim(p_reason),
      voided_by = auth.uid(),
      voided_at = now()
  where id = p_evidence_id;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'audit_evidence.voided', 'audit_evidence', p_evidence_id,
    jsonb_build_object('entity_type', v_evidence.entity_type, 'entity_id', v_evidence.entity_id, 'reason', trim(p_reason))
  );
  return p_evidence_id;
end;
$$;

revoke all on function public.register_audit_evidence(text, uuid, text, text, text, text, text, integer, text) from public;
revoke all on function public.void_audit_evidence(uuid, text) from public;
grant execute on function public.register_audit_evidence(text, uuid, text, text, text, text, text, integer, text) to authenticated;
grant execute on function public.void_audit_evidence(uuid, text) to authenticated;
