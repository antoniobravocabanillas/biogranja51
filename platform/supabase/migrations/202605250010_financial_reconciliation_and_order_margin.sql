-- Financial close: payment reconciliation, sales receipts and order expenses.

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id),
  amount numeric(12, 2) not null check (amount > 0),
  paid_at timestamptz not null,
  operation_reference text not null,
  evidence_reference text not null default '',
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'reconciled', 'rejected')),
  reconciliation_notes text not null default '',
  reconciled_at timestamptz,
  actor_id uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists order_payments_operation_active_uidx
  on public.order_payments (payment_method_id, lower(operation_reference))
  where status <> 'rejected';
create index if not exists order_payments_order_idx
  on public.order_payments (order_id, status, paid_at);

create table if not exists public.sales_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  receipt_type text not null check (receipt_type in ('boleta', 'factura')),
  series_number text not null,
  customer_document text,
  issued_at timestamptz not null,
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'issued' check (status in ('issued', 'voided')),
  void_reason text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_receipts_series_active_uidx
  on public.sales_receipts (series_number)
  where status = 'issued';
create unique index if not exists sales_receipts_order_active_uidx
  on public.sales_receipts (order_id)
  where status = 'issued';

create table if not exists public.order_expenses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  category text not null check (category in ('delivery', 'packaging', 'commission', 'other')),
  amount numeric(12, 2) not null check (amount > 0),
  incurred_at timestamptz not null,
  reference text not null,
  notes text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists order_expenses_order_idx
  on public.order_expenses (order_id, incurred_at);

alter table public.order_payments enable row level security;
alter table public.sales_receipts enable row level security;
alter table public.order_expenses enable row level security;

drop policy if exists "staff manage order payments" on public.order_payments;
create policy "staff manage order payments"
on public.order_payments for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "staff manage sales receipts" on public.sales_receipts;
create policy "staff manage sales receipts"
on public.sales_receipts for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "staff manage order expenses" on public.order_expenses;
create policy "staff manage order expenses"
on public.order_expenses for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop trigger if exists order_payments_touch_updated_at on public.order_payments;
create trigger order_payments_touch_updated_at before update on public.order_payments
for each row execute function public.touch_updated_at();
drop trigger if exists sales_receipts_touch_updated_at on public.sales_receipts;
create trigger sales_receipts_touch_updated_at before update on public.sales_receipts
for each row execute function public.touch_updated_at();

create or replace function public.register_order_payment(
  p_order_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_paid_at timestamptz,
  p_operation_reference text,
  p_evidence_reference text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment_id uuid;
  v_registered numeric(12, 2);
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.status = 'cancelled' then
    raise exception 'Pedido no disponible para cobranza.';
  end if;
  if v_order.total is null then
    raise exception 'Confirma el total del pedido antes de registrar pago.';
  end if;
  if not exists (select 1 from public.payment_methods where id = p_payment_method_id and active) then
    raise exception 'Medio de pago no disponible.';
  end if;
  if p_amount is null or p_amount <= 0
     or p_paid_at is null
     or length(trim(coalesce(p_operation_reference, ''))) < 2 then
    raise exception 'Registra importe, fecha y numero de operacion validos.';
  end if;
  select coalesce(sum(amount), 0) into v_registered
  from public.order_payments
  where order_id = p_order_id and status <> 'rejected';
  if v_registered + p_amount > v_order.total then
    raise exception 'Los cobros registrados superan el total del pedido.';
  end if;

  insert into public.order_payments (
    order_id, payment_method_id, amount, paid_at, operation_reference,
    evidence_reference, notes, actor_id
  ) values (
    p_order_id, p_payment_method_id, p_amount, p_paid_at,
    upper(trim(p_operation_reference)), trim(coalesce(p_evidence_reference, '')),
    trim(coalesce(p_notes, '')), auth.uid()
  ) returning id into v_payment_id;

  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_payment.registered', 'order_payments', v_payment_id,
    jsonb_build_object('order_id', p_order_id, 'amount', p_amount, 'reference', upper(trim(p_operation_reference)))
  );
  return v_payment_id;
end;
$$;

create or replace function public.review_order_payment(
  p_payment_id uuid,
  p_status text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.order_payments;
  v_order public.orders;
  v_reconciled numeric(12, 2);
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if p_status not in ('reconciled', 'rejected')
     or length(trim(coalesce(p_notes, ''))) < 3 then
    raise exception 'Documenta el resultado de conciliacion.';
  end if;
  select * into v_payment from public.order_payments where id = p_payment_id for update;
  if v_payment.id is null or v_payment.status <> 'pending' then
    raise exception 'El cobro ya fue revisado o no existe.';
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if p_status = 'reconciled' then
    select coalesce(sum(amount), 0) into v_reconciled
    from public.order_payments
    where order_id = v_payment.order_id and status = 'reconciled';
    if v_order.total is null or v_reconciled + v_payment.amount > v_order.total then
      raise exception 'La conciliacion supera el total del pedido.';
    end if;
  end if;
  update public.order_payments
  set status = p_status,
      reconciliation_notes = trim(p_notes),
      reconciled_at = case when p_status = 'reconciled' then now() else null end,
      reviewed_by = auth.uid()
  where id = p_payment_id;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_payment.reviewed', 'order_payments', p_payment_id,
    jsonb_build_object('order_id', v_payment.order_id, 'status', p_status, 'amount', v_payment.amount)
  );
  return p_payment_id;
