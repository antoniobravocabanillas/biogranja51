-- Account routing and delivery self-service portal.

alter table public.delivery_profiles
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists delivery_profiles_auth_user_id_unique
  on public.delivery_profiles (auth_user_id)
  where auth_user_id is not null;

drop policy if exists "delivery reads own profile" on public.delivery_profiles;
create policy "delivery reads own profile"
on public.delivery_profiles for select to authenticated
using (auth_user_id = (select auth.uid()));

create or replace function public.my_account_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role_code text;
  v_role_name text;
  v_role_scope text;
  v_delivery public.delivery_profiles;
  v_customer public.customers;
begin
  if v_uid is null then
    return jsonb_build_object('accountType', 'unknown', 'destination', '/cuenta');
  end if;

  select role.code, role.name, role.scope
  into v_role_code, v_role_name, v_role_scope
  from public.staff_assignments assignment
  join public.staff_roles role on role.id = assignment.role_id
  where assignment.user_id = v_uid
  order by role.code
  limit 1;

  if v_role_code is not null then
    return jsonb_build_object(
      'accountType', 'staff',
      'destination', '/gestion',
      'role', jsonb_build_object(
        'code', v_role_code,
        'name', v_role_name,
        'scope', v_role_scope
      )
    );
  end if;

  select * into v_delivery
  from public.delivery_profiles
  where auth_user_id = v_uid and active
  limit 1;

  if v_delivery.id is not null then
    return jsonb_build_object(
      'accountType', 'delivery',
      'destination', '/reparto',
      'delivery', jsonb_build_object(
        'id', v_delivery.id::text,
        'code', v_delivery.code,
        'name', v_delivery.name,
        'phone', v_delivery.phone,
        'vehicleReference', v_delivery.vehicle_reference,
        'notes', v_delivery.notes,
        'active', v_delivery.active,
        'authUserId', v_delivery.auth_user_id::text
      )
    );
  end if;

  select * into v_customer
  from public.customers
  where auth_user_id = v_uid
  limit 1;

  if v_customer.id is not null then
    return jsonb_build_object(
      'accountType', 'customer',
      'destination', '/mi-cuenta',
      'customer', jsonb_build_object(
        'id', v_customer.id::text,
        'name', v_customer.name,
        'phone', v_customer.phone,
        'email', v_customer.email,
        'lastAddress', v_customer.last_address,
        'deliveryZoneId', v_customer.last_delivery_zone_id::text,
        'paymentMethodId', v_customer.preferred_payment_method_id::text
      )
    );
  end if;

  return jsonb_build_object('accountType', 'unknown', 'destination', '/cuenta');
end;
$$;

