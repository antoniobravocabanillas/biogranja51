-- Auditable feed supply chain: suppliers, received ingredient lots, quality
-- release, FIFO consumption into milling, and staff audit visibility.

create sequence if not exists public.feed_input_lot_number_seq start 1;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tax_id text,
  category text not null default 'feed_input',
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_input_lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  input_id uuid not null references public.feed_inputs(id),
  supplier_id uuid not null references public.suppliers(id),
  location_id uuid not null references public.locations(id),
  received_kg numeric(12, 4) not null check (received_kg > 0),
  available_kg numeric(12, 4) not null check (available_kg >= 0),
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  received_at timestamptz not null,
  document_reference text not null,
  quality_status text not null default 'pending'
    check (quality_status in ('pending', 'approved', 'rejected')),
  quality_notes text not null default '',
  notes text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feed_input_lots_available_check check (available_kg <= received_kg)
);

create table if not exists public.feed_input_lot_movements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.feed_input_lots(id) on delete cascade,
  movement_type text not null check (movement_type in ('receipt', 'consumption', 'adjustment', 'waste')),
  quantity_delta numeric(12, 4) not null check (quantity_delta <> 0),
  mill_batch_id uuid references public.mill_batches(id),
  reason text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.mill_batch_input_consumptions (
  id uuid primary key default gen_random_uuid(),
  mill_batch_id uuid not null references public.mill_batches(id) on delete cascade,
  input_lot_id uuid not null references public.feed_input_lots(id),
  input_id uuid not null references public.feed_inputs(id),
  quantity_kg numeric(12, 4) not null check (quantity_kg > 0),
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  amount numeric(14, 4) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists feed_input_lots_input_available_idx
  on public.feed_input_lots (input_id, quality_status, received_at)
  where available_kg > 0;
create index if not exists feed_input_lot_movements_lot_idx
  on public.feed_input_lot_movements (lot_id, created_at);
create index if not exists mill_batch_input_consumptions_batch_idx
  on public.mill_batch_input_consumptions (mill_batch_id);

alter table public.suppliers enable row level security;
alter table public.feed_input_lots enable row level security;
alter table public.feed_input_lot_movements enable row level security;
alter table public.mill_batch_input_consumptions enable row level security;

drop policy if exists "staff manage suppliers" on public.suppliers;
drop policy if exists "staff manage feed input lots" on public.feed_input_lots;
drop policy if exists "staff manage feed input lot movements" on public.feed_input_lot_movements;
drop policy if exists "staff read mill batch input consumptions" on public.mill_batch_input_consumptions;
drop policy if exists "staff read audit events" on public.audit_events;

create policy "staff manage suppliers" on public.suppliers for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage feed input lots" on public.feed_input_lots for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage feed input lot movements" on public.feed_input_lot_movements for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read mill batch input consumptions" on public.mill_batch_input_consumptions for select to authenticated
using ((select public.is_staff()));
create policy "staff read audit events" on public.audit_events for select to authenticated
using ((select public.is_staff()));

drop trigger if exists suppliers_touch_updated_at on public.suppliers;
create trigger suppliers_touch_updated_at before update on public.suppliers
for each row execute function public.touch_updated_at();
drop trigger if exists feed_input_lots_touch_updated_at on public.feed_input_lots;
create trigger feed_input_lots_touch_updated_at before update on public.feed_input_lots
for each row execute function public.touch_updated_at();

create or replace function public.receive_feed_input_lot(
  p_input_id uuid,
  p_location_id uuid,
  p_supplier_name text,
  p_supplier_tax_id text,
  p_quantity_kg numeric,
  p_unit_cost numeric,
  p_received_at timestamptz,
  p_document_reference text,
  p_quality_status text,
  p_quality_notes text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier public.suppliers;
  v_lot public.feed_input_lots;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if not exists (select 1 from public.feed_inputs where id = p_input_id and active) then
    raise exception 'Insumo no disponible.';
  end if;
  if not exists (select 1 from public.locations where id = p_location_id and active and type = 'mill') then
    raise exception 'Selecciona una sede de molino activa.';
  end if;
  if length(trim(coalesce(p_supplier_name, ''))) < 2
     or length(trim(coalesce(p_document_reference, ''))) < 2
     or p_quantity_kg is null or p_quantity_kg <= 0
     or p_unit_cost is null or p_unit_cost < 0
     or p_received_at is null then
    raise exception 'Registra proveedor, documento, cantidad, costo y fecha validos.';
  end if;
  if p_quality_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Selecciona un estado de calidad valido.';
  end if;
  if p_quality_status <> 'pending' and length(trim(coalesce(p_quality_notes, ''))) < 3 then
    raise exception 'Documenta la revision de calidad para liberar o rechazar.';
  end if;

  select * into v_supplier from public.suppliers
  where lower(name) = lower(trim(p_supplier_name))
  limit 1;
  if v_supplier.id is null then
    insert into public.suppliers (name, tax_id, category)
    values (trim(p_supplier_name), nullif(trim(coalesce(p_supplier_tax_id, '')), ''), 'feed_input')
    returning * into v_supplier;
  elsif p_supplier_tax_id is not null and trim(p_supplier_tax_id) <> '' and v_supplier.tax_id is null then
    update public.suppliers set tax_id = trim(p_supplier_tax_id) where id = v_supplier.id
    returning * into v_supplier;
  end if;

  insert into public.feed_input_lots (
    code, input_id, supplier_id, location_id, received_kg, available_kg,
    unit_cost, received_at, document_reference, quality_status, quality_notes,
    notes, actor_id
  ) values (
    'BG51-INS-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.feed_input_lot_number_seq')::text, 5, '0'),
    p_input_id, v_supplier.id, p_location_id, p_quantity_kg, p_quantity_kg,
    p_unit_cost, p_received_at, trim(p_document_reference), p_quality_status,
    trim(coalesce(p_quality_notes, '')), trim(coalesce(p_notes, '')), auth.uid()
  ) returning * into v_lot;

  insert into public.feed_input_lot_movements (
    lot_id, movement_type, quantity_delta, reason, actor_id
  ) values (
    v_lot.id, 'receipt', p_quantity_kg, 'Recepcion de materia prima', auth.uid()
  );

  insert into public.feed_input_prices (input_id, cost_per_kg, effective_at, supplier_name, actor_id)
  values (p_input_id, p_unit_cost, p_received_at, v_supplier.name, auth.uid());

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'feed_input_lot.received', 'feed_input_lots', v_lot.id,
    jsonb_build_object(
      'code', v_lot.code, 'supplier', v_supplier.name, 'quantity_kg', p_quantity_kg,
      'document_reference', trim(p_document_reference), 'quality_status', p_quality_status
    )
  );
  return v_lot.id;
