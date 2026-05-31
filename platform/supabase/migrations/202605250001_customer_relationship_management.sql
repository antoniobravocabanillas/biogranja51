-- Customer relationship management: recurring customers, preferences and delivery context.

alter table public.customers
  add column if not exists phone_normalized text,
  add column if not exists notes text not null default '',
  add column if not exists segment text not null default 'hogar',
  add column if not exists subscription_interest boolean not null default false,
  add column if not exists last_address text,
  add column if not exists last_delivery_zone_id uuid references public.delivery_zones(id),
  add column if not exists updated_at timestamptz not null default now();

update public.customers
set phone_normalized = regexp_replace(phone, '[^0-9]', '', 'g')
where phone_normalized is null;

alter table public.customers drop constraint if exists customers_segment_check;
alter table public.customers
  add constraint customers_segment_check
  check (segment in ('hogar', 'recurrente', 'fitness', 'parrilla', 'restaurante', 'distribuidor'));

create index if not exists customers_phone_normalized_idx
  on public.customers (phone_normalized);

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
before update on public.customers
for each row execute function public.touch_updated_at();

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
  v_customer_id uuid;
  v_phone_normalized text;
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

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega productos al pedido.';
  end if;

  select *
  into v_zone
  from public.delivery_zones
  where id = p_delivery_zone_id and active;

  select *
  into v_payment
  from public.payment_methods
  where id = p_payment_method_id and active;

  if v_zone.id is null or v_payment.id is null then
    raise exception 'Zona o medio de pago no disponible.';
  end if;

  select count(*)
  into v_item_count
  from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products product on product.id = requested.product_id
  where product.active
    and requested.quantity between 1 and 100;

  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'El pedido contiene un producto o cantidad no disponible.';
  end if;

  select
    coalesce(sum(
      case
        when product.price is null then 0
        when product.price_unit = 'kg' and product.portion_grams is not null
          then product.price * (product.portion_grams / 1000.0) * requested.quantity
        else product.price * requested.quantity
      end
    ), 0),
    coalesce(bool_or(product.price is null), false)
  into v_subtotal, v_pending
  from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products product on product.id = requested.product_id;

  v_delivery_fee :=
    case
      when not v_pending and v_zone.free_from is not null and v_subtotal >= v_zone.free_from then 0
      else v_zone.base_fee
    end;
  v_total := case when v_pending then null else v_subtotal + v_delivery_fee end;
  v_number :=
    'BG51-' || to_char(timezone('America/Lima', now()), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 6, '0');

  select customer.id
  into v_customer_id
  from public.customers customer
  where customer.phone_normalized = v_phone_normalized
     or regexp_replace(customer.phone, '[^0-9]', '', 'g') = v_phone_normalized
  order by customer.updated_at desc nulls last, customer.created_at desc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      name,
      phone,
      phone_normalized,
      last_address,
      last_delivery_zone_id
    )
    values (
      trim(p_customer_name),
      trim(p_phone),
      v_phone_normalized,
      trim(p_address),
      p_delivery_zone_id
    )
    returning id into v_customer_id;
  else
    update public.customers
    set name = trim(p_customer_name),
        phone = trim(p_phone),
        phone_normalized = v_phone_normalized,
        last_address = trim(p_address),
        last_delivery_zone_id = p_delivery_zone_id
    where id = v_customer_id;
  end if;

  insert into public.orders (
    number,
    customer_id,
    delivery_zone_id,
    payment_method_id,
    address,
    channel,
    status,
    subtotal,
    delivery_fee,
    total,
    has_pending_price
  )
  values (
    v_number,
    v_customer_id,
    p_delivery_zone_id,
    p_payment_method_id,
    trim(p_address),
    'web',
    'pending_confirmation',
    v_subtotal,
    v_delivery_fee,
    v_total,
    v_pending
  )
  returning * into v_order;

  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    unit_price,
    subtotal
  )
  select
    v_order.id,
    product.id,
    requested.quantity,
    case
      when product.price is null then null
      when product.price_unit = 'kg' and product.portion_grams is not null
        then product.price * (product.portion_grams / 1000.0)
      else product.price
    end,
    case
      when product.price is null then null
      when product.price_unit = 'kg' and product.portion_grams is not null
        then product.price * (product.portion_grams / 1000.0) * requested.quantity
      else product.price * requested.quantity
    end
  from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products product on product.id = requested.product_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id::text,
      'customerId', v_order.customer_id::text,
      'number', v_order.number,
      'customerName', trim(p_customer_name),
      'phone', trim(p_phone),
      'address', v_order.address,
      'deliveryZoneId', v_order.delivery_zone_id::text,
      'paymentMethodId', v_order.payment_method_id::text,
      'status', v_order.status,
      'items', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'productId', item.product_id::text,
              'name', product.name,
              'presentation', product.presentation,
              'quantity', item.quantity,
              'unitPrice', item.unit_price,
              'subtotal', item.subtotal
            )
          ),
          '[]'::jsonb
        )
        from public.order_items item
        join public.products product on product.id = item.product_id
        where item.order_id = v_order.id
      ),
      'subtotal', v_order.subtotal,
      'deliveryFee', v_order.delivery_fee,
      'total', v_order.total,
      'hasPendingPrice', v_order.has_pending_price,
      'createdAt', v_order.created_at
    ),
    'zoneName', v_zone.name,
    'paymentName', v_payment.name
  );
end;
$$;

revoke all on function public.create_storefront_order(text, text, text, uuid, uuid, jsonb) from public;
grant execute on function public.create_storefront_order(text, text, text, uuid, uuid, jsonb)
  to anon, authenticated;
