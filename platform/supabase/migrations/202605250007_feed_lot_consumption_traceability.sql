-- Link mill feed production with actual consumption in broilers and laying hens.
-- A mill batch becomes a valued, auditable stock balance of feed.

alter table public.mill_batches
  add column if not exists available_kg numeric(12, 3);

update public.mill_batches
set available_kg = produced_kg
where available_kg is null;

alter table public.mill_batches
  alter column available_kg set not null,
  alter column available_kg set default 0;

alter table public.mill_batches
  drop constraint if exists mill_batches_available_kg_check;

alter table public.mill_batches
  add constraint mill_batches_available_kg_check
    check (available_kg >= 0 and available_kg <= produced_kg);

alter table public.bird_batch_events
  add column if not exists mill_batch_id uuid references public.mill_batches(id);

alter table public.layer_flock_events
  add column if not exists mill_batch_id uuid references public.mill_batches(id);

create index if not exists bird_batch_events_mill_batch_id_idx
  on public.bird_batch_events (mill_batch_id);
create index if not exists layer_flock_events_mill_batch_id_idx
  on public.layer_flock_events (mill_batch_id);

create or replace function public.create_mill_batch(
  p_version_id uuid,
  p_location_id uuid,
  p_usage text,
  p_produced_kg numeric,
  p_produced_at timestamptz,
  p_notes text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_version public.feed_formula_versions; v_cost numeric; v_batch public.mill_batches;
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
  select sum(item.quantity_kg * price.cost_per_kg) into v_cost
  from public.feed_formula_items item
  join lateral (
    select cost_per_kg from public.feed_input_prices
    where input_id = item.input_id order by effective_at desc, created_at desc limit 1
  ) price on true
  where item.version_id = p_version_id;
  if v_cost is null then raise exception 'No es posible costear la formula.'; end if;
  insert into public.mill_batches (
    code, version_id, location_id, usage, produced_kg, available_kg, total_cost, cost_per_kg,
    produced_at, notes, actor_id
  ) values (
    'BG51-MOL-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.mill_batch_number_seq')::text, 5, '0'),
    p_version_id, p_location_id, p_usage, p_produced_kg, p_produced_kg,
    round((v_cost / v_version.target_kg) * p_produced_kg, 2),
    round(v_cost / v_version.target_kg, 4), p_produced_at,
    trim(coalesce(p_notes, '')), auth.uid()
  ) returning * into v_batch;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (auth.uid(), 'mill_batch.created', 'mill_batches', v_batch.id,
    jsonb_build_object('code', v_batch.code, 'produced_kg', p_produced_kg, 'cost_per_kg', v_batch.cost_per_kg));
  return v_batch.id;
end; $$;

