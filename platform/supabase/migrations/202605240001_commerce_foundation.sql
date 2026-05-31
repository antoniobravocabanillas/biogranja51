create extension if not exists pgcrypto;

create type public.origin_type as enum ('own', 'selected_supplier', 'partner_farm', 'pending_confirmation');
create type public.location_type as enum ('store', 'warehouse', 'mill', 'farm');
create type public.order_status as enum (
  'draft',
  'pending_confirmation',
  'confirmed',
  'preparing',
  'dispatched',
  'delivered',
  'cancelled'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null unique,
  name text not null,
  type public.location_type not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  origin_type public.origin_type not null,
  description text not null default '',
  presentation text not null,
  price_unit text not null check (price_unit in ('unit', 'maple', 'kg')),
  price numeric(12, 2),
  portion_grams integer check (portion_grams is null or portion_grams > 0),
  image_url text,
  active boolean not null default true,
  subscription_eligible boolean not null default false,
  traceable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  neighborhoods text not null,
  base_fee numeric(12, 2) not null check (base_fee >= 0),
  free_from numeric(12, 2) check (free_from is null or free_from >= 0),
  subscription_available boolean not null default true,
  active boolean not null default true
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  instructions text not null default '',
  active boolean not null default true
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  document text,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid references public.customers(id),
  location_id uuid references public.locations(id),
  delivery_zone_id uuid references public.delivery_zones(id),
  payment_method_id uuid references public.payment_methods(id),
  address text,
  channel text not null default 'web',
  status public.order_status not null default 'draft',
  subtotal numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  has_pending_price boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  lot_id uuid,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2),
  subtotal numeric(12, 2),
  created_at timestamptz not null default now()
);

create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  product_id uuid not null references public.products(id),
  origin_type public.origin_type not null,
  supplier_name text,
  location_id uuid not null references public.locations(id),
  quantity numeric(12, 3) not null default 0,
  unit text not null,
  unit_cost numeric(12, 2),
  produced_or_received_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.order_items
  add constraint order_items_lot_fk
  foreign key (lot_id) references public.inventory_lots(id);

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  scope text not null
);

create table public.staff_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.staff_roles(id),
  location_id uuid references public.locations(id),
  primary key (user_id, role_id, location_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at
before update on public.products
for each row execute function public.touch_updated_at();

alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.payment_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.locations enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.audit_events enable row level security;

create policy "public reads active products"
on public.products for select
using (active);

create policy "public reads active delivery zones"
on public.delivery_zones for select
using (active);

create policy "public reads active payment methods"
on public.payment_methods for select
using (active);

create policy "authenticated staff manage products"
on public.products for all to authenticated
using (
  exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid())
)
with check (
  exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid())
);

create policy "authenticated staff manage delivery zones"
on public.delivery_zones for all to authenticated
using (
  exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid())
)
with check (
  exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid())
);

create policy "authenticated staff manage payment methods"
on public.payment_methods for all to authenticated
using (
  exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid())
)
with check (
  exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid())
);

create policy "authenticated staff view locations"
on public.locations for select to authenticated
using (
  exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid())
);

insert into public.organizations (id, name, tax_id)
values ('00000000-0000-0000-0000-000000000051', 'BioGranja 51 E.I.R.L.', '20614927993');

insert into public.locations (organization_id, code, name, type, address) values
('00000000-0000-0000-0000-000000000051', 'TIENDA-01', 'Comercializadora BioGranja 51', 'store', 'Trujillo - dirección por registrar'),
('00000000-0000-0000-0000-000000000051', 'MOLINO-01', 'Almacén y molino', 'mill', 'Ubicación por registrar'),
('00000000-0000-0000-0000-000000000051', 'GRANJA-01', 'Unidad productiva avícola', 'farm', 'Ubicación por registrar');

insert into public.products
  (sku, name, category, origin_type, description, presentation, price_unit, price, portion_grams, subscription_eligible)
values
  ('POL-ENTERO', 'Pollo entero', 'Pollo', 'own', 'Pollo criado en BioGranja 51 con alimentación controlada por etapa.', 'Entero, peso final confirmado', 'kg', null, null, true),
  ('HUE-MAPLE-30', 'Huevos frescos', 'Huevos', 'pending_confirmation', 'Maple completo de huevos frescos, clasificados para despacho.', 'Maple completo de 30 unidades', 'maple', null, null, true),
  ('RES-POR-500', 'Res seleccionada', 'Res', 'selected_supplier', 'Carne de res adquirida a proveedor evaluado.', 'Porción de 500 g', 'kg', null, 500, true),
  ('CER-POR-500', 'Cerdo seleccionado', 'Cerdo', 'selected_supplier', 'Carne de cerdo de proveedor evaluado.', 'Porción de 500 g', 'kg', null, 500, true),
  ('CUY-ENTERO', 'Cuy entero', 'Cuy', 'pending_confirmation', 'Cuy entero fresco para preparaciones tradicionales.', 'Unidad entera', 'unit', 35, null, false);

insert into public.delivery_zones
  (code, name, neighborhoods, base_fee, free_from, subscription_available)
values
  ('TRU-CENTRAL', 'Trujillo urbano central', 'Centro, San Andrés, La Merced, Primavera', 8, 160, true),
  ('VLA-CALIF', 'Víctor Larco y California', 'California, El Golf, Las Flores, Buenos Aires', 10, 190, true),
  ('TRU-URBAN', 'Urbanizaciones norte y este', 'Las Quintanas, Santa Inés, Los Cedros, Palermo', 10, 190, true);

insert into public.payment_methods (code, name, instructions) values
  ('YAPE', 'Yape', 'Confirmación mediante comprobante de pago.'),
  ('PLIN', 'Plin', 'Confirmación mediante comprobante de pago.'),
  ('TRANSFERENCIA', 'Transferencia bancaria', 'Confirmación antes del despacho.');

insert into public.staff_roles (code, name, scope) values
  ('ADMIN', 'Administrador', 'Empresa completa'),
  ('VENTAS', 'Ventas', 'Tienda asignada'),
  ('ALMACEN', 'Almacén / Molino', 'Almacén asignado');
