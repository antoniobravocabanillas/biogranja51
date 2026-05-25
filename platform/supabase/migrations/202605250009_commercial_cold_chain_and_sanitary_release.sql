-- Commercial cold-chain evidence and sanitary release for purchased finished products.

alter table public.inventory_lots
  add column if not exists supplier_document text,
  add column if not exists supplier_lot_code text,
  add column if not exists arrival_temperature_c numeric(5, 2),
  add column if not exists storage_temperature_c numeric(5, 2),
  add column if not exists packaging_condition text not null default '',
  add column if not exists sanitary_status text,
  add column if not exists sanitary_notes text not null default '',
  add column if not exists sanitary_reviewed_at timestamptz,
  add column if not exists sanitary_reviewed_by uuid references auth.users(id);

alter table public.inventory_lots drop constraint if exists inventory_lots_sanitary_status_check;
alter table public.inventory_lots
  add constraint inventory_lots_sanitary_status_check
  check (sanitary_status is null or sanitary_status in ('pending', 'approved', 'rejected'));

alter table public.inventory_lots drop constraint if exists inventory_lots_temperature_check;
alter table public.inventory_lots
  add constraint inventory_lots_temperature_check
  check (
    (arrival_temperature_c is null or arrival_temperature_c between -30 and 15)
    and (storage_temperature_c is null or storage_temperature_c between -30 and 15)
  );

create index if not exists inventory_lots_sanitary_status_idx
  on public.inventory_lots (sanitary_status, status);

drop function if exists public.create_inventory_lot(
  uuid, uuid, numeric, text, numeric, timestamptz, timestamptz, text, text
);

create or replace function public.create_inventory_lot(
  p_product_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_unit text,
  p_unit_cost numeric,
  p_received_at timestamptz,
  p_expires_at timestamptz,
  p_supplier_name text,
  p_supplier_document text,
  p_supplier_lot_code text,
  p_arrival_temperature_c numeric,
  p_storage_temperature_c numeric,
  p_packaging_condition text,
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
    raise exception 'El producto propio se recibe desde produccion.';
  end if;
  if not exists (select 1 from public.locations where id = p_location_id and active) then
    raise exception 'Sede no disponible.';
  end if;
  v_expected_unit := case when v_product.price_unit = 'kg' then 'kg' else v_product.price_unit end;
  if p_quantity is null or p_quantity <= 0 or p_unit <> v_expected_unit then
    raise exception 'La cantidad o unidad no corresponde al producto terminado.';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'El costo no puede ser negativo.';
  end if;
  if p_expires_at is not null and p_expires_at < p_received_at then
    raise exception 'El vencimiento no puede ser anterior al ingreso.';
  end if;
  if length(trim(coalesce(p_supplier_name, ''))) < 2
     or length(trim(coalesce(p_supplier_document, ''))) < 2
     or length(trim(coalesce(p_supplier_lot_code, ''))) < 2
     or length(trim(coalesce(p_packaging_condition, ''))) < 3
     or p_arrival_temperature_c is null
     or p_storage_temperature_c is null then
    raise exception 'Registra proveedor, documento, lote, temperaturas y condicion de empaque.';
  end if;
  if p_arrival_temperature_c not between -30 and 15
     or p_storage_temperature_c not between -30 and 15 then
    raise exception 'Las temperaturas registradas estan fuera del rango permitido.';
  end if;

  insert into public.inventory_lots (
    code, product_id, origin_type, supplier_name, location_id, received_quantity,
    quantity, unit, unit_cost, produced_or_received_at, expires_at, status, notes,
    supplier_document, supplier_lot_code, arrival_temperature_c,
    storage_temperature_c, packaging_condition, sanitary_status
  )
  values (
    'BG51-LT-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.inventory_lot_number_seq')::text, 5, '0'),
    p_product_id, v_product.origin_type, trim(p_supplier_name), p_location_id,
    p_quantity, p_quantity, p_unit, p_unit_cost, p_received_at, p_expires_at,
    'quarantine', trim(coalesce(p_notes, '')), trim(p_supplier_document),
    trim(p_supplier_lot_code), p_arrival_temperature_c, p_storage_temperature_c,
    trim(p_packaging_condition), 'pending'
  )
  returning * into v_lot;

  insert into public.inventory_movements (
    lot_id, movement_type, quantity_delta, unit, reason, actor_id
  )
  values (v_lot.id, 'receipt', p_quantity, p_unit, 'Recepcion comercial en cuarentena', auth.uid());

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'inventory_lot.sanitary_received', 'inventory_lots', v_lot.id,
    jsonb_build_object(
      'code', v_lot.code, 'supplier', trim(p_supplier_name),
      'document', trim(p_supplier_document), 'supplier_lot', trim(p_supplier_lot_code),
      'arrival_temperature_c', p_arrival_temperature_c,
      'storage_temperature_c', p_storage_temperature_c,
      'sanitary_status', 'pending'
    )
  );
  return v_lot.id;
