-- Delivery profiles and assignment-aware route scheduling.

create table if not exists public.delivery_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text,
  vehicle_reference text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_profiles_code_check check (length(trim(code)) >= 3),
  constraint delivery_profiles_name_check check (length(trim(name)) >= 3),
  constraint delivery_profiles_vehicle_check check (length(trim(vehicle_reference)) >= 3)
);

alter table public.delivery_profiles enable row level security;

drop policy if exists "staff manage delivery profiles" on public.delivery_profiles;
create policy "staff manage delivery profiles"
on public.delivery_profiles for all to authenticated
using (public.is_staff())
with check (public.is_staff());

drop trigger if exists delivery_profiles_touch_updated_at on public.delivery_profiles;
create trigger delivery_profiles_touch_updated_at
before update on public.delivery_profiles
for each row execute function public.touch_updated_at();

insert into public.delivery_profiles (code, name, phone, vehicle_reference, notes, active)
values (
  'DEL-01',
  'Delivery BioGranja',
  null,
  'Movilidad por asignar',
  'Perfil base para coordinar entregas propias o tercerizadas.',
  true
)
on conflict (code) do update set
  name = excluded.name,
  vehicle_reference = excluded.vehicle_reference,
  notes = excluded.notes,
  active = true;

alter table public.order_deliveries
  add column if not exists delivery_profile_id uuid references public.delivery_profiles(id);

update public.order_deliveries delivery
set delivery_profile_id = profile.id
from public.delivery_profiles profile
where delivery.delivery_profile_id is null
  and profile.code = 'DEL-01';

create or replace function public.schedule_order_delivery(
  p_order_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_delivery_profile_id uuid,
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
  v_profile public.delivery_profiles;
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

  select * into v_profile
  from public.delivery_profiles
  where id = p_delivery_profile_id and active
  for update;
  if v_profile.id is null then
    raise exception 'Selecciona un perfil delivery activo.';
  end if;

  select * into v_delivery from public.order_deliveries where order_id = p_order_id for update;
  if v_delivery.id is not null and v_delivery.status <> 'planned' then
    raise exception 'La ruta ya salio y no puede reprogramarse.';
  end if;

  insert into public.order_deliveries (
    order_id, window_start, window_end, delivery_profile_id, driver_name,
    vehicle_reference, planning_notes, actor_id
  )
  values (
    p_order_id, p_window_start, p_window_end, v_profile.id, trim(v_profile.name),
    trim(v_profile.vehicle_reference), trim(coalesce(p_notes, '')), auth.uid()
  )
  on conflict (order_id) do update set
    window_start = excluded.window_start,
    window_end = excluded.window_end,
    delivery_profile_id = excluded.delivery_profile_id,
    driver_name = excluded.driver_name,
    vehicle_reference = excluded.vehicle_reference,
    planning_notes = excluded.planning_notes,
    actor_id = excluded.actor_id
  returning id into v_delivery_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_delivery.scheduled', 'orders', p_order_id,
    jsonb_build_object(
      'number', v_order.number,
      'window_start', p_window_start,
      'window_end', p_window_end,
      'delivery_profile_id', v_profile.id,
      'delivery_profile_name', v_profile.name
    )
  );
  return v_delivery_id;
end;
$$;

revoke all on public.delivery_profiles from public;
revoke all on function public.schedule_order_delivery(uuid, timestamptz, timestamptz, uuid, text) from public;
drop function if exists public.schedule_order_delivery(uuid, timestamptz, timestamptz, text, text, text);

grant select, insert, update on public.delivery_profiles to authenticated;
grant execute on function public.schedule_order_delivery(uuid, timestamptz, timestamptz, uuid, text) to authenticated;
