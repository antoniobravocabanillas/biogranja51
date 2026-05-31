-- Last-mile scheduling, cold-chain controls and auditable delivery closure.

create table if not exists public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  status text not null default 'planned'
    check (status in ('planned', 'dispatched', 'delivered')),
  window_start timestamptz not null,
  window_end timestamptz not null,
  driver_name text not null,
  vehicle_reference text not null default '',
  planning_notes text not null default '',
  dispatched_at timestamptz,
  dispatch_temperature_c numeric(5, 2),
  packaging_condition text not null default '',
  delivered_at timestamptz,
  delivery_temperature_c numeric(5, 2),
  received_by text not null default '',
  delivery_notes text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_deliveries_window_check check (window_end > window_start),
  constraint order_deliveries_dispatch_temperature_check check (
    dispatch_temperature_c is null or dispatch_temperature_c between -5 and 12
  ),
  constraint order_deliveries_delivery_temperature_check check (
    delivery_temperature_c is null or delivery_temperature_c between -5 and 12
  )
);

create index if not exists order_deliveries_status_window_idx
  on public.order_deliveries (status, window_start);

alter table public.order_deliveries enable row level security;

drop policy if exists "staff manage order deliveries" on public.order_deliveries;
create policy "staff manage order deliveries"
on public.order_deliveries for all to authenticated
using (public.is_staff())
with check (public.is_staff());

drop trigger if exists order_deliveries_touch_updated_at on public.order_deliveries;
create trigger order_deliveries_touch_updated_at
before update on public.order_deliveries
for each row execute function public.touch_updated_at();

create or replace function public.schedule_order_delivery(
  p_order_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_driver_name text,
  p_vehicle_reference text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_delivery public.order_deliveries;
  v_delivery_id uuid;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status not in ('confirmed', 'preparing') then
    raise exception 'Solo pedidos confirmados o en preparacion pueden programarse.';
  end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start
     or p_window_end <= now() then
    raise exception 'Registra una ventana de entrega futura valida.';
  end if;
  if length(trim(coalesce(p_driver_name, ''))) < 3 then
    raise exception 'Registra el responsable de la entrega.';
  end if;

  select * into v_delivery from public.order_deliveries where order_id = p_order_id for update;
  if v_delivery.id is not null and v_delivery.status <> 'planned' then
    raise exception 'La ruta ya salio y no puede reprogramarse.';
  end if;

  insert into public.order_deliveries (
    order_id, window_start, window_end, driver_name, vehicle_reference,
    planning_notes, actor_id
  )
  values (
    p_order_id, p_window_start, p_window_end, trim(p_driver_name),
    trim(coalesce(p_vehicle_reference, '')), trim(coalesce(p_notes, '')), auth.uid()
  )
  on conflict (order_id) do update set
    window_start = excluded.window_start,
    window_end = excluded.window_end,
    driver_name = excluded.driver_name,
    vehicle_reference = excluded.vehicle_reference,
    planning_notes = excluded.planning_notes,
    actor_id = excluded.actor_id
  returning id into v_delivery_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_delivery.scheduled', 'orders', p_order_id,
    jsonb_build_object('number', v_order.number, 'window_start', p_window_start, 'window_end', p_window_end)
  );
  return v_delivery_id;
end;
$$;

create or replace function public.dispatch_order_delivery(
  p_order_id uuid,
  p_dispatched_at timestamptz,
  p_temperature_c numeric,
  p_packaging_condition text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_delivery public.order_deliveries;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status <> 'preparing' then
    raise exception 'El pedido debe estar en preparacion para despacharse.';
  end if;
  select * into v_delivery from public.order_deliveries where order_id = p_order_id for update;
  if v_delivery.id is null or v_delivery.status <> 'planned' then
    raise exception 'Programa la ruta antes de despachar.';
  end if;
  if exists (select 1 from public.order_items where order_id = p_order_id and lot_id is null) then
    raise exception 'Asigna lote a todos los productos antes de despachar.';
  end if;
  if p_dispatched_at is null or p_temperature_c is null or p_temperature_c not between -5 and 12
     or length(trim(coalesce(p_packaging_condition, ''))) < 3 then
    raise exception 'Registra temperatura y condicion de empaque validas.';
  end if;

  update public.order_deliveries
  set status = 'dispatched',
      dispatched_at = p_dispatched_at,
      dispatch_temperature_c = p_temperature_c,
      packaging_condition = trim(p_packaging_condition),
      actor_id = auth.uid()
  where id = v_delivery.id;
  update public.orders set status = 'dispatched'::public.order_status where id = p_order_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_delivery.dispatched', 'orders', p_order_id,
    jsonb_build_object('number', v_order.number, 'temperature_c', p_temperature_c, 'at', p_dispatched_at)
  );
  return v_delivery.id;
end;
$$;

create or replace function public.complete_order_delivery(
  p_order_id uuid,
  p_delivered_at timestamptz,
  p_temperature_c numeric,
  p_received_by text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_delivery public.order_deliveries;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status <> 'dispatched' then
    raise exception 'El pedido debe estar despachado para registrar recepcion.';
  end if;
  select * into v_delivery from public.order_deliveries where order_id = p_order_id for update;
  if v_delivery.id is null or v_delivery.status <> 'dispatched' then
    raise exception 'No existe un despacho controlado para este pedido.';
  end if;
  if p_delivered_at is null or p_delivered_at < v_delivery.dispatched_at
     or p_temperature_c is null or p_temperature_c not between -5 and 12
     or length(trim(coalesce(p_received_by, ''))) < 3 then
    raise exception 'Registra recepcion, temperatura y receptor validos.';
  end if;

  update public.order_deliveries
  set status = 'delivered',
      delivered_at = p_delivered_at,
      delivery_temperature_c = p_temperature_c,
      received_by = trim(p_received_by),
      delivery_notes = trim(coalesce(p_notes, '')),
      actor_id = auth.uid()
  where id = v_delivery.id;
  update public.orders set status = 'delivered'::public.order_status where id = p_order_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_delivery.delivered', 'orders', p_order_id,
    jsonb_build_object('number', v_order.number, 'temperature_c', p_temperature_c, 'received_by', trim(p_received_by))
  );
  return v_delivery.id;
end;
$$;

-- Delivery states must be generated by the controlled delivery functions.
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
  if p_status in ('dispatched', 'delivered') then
    raise exception 'Usa el control de entrega para registrar despacho y recepcion.';
  end if;
  if not (
    (v_order.status = 'pending_confirmation' and p_status in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and p_status in ('preparing', 'cancelled'))
    or (v_order.status = 'preparing' and p_status = 'cancelled')
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

revoke all on public.order_deliveries from public;
revoke all on function public.schedule_order_delivery(uuid, timestamptz, timestamptz, text, text, text) from public;
revoke all on function public.dispatch_order_delivery(uuid, timestamptz, numeric, text) from public;
revoke all on function public.complete_order_delivery(uuid, timestamptz, numeric, text, text) from public;

grant select on public.order_deliveries to authenticated;
grant execute on function public.schedule_order_delivery(uuid, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.dispatch_order_delivery(uuid, timestamptz, numeric, text) to authenticated;
grant execute on function public.complete_order_delivery(uuid, timestamptz, numeric, text, text) to authenticated;