end;
$$;

create or replace function public.record_inventory_lot_sanitary_evidence(
  p_lot_id uuid,
  p_supplier_document text,
  p_supplier_lot_code text,
  p_arrival_temperature_c numeric,
  p_storage_temperature_c numeric,
  p_packaging_condition text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.inventory_lots;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_lot from public.inventory_lots where id = p_lot_id for update;
  if v_lot.id is null then raise exception 'Lote no encontrado.'; end if;
  if v_lot.origin_type = 'own' then
    raise exception 'El lote propio no utiliza expediente de proveedor.';
  end if;
  if length(trim(coalesce(p_supplier_document, ''))) < 2
     or length(trim(coalesce(p_supplier_lot_code, ''))) < 2
     or length(trim(coalesce(p_packaging_condition, ''))) < 3
     or p_arrival_temperature_c is null
     or p_storage_temperature_c is null
     or p_arrival_temperature_c not between -30 and 15
     or p_storage_temperature_c not between -30 and 15 then
    raise exception 'La evidencia sanitaria o temperaturas no son validas.';
  end if;

  update public.inventory_lots
  set supplier_document = trim(p_supplier_document),
      supplier_lot_code = trim(p_supplier_lot_code),
      arrival_temperature_c = p_arrival_temperature_c,
      storage_temperature_c = p_storage_temperature_c,
      packaging_condition = trim(p_packaging_condition),
      sanitary_status = 'pending',
      sanitary_notes = '',
      sanitary_reviewed_at = null,
      sanitary_reviewed_by = null,
      status = case when quantity = 0 then 'depleted' else 'quarantine' end
  where id = p_lot_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'inventory_lot.sanitary_evidence_recorded', 'inventory_lots', p_lot_id,
    jsonb_build_object(
      'document', trim(p_supplier_document), 'supplier_lot', trim(p_supplier_lot_code),
      'arrival_temperature_c', p_arrival_temperature_c,
      'storage_temperature_c', p_storage_temperature_c
    )
  );
  return p_lot_id;
end;
$$;

