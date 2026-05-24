-- Production hardening: staff authorization, public checkout and product media.

alter table public.customers enable row level security;
alter table public.staff_roles enable row level security;

alter table public.orders alter column total drop not null;

create sequence if not exists public.order_number_seq start 1;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_assignments
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

drop policy if exists "authenticated staff manage products" on public.products;
drop policy if exists "authenticated staff manage delivery zones" on public.delivery_zones;
drop policy if exists "authenticated staff manage payment methods" on public.payment_methods;
drop policy if exists "authenticated staff view locations" on public.locations;
drop policy if exists "staff manage products" on public.products;
drop policy if exists "staff manage delivery zones" on public.delivery_zones;
drop policy if exists "staff manage payment methods" on public.payment_methods;
drop policy if exists "staff view locations" on public.locations;
drop policy if exists "staff view roles" on public.staff_roles;
drop policy if exists "staff read own assignment" on public.staff_assignments;
drop policy if exists "staff manage customers" on public.customers;
drop policy if exists "staff manage orders" on public.orders;
drop policy if exists "staff manage order items" on public.order_items;
drop policy if exists "staff manage inventory lots" on public.inventory_lots;

create policy "staff manage products"
on public.products for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage delivery zones"
on public.delivery_zones for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage payment methods"
on public.payment_methods for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff view locations"
on public.locations for select to authenticated
using ((select public.is_staff()));

create policy "staff view roles"
on public.staff_roles for select to authenticated
using ((select public.is_staff()));

create policy "staff read own assignment"
on public.staff_assignments for select to authenticated
using (user_id = (select auth.uid()));

create policy "staff manage customers"
on public.customers for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage orders"
on public.orders for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage order items"
on public.order_items for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "staff manage inventory lots"
on public.inventory_lots for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

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
  if length(trim(coalesce(p_customer_name, ''))) < 2
     or length(trim(coalesce(p_phone, ''))) < 6
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

  insert into public.customers (name, phone)
  values (trim(p_customer_name), trim(p_phone))
  returning id into v_customer_id;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads product images" on storage.objects;
drop policy if exists "staff uploads product images" on storage.objects;
drop policy if exists "staff updates product images" on storage.objects;
drop policy if exists "staff deletes product images" on storage.objects;

create policy "public reads product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "staff uploads product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (select public.is_staff()));

create policy "staff updates product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select public.is_staff()))
with check (bucket_id = 'product-images' and (select public.is_staff()));

create policy "staff deletes product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select public.is_staff()));