end;
$$;

create or replace function public.issue_sales_receipt(
  p_order_id uuid,
  p_receipt_type text,
  p_series_number text,
  p_customer_document text,
  p_issued_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_receipt_id uuid;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.status = 'cancelled' or v_order.total is null then
    raise exception 'Pedido sin total valido para comprobante.';
  end if;
  if p_receipt_type not in ('boleta', 'factura')
     or length(trim(coalesce(p_series_number, ''))) < 3
     or p_issued_at is null then
    raise exception 'Registra tipo, serie y fecha del comprobante.';
  end if;
  if p_receipt_type = 'factura' and length(trim(coalesce(p_customer_document, ''))) < 8 then
    raise exception 'La factura requiere RUC valido.';
  end if;
  insert into public.sales_receipts (
    order_id, receipt_type, series_number, customer_document, issued_at, total, actor_id
  ) values (
    p_order_id, p_receipt_type, upper(trim(p_series_number)),
    nullif(trim(coalesce(p_customer_document, '')), ''), p_issued_at, v_order.total, auth.uid()
  ) returning id into v_receipt_id;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'sales_receipt.issued', 'sales_receipts', v_receipt_id,
    jsonb_build_object('order_id', p_order_id, 'type', p_receipt_type, 'series_number', upper(trim(p_series_number)), 'total', v_order.total)
  );
  return v_receipt_id;
end;
$$;

create or replace function public.record_order_expense(
  p_order_id uuid,
  p_category text,
  p_amount numeric,
  p_incurred_at timestamptz,
  p_reference text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if not exists (select 1 from public.orders where id = p_order_id and status <> 'cancelled') then
    raise exception 'Pedido no disponible para registrar gastos.';
  end if;
  if p_category not in ('delivery', 'packaging', 'commission', 'other')
     or p_amount is null or p_amount <= 0
     or p_incurred_at is null
     or length(trim(coalesce(p_reference, ''))) < 2 then
    raise exception 'Registra categoria, importe, fecha y sustento validos.';
  end if;
  insert into public.order_expenses (
    order_id, category, amount, incurred_at, reference, notes, actor_id
  ) values (
    p_order_id, p_category, p_amount, p_incurred_at,
    trim(p_reference), trim(coalesce(p_notes, '')), auth.uid()
  ) returning id into v_expense_id;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order_expense.recorded', 'order_expenses', v_expense_id,
    jsonb_build_object('order_id', p_order_id, 'category', p_category, 'amount', p_amount)
  );
  return v_expense_id;
end;
$$;

create or replace function public.void_sales_receipt(
  p_receipt_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.sales_receipts;
begin
  if not public.is_staff() then raise exception 'Acceso no autorizado.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Documenta el motivo de anulacion.';
  end if;
  select * into v_receipt from public.sales_receipts where id = p_receipt_id for update;
  if v_receipt.id is null or v_receipt.status <> 'issued' then
    raise exception 'El comprobante ya fue anulado o no existe.';
  end if;
  update public.sales_receipts
  set status = 'voided', void_reason = trim(p_reason)
  where id = p_receipt_id;
  insert into public.audit_events (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'sales_receipt.voided', 'sales_receipts', p_receipt_id,
    jsonb_build_object('order_id', v_receipt.order_id, 'series_number', v_receipt.series_number, 'reason', trim(p_reason))
  );
  return p_receipt_id;
end;
$$;

revoke all on function public.register_order_payment(uuid, uuid, numeric, timestamptz, text, text, text) from public;
revoke all on function public.review_order_payment(uuid, text, text) from public;
revoke all on function public.issue_sales_receipt(uuid, text, text, text, timestamptz) from public;
revoke all on function public.record_order_expense(uuid, text, numeric, timestamptz, text, text) from public;
revoke all on function public.void_sales_receipt(uuid, text) from public;

grant execute on function public.register_order_payment(uuid, uuid, numeric, timestamptz, text, text, text) to authenticated;
grant execute on function public.review_order_payment(uuid, text, text) to authenticated;
grant execute on function public.issue_sales_receipt(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.record_order_expense(uuid, text, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.void_sales_receipt(uuid, text) to authenticated;
