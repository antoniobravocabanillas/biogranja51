-- Add technical and economic follow-up to live poultry batches.
-- This migration keeps the original RPC available for the already deployed client.

alter table public.bird_batch_events
  drop constraint if exists bird_batch_events_event_type_check;

alter table public.bird_batch_events
  add constraint bird_batch_events_event_type_check
    check (event_type in ('mortality', 'weight_sample', 'feed_consumption', 'expense', 'stage_change', 'processing')),
  add column if not exists feed_unit_cost numeric(12, 4)
    check (feed_unit_cost is null or feed_unit_cost >= 0),
  add column if not exists amount numeric(14, 2)
    check (amount is null or amount >= 0),
  add column if not exists expense_category text
    check (
      expense_category is null
      or expense_category in ('health', 'bedding', 'energy', 'labor', 'transport', 'other')
    );

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
  v_amount numeric;
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
    if p_feed_unit_cost is not null and p_feed_unit_cost < 0 then
      raise exception 'El costo del alimento no puede ser negativo.';
    end if;
    v_amount := case
      when p_feed_unit_cost is null then null
      else round(p_feed_kg * p_feed_unit_cost, 2)
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
    batch_id,
    event_type,
    event_at,
    count,
    avg_weight_grams,
    feed_kg,
    feed_unit_cost,
    amount,
    expense_category,
    stage,
    notes,
    actor_id
  )
  values (
    p_batch_id,
    p_event_type,
    p_event_at,
    case when p_event_type = 'mortality' then p_count else null end,
    case when p_event_type = 'weight_sample' then p_avg_weight_grams else null end,
    case when p_event_type = 'feed_consumption' then p_feed_kg else null end,
    case when p_event_type = 'feed_consumption' then p_feed_unit_cost else null end,
    v_amount,
    case when p_event_type = 'expense' then p_expense_category else null end,
    case when p_event_type = 'stage_change' then p_stage else null end,
    trim(coalesce(p_notes, '')),
    auth.uid()
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_bird_batch_event(
  uuid, text, timestamptz, integer, numeric, numeric, numeric, numeric, text, text, text
) from public;

grant execute on function public.record_bird_batch_event(
  uuid, text, timestamptz, integer, numeric, numeric, numeric, numeric, text, text, text
) to authenticated;

create or replace function public.value_bird_feed_event(
  p_batch_id uuid,
  p_event_id uuid,
  p_feed_unit_cost numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.bird_batch_events;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if p_feed_unit_cost is null or p_feed_unit_cost < 0 then
    raise exception 'Registra un costo por kg valido.';
  end if;

  select * into v_event
  from public.bird_batch_events
  where id = p_event_id
    and batch_id = p_batch_id
    and event_type = 'feed_consumption'
  for update;

  if v_event.id is null then
    raise exception 'Consumo de alimento no encontrado.';
  end if;

  update public.bird_batch_events
  set feed_unit_cost = p_feed_unit_cost,
      amount = round(feed_kg * p_feed_unit_cost, 2)
  where id = p_event_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'bird_batch.feed_valued',
    'bird_batch_events',
    p_event_id,
    jsonb_build_object('batch_id', p_batch_id, 'feed_unit_cost', p_feed_unit_cost)
  );

  return p_event_id;
end;
$$;

revoke all on function public.value_bird_feed_event(uuid, uuid, numeric) from public;
grant execute on function public.value_bird_feed_event(uuid, uuid, numeric) to authenticated;