create or replace function public.record_bird_batch_event(
  p_batch_id uuid,
  p_event_type text,
  p_event_at timestamptz,
  p_count integer,
  p_avg_weight_grams numeric,
  p_feed_kg numeric,
  p_feed_unit_cost numeric,
  p_amount numeric,
  p_expense_category text,
  p_stage text,
  p_notes text,
  p_mill_batch_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.bird_batches;
  v_mill_batch public.mill_batches;
  v_event_id uuid;
  v_amount numeric;
  v_feed_unit_cost numeric;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if p_event_type is null
     or p_event_type not in ('mortality', 'weight_sample', 'feed_consumption', 'expense', 'stage_change') then
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
      raise exception 'Registra un peso promedio valido.';
    end if;
  elsif p_event_type = 'feed_consumption' then
    if p_feed_kg is null or p_feed_kg <= 0 then
      raise exception 'Registra alimento consumido valido.';
    end if;
    v_feed_unit_cost := p_feed_unit_cost;
    if p_mill_batch_id is not null then
      select * into v_mill_batch from public.mill_batches where id = p_mill_batch_id for update;
      if v_mill_batch.id is null or v_mill_batch.usage <> 'internal_broiler' then
        raise exception 'Selecciona un lote de alimento destinado a pollos.';
      end if;
      if v_mill_batch.available_kg < p_feed_kg then
        raise exception 'El lote de alimento no tiene saldo suficiente.';
      end if;
      v_feed_unit_cost := v_mill_batch.cost_per_kg;
      update public.mill_batches set available_kg = available_kg - p_feed_kg where id = p_mill_batch_id;
    elsif p_feed_unit_cost is not null and p_feed_unit_cost < 0 then
      raise exception 'El costo del alimento no puede ser negativo.';
    end if;
    v_amount := case
      when v_feed_unit_cost is null then null
      else round(p_feed_kg * v_feed_unit_cost, 2)
    end;
  elsif p_event_type = 'expense' then
    if p_amount is null or p_amount <= 0 then
      raise exception 'Registra un monto de costo valido.';
    end if;
    if p_expense_category is null
       or p_expense_category not in ('health', 'bedding', 'energy', 'labor', 'transport', 'other') then
      raise exception 'Selecciona una categoria de costo.';
    end if;
    v_amount := round(p_amount, 2);
  elsif p_event_type = 'stage_change' then
    if p_stage not in ('received', 'brooding', 'growing', 'finishing', 'ready_processing') then
      raise exception 'La etapa seleccionada no es valida.';
    end if;
    update public.bird_batches set stage = p_stage where id = p_batch_id;
  end if;

  insert into public.bird_batch_events (
    batch_id, event_type, event_at, count, avg_weight_grams, feed_kg, feed_unit_cost,
    amount, expense_category, mill_batch_id, stage, notes, actor_id
  ) values (
    p_batch_id,
    p_event_type,
    p_event_at,
    case when p_event_type = 'mortality' then p_count else null end,
    case when p_event_type = 'weight_sample' then p_avg_weight_grams else null end,
    case when p_event_type = 'feed_consumption' then p_feed_kg else null end,
    case when p_event_type = 'feed_consumption' then v_feed_unit_cost else null end,
    v_amount,
    case when p_event_type = 'expense' then p_expense_category else null end,
    case when p_event_type = 'feed_consumption' then p_mill_batch_id else null end,
    case when p_event_type = 'stage_change' then p_stage else null end,
    trim(coalesce(p_notes, '')),
    auth.uid()
  ) returning id into v_event_id;

  if p_event_type = 'feed_consumption' and p_mill_batch_id is not null then
    insert into public.audit_events (actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'mill_batch.consumed_broiler', 'mill_batches', p_mill_batch_id,
      jsonb_build_object('bird_batch_id', p_batch_id, 'event_id', v_event_id, 'feed_kg', p_feed_kg));
  end if;
  return v_event_id;
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
  p_notes text,
  p_mill_batch_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flock public.layer_flocks;
  v_mill_batch public.mill_batches;
  v_event_id uuid;
  v_amount numeric;
  v_feed_unit_cost numeric;
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
    if p_feed_kg is null or p_feed_kg <= 0 then
      raise exception 'Registra cantidad de alimento.';
    end if;
    v_feed_unit_cost := p_feed_unit_cost;
    if p_mill_batch_id is not null then
      select * into v_mill_batch from public.mill_batches where id = p_mill_batch_id for update;
      if v_mill_batch.id is null or v_mill_batch.usage <> 'internal_layers' then
        raise exception 'Selecciona un lote de alimento destinado a ponedoras.';
      end if;
      if v_mill_batch.available_kg < p_feed_kg then
        raise exception 'El lote de alimento no tiene saldo suficiente.';
      end if;
      v_feed_unit_cost := v_mill_batch.cost_per_kg;
      update public.mill_batches set available_kg = available_kg - p_feed_kg where id = p_mill_batch_id;
    elsif p_feed_unit_cost is null or p_feed_unit_cost < 0 then
      raise exception 'Registra cantidad y costo del alimento.';
    end if;
    v_amount := round(p_feed_kg * v_feed_unit_cost, 2);
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
    amount, expense_category, mill_batch_id, notes, actor_id
  ) values (
    p_flock_id,
    p_event_type,
    p_event_at,
    case when p_event_type = 'mortality' then p_count else null end,
    case when p_event_type = 'feed_consumption' then p_feed_kg else null end,
    case when p_event_type = 'feed_consumption' then v_feed_unit_cost else null end,
    v_amount,
    case when p_event_type = 'expense' then p_expense_category else null end,
    case when p_event_type = 'feed_consumption' then p_mill_batch_id else null end,
    trim(coalesce(p_notes, '')),
    auth.uid()
  ) returning id into v_event_id;

  if p_event_type = 'feed_consumption' and p_mill_batch_id is not null then
    insert into public.audit_events (actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'mill_batch.consumed_layers', 'mill_batches', p_mill_batch_id,
      jsonb_build_object('layer_flock_id', p_flock_id, 'event_id', v_event_id, 'feed_kg', p_feed_kg));
  end if;
  return v_event_id;
end;
$$;

revoke all on function public.record_bird_batch_event(
  uuid, text, timestamptz, integer, numeric, numeric, numeric, numeric, text, text, text, uuid
) from public;
revoke all on function public.record_layer_flock_event(
  uuid, text, timestamptz, integer, numeric, numeric, numeric, text, text, uuid
) from public;

grant execute on function public.record_bird_batch_event(
  uuid, text, timestamptz, integer, numeric, numeric, numeric, numeric, text, text, text, uuid
) to authenticated;
grant execute on function public.record_layer_flock_event(
  uuid, text, timestamptz, integer, numeric, numeric, numeric, text, text, uuid
) to authenticated;
