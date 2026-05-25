-- Operational inventory: lot receipts, adjustments, waste and order allocation.

alter table public.inventory_lots
  add column if not exists received_quantity numeric(12, 3),
  add column if not exists status text not null default 'available',
  add column if not exists notes text not null default '',
  add column if not exists updated_at timestamptz not null default now();

update public.inventory_lots
set received_quantity = quantity
where received_quantity is null;

alter table public.inventory_lots
  alter column received_quantity set not null;

alter table public.inventory_lots drop constraint if exists inventory_lots_status_check;
alter table public.inventory_lots
  add constraint inventory_lots_status_check
  check (status in ('available', 'depleted', 'quarantine'));

alter table public.inventory_lots drop constraint if exists inventory_lots_unit_check;
alter table public.inventory_lots
  add constraint inventory_lots_unit_check
  check (unit in ('kg', 'unit', 'maple'));

alter table public.order_items
  add column if not exists allocated_quantity numeric(12, 3),
  add column if not exists allocated_unit text,
  add column if not exists cost_total numeric(12, 2);

alter table public.order_items drop constraint if exists order_items_allocated_unit_check;
alter table public.order_items
  add constraint order_items_allocated_unit_check
  check (allocated_unit is null or allocated_unit in ('kg', 'unit', 'maple'));

create sequence if not exists public.inventory_lot_number_seq start 1;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.inventory_lots(id) on delete cascade,
  movement_type text not null check (movement_type in ('receipt', 'adjustment_in', 'waste', 'allocation')),
  quantity_delta numeric(12, 3) not null check (quantity_delta <> 0),
  unit text not null check (unit in ('kg', 'unit', 'maple')),
  reason text not null default '',
  order_item_id uuid references public.order_items(id),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.inventory_movements enable row level security;

drop policy if exists "staff manage inventory movements" on public.inventory_movements;
create policy "staff manage inventory movements"
on public.inventory_movements for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop trigger if exists inventory_lots_touch_updated_at on public.inventory_lots;
create trigger inventory_lots_touch_updated_at
before update on public.inventory_lots
for each row execute function public.touch_updated_at();

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

  if not exists (select 1 from public.locations where id = p_location_id and active) then
    raise exception 'Sede no disponible.';
  end if;

  v_expected_unit := case when v_product.price_unit = 'kg' then 'kg' else v_product.price_unit end;
  if p_quantity <= 0 or p_unit <> v_expected_unit then
    raise exception 'La cantidad o unidad no corresponde al producto.';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'El costo no puede ser negativo.';
  end if;
  if p_expires_at is not null and p_expires_at < p_received_at then
    raise exception 'El vencimiento no puede ser anterior al ingreso.';
  end if;
  if v_product.origin_type = 'selected_supplier'
     and length(trim(coalesce(p_supplier_name, ''))) < 2 then
    raise exception 'Registra el proveedor del producto seleccionado.';
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
    notes
  )
  values (
    'BG51-LT-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.inventory_lot_number_seq')::text, 5, '0'),
    p_product_id,
    v_product.origin_type,
    nullif(trim(coalesce(p_supplier_name, '')), ''),
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
  values (
    v_lot.id, 'receipt', p_quantity, p_unit, 'Recepción inicial de lote', auth.uid()
  );

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'inventory_lot.created',
    'inventory_lots',
    v_lot.id,
    jsonb_build_object('code', v_lot.code, 'quantity', p_quantity, 'unit', p_unit)
  );

  return v_lot.id;
end;
$$;

create or replace function public.record_inventory_movement(
  p_lot_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.inventory_lots;
  v_delta numeric(12, 3);
  v_movement_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if p_movement_type not in ('adjustment_in', 'waste')
     or p_quantity <= 0
     or length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Movimiento, cantidad o motivo no válido.';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = p_lot_id
  for update;
  if v_lot.id is null then
    raise exception 'Lote no encontrado.';
  end if;

  v_delta := case when p_movement_type = 'waste' then -p_quantity else p_quantity end;
  if v_lot.quantity + v_delta < 0 then
    raise exception 'La merma supera el saldo disponible.';
  end if;

  update public.inventory_lots
  set quantity = quantity + v_delta,
      status = case when quantity + v_delta = 0 then 'depleted' else 'available' end
  where id = p_lot_id;

  insert into public.inventory_movements (
    lot_id, movement_type, quantity_delta, unit, reason, actor_id
  )
  values (
    p_lot_id, p_movement_type, v_delta, v_lot.unit, trim(p_reason), auth.uid()
  )
  returning id into v_movement_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'inventory_lot.movement',
    'inventory_lots',
    p_lot_id,
    jsonb_build_object('type', p_movement_type, 'delta', v_delta, 'reason', trim(p_reason))
  );

  return v_movement_id;