create or replace function public.review_inventory_lot_sanitary(
  p_lot_id uuid,
  p_sanitary_status text,
  p_sanitary_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.inventory_lots;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if p_sanitary_status not in ('approved', 'rejected')
     or length(trim(coalesce(p_sanitary_notes, ''))) < 3 then
    raise exception 'Documenta el resultado de la revision sanitaria.';
  end if;
  select * into v_lot from public.inventory_lots where id = p_lot_id for update;
  if v_lot.id is null then raise exception 'Lote no encontrado.'; end if;
  if v_lot.sanitary_status is null
     or v_lot.supplier_document is null
     or v_lot.supplier_lot_code is null
     or v_lot.arrival_temperature_c is null
     or v_lot.storage_temperature_c is null then
    raise exception 'Completa el expediente sanitario antes de revisar.';
  end if;

  update public.inventory_lots
  set sanitary_status = p_sanitary_status,
      sanitary_notes = trim(p_sanitary_notes),
      sanitary_reviewed_at = now(),
      sanitary_reviewed_by = auth.uid(),
      status = case
        when quantity = 0 then 'depleted'
        when p_sanitary_status = 'approved' then 'available'
        else 'quarantine'
      end
  where id = p_lot_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'inventory_lot.sanitary_reviewed', 'inventory_lots', p_lot_id,
    jsonb_build_object('sanitary_status', p_sanitary_status, 'notes', trim(p_sanitary_notes))
  );
  return p_lot_id;
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
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if p_movement_type not in ('adjustment_in', 'waste')
     or p_quantity <= 0
     or length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Movimiento, cantidad o motivo no valido.';
  end if;
  select * into v_lot from public.inventory_lots where id = p_lot_id for update;
  if v_lot.id is null then raise exception 'Lote no encontrado.'; end if;
  v_delta := case when p_movement_type = 'waste' then -p_quantity else p_quantity end;
  if v_lot.quantity + v_delta < 0 then
    raise exception 'La merma supera el saldo disponible.';
  end if;

  update public.inventory_lots
  set quantity = quantity + v_delta,
      status = case
        when quantity + v_delta = 0 then 'depleted'
        when sanitary_status in ('pending', 'rejected') then 'quarantine'
        else 'available'
      end
  where id = p_lot_id;

  insert into public.inventory_movements (
    lot_id, movement_type, quantity_delta, unit, reason, actor_id
  )
  values (p_lot_id, p_movement_type, v_delta, v_lot.unit, trim(p_reason), auth.uid())
  returning id into v_movement_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'inventory_lot.movement', 'inventory_lots', p_lot_id,
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
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if p_quantity <= 0 then raise exception 'La cantidad reservada debe ser mayor a cero.'; end if;

  select * into v_item from public.order_items where id = p_order_item_id for update;
  if v_item.id is null or v_item.lot_id is not null then
    raise exception 'El item no existe o ya tiene lote asignado.';
  end if;
  select * into v_order from public.orders where id = v_item.order_id;
  if v_order.status not in ('confirmed', 'preparing') then
    raise exception 'El pedido debe estar confirmado o en preparacion.';
  end if;
  select * into v_product from public.products where id = v_item.product_id;
  select * into v_lot from public.inventory_lots where id = p_lot_id for update;
  if v_lot.id is null
     or v_lot.product_id <> v_item.product_id
     or v_lot.status <> 'available' then
    raise exception 'El lote seleccionado no corresponde o no esta disponible.';
  end if;
  if v_lot.origin_type::text <> 'own' and v_lot.sanitary_status is distinct from 'approved' then
    raise exception 'El lote comprado requiere liberacion sanitaria antes del despacho.';
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
    raise exception 'La cantidad reservada no coincide con la presentacion vendida.';
  end if;
  if v_lot.quantity < p_quantity then raise exception 'El lote no tiene saldo suficiente.'; end if;

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
    p_lot_id, 'allocation', -p_quantity, v_lot.unit,
    'Reserva para pedido ' || v_order.number, p_order_item_id, auth.uid()
  )
  returning id into v_movement_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_item.lot_allocated', 'order_items', p_order_item_id,
    jsonb_build_object('lot_id', p_lot_id, 'quantity', p_quantity, 'unit', v_lot.unit)
  );
  return v_movement_id;
end;
$$;

revoke all on function public.create_inventory_lot(
  uuid, uuid, numeric, text, numeric, timestamptz, timestamptz, text, text,
  text, numeric, numeric, text, text
) from public;
revoke all on function public.record_inventory_lot_sanitary_evidence(
  uuid, text, text, numeric, numeric, text
) from public;
revoke all on function public.review_inventory_lot_sanitary(uuid, text, text) from public;
revoke all on function public.allocate_inventory_lot(uuid, uuid, numeric) from public;

grant execute on function public.create_inventory_lot(
  uuid, uuid, numeric, text, numeric, timestamptz, timestamptz, text, text,
  text, numeric, numeric, text, text
) to authenticated;
grant execute on function public.record_inventory_lot_sanitary_evidence(
  uuid, text, text, numeric, numeric, text
) to authenticated;
grant execute on function public.review_inventory_lot_sanitary(uuid, text, text) to authenticated;
grant execute on function public.allocate_inventory_lot(uuid, uuid, numeric) to authenticated;
