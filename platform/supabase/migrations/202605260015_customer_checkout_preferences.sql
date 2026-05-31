-- Saved checkout preferences for authenticated customers and frictionless reordering.

alter table public.customers
  add column if not exists preferred_payment_method_id uuid references public.payment_methods(id);

revoke all on function public.upsert_my_customer_profile(text, text) from public;
drop function if exists public.upsert_my_customer_profile(text, text);

create or replace function public.upsert_my_customer_profile(
  p_name text,
  p_phone text,
  p_address text,
  p_delivery_zone_id uuid,
  p_payment_method_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone_normalized text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_customer public.customers;
  v_zone public.delivery_zones;
  v_payment public.payment_methods;
begin
  if v_uid is null then raise exception 'Inicia sesion para actualizar tu perfil.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(v_phone_normalized) < 9 then
    raise exception 'Completa correctamente nombre y celular.';
  end if;
  if length(trim(coalesce(p_address, ''))) < 5 then
    raise exception 'Ingresa una direccion de entrega valida.';
  end if;

  select * into v_zone from public.delivery_zones where id = p_delivery_zone_id and active;
  select * into v_payment from public.payment_methods where id = p_payment_method_id and active;
  if v_zone.id is null or v_payment.id is null then
    raise exception 'Zona o medio de pago no disponible.';
  end if;

  select * into v_customer from public.customers where auth_user_id = v_uid for update;
  if v_customer.id is null then
    insert into public.customers (
      name, phone, email, phone_normalized, auth_user_id, last_address,
      last_delivery_zone_id, preferred_payment_method_id
    )
    values (
      trim(p_name), trim(p_phone), nullif(v_email, ''), v_phone_normalized, v_uid,
      trim(p_address), p_delivery_zone_id, p_payment_method_id
    )
    returning * into v_customer;
  else
    update public.customers
    set name = trim(p_name),
        phone = trim(p_phone),
        email = coalesce(nullif(v_email, ''), email),
        phone_normalized = v_phone_normalized,
        last_address = trim(p_address),
        last_delivery_zone_id = p_delivery_zone_id,
        preferred_payment_method_id = p_payment_method_id
    where id = v_customer.id
    returning * into v_customer;
  end if;

  return jsonb_build_object(
    'name', v_customer.name,
    'phone', v_customer.phone,
    'email', v_customer.email,
    'lastAddress', v_customer.last_address,
    'deliveryZoneId', v_customer.last_delivery_zone_id::text,
    'paymentMethodId', v_customer.preferred_payment_method_id::text
  );
end;
$$;

create or replace function public.get_my_customer_portal()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers;
begin
  if v_uid is null then raise exception 'Inicia sesion para ver tus pedidos.'; end if;
  select * into v_customer from public.customers where auth_user_id = v_uid;
  if v_customer.id is null then
    return jsonb_build_object('profile', null, 'orders', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'name', v_customer.name,
      'phone', v_customer.phone,
      'email', v_customer.email,
      'lastAddress', v_customer.last_address,
      'deliveryZoneId', v_customer.last_delivery_zone_id::text,
      'paymentMethodId', v_customer.preferred_payment_method_id::text
    ),
    'orders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sale.id::text,
          'number', sale.number,
          'address', sale.address,
          'status', sale.status,
          'subtotal', sale.subtotal,
          'deliveryFee', sale.delivery_fee,
          'total', sale.total,
          'hasPendingPrice', sale.has_pending_price,
          'createdAt', sale.created_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'name', product.name,
              'presentation', product.presentation,
              'quantity', item.quantity,
              'subtotal', item.subtotal
            ) order by item.created_at)
            from public.order_items item
            join public.products product on product.id = item.product_id
            where item.order_id = sale.id
          ), '[]'::jsonb),
          'delivery', case
            when delivery.id is null then null
            else jsonb_build_object(
              'status', delivery.status,
              'windowStart', delivery.window_start,
              'windowEnd', delivery.window_end
            )
          end
        ) order by sale.created_at desc
      )
      from public.orders sale
      left join public.order_deliveries delivery on delivery.order_id = sale.id
      where sale.customer_id = v_customer.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.capture_customer_payment_preference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null then
    update public.customers
    set preferred_payment_method_id = new.payment_method_id
    where id = new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_created_capture_payment_preference on public.orders;
create trigger on_order_created_capture_payment_preference
after insert on public.orders
for each row execute function public.capture_customer_payment_preference();

revoke all on function public.upsert_my_customer_profile(text, text, text, uuid, uuid) from public;
revoke all on function public.get_my_customer_portal() from public;
revoke all on function public.capture_customer_payment_preference() from public;

grant execute on function public.upsert_my_customer_profile(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.get_my_customer_portal() to authenticated;
