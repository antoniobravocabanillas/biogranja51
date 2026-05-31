-- Private customer accounts and safe visual tracking for their own orders.

alter table public.customers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists customers_auth_user_id_uidx
  on public.customers (auth_user_id)
  where auth_user_id is not null;

create or replace function public.create_customer_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
  v_phone_normalized text;
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') <> 'customer' then
    return new;
  end if;
  v_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_phone := trim(coalesce(new.raw_user_meta_data ->> 'phone', ''));
  v_phone_normalized := regexp_replace(v_phone, '[^0-9]', '', 'g');
  if length(v_name) < 2 or length(v_phone_normalized) < 9 then
    raise exception 'Completa nombre y celular para crear tu cuenta.';
  end if;

  insert into public.customers (name, phone, email, phone_normalized, auth_user_id)
  values (v_name, v_phone, lower(new.email), v_phone_normalized, new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer_profile on auth.users;
create trigger on_auth_user_created_customer_profile
after insert on auth.users
for each row execute function public.create_customer_profile_from_auth();

create or replace function public.upsert_my_customer_profile(
  p_name text,
  p_phone text
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
begin
  if v_uid is null then raise exception 'Inicia sesion para actualizar tu perfil.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(v_phone_normalized) < 9 then
    raise exception 'Completa correctamente nombre y celular.';
  end if;

  select * into v_customer from public.customers where auth_user_id = v_uid for update;
  if v_customer.id is null then
    insert into public.customers (name, phone, email, phone_normalized, auth_user_id)
    values (trim(p_name), trim(p_phone), nullif(v_email, ''), v_phone_normalized, v_uid)
    returning * into v_customer;
  else
    update public.customers
    set name = trim(p_name),
        phone = trim(p_phone),
        email = coalesce(nullif(v_email, ''), email),
        phone_normalized = v_phone_normalized
    where id = v_customer.id
    returning * into v_customer;
  end if;

  return jsonb_build_object(
    'name', v_customer.name,
    'phone', v_customer.phone,
    'email', v_customer.email,
    'lastAddress', v_customer.last_address
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
      'lastAddress', v_customer.last_address
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

create or replace function public.create_storefront_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_delivery_zone_id uuid,
  p_payment_method_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_phone_normalized text;
  v_customer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_order public.orders;
  v_zone public.delivery_zones;
  v_payment public.payment_methods;
  v_item_count integer;
  v_subtotal numeric(12, 2);
  v_delivery_fee numeric(12, 2);
  v_total numeric(12, 2);
  v_pending boolean;
  v_number text;
begin
  v_phone_normalized := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(trim(coalesce(p_customer_name, ''))) < 2
     or length(v_phone_normalized) < 9
     or length(trim(coalesce(p_address, ''))) < 5 then
    raise exception 'Completa correctamente los datos de entrega.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega productos al pedido.';
  end if;

  select * into v_zone from public.delivery_zones where id = p_delivery_zone_id and active;
  select * into v_payment from public.payment_methods where id = p_payment_method_id and active;
  if v_zone.id is null or v_payment.id is null then raise exception 'Zona o medio de pago no disponible.'; end if;

  select count(*) into v_item_count
  from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products product on product.id = requested.product_id
  where product.active and requested.quantity between 1 and 100;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'El pedido contiene un producto o cantidad no disponible.';
  end if;

  select coalesce(sum(
      case when product.price is null then 0
        when product.price_unit = 'kg' and product.portion_grams is not null
          then product.price * (product.portion_grams / 1000.0) * requested.quantity
        else product.price * requested.quantity end
    ), 0), coalesce(bool_or(product.price is null), false)
  into v_subtotal, v_pending
  from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products product on product.id = requested.product_id;

  v_delivery_fee := case
    when not v_pending and v_zone.free_from is not null and v_subtotal >= v_zone.free_from then 0
    else v_zone.base_fee end;
  v_total := case when v_pending then null else v_subtotal + v_delivery_fee end;
  v_number := 'BG51-' || to_char(timezone('America/Lima', now()), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 6, '0');

  if v_auth_user_id is not null then
    select id into v_customer_id from public.customers where auth_user_id = v_auth_user_id;
    if v_customer_id is null then
      insert into public.customers (name, phone, email, phone_normalized, auth_user_id, last_address, last_delivery_zone_id)
      values (
        trim(p_customer_name), trim(p_phone), nullif(v_customer_email, ''),
        v_phone_normalized, v_auth_user_id, trim(p_address), p_delivery_zone_id
      )
      returning id into v_customer_id;
    else
      update public.customers
      set name = trim(p_customer_name), phone = trim(p_phone),
          email = coalesce(nullif(v_customer_email, ''), email),
          phone_normalized = v_phone_normalized, last_address = trim(p_address),
          last_delivery_zone_id = p_delivery_zone_id
      where id = v_customer_id;
    end if;
  else
    select customer.id into v_customer_id
    from public.customers customer
    where customer.auth_user_id is null
      and (
        customer.phone_normalized = v_phone_normalized
        or regexp_replace(customer.phone, '[^0-9]', '', 'g') = v_phone_normalized
      )
    order by customer.updated_at desc nulls last, customer.created_at desc
    limit 1;
    if v_customer_id is null then
      insert into public.customers (name, phone, phone_normalized, last_address, last_delivery_zone_id)
      values (trim(p_customer_name), trim(p_phone), v_phone_normalized, trim(p_address), p_delivery_zone_id)
      returning id into v_customer_id;
    else
      update public.customers
      set name = trim(p_customer_name), phone = trim(p_phone),
          phone_normalized = v_phone_normalized, last_address = trim(p_address),
          last_delivery_zone_id = p_delivery_zone_id
      where id = v_customer_id;
    end if;
  end if;

  insert into public.orders (
    number, customer_id, delivery_zone_id, payment_method_id, address,
    channel, status, subtotal, delivery_fee, total, has_pending_price
  )
  values (
    v_number, v_customer_id, p_delivery_zone_id, p_payment_method_id, trim(p_address),
    'web', 'pending_confirmation', v_subtotal, v_delivery_fee, v_total, v_pending
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, quantity, unit_price, subtotal)
  select v_order.id, product.id, requested.quantity,
    case when product.price is null then null
      when product.price_unit = 'kg' and product.portion_grams is not null then product.price * (product.portion_grams / 1000.0)
      else product.price end,
    case when product.price is null then null
      when product.price_unit = 'kg' and product.portion_grams is not null then product.price * (product.portion_grams / 1000.0) * requested.quantity
      else product.price * requested.quantity end
  from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products product on product.id = requested.product_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id::text, 'customerId', v_order.customer_id::text, 'number', v_order.number,
      'customerName', trim(p_customer_name), 'phone', trim(p_phone), 'address', v_order.address,
      'deliveryZoneId', v_order.delivery_zone_id::text, 'paymentMethodId', v_order.payment_method_id::text,
      'status', v_order.status,
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'productId', item.product_id::text, 'name', product.name, 'presentation', product.presentation,
        'quantity', item.quantity, 'unitPrice', item.unit_price, 'subtotal', item.subtotal
      )), '[]'::jsonb) from public.order_items item join public.products product on product.id = item.product_id where item.order_id = v_order.id),
      'subtotal', v_order.subtotal, 'deliveryFee', v_order.delivery_fee, 'total', v_order.total,
      'hasPendingPrice', v_order.has_pending_price, 'createdAt', v_order.created_at
    ),
    'zoneName', v_zone.name, 'paymentName', v_payment.name
  );
end;
$$;

revoke all on function public.create_customer_profile_from_auth() from public;
revoke all on function public.upsert_my_customer_profile(text, text) from public;
revoke all on function public.get_my_customer_portal() from public;
revoke all on function public.create_storefront_order(text, text, text, uuid, uuid, jsonb) from public;

grant execute on function public.upsert_my_customer_profile(text, text) to authenticated;
grant execute on function public.get_my_customer_portal() to authenticated;
grant execute on function public.create_storefront_order(text, text, text, uuid, uuid, jsonb) to anon, authenticated;
