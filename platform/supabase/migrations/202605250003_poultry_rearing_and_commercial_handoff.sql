-- Separate live poultry rearing from sellable processed inventory.

create sequence if not exists public.bird_batch_number_seq start 1;

create table if not exists public.bird_batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  location_id uuid not null references public.locations(id),
  source_name text not null,
  breed text,
  received_at timestamptz not null,
  initial_count integer not null check (initial_count > 0),
  current_count integer not null check (current_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  initial_avg_weight_grams numeric(10, 2) check (initial_avg_weight_grams is null or initial_avg_weight_grams > 0),
  cost_per_chick numeric(12, 2) check (cost_per_chick is null or cost_per_chick >= 0),
  stage text not null default 'received'
    check (stage in ('received', 'brooding', 'growing', 'finishing', 'ready_processing', 'processed', 'closed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bird_batch_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bird_batches(id) on delete cascade,
  event_type text not null
    check (event_type in ('mortality', 'weight_sample', 'feed_consumption', 'stage_change', 'processing')),
  event_at timestamptz not null,
  count integer check (count is null or count > 0),
  avg_weight_grams numeric(10, 2) check (avg_weight_grams is null or avg_weight_grams > 0),
  feed_kg numeric(12, 3) check (feed_kg is null or feed_kg > 0),
  stage text check (stage is null or stage in ('received', 'brooding', 'growing', 'finishing', 'ready_processing', 'processed', 'closed')),
  notes text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.inventory_lots
  add column if not exists source_bird_batch_id uuid references public.bird_batches(id),
  add column if not exists processed_units integer check (processed_units is null or processed_units > 0);

alter table public.bird_batches enable row level security;
alter table public.bird_batch_events enable row level security;

drop policy if exists "staff manage bird batches" on public.bird_batches;
drop policy if exists "staff manage bird batch events" on public.bird_batch_events;

create policy "staff manage bird batches"
on public.bird_batches for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage bird batch events"
on public.bird_batch_events for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop trigger if exists bird_batches_touch_updated_at on public.bird_batches;
create trigger bird_batches_touch_updated_at
before update on public.bird_batches
for each row execute function public.touch_updated_at();

create or replace function public.create_bird_batch(
  p_location_id uuid,
  p_source_name text,
  p_breed text,
  p_received_at timestamptz,
  p_initial_count integer,
  p_initial_avg_weight_grams numeric,
  p_cost_per_chick numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.bird_batches;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if not exists (
    select 1 from public.locations
    where id = p_location_id and active and type = 'farm'
  ) then
    raise exception 'Selecciona una unidad productiva avícola activa.';
  end if;
  if length(trim(coalesce(p_source_name, ''))) < 2
     or p_initial_count is null
     or p_initial_count <= 0 then
    raise exception 'Registra proveedor y cantidad de pollitos.';
  end if;
  if p_initial_avg_weight_grams is not null and p_initial_avg_weight_grams <= 0 then
    raise exception 'El peso inicial debe ser mayor a cero.';
  end if;
  if p_cost_per_chick is not null and p_cost_per_chick < 0 then
    raise exception 'El costo del pollito no puede ser negativo.';
  end if;

  insert into public.bird_batches (
    code,
    location_id,
    source_name,
    breed,
    received_at,
    initial_count,
    current_count,
    initial_avg_weight_grams,
    cost_per_chick,
    stage,
    notes
  )
  values (
    'BG51-AVI-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.bird_batch_number_seq')::text, 5, '0'),
    p_location_id,
    trim(p_source_name),
    nullif(trim(coalesce(p_breed, '')), ''),
    p_received_at,
    p_initial_count,
    p_initial_count,
    p_initial_avg_weight_grams,
    p_cost_per_chick,
    'received',
    trim(coalesce(p_notes, ''))
  )
  returning * into v_batch;

  insert into public.bird_batch_events (
    batch_id, event_type, event_at, count, avg_weight_grams, stage, notes, actor_id
  )
  values (
    v_batch.id,
    'stage_change',
    p_received_at,
    p_initial_count,
    p_initial_avg_weight_grams,
    'received',
    'Ingreso de pollitos vivos',
    auth.uid()
  );

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'bird_batch.created',
    'bird_batches',
    v_batch.id,
    jsonb_build_object('code', v_batch.code, 'initial_count', p_initial_count)
  );

  return v_batch.id;
end;
$$;

create or replace function public.record_bird_batch_event(
  p_batch_id uuid,
  p_event_type text,
  p_event_at timestamptz,
  p_count integer,
  p_avg_weight_grams numeric,
  p_feed_kg numeric,
  p_stage text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.bird_batches;
  v_event_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if p_event_type is null
     or p_event_type not in ('mortality', 'weight_sample', 'feed_consumption', 'stage_change') then
    raise exception 'Evento de crianza no permitido.';
  end if;
  select * into v_batch
  from public.bird_batches
  where id = p_batch_id
  for update;
  if v_batch.id is null then
    raise exception 'Lote de crianza no encontrado.';
  end if;
  if v_batch.stage in ('processed', 'closed') then
    raise exception 'El lote ya fue cerrado para seguimiento productivo.';
  end if;

  if p_event_type = 'mortality' then
    if p_count is null or p_count <= 0 or p_count > v_batch.current_count then
      raise exception 'La mortalidad supera las aves vivas disponibles.';
    end if;
    update public.bird_batches
    set current_count = current_count - p_count,
        stage = case when current_count - p_count = 0 then 'closed' else stage end
    where id = p_batch_id;
  elsif p_event_type = 'weight_sample' then
    if p_avg_weight_grams is null or p_avg_weight_grams <= 0 then
      raise exception 'Registra un peso promedio válido.';
    end if;
  elsif p_event_type = 'feed_consumption' then
    if p_feed_kg is null or p_feed_kg <= 0 then
      raise exception 'Registra alimento consumido válido.';
    end if;
  elsif p_event_type = 'stage_change' then
    if p_stage not in ('received', 'brooding', 'growing', 'finishing', 'ready_processing') then
      raise exception 'La etapa seleccionada no es válida.';
    end if;
    update public.bird_batches set stage = p_stage where id = p_batch_id;
  end if;

  insert into public.bird_batch_events (
    batch_id, event_type, event_at, count, avg_weight_grams, feed_kg, stage, notes, actor_id
  )
  values (
    p_batch_id,
    p_event_type,
    p_event_at,
    case when p_event_type = 'mortality' then p_count else null end,
    case when p_event_type = 'weight_sample' then p_avg_weight_grams else null end,
    case when p_event_type = 'feed_consumption' then p_feed_kg else null end,
    case when p_event_type = 'stage_change' then p_stage else null end,
    trim(coalesce(p_notes, '')),
    auth.uid()
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.harvest_bird_batch_to_inventory(
  p_batch_id uuid,
  p_product_id uuid,
  p_location_id uuid,
  p_processed_units integer,
  p_net_weight_kg numeric,
  p_unit_cost numeric,
  p_processed_at timestamptz,
  p_expires_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.bird_batches;
  v_product public.products;
  v_lot public.inventory_lots;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  select * into v_batch
  from public.bird_batches where id = p_batch_id for update;
  if v_batch.id is null
     or p_processed_units is null
     or p_processed_units <= 0
     or v_batch.current_count < p_processed_units then
    raise exception 'La cantidad faenada no corresponde a aves vivas del lote.';
  end if;
  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null or v_product.origin_type <> 'own' or v_product.price_unit <> 'kg' then
    raise exception 'Selecciona un producto propio comercializado en kg.';
  end if;
  if not exists (
    select 1 from public.locations
    where id = p_location_id and active and type in ('store', 'warehouse', 'mill')
  ) then
    raise exception 'Selecciona una sede comercial o almacén para el producto faenado.';
  end if;
  if p_net_weight_kg is null
     or p_net_weight_kg <= 0
     or (p_unit_cost is not null and p_unit_cost < 0) then
    raise exception 'Registra peso neto y costo válidos.';
  end if;
  if p_processed_at < v_batch.received_at
     or (p_expires_at is not null and p_expires_at < p_processed_at) then
    raise exception 'Las fechas de faena o vencimiento no son válidas.';
  end if;

  insert into public.inventory_lots (
    code,
    product_id,
    origin_type,
    supplier_name,
    location_id,
    received_quantity,
    quantity,
    unit,
    unit_cost,
    produced_or_received_at,
    expires_at,
    status,
    notes,
    source_bird_batch_id,
    processed_units
  )
  values (
    'BG51-LT-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.inventory_lot_number_seq')::text, 5, '0'),
    p_product_id,
    'own',
    null,
    p_location_id,
    p_net_weight_kg,
    p_net_weight_kg,
    'kg',
    p_unit_cost,
    p_processed_at,
    p_expires_at,
    'available',
    trim(coalesce(p_notes, '')),
    p_batch_id,
    p_processed_units
  )
  returning * into v_lot;

  insert into public.inventory_movements (
    lot_id, movement_type, quantity_delta, unit, reason, actor_id
  )
  values (
    v_lot.id,
    'receipt',
    p_net_weight_kg,
    'kg',
    'Faena desde crianza ' || v_batch.code,
    auth.uid()
  );

  update public.bird_batches
  set current_count = current_count - p_processed_units,
      processed_count = processed_count + p_processed_units,
      stage = case
        when current_count - p_processed_units = 0 then 'processed'
        else 'ready_processing'
      end
  where id = p_batch_id;

  insert into public.bird_batch_events (
    batch_id, event_type, event_at, count, notes, actor_id
  )
  values (
    p_batch_id,
    'processing',
    p_processed_at,
    p_processed_units,
    'Lote comercial ' || v_lot.code || ' | ' || p_net_weight_kg || ' kg',
    auth.uid()
  );

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'bird_batch.inventory_handoff',
    'inventory_lots',
    v_lot.id,
    jsonb_build_object('batch_id', p_batch_id, 'processed_units', p_processed_units, 'net_weight_kg', p_net_weight_kg)
  );

  return v_lot.id;
end;
$$;

create or replace function public.create_inventory_lot(
  p_product_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_unit text,
  p_unit_cost numeric,
  p_received_at timestamptz,
  p_expires_at timestamptz,
  p_supplier_name text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_lot public.inventory_lots;
  v_expected_unit text;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null then
    raise exception 'Producto no encontrado.';
  end if;
  if v_product.origin_type = 'own' then
    raise exception 'El producto propio se recibe desde Crianza después de la faena.';
  end if;
  if not exists (select 1 from public.locations where id = p_location_id and active) then
    raise exception 'Sede no disponible.';
  end if;
  v_expected_unit := case when v_product.price_unit = 'kg' then 'kg' else v_product.price_unit end;
  if p_quantity <= 0 or p_unit <> v_expected_unit then
    raise exception 'La cantidad o unidad no corresponde al producto terminado.';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'El costo no puede ser negativo.';
  end if;
  if p_expires_at is not null and p_expires_at < p_received_at then
    raise exception 'El vencimiento no puede ser anterior al ingreso.';
  end if;
  if length(trim(coalesce(p_supplier_name, ''))) < 2 then
    raise exception 'Registra el proveedor del producto terminado.';
  end if;

  insert into public.inventory_lots (
    code, product_id, origin_type, supplier_name, location_id, received_quantity,
    quantity, unit, unit_cost, produced_or_received_at, expires_at, status, notes
  )
  values (
    'BG51-LT-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.inventory_lot_number_seq')::text, 5, '0'),
    p_product_id,
    v_product.origin_type,
    trim(p_supplier_name),
    p_location_id,
    p_quantity,
    p_quantity,
    p_unit,
    p_unit_cost,
    p_received_at,
    p_expires_at,
    'available',
    trim(coalesce(p_notes, ''))
  )
  returning * into v_lot;

  insert into public.inventory_movements (
    lot_id, movement_type, quantity_delta, unit, reason, actor_id
  )
  values (v_lot.id, 'receipt', p_quantity, p_unit, 'Recepción de producto terminado', auth.uid());

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'inventory_lot.finished_product_created',
    'inventory_lots',
    v_lot.id,
    jsonb_build_object('code', v_lot.code, 'quantity', p_quantity, 'unit', p_unit)
  );

  return v_lot.id;
end;
$$;

revoke all on function public.create_bird_batch(uuid, text, text, timestamptz, integer, numeric, numeric, text) from public;
revoke all on function public.record_bird_batch_event(uuid, text, timestamptz, integer, numeric, numeric, text, text) from public;
revoke all on function public.harvest_bird_batch_to_inventory(uuid, uuid, uuid, integer, numeric, numeric, timestamptz, timestamptz, text) from public;

grant execute on function public.create_bird_batch(uuid, text, text, timestamptz, integer, numeric, numeric, text) to authenticated;
grant execute on function public.record_bird_batch_event(uuid, text, timestamptz, integer, numeric, numeric, text, text) to authenticated;
grant execute on function public.harvest_bird_batch_to_inventory(uuid, uuid, uuid, integer, numeric, numeric, timestamptz, timestamptz, text) to authenticated;