end;
$$;

create or replace function public.review_feed_input_lot(
  p_lot_id uuid,
  p_quality_status text,
  p_quality_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.feed_input_lots;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if p_quality_status not in ('approved', 'rejected')
     or length(trim(coalesce(p_quality_notes, ''))) < 3 then
    raise exception 'Registra resultado y evidencia de la revision de calidad.';
  end if;
  select * into v_lot from public.feed_input_lots where id = p_lot_id for update;
  if v_lot.id is null then raise exception 'Lote de insumo no encontrado.'; end if;
  if v_lot.available_kg < v_lot.received_kg and p_quality_status = 'rejected' then
    raise exception 'No se puede rechazar un lote que ya fue consumido.';
  end if;
  update public.feed_input_lots
  set quality_status = p_quality_status, quality_notes = trim(p_quality_notes)
  where id = p_lot_id;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'feed_input_lot.quality_reviewed', 'feed_input_lots', p_lot_id,
    jsonb_build_object('quality_status', p_quality_status, 'quality_notes', trim(p_quality_notes))
  );
  return p_lot_id;
end;
$$;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido no encontrado.'; end if;
  if not (
    (v_order.status = 'pending_confirmation' and p_status in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and p_status in ('preparing', 'cancelled'))
    or (v_order.status = 'preparing' and p_status in ('dispatched', 'cancelled'))
    or (v_order.status = 'dispatched' and p_status = 'delivered')
  ) then
    raise exception 'La transicion de estado no esta permitida.';
  end if;
  update public.orders set status = p_status::public.order_status where id = p_order_id;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order.status_transition', 'orders', p_order_id,
    jsonb_build_object('number', v_order.number, 'previous_status', v_order.status, 'next_status', p_status)
  );
  return p_order_id;
end;
$$;

