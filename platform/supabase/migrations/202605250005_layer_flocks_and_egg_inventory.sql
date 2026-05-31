-- Track laying hens, daily egg collection, costs, and packaged maples.

create sequence if not exists public.layer_flock_number_seq start 1;

create table if not exists public.layer_flocks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  location_id uuid not null references public.locations(id),
  source_name text not null,
  breed text,
  started_at timestamptz not null,
  initial_hens integer not null check (initial_hens > 0),
  current_hens integer not null check (current_hens >= 0),
  available_eggs integer not null default 0 check (available_eggs >= 0),
  packed_maples integer not null default 0 check (packed_maples >= 0),
  cost_per_hen numeric(12, 2) check (cost_per_hen is null or cost_per_hen >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.layer_flock_events (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.layer_flocks(id) on delete cascade,
  event_type text not null check (event_type in ('mortality', 'feed_consumption', 'expense')),
  event_at timestamptz not null,
  count integer check (count is null or count > 0),
  feed_kg numeric(12, 3) check (feed_kg is null or feed_kg > 0),
  feed_unit_cost numeric(12, 4) check (feed_unit_cost is null or feed_unit_cost >= 0),
  amount numeric(14, 2) check (amount is null or amount >= 0),
  expense_category text check (
    expense_category is null
    or expense_category in ('health', 'bedding', 'energy', 'labor', 'transport', 'other')
  ),
  notes text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.egg_collections (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.layer_flocks(id) on delete cascade,
  collected_at timestamptz not null,
  collected_eggs integer not null check (collected_eggs > 0),
  rejected_eggs integer not null default 0 check (rejected_eggs >= 0 and rejected_eggs <= collected_eggs),
  notes text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.inventory_lots
  add column if not exists source_layer_flock_id uuid references public.layer_flocks(id);

alter table public.layer_flocks enable row level security;
alter table public.layer_flock_events enable row level security;
alter table public.egg_collections enable row level security;

drop policy if exists "staff manage layer flocks" on public.layer_flocks;
drop policy if exists "staff manage layer events" on public.layer_flock_events;
drop policy if exists "staff manage egg collections" on public.egg_collections;

create policy "staff manage layer flocks"
on public.layer_flocks for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage layer events"
on public.layer_flock_events for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage egg collections"
on public.egg_collections for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop trigger if exists layer_flocks_touch_updated_at on public.layer_flocks;
create trigger layer_flocks_touch_updated_at
before update on public.layer_flocks
for each row execute function public.touch_updated_at();

create or replace function public.create_layer_flock(
  p_location_id uuid,
  p_source_name text,
  p_breed text,
  p_started_at timestamptz,
  p_initial_hens integer,
  p_cost_per_hen numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flock public.layer_flocks;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if not exists (
    select 1 from public.locations where id = p_location_id and active and type = 'farm'
  ) then
    raise exception 'Selecciona una unidad productiva avicola activa.';
  end if;
  if length(trim(coalesce(p_source_name, ''))) < 2
     or p_initial_hens is null or p_initial_hens <= 0 then
    raise exception 'Registra origen y cantidad de ponedoras.';
  end if;
  if p_cost_per_hen is not null and p_cost_per_hen < 0 then
    raise exception 'El costo de la ponedora no puede ser negativo.';
  end if;

  insert into public.layer_flocks (
    code, location_id, source_name, breed, started_at, initial_hens,
    current_hens, cost_per_hen, notes
  )
  values (
    'BG51-PON-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.layer_flock_number_seq')::text, 5, '0'),
    p_location_id,
    trim(p_source_name),
    nullif(trim(coalesce(p_breed, '')), ''),
    p_started_at,
    p_initial_hens,
    p_initial_hens,
    p_cost_per_hen,
    trim(coalesce(p_notes, ''))
  )
  returning * into v_flock;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'layer_flock.created',
    'layer_flocks',
    v_flock.id,
    jsonb_build_object('code', v_flock.code, 'initial_hens', p_initial_hens)
  );

  return v_flock.id;
end;
$$;

create or replace function public.record_layer_flock_event(
  p_flock_id uuid,
  p_event_type text,
  p_event_at timestamptz,
  p_count integer,
  p_feed_kg numeric,
  p_feed_unit_cost numeric,
  p_amount numeric,
  p_expense_category text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flock public.layer_flocks;
  v_event_id uuid;
  v_amount numeric;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if p_event_type is null or p_event_type not in ('mortality', 'feed_consumption', 'expense') then
    raise exception 'Evento de ponedoras no permitido.';
  end if;

  select * into v_flock from public.layer_flocks where id = p_flock_id for update;
  if v_flock.id is null then
    raise exception 'Lote de ponedoras no encontrado.';
  end if;
  if v_flock.status = 'closed' then
    raise exception 'El lote de ponedoras esta cerrado.';
  end if;

  if p_event_type = 'mortality' then
    if p_count is null or p_count <= 0 or p_count > v_flock.current_hens then
      raise exception 'La mortalidad supera las ponedoras disponibles.';
    end if;
    update public.layer_flocks
    set current_hens = current_hens - p_count,
        status = case when current_hens - p_count = 0 then 'closed' else status end
    where id = p_flock_id;
  elsif p_event_type = 'feed_consumption' then
    if p_feed_kg is null or p_feed_kg <= 0
       or p_feed_unit_cost is null or p_feed_unit_cost < 0 then
      raise exception 'Registra cantidad y costo del alimento.';
    end if;
    v_amount := round(p_feed_kg * p_feed_unit_cost, 2);
  elsif p_event_type = 'expense' then
    if p_amount is null or p_amount <= 0 then
      raise exception 'Registra un monto de costo valido.';
    end if;
    if p_expense_category is null
       or p_expense_category not in ('health', 'bedding', 'energy', 'labor', 'transport', 'other') then
      raise exception 'Selecciona una categoria de costo.';
    end if;
    v_amount := round(p_amount, 2);
  end if;

  insert into public.layer_flock_events (
    flock_id, event_type, event_at, count, feed_kg, feed_unit_cost,
    amount, expense_category, notes, actor_id
  )
  values (
    p_flock_id,
    p_event_type,
    p_event_at,
    case when p_event_type = 'mortality' then p_count else null end,
    case when p_event_type = 'feed_consumption' then p_feed_kg else null end,
    case when p_event_type = 'feed_consumption' then p_feed_unit_cost else null end,
    v_amount,
    case when p_event_type = 'expense' then p_expense_category else null end,
    trim(coalesce(p_notes, '')),
    auth.uid()
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.collect_layer_eggs(
  p_flock_id uuid,
  p_collected_at timestamptz,
  p_collected_eggs integer,
  p_rejected_eggs integer,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flock public.layer_flocks;
  v_collection_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  select * into v_flock from public.layer_flocks where id = p_flock_id for update;
  if v_flock.id is null or v_flock.status <> 'active' then
    raise exception 'Selecciona un lote activo de ponedoras.';
  end if;
  if p_collected_at < v_flock.started_at then
    raise exception 'La recoleccion no puede ser anterior al inicio del lote.';
  end if;
  if p_collected_eggs is null or p_collected_eggs <= 0
     or p_rejected_eggs is null or p_rejected_eggs < 0
     or p_rejected_eggs > p_collected_eggs then
    raise exception 'Registra cantidad recolectada y descarte validos.';
  end if;

  insert into public.egg_collections (
    flock_id, collected_at, collected_eggs, rejected_eggs, notes, actor_id
  )
  values (
    p_flock_id, p_collected_at, p_collected_eggs, p_rejected_eggs,
    trim(coalesce(p_notes, '')), auth.uid()
  )
  returning id into v_collection_id;

  update public.layer_flocks
  set available_eggs = available_eggs + p_collected_eggs - p_rejected_eggs
  where id = p_flock_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'egg_collection.created',
    'egg_collections',
    v_collection_id,
    jsonb_build_object(
      'flock_id', p_flock_id,
      'collected_eggs', p_collected_eggs,
      'rejected_eggs', p_rejected_eggs
    )
  );

  return v_collection_id;
end;
$$;

create or replace function public.pack_egg_maples_to_inventory(
  p_flock_id uuid,
  p_product_id uuid,
  p_location_id uuid,
  p_maple_count integer,
  p_unit_cost numeric,
  p_packed_at timestamptz,
  p_expires_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flock public.layer_flocks;
  v_product public.products;
  v_lot public.inventory_lots;
  v_required_eggs integer;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  select * into v_flock from public.layer_flocks where id = p_flock_id for update;
  if v_flock.id is null then
    raise exception 'Lote de ponedoras no encontrado.';
  end if;
  v_required_eggs := p_maple_count * 30;
  if p_maple_count is null or p_maple_count <= 0 or v_required_eggs > v_flock.available_eggs then
    raise exception 'No hay huevos aptos suficientes para esos maples.';
  end if;
  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null or v_product.origin_type <> 'own' or v_product.price_unit <> 'maple' then
    raise exception 'Selecciona un producto propio comercializado por maple.';
  end if;
  if not exists (
    select 1 from public.locations where id = p_location_id and active and type in ('store', 'warehouse', 'mill')
  ) then
    raise exception 'Selecciona una sede comercial o almacen.';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'El costo por maple no puede ser negativo.';
  end if;
  if p_packed_at < v_flock.started_at
     or (p_expires_at is not null and p_expires_at < p_packed_at) then
    raise exception 'Las fechas de empaque o vencimiento no son validas.';
  end if;

  insert into public.inventory_lots (
    code, product_id, origin_type, supplier_name, location_id, received_quantity,
    quantity, unit, unit_cost, produced_or_received_at, expires_at, status, notes,
    source_layer_flock_id
  )
  values (
    'BG51-LT-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.inventory_lot_number_seq')::text, 5, '0'),
    p_product_id, 'own', null, p_location_id, p_maple_count, p_maple_count,
    'maple', p_unit_cost, p_packed_at, p_expires_at, 'available',
    trim(coalesce(p_notes, '')), p_flock_id
  )
  returning * into v_lot;

  insert into public.inventory_movements (
    lot_id, movement_type, quantity_delta, unit, reason, actor_id
  )
  values (
    v_lot.id, 'receipt', p_maple_count, 'maple',
    'Empaque desde ponedoras ' || v_flock.code, auth.uid()
  );

  update public.layer_flocks
  set available_eggs = available_eggs - v_required_eggs,
      packed_maples = packed_maples + p_maple_count
  where id = p_flock_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'layer_flock.inventory_handoff', 'inventory_lots', v_lot.id,
    jsonb_build_object('flock_id', p_flock_id, 'maples', p_maple_count, 'eggs', v_required_eggs)
  );

  return v_lot.id;
end;
$$;

revoke all on function public.create_layer_flock(uuid, text, text, timestamptz, integer, numeric, text) from public;
revoke all on function public.record_layer_flock_event(uuid, text, timestamptz, integer, numeric, numeric, numeric, text, text) from public;
revoke all on function public.collect_layer_eggs(uuid, timestamptz, integer, integer, text) from public;
revoke all on function public.pack_egg_maples_to_inventory(uuid, uuid, uuid, integer, numeric, timestamptz, timestamptz, text) from public;

grant execute on function public.create_layer_flock(uuid, text, text, timestamptz, integer, numeric, text) to authenticated;
grant execute on function public.record_layer_flock_event(uuid, text, timestamptz, integer, numeric, numeric, numeric, text, text) to authenticated;
grant execute on function public.collect_layer_eggs(uuid, timestamptz, integer, integer, text) to authenticated;
grant execute on function public.pack_egg_maples_to_inventory(uuid, uuid, uuid, integer, numeric, timestamptz, timestamptz, text) to authenticated;
