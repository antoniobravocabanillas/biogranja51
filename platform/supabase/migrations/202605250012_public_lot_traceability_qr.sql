-- Customer-facing traceability publication with private operational data excluded.

alter table public.inventory_lots
  add column if not exists public_trace_token uuid not null default gen_random_uuid(),
  add column if not exists traceability_published boolean not null default false,
  add column if not exists public_trace_summary text not null default '',
  add column if not exists traceability_published_at timestamptz,
  add column if not exists traceability_published_by uuid references auth.users(id);

create unique index if not exists inventory_lots_public_trace_token_uidx
  on public.inventory_lots (public_trace_token);

create or replace function public.publish_inventory_lot_traceability(
  p_lot_id uuid,
  p_published boolean,
  p_public_summary text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.inventory_lots;
  v_product public.products;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_lot from public.inventory_lots where id = p_lot_id for update;
  if v_lot.id is null then raise exception 'Lote no encontrado.'; end if;
  select * into v_product from public.products where id = v_lot.product_id;
  if p_published then
    if not v_product.traceable then
      raise exception 'El producto no esta habilitado para trazabilidad publica.';
    end if;
    if length(trim(coalesce(p_public_summary, ''))) < 12 then
      raise exception 'Incluye una descripcion publica breve del lote.';
    end if;
    if v_lot.origin_type::text = 'own'
       and v_lot.source_bird_batch_id is null
       and v_lot.source_layer_flock_id is null then
      raise exception 'El producto propio requiere origen productivo enlazado.';
    end if;
    if v_lot.origin_type::text <> 'own' then
      if v_lot.sanitary_status is distinct from 'approved' then
        raise exception 'El lote comprado debe estar liberado sanitariamente.';
      end if;
      if not exists (
        select 1 from public.audit_evidence
        where entity_type = 'inventory_lot' and entity_id = p_lot_id
          and category = 'supplier_document' and status = 'active'
      ) or not exists (
        select 1 from public.audit_evidence
        where entity_type = 'inventory_lot' and entity_id = p_lot_id
          and category = 'temperature_record' and status = 'active'
      ) or not exists (
        select 1 from public.audit_evidence
        where entity_type = 'inventory_lot' and entity_id = p_lot_id
          and category = 'sanitary_release' and status = 'active'
      ) then
        raise exception 'Anexa documentos, temperatura y liberacion antes de publicar.';
      end if;
    end if;
  end if;

  update public.inventory_lots
  set traceability_published = p_published,
      public_trace_summary = case when p_published then trim(p_public_summary) else public_trace_summary end,
      traceability_published_at = case when p_published then now() else null end,
      traceability_published_by = case when p_published then auth.uid() else null end
  where id = p_lot_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    case when p_published then 'inventory_lot.traceability_published' else 'inventory_lot.traceability_unpublished' end,
    'inventory_lots',
    p_lot_id,
    jsonb_build_object('code', v_lot.code, 'published', p_published)
  );
  return p_lot_id;
end;
$$;

create or replace function public.get_public_lot_traceability(p_token uuid)
returns table (
  token uuid,
  lot_code text,
  product_name text,
  presentation text,
  origin_type text,
  produced_or_received_at timestamptz,
  expires_at timestamptz,
  source_label text,
  verification_label text,
  public_summary text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.public_trace_token,
    l.code,
    p.name,
    p.presentation,
    l.origin_type::text,
    l.produced_or_received_at,
    l.expires_at,
    case
      when l.source_bird_batch_id is not null then 'Crianza propia BioGranja 51'
      when l.source_layer_flock_id is not null then 'Produccion propia de huevos BioGranja 51'
      when l.origin_type::text = 'own' then 'Produccion propia BioGranja 51'
      else 'Proveedor seleccionado y controlado por BioGranja 51'
    end,
    case
      when l.origin_type::text = 'own' then 'Origen productivo registrado'
      else 'Recepcion y liberacion sanitaria aprobadas'
    end,
    l.public_trace_summary,
    l.traceability_published_at
  from public.inventory_lots l
  join public.products p on p.id = l.product_id
  where l.public_trace_token = p_token
    and l.traceability_published
    and p.active
    and p.traceable
    and (
      (l.origin_type::text = 'own' and (l.source_bird_batch_id is not null or l.source_layer_flock_id is not null))
      or (l.origin_type::text <> 'own' and l.sanitary_status = 'approved')
    );
$$;

revoke all on function public.publish_inventory_lot_traceability(uuid, boolean, text) from public;
revoke all on function public.get_public_lot_traceability(uuid) from public;
grant execute on function public.publish_inventory_lot_traceability(uuid, boolean, text) to authenticated;
grant execute on function public.get_public_lot_traceability(uuid) to anon, authenticated;