create or replace function public.create_mill_batch(
  p_version_id uuid,
  p_location_id uuid,
  p_usage text,
  p_produced_kg numeric,
  p_produced_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.feed_formula_versions;
  v_batch public.mill_batches;
  v_item record;
  v_lot record;
  v_required numeric(12, 4);
  v_available numeric(12, 4);
  v_remaining numeric(12, 4);
  v_taken numeric(12, 4);
  v_total_cost numeric(14, 4) := 0;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_version from public.feed_formula_versions where id = p_version_id and status = 'approved';
  if v_version.id is null then raise exception 'Selecciona una formula aprobada.'; end if;
  if not exists (select 1 from public.locations where id = p_location_id and active and type = 'mill') then
    raise exception 'Selecciona la sede de molino.';
  end if;
  if p_usage not in ('internal_broiler', 'internal_layers', 'external_service')
     or p_produced_kg is null or p_produced_kg <= 0 then
    raise exception 'Registra destino y cantidad producida.';
  end if;

  for v_item in
    select item.input_id, item.quantity_kg, input.name
    from public.feed_formula_items item
    join public.feed_inputs input on input.id = item.input_id
    where item.version_id = p_version_id and item.quantity_kg > 0
  loop
    v_required := round((v_item.quantity_kg * p_produced_kg) / v_version.target_kg, 4);
    select coalesce(sum(available_kg), 0) into v_available
    from public.feed_input_lots
    where input_id = v_item.input_id and quality_status = 'approved' and available_kg > 0;
    if v_available < v_required then
      raise exception 'Stock aprobado insuficiente para %: requiere % kg y dispone % kg.',
        v_item.name, v_required, v_available;
    end if;
  end loop;

  insert into public.mill_batches (
    code, version_id, location_id, usage, produced_kg, available_kg,
    total_cost, cost_per_kg, produced_at, notes, actor_id
  ) values (
    'BG51-MOL-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.mill_batch_number_seq')::text, 5, '0'),
    p_version_id, p_location_id, p_usage, p_produced_kg, p_produced_kg,
    0, 0, p_produced_at, trim(coalesce(p_notes, '')), auth.uid()
  ) returning * into v_batch;

  for v_item in
    select item.input_id, item.quantity_kg
    from public.feed_formula_items item
    where item.version_id = p_version_id and item.quantity_kg > 0
  loop
    v_remaining := round((v_item.quantity_kg * p_produced_kg) / v_version.target_kg, 4);
    for v_lot in
      select id, available_kg, unit_cost
      from public.feed_input_lots
      where input_id = v_item.input_id and quality_status = 'approved' and available_kg > 0
      order by received_at, created_at
      for update
    loop
      exit when v_remaining <= 0;
      v_taken := least(v_remaining, v_lot.available_kg);
      update public.feed_input_lots
      set available_kg = available_kg - v_taken
      where id = v_lot.id;
      insert into public.feed_input_lot_movements (
        lot_id, movement_type, quantity_delta, mill_batch_id, reason, actor_id
      ) values (
        v_lot.id, 'consumption', -v_taken, v_batch.id, 'Consumo en produccion de alimento', auth.uid()
      );
      insert into public.mill_batch_input_consumptions (
        mill_batch_id, input_lot_id, input_id, quantity_kg, unit_cost, amount
      ) values (
        v_batch.id, v_lot.id, v_item.input_id, v_taken, v_lot.unit_cost,
        round(v_taken * v_lot.unit_cost, 4)
      );
      v_total_cost := v_total_cost + round(v_taken * v_lot.unit_cost, 4);
      v_remaining := v_remaining - v_taken;
    end loop;
  end loop;

  update public.mill_batches
  set total_cost = round(v_total_cost, 2),
      cost_per_kg = round(v_total_cost / p_produced_kg, 4)
  where id = v_batch.id
  returning * into v_batch;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'mill_batch.created', 'mill_batches', v_batch.id,
    jsonb_build_object(
      'code', v_batch.code, 'produced_kg', p_produced_kg,
      'cost_per_kg', v_batch.cost_per_kg, 'input_stock_consumed', true
    )
  );
  return v_batch.id;
end;
$$;

revoke all on function public.receive_feed_input_lot(
  uuid, uuid, text, text, numeric, numeric, timestamptz, text, text, text, text
) from public;
revoke all on function public.review_feed_input_lot(uuid, text, text) from public;
revoke all on function public.transition_order_status(uuid, text) from public;
revoke all on function public.create_mill_batch(uuid, uuid, text, numeric, timestamptz, text) from public;

grant execute on function public.receive_feed_input_lot(
  uuid, uuid, text, text, numeric, numeric, timestamptz, text, text, text, text
) to authenticated;
grant execute on function public.review_feed_input_lot(uuid, text, text) to authenticated;
grant execute on function public.transition_order_status(uuid, text) to authenticated;
grant execute on function public.create_mill_batch(uuid, uuid, text, numeric, timestamptz, text) to authenticated;
