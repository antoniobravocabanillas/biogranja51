-- Mill inputs, priced feed formulas, approval control, and internal feed lots.
-- Initial formulas are transcribed from Alimentacion Actual.xlsx as draft versions.

create sequence if not exists public.mill_batch_number_seq start 1;

create table if not exists public.feed_inputs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'kg' check (unit = 'kg'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_input_prices (
  id uuid primary key default gen_random_uuid(),
  input_id uuid not null references public.feed_inputs(id) on delete cascade,
  cost_per_kg numeric(14, 4) not null check (cost_per_kg >= 0),
  effective_at timestamptz not null,
  supplier_name text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.feed_formulas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  species text not null default 'broiler',
  stage text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_formula_versions (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.feed_formulas(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  target_kg numeric(12, 3) not null check (target_kg > 0),
  notes text not null default '',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (formula_id, version)
);

create table if not exists public.feed_formula_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.feed_formula_versions(id) on delete cascade,
  input_id uuid not null references public.feed_inputs(id),
  quantity_kg numeric(12, 4) not null check (quantity_kg >= 0),
  percentage numeric(12, 6) not null check (percentage >= 0),
  unique (version_id, input_id)
);

create table if not exists public.mill_batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  version_id uuid not null references public.feed_formula_versions(id),
  location_id uuid not null references public.locations(id),
  usage text not null check (usage in ('internal_broiler', 'internal_layers', 'external_service')),
  produced_kg numeric(12, 3) not null check (produced_kg > 0),
  total_cost numeric(14, 2) not null check (total_cost >= 0),
  cost_per_kg numeric(14, 4) not null check (cost_per_kg >= 0),
  produced_at timestamptz not null,
  notes text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.feed_inputs enable row level security;
alter table public.feed_input_prices enable row level security;
alter table public.feed_formulas enable row level security;
alter table public.feed_formula_versions enable row level security;
alter table public.feed_formula_items enable row level security;
alter table public.mill_batches enable row level security;

drop policy if exists "staff manage feed inputs" on public.feed_inputs;
drop policy if exists "staff manage feed input prices" on public.feed_input_prices;
drop policy if exists "staff manage feed formulas" on public.feed_formulas;
drop policy if exists "staff manage feed formula versions" on public.feed_formula_versions;
drop policy if exists "staff manage feed formula items" on public.feed_formula_items;
drop policy if exists "staff manage mill batches" on public.mill_batches;

create policy "staff manage feed inputs" on public.feed_inputs for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage feed input prices" on public.feed_input_prices for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage feed formulas" on public.feed_formulas for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage feed formula versions" on public.feed_formula_versions for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage feed formula items" on public.feed_formula_items for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage mill batches" on public.mill_batches for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));

drop trigger if exists feed_inputs_touch_updated_at on public.feed_inputs;
create trigger feed_inputs_touch_updated_at before update on public.feed_inputs
for each row execute function public.touch_updated_at();
drop trigger if exists feed_formulas_touch_updated_at on public.feed_formulas;
create trigger feed_formulas_touch_updated_at before update on public.feed_formulas
for each row execute function public.touch_updated_at();

insert into public.feed_inputs (name) values
  ('Maiz Molino'), ('Soya'), ('Harina de pescado'), ('Afrecho de trigo'),
  ('Harina de alfalfa'), ('Nucleo Inicio (27 kg /TM)'), ('Nucleo ACABADO (19 kg /TM)'),
  ('Carbonato de calcio'), ('Phosbic'), ('Sal yodada'), ('Aceite vegetal'),
  ('Aceite de palma'), ('Melaza'), ('Metionina'), ('Natuzyme'), ('Promotor'),
  ('Lisina'), ('Treonina'), ('Achiote'), ('Oregano'), ('Curcuma'), ('Paprika')
on conflict (name) do nothing;

with reference_prices(name, cost_per_kg) as (
  values
    ('Maiz Molino', 1.4000::numeric), ('Soya', 1.7000), ('Harina de pescado', 3.0000),
    ('Afrecho de trigo', 1.5250), ('Nucleo Inicio (27 kg /TM)', 12.0796),
    ('Nucleo ACABADO (19 kg /TM)', 10.0152), ('Carbonato de calcio', 0.3000),
    ('Phosbic', 1.6494), ('Sal yodada', 0.5400), ('Aceite vegetal', 6.4500),
    ('Aceite de palma', 7.3000), ('Melaza', 1.5000), ('Metionina', 13.0000),
    ('Natuzyme', 13.0000), ('Promotor', 13.0000), ('Lisina', 10.0000),
    ('Treonina', 10.0000), ('Achiote', 20.0000), ('Oregano', 15.0000),
    ('Curcuma', 12.0000), ('Paprika', 24.0000)
)
insert into public.feed_input_prices (input_id, cost_per_kg, effective_at, supplier_name)
select input.id, price.cost_per_kg, '2026-05-25 00:00:00-05'::timestamptz, 'Referencia Alimentacion Actual.xlsx'
from reference_prices price
join public.feed_inputs input on input.name = price.name
where not exists (select 1 from public.feed_input_prices existing where existing.input_id = input.id);

insert into public.feed_formulas (code, name, species, stage) values
  ('BRO-INI', 'Etapa I - Inicio', 'broiler', 'Dia 8 al 21'),
  ('BRO-CRE', 'Etapa II - Crecimiento', 'broiler', 'Dia 22 al 36'),
  ('BRO-ENG', 'Etapa III - Engorde', 'broiler', 'Dia 37 al 45'),
  ('BRO-MAN', 'Etapa IV - Mantenimiento', 'broiler', 'Dia 45 al 70')
on conflict (code) do nothing;

insert into public.feed_formula_versions (formula_id, version, status, target_kg, notes)
select id, 1, 'draft', 40, 'Importada de Alimentacion Actual.xlsx. Revisar total y precios antes de aprobar.'
from public.feed_formulas
where code in ('BRO-INI', 'BRO-CRE', 'BRO-ENG', 'BRO-MAN')
on conflict (formula_id, version) do nothing;

with initial_items(formula_code, input_name, quantity_kg) as (
  values
    ('BRO-INI', 'Maiz Molino', 21.5720::numeric), ('BRO-INI', 'Soya', 10.8000),
    ('BRO-INI', 'Harina de pescado', 2.2400), ('BRO-INI', 'Afrecho de trigo', 1.2000),
    ('BRO-INI', 'Harina de alfalfa', 0.0000), ('BRO-INI', 'Nucleo Inicio (27 kg /TM)', 1.0800),
    ('BRO-INI', 'Carbonato de calcio', 0.6400), ('BRO-INI', 'Phosbic', 0.5600),
    ('BRO-INI', 'Sal yodada', 0.1440), ('BRO-INI', 'Aceite vegetal', 0.6400),
    ('BRO-INI', 'Aceite de palma', 0.4800), ('BRO-INI', 'Melaza', 0.4000),
    ('BRO-INI', 'Metionina', 0.0360), ('BRO-INI', 'Natuzyme', 0.0140),
    ('BRO-INI', 'Promotor', 0.0080), ('BRO-INI', 'Lisina', 0.0560),
    ('BRO-INI', 'Treonina', 0.0096), ('BRO-INI', 'Achiote', 0.0240),
    ('BRO-INI', 'Oregano', 0.0800), ('BRO-INI', 'Curcuma', 0.0160),
    ('BRO-INI', 'Paprika', 0.0000),
    ('BRO-CRE', 'Maiz Molino', 22.3400), ('BRO-CRE', 'Soya', 9.6000),
    ('BRO-CRE', 'Harina de pescado', 2.4000), ('BRO-CRE', 'Afrecho de trigo', 2.0000),
    ('BRO-CRE', 'Harina de alfalfa', 0.0000), ('BRO-CRE', 'Nucleo Inicio (27 kg /TM)', 0.9200),
    ('BRO-CRE', 'Carbonato de calcio', 0.6400), ('BRO-CRE', 'Phosbic', 0.5600),
    ('BRO-CRE', 'Sal yodada', 0.2000), ('BRO-CRE', 'Aceite vegetal', 0.4800),
    ('BRO-CRE', 'Aceite de palma', 1.1200), ('BRO-CRE', 'Melaza', 0.3200),
    ('BRO-CRE', 'Metionina', 0.0350), ('BRO-CRE', 'Natuzyme', 0.0175),
    ('BRO-CRE', 'Promotor', 0.0100), ('BRO-CRE', 'Lisina', 0.0500),
    ('BRO-CRE', 'Treonina', 0.0120), ('BRO-CRE', 'Achiote', 0.0240),
    ('BRO-CRE', 'Oregano', 0.0800), ('BRO-CRE', 'Curcuma', 0.0160),
    ('BRO-CRE', 'Paprika', 0.0000),
    ('BRO-ENG', 'Maiz Molino', 24.4000), ('BRO-ENG', 'Soya', 8.4000),
    ('BRO-ENG', 'Harina de pescado', 1.6000), ('BRO-ENG', 'Afrecho de trigo', 1.6000),
    ('BRO-ENG', 'Harina de alfalfa', 0.0000), ('BRO-ENG', 'Nucleo ACABADO (19 kg /TM)', 0.7600),
    ('BRO-ENG', 'Carbonato de calcio', 0.4000), ('BRO-ENG', 'Phosbic', 0.3600),
    ('BRO-ENG', 'Sal yodada', 0.2000), ('BRO-ENG', 'Aceite vegetal', 0.4000),
    ('BRO-ENG', 'Aceite de palma', 1.4400), ('BRO-ENG', 'Melaza', 0.3200),
    ('BRO-ENG', 'Metionina', 0.0280), ('BRO-ENG', 'Natuzyme', 0.0140),
    ('BRO-ENG', 'Promotor', 0.0080), ('BRO-ENG', 'Lisina', 0.0400),
    ('BRO-ENG', 'Treonina', 0.0096), ('BRO-ENG', 'Achiote', 0.1600),
    ('BRO-ENG', 'Oregano', 0.1600), ('BRO-ENG', 'Curcuma', 0.0800),
    ('BRO-ENG', 'Paprika', 0.0800),
    ('BRO-MAN', 'Maiz Molino', 25.6120), ('BRO-MAN', 'Soya', 5.6000),
    ('BRO-MAN', 'Harina de pescado', 0.6000), ('BRO-MAN', 'Afrecho de trigo', 5.6000),
    ('BRO-MAN', 'Harina de alfalfa', 0.0000), ('BRO-MAN', 'Nucleo ACABADO (19 kg /TM)', 0.6000),
    ('BRO-MAN', 'Carbonato de calcio', 0.4000), ('BRO-MAN', 'Phosbic', 0.4000),
    ('BRO-MAN', 'Sal yodada', 0.2000), ('BRO-MAN', 'Aceite vegetal', 0.2000),
    ('BRO-MAN', 'Aceite de palma', 0.6000), ('BRO-MAN', 'Melaza', 0.1200),
    ('BRO-MAN', 'Metionina', 0.0200), ('BRO-MAN', 'Natuzyme', 0.0080),
    ('BRO-MAN', 'Promotor', 0.0000), ('BRO-MAN', 'Lisina', 0.0320),
    ('BRO-MAN', 'Treonina', 0.0080), ('BRO-MAN', 'Achiote', 0.0800),
    ('BRO-MAN', 'Oregano', 0.0800), ('BRO-MAN', 'Curcuma', 0.0400),
    ('BRO-MAN', 'Paprika', 0.0400)
)
insert into public.feed_formula_items (version_id, input_id, quantity_kg, percentage)
select version.id, input.id, item.quantity_kg, round((item.quantity_kg / version.target_kg) * 100, 6)
from initial_items item
join public.feed_formulas formula on formula.code = item.formula_code
join public.feed_formula_versions version on version.formula_id = formula.id and version.version = 1
join public.feed_inputs input on input.name = item.input_name
on conflict (version_id, input_id) do nothing;

create or replace function public.register_feed_input_price(
  p_input_id uuid,
  p_cost_per_kg numeric,
  p_effective_at timestamptz,
  p_supplier_name text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_price_id uuid;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if not exists (select 1 from public.feed_inputs where id = p_input_id and active) then
    raise exception 'Insumo no disponible.';
  end if;
  if p_cost_per_kg is null or p_cost_per_kg < 0 or p_effective_at is null then
    raise exception 'Registra costo y fecha validos.';
  end if;
  insert into public.feed_input_prices (input_id, cost_per_kg, effective_at, supplier_name, actor_id)
  values (p_input_id, p_cost_per_kg, p_effective_at, nullif(trim(coalesce(p_supplier_name, '')), ''), auth.uid())
  returning id into v_price_id;
  return v_price_id;
end; $$;

create or replace function public.create_feed_formula_version(
  p_formula_id uuid,
  p_target_kg numeric,
  p_notes text,
  p_items jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_version public.feed_formula_versions; v_item jsonb;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if not exists (select 1 from public.feed_formulas where id = p_formula_id and active) then
    raise exception 'Formula no disponible.';
  end if;
  if p_target_kg is null or p_target_kg <= 0 or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Registra objetivo e ingredientes.';
  end if;
  insert into public.feed_formula_versions (formula_id, version, status, target_kg, notes)
  select p_formula_id, coalesce(max(version), 0) + 1, 'draft', p_target_kg, trim(coalesce(p_notes, ''))
  from public.feed_formula_versions where formula_id = p_formula_id
  returning * into v_version;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantityKg')::numeric < 0 then raise exception 'Cantidad de insumo invalida.'; end if;
    insert into public.feed_formula_items (version_id, input_id, quantity_kg, percentage)
    values (
      v_version.id, (v_item->>'inputId')::uuid, (v_item->>'quantityKg')::numeric,
      round(((v_item->>'quantityKg')::numeric / p_target_kg) * 100, 6)
    );
  end loop;
  return v_version.id;
end; $$;

create or replace function public.approve_feed_formula_version(p_version_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_version public.feed_formula_versions; v_total numeric; v_missing integer;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_version from public.feed_formula_versions where id = p_version_id for update;
  if v_version.id is null then raise exception 'Version no encontrada.'; end if;
  select coalesce(sum(quantity_kg), 0) into v_total from public.feed_formula_items where version_id = p_version_id;
  if abs(v_total - v_version.target_kg) > 0.01 then
    raise exception 'La formula debe totalizar exactamente el lote objetivo.';
  end if;
  select count(*) into v_missing
  from public.feed_formula_items item
  where item.version_id = p_version_id and item.quantity_kg > 0
    and not exists (select 1 from public.feed_input_prices price where price.input_id = item.input_id);
  if v_missing > 0 then raise exception 'Todos los insumos usados requieren precio vigente.'; end if;
  update public.feed_formula_versions set status = 'archived'
  where formula_id = v_version.formula_id and status = 'approved' and id <> p_version_id;
  update public.feed_formula_versions set status = 'approved', approved_at = now(), approved_by = auth.uid()
  where id = p_version_id;
  return p_version_id;
end; $$;

create or replace function public.create_mill_batch(
  p_version_id uuid,
  p_location_id uuid,
  p_usage text,
  p_produced_kg numeric,
  p_produced_at timestamptz,
  p_notes text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_version public.feed_formula_versions; v_cost numeric; v_batch public.mill_batches;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_version from public.feed_formula_versions where id = p_version_id and status = 'approved';
  if v_version.id is null then raise exception 'Selecciona una formula aprobada.'; end if;
  if not exists (select 1 from public.locations where id = p_location_id and active and type = 'mill') then
    raise exception 'Selecciona la sede de molino.';
  end if;
  if p_usage not in ('internal_broiler', 'internal_layers', 'external_service')
     or p_produced_kg is null or p_produced_kg <= 0 then
    raise exception 'Registra destino y cantidad producida.';
  end if;
  select sum(item.quantity_kg * price.cost_per_kg) into v_cost
  from public.feed_formula_items item
  join lateral (
    select cost_per_kg from public.feed_input_prices
    where input_id = item.input_id order by effective_at desc, created_at desc limit 1
  ) price on true
  where item.version_id = p_version_id;
  if v_cost is null then raise exception 'No es posible costear la formula.'; end if;
  insert into public.mill_batches (
    code, version_id, location_id, usage, produced_kg, total_cost, cost_per_kg,
    produced_at, notes, actor_id
  ) values (
    'BG51-MOL-' || to_char(timezone('America/Lima', now()), 'YYMMDD') || '-' ||
      lpad(nextval('public.mill_batch_number_seq')::text, 5, '0'),
    p_version_id, p_location_id, p_usage, p_produced_kg,
    round((v_cost / v_version.target_kg) * p_produced_kg, 2),
    round(v_cost / v_version.target_kg, 4), p_produced_at,
    trim(coalesce(p_notes, '')), auth.uid()
  ) returning * into v_batch;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (auth.uid(), 'mill_batch.created', 'mill_batches', v_batch.id,
    jsonb_build_object('code', v_batch.code, 'produced_kg', p_produced_kg, 'cost_per_kg', v_batch.cost_per_kg));
  return v_batch.id;
end; $$;

revoke all on function public.register_feed_input_price(uuid, numeric, timestamptz, text) from public;
revoke all on function public.create_feed_formula_version(uuid, numeric, text, jsonb) from public;
revoke all on function public.approve_feed_formula_version(uuid) from public;
revoke all on function public.create_mill_batch(uuid, uuid, text, numeric, timestamptz, text) from public;
grant execute on function public.register_feed_input_price(uuid, numeric, timestamptz, text) to authenticated;
grant execute on function public.create_feed_formula_version(uuid, numeric, text, jsonb) to authenticated;
grant execute on function public.approve_feed_formula_version(uuid) to authenticated;
grant execute on function public.create_mill_batch(uuid, uuid, text, numeric, timestamptz, text) to authenticated;