end;
$$;

create or replace function public.allocate_inventory_lot(
  p_order_item_id uuid,
  p_lot_id uuid,
  p_quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items;
  v_order public.orders;
  v_product public.products;
  v_lot public.inventory_lots;
  v_required numeric(12, 3);
  v_expected_unit text;
  v_movement_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Acceso no autorizado.';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad reservada debe ser mayor a cero.';
  end if;

  select * into v_item
  from public.order_items
  where id = p_order_item_id
  for update;
  if v_item.id is null or v_item.lot_id is not null then
    raise exception 'El ítem no existe o ya tiene lote asignado.';
  end if;

  select * into v_order from public.orders where id = v_item.order_id;
  if v_order.status not in ('confirmed', 'preparing') then
    raise exception 'El pedido debe estar confirmado o en preparación.';
  end if;

  select * into v_product from public.products where id = v_item.product_id;
  select * into v_lot
  from public.inventory_lots
  where id = p_lot_id
  for update;
  if v_lot.id is null
     or v_lot.product_id <> v_item.product_id
     or v_lot.status <> 'available' then
    raise exception 'El lote seleccionado no corresponde o no está disponible.';
  end if;

  v_expected_unit := case when v_product.price_unit = 'kg' then 'kg' else v_product.price_unit end;
  if v_lot.unit <> v_expected_unit then
    raise exception 'La unidad del lote no corresponde al producto.';
  end if;
  if v_product.price_unit = 'kg' and v_product.portion_grams is not null then
    v_required := v_item.quantity * (v_product.portion_grams / 1000.0);
  elsif v_product.price_unit <> 'kg' then
    v_required := v_item.quantity;
  end if;
  if v_required is not null and abs(p_quantity - v_required) > 0.001 then
    raise exception 'La cantidad reservada no coincide con la presentación vendida.';
  end if;
  if v_lot.quantity < p_quantity then
    raise exception 'El lote no tiene saldo suficiente.';
  end if;

  update public.order_items
  set lot_id = p_lot_id,
      allocated_quantity = p_quantity,
      allocated_unit = v_lot.unit,
      cost_total = case
        when v_lot.unit_cost is null then null
        else round(p_quantity * v_lot.unit_cost, 2)
      end
  where id = p_order_item_id;

  update public.inventory_lots
  set quantity = quantity - p_quantity,
      status = case when quantity - p_quantity = 0 then 'depleted' else status end
  where id = p_lot_id;

  insert into public.inventory_movements (
    lot_id, movement_type, quantity_delta, unit, reason, order_item_id, actor_id
  )
  values (
    p_lot_id,
    'allocation',
    -p_quantity,
    v_lot.unit,
    'Reserva para pedido ' || v_order.number,
    p_order_item_id,
    auth.uid()
  )
  returning id into v_movement_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'order_item.lot_allocated',
    'order_items',
    p_order_item_id,
    jsonb_build_object('lot_id', p_lot_id, 'quantity', p_quantity, 'unit', v_lot.unit)
  );

  return v_movement_id;
end;
$$;

revoke all on function public.create_inventory_lot(uuid, uuid, numeric, text, numeric, timestamptz, timestamptz, text, text) from public;
revoke all on function public.record_inventory_movement(uuid, text, numeric, text) from public;
revoke all on function public.allocate_inventory_lot(uuid, uuid, numeric) from public;

grant execute on function public.create_inventory_lot(uuid, uuid, numeric, text, numeric, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.record_inventory_movement(uuid, text, numeric, text) to authenticated;
grant execute on function public.allocate_inventory_lot(uuid, uuid, numeric) to authenticated;