create or replace function public.get_my_delivery_portal()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.delivery_profiles;
begin
  if v_uid is null then raise exception 'Inicia sesion para ver tus entregas.'; end if;

  select * into v_profile
  from public.delivery_profiles
  where auth_user_id = v_uid and active
  limit 1;

  if v_profile.id is null then
    raise exception 'Tu cuenta no tiene perfil delivery activo.';
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id::text,
      'code', v_profile.code,
      'name', v_profile.name,
      'phone', v_profile.phone,
      'vehicleReference', v_profile.vehicle_reference,
      'notes', v_profile.notes,
      'active', v_profile.active,
      'authUserId', v_profile.auth_user_id::text
    ),
    'deliveries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', delivery.id::text,
          'orderId', sale.id::text,
          'orderNumber', sale.number,
          'orderStatus', sale.status,
          'customerName', customer.name,
          'phone', customer.phone,
          'address', sale.address,
          'deliveryZoneName', zone.name,
          'paymentMethodName', payment.name,
          'subtotal', sale.subtotal,
          'deliveryFee', sale.delivery_fee,
          'total', sale.total,
          'hasPendingPrice', sale.has_pending_price,
          'createdAt', sale.created_at,
          'status', delivery.status,
          'windowStart', delivery.window_start,
          'windowEnd', delivery.window_end,
          'planningNotes', delivery.planning_notes,
          'dispatchedAt', delivery.dispatched_at,
          'dispatchTemperatureC', delivery.dispatch_temperature_c,
          'packagingCondition', delivery.packaging_condition,
          'deliveredAt', delivery.delivered_at,
          'deliveryTemperatureC', delivery.delivery_temperature_c,
          'receivedBy', delivery.received_by,
          'deliveryNotes', delivery.delivery_notes,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'name', product.name,
              'presentation', product.presentation,
              'quantity', item.quantity,
              'subtotal', item.subtotal,
              'lotCode', lot.code
            ) order by item.created_at)
            from public.order_items item
            join public.products product on product.id = item.product_id
            left join public.inventory_lots lot on lot.id = item.lot_id
            where item.order_id = sale.id
          ), '[]'::jsonb)
        )
        order by
          case delivery.status when 'planned' then 1 when 'dispatched' then 2 else 3 end,
          delivery.window_start
      )
      from public.order_deliveries delivery
      join public.orders sale on sale.id = delivery.order_id
      join public.customers customer on customer.id = sale.customer_id
      join public.delivery_zones zone on zone.id = sale.delivery_zone_id
      join public.payment_methods payment on payment.id = sale.payment_method_id
      where delivery.delivery_profile_id = v_profile.id
        and sale.status <> 'cancelled'
        and (
          delivery.status in ('planned', 'dispatched')
          or delivery.delivered_at >= now() - interval '2 days'
        )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.dispatch_my_delivery(
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
  v_uid uuid := auth.uid();
  v_profile public.delivery_profiles;
  v_order public.orders;
  v_delivery public.order_deliveries;
begin
  if v_uid is null then raise exception 'Inicia sesion para despachar.'; end if;

  select * into v_profile
  from public.delivery_profiles
  where auth_user_id = v_uid and active
  limit 1;
  if v_profile.id is null then raise exception 'Tu cuenta no tiene perfil delivery activo.'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status <> 'preparing' then
    raise exception 'El pedido debe estar en preparacion para despacharse.';
  end if;

  select * into v_delivery
  from public.order_deliveries
  where order_id = p_order_id and delivery_profile_id = v_profile.id
  for update;
  if v_delivery.id is null or v_delivery.status <> 'planned' then
    raise exception 'No tienes una ruta programada para este pedido.';
  end if;
  if exists (select 1 from public.order_items where order_id = p_order_id and lot_id is null) then
    raise exception 'Almacen debe asignar lote a todos los productos antes de despachar.';
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
      actor_id = v_uid
  where id = v_delivery.id;

  update public.orders set status = 'dispatched'::public.order_status where id = p_order_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    v_uid, 'order_delivery.dispatched_by_delivery', 'orders', p_order_id,
    jsonb_build_object(
      'number', v_order.number,
      'delivery_profile_id', v_profile.id,
      'delivery_profile_name', v_profile.name,
      'temperature_c', p_temperature_c,
      'at', p_dispatched_at
    )
  );
  return v_delivery.id;
end;
$$;

create or replace function public.complete_my_delivery(
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
  v_uid uuid := auth.uid();
  v_profile public.delivery_profiles;
  v_order public.orders;
  v_delivery public.order_deliveries;
begin
  if v_uid is null then raise exception 'Inicia sesion para confirmar entrega.'; end if;

  select * into v_profile
  from public.delivery_profiles
  where auth_user_id = v_uid and active
  limit 1;
  if v_profile.id is null then raise exception 'Tu cuenta no tiene perfil delivery activo.'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status <> 'dispatched' then
    raise exception 'El pedido debe estar despachado para registrar recepcion.';
  end if;

  select * into v_delivery
  from public.order_deliveries
  where order_id = p_order_id and delivery_profile_id = v_profile.id
  for update;
  if v_delivery.id is null or v_delivery.status <> 'dispatched' then
    raise exception 'No existe un despacho activo asignado a tu perfil.';
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
      actor_id = v_uid
  where id = v_delivery.id;

  update public.orders set status = 'delivered'::public.order_status where id = p_order_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    v_uid, 'order_delivery.delivered_by_delivery', 'orders', p_order_id,
    jsonb_build_object(
      'number', v_order.number,
      'delivery_profile_id', v_profile.id,
      'delivery_profile_name', v_profile.name,
      'temperature_c', p_temperature_c,
      'received_by', trim(p_received_by)
    )
  );
  return v_delivery.id;
end;
$$;

revoke all on function public.my_account_context() from public;
revoke all on function public.get_my_delivery_portal() from public;
revoke all on function public.dispatch_my_delivery(uuid, timestamptz, numeric, text) from public;
revoke all on function public.complete_my_delivery(uuid, timestamptz, numeric, text, text) from public;

grant execute on function public.my_account_context() to authenticated;
grant execute on function public.get_my_delivery_portal() to authenticated;
grant execute on function public.dispatch_my_delivery(uuid, timestamptz, numeric, text) to authenticated;
grant execute on function public.complete_my_delivery(uuid, timestamptz, numeric, text, text) to authenticated;
