"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  FinanceOrder,
  FinanceWorkspace,
  OrderExpenseCategory,
  PaymentMethod,
  SalesReceiptType,
} from "@/domain/commerce";
import {
  orderExpenseCategoryLabels,
  orderPaymentStatusLabels,
  orderStatusLabels,
  salesReceiptTypeLabels,
} from "@/domain/commerce";

type FinanceAdminProps = {
  workspace: FinanceWorkspace;
  paymentMethods: PaymentMethod[];
  editable: boolean;
};

function localDateValue(): string {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function money(value: number | null): string {
  return value === null ? "Pendiente" : `S/ ${value.toFixed(2)}`;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function outstanding(order: FinanceOrder): number | null {
  return order.total === null ? null : Math.max(order.total - order.reconciledAmount, 0);
}

export function FinanceAdmin({ workspace, paymentMethods, editable }: FinanceAdminProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(workspace.orders[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = workspace.orders.find((order) => order.id === selectedId) ?? workspace.orders[0] ?? null;
  const activePayments = paymentMethods.filter((method) => method.active);
  const [paymentDraft, setPaymentDraft] = useState({
    paymentMethodId: activePayments[0]?.id ?? "",
    amount: "",
    paidAt: localDateValue(),
    operationReference: "",
    evidenceReference: "",
    notes: "",
  });
  const [receiptDraft, setReceiptDraft] = useState({
    type: "boleta" as SalesReceiptType,
    seriesNumber: "",
    customerDocument: "",
    issuedAt: localDateValue(),
  });
  const [expenseDraft, setExpenseDraft] = useState({
    category: "delivery" as OrderExpenseCategory,
    amount: "",
    incurredAt: localDateValue(),
    reference: "",
    notes: "",
  });

  async function submit(path: string, body: object, success: string) {
    setSaving(true);
    setMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo completar la operacion.");
      setSaving(false);
      return false;
    }
    setMessage(success);
    setSaving(false);
    router.refresh();
    return true;
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editable) return;
    const ok = await submit("/api/finanzas/pagos", {
      orderId: selected.id,
      paymentMethodId: paymentDraft.paymentMethodId,
      amount: Number(paymentDraft.amount),
      paidAt: new Date(paymentDraft.paidAt).toISOString(),
      operationReference: paymentDraft.operationReference,
      evidenceReference: paymentDraft.evidenceReference,
      notes: paymentDraft.notes,
    }, "Cobro registrado para conciliacion.");
    if (ok) setPaymentDraft({ ...paymentDraft, amount: "", operationReference: "", evidenceReference: "", notes: "" });
  }

  async function reconcile(paymentId: string, status: "reconciled" | "rejected") {
    if (!editable) return;
    const notes = window.prompt(
      status === "reconciled" ? "Sustento de conciliacion bancaria o billetera:" : "Motivo del rechazo:",
    );
    if (!notes?.trim()) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/finanzas/pagos/${paymentId}/conciliacion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes: notes.trim() }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo conciliar el cobro.");
      setSaving(false);
      return;
    }
    setMessage(status === "reconciled" ? "Cobro conciliado." : "Cobro rechazado.");
    setSaving(false);
    router.refresh();
  }

  async function addReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editable) return;
    const ok = await submit("/api/finanzas/comprobantes", {
      orderId: selected.id,
      ...receiptDraft,
      issuedAt: new Date(receiptDraft.issuedAt).toISOString(),
    }, "Comprobante de venta registrado.");
    if (ok) setReceiptDraft({ ...receiptDraft, seriesNumber: "", customerDocument: "" });
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editable) return;
    const ok = await submit("/api/finanzas/gastos", {
      orderId: selected.id,
      ...expenseDraft,
      amount: Number(expenseDraft.amount),
      incurredAt: new Date(expenseDraft.incurredAt).toISOString(),
    }, "Gasto incorporado al margen del pedido.");
    if (ok) setExpenseDraft({ ...expenseDraft, amount: "", reference: "", notes: "" });
  }

  async function voidReceipt(receiptId: string) {
    if (!editable) return;
    const reason = window.prompt("Motivo de anulacion del comprobante:");
    if (!reason?.trim()) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/finanzas/comprobantes/${receiptId}/anulacion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo anular el comprobante.");
      setSaving(false);
      return;
    }
    setMessage("Comprobante anulado. Registra el reemplazo correspondiente.");
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="finance-workspace">
      <div className="inventory-kpis">
        <article><span>Cobrado conciliado</span><strong>{money(workspace.reconciledRevenue)}</strong><small>Pagos confirmados</small></article>
        <article><span>Por cobrar</span><strong>{money(workspace.accountsReceivable)}</strong><small>Saldo de pedidos activos</small></article>
        <article><span>Costo de lotes</span><strong>{money(workspace.registeredCost)}</strong><small>Stock asignado y valorizado</small></article>
        <article><span>Gasto operativo</span><strong>{money(workspace.operatingCost)}</strong><small>Reparto, empaque y comisiones</small></article>
        <article><span>Margen auditado</span><strong>{money(workspace.auditableMargin)}</strong><small>Entregado, cobrado y costeado</small></article>
        <article><span>Conciliacion pendiente</span><strong>{workspace.pendingReconciliationCount}</strong><small>{workspace.missingReceiptCount} entregas sin comprobante</small></article>
      </div>

      <div className="finance-grid">
        <section className="records-panel finance-orders">
          <div className="panel-heading"><div><p className="eyebrow">Cierre de ventas</p><h2>{workspace.orders.length} pedidos</h2></div></div>
          {workspace.orders.length ? workspace.orders.map((order) => (
            <button className={selected?.id === order.id ? "selected" : ""} key={order.id} type="button" onClick={() => setSelectedId(order.id)}>
              <div><strong>{order.number}</strong><small>{order.customerName} | {orderStatusLabels[order.status]}</small></div>
              <span>{money(order.reconciledAmount)} cobrado</span>
              <b>{outstanding(order) === null ? "Total pendiente" : `${money(outstanding(order))} saldo`}</b>
            </button>
          )) : <p className="empty-history">Todavia no hay pedidos para cierre financiero.</p>}
        </section>

        <section className="settings-panel finance-detail">
          {selected ? (
            <>
              <div className="panel-heading">
                <div><p className="eyebrow">Expediente financiero</p><h2>{selected.number}</h2></div>
                <span className={`order-status status-${selected.status}`}>{orderStatusLabels[selected.status]}</span>
              </div>
              <dl className="finance-margin">
                <div><dt>Venta</dt><dd>{money(selected.total)}</dd></div>
                <div><dt>Costo lote</dt><dd>{money(selected.stockCost)}</dd></div>
                <div><dt>Gastos</dt><dd>{money(selected.operatingCost)}</dd></div>
                <div className="total"><dt>Margen registrado</dt><dd>{money(selected.margin)}</dd></div>
              </dl>
              <div className="finance-cost-items">
                <h3>Margen base por producto y lote</h3>
                {selected.items.map((item) => (
                  <article key={`${item.productId}-${item.lotCode ?? "sin-lote"}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.lotCode ? `Lote ${item.lotCode}` : "Sin lote asignado"}</small>
                    </div>
                    <span>Venta {money(item.subtotal)}</span>
                    <span>Costo {money(item.costTotal)}</span>
                    <b>
                      {item.subtotal !== null && item.costTotal !== null
                        ? money(item.subtotal - item.costTotal)
                        : "Pendiente"}
                    </b>
                  </article>
                ))}
              </div>

              <form className="finance-form" onSubmit={addPayment}>
                <h3>Registrar cobro</h3>
                <div className="field-pair">
                  <label className="form-field"><span>Medio</span><select value={paymentDraft.paymentMethodId} onChange={(event) => setPaymentDraft({ ...paymentDraft, paymentMethodId: event.target.value })}>{activePayments.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
                  <label className="form-field"><span>Importe S/</span><input required type="number" min="0.01" step="0.01" value={paymentDraft.amount} onChange={(event) => setPaymentDraft({ ...paymentDraft, amount: event.target.value })} /></label>
                </div>
                <div className="field-pair">
                  <label className="form-field"><span>Fecha de pago</span><input type="datetime-local" required value={paymentDraft.paidAt} onChange={(event) => setPaymentDraft({ ...paymentDraft, paidAt: event.target.value })} /></label>
                  <label className="form-field"><span>Nro. operacion</span><input required value={paymentDraft.operationReference} onChange={(event) => setPaymentDraft({ ...paymentDraft, operationReference: event.target.value })} /></label>
                </div>
                <label className="form-field"><span>Constancia / referencia</span><input value={paymentDraft.evidenceReference} onChange={(event) => setPaymentDraft({ ...paymentDraft, evidenceReference: event.target.value })} placeholder="Captura, archivo o referencia recibida" /></label>
                <label className="form-field"><span>Observacion</span><input value={paymentDraft.notes} onChange={(event) => setPaymentDraft({ ...paymentDraft, notes: event.target.value })} /></label>
                <button className="save-button" disabled={!editable || saving} type="submit">Registrar cobro</button>
              </form>

              <div className="finance-payments">
                <h3>Cobros y conciliacion</h3>
                {selected.payments.length ? selected.payments.map((payment) => (
                  <article key={payment.id}>
                    <div><strong>{money(payment.amount)} | {payment.paymentMethodName}</strong><small>{payment.operationReference} | {dateLabel(payment.paidAt)}</small></div>
                    <span className={`quality-pill quality-${payment.status === "reconciled" ? "approved" : payment.status}`}>{orderPaymentStatusLabels[payment.status]}</span>
                    {payment.status === "pending" ? <div className="quality-actions"><button disabled={!editable || saving} type="button" onClick={() => reconcile(payment.id, "reconciled")}>Conciliar</button><button disabled={!editable || saving} type="button" onClick={() => reconcile(payment.id, "rejected")}>Rechazar</button></div> : null}
                  </article>
                )) : <p className="empty-history">No hay cobros registrados.</p>}
              </div>

              {selected.receipt ? (
                <div className="finance-receipt">
                  <p>{salesReceiptTypeLabels[selected.receipt.type]} {selected.receipt.seriesNumber} | {money(selected.receipt.total)} | {dateLabel(selected.receipt.issuedAt)}</p>
                  <button disabled={!editable || saving} type="button" onClick={() => voidReceipt(selected.receipt!.id)}>Anular</button>
                </div>
              ) : (
                <form className="finance-form" onSubmit={addReceipt}>
                  <h3>Emitir comprobante de venta</h3>
                  <div className="field-pair">
                    <label className="form-field"><span>Tipo</span><select value={receiptDraft.type} onChange={(event) => setReceiptDraft({ ...receiptDraft, type: event.target.value as SalesReceiptType })}>{Object.entries(salesReceiptTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
                    <label className="form-field"><span>Serie y numero</span><input required value={receiptDraft.seriesNumber} onChange={(event) => setReceiptDraft({ ...receiptDraft, seriesNumber: event.target.value })} placeholder="B001-000001" /></label>
                  </div>
                  <div className="field-pair">
                    <label className="form-field"><span>RUC / documento</span><input value={receiptDraft.customerDocument} onChange={(event) => setReceiptDraft({ ...receiptDraft, customerDocument: event.target.value })} /></label>
                    <label className="form-field"><span>Fecha emision</span><input type="datetime-local" required value={receiptDraft.issuedAt} onChange={(event) => setReceiptDraft({ ...receiptDraft, issuedAt: event.target.value })} /></label>
                  </div>
                  <button className="save-button" disabled={!editable || saving || selected.total === null} type="submit">Registrar comprobante</button>
                </form>
              )}

              <form className="finance-form" onSubmit={addExpense}>
                <h3>Registrar gasto del pedido</h3>
                <div className="field-pair">
                  <label className="form-field"><span>Categoria</span><select value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value as OrderExpenseCategory })}>{Object.entries(orderExpenseCategoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <label className="form-field"><span>Importe S/</span><input required type="number" min="0.01" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })} /></label>
                </div>
                <div className="field-pair">
                  <label className="form-field"><span>Fecha</span><input type="datetime-local" required value={expenseDraft.incurredAt} onChange={(event) => setExpenseDraft({ ...expenseDraft, incurredAt: event.target.value })} /></label>
                  <label className="form-field"><span>Sustento</span><input required value={expenseDraft.reference} onChange={(event) => setExpenseDraft({ ...expenseDraft, reference: event.target.value })} /></label>
                </div>
                <label className="form-field"><span>Nota</span><input value={expenseDraft.notes} onChange={(event) => setExpenseDraft({ ...expenseDraft, notes: event.target.value })} /></label>
                <button className="save-button" disabled={!editable || saving} type="submit">Incorporar costo</button>
              </form>
              <div className="finance-expenses">
                <h3>Gastos registrados</h3>
                {selected.expenses.length ? selected.expenses.map((expense) => (
                  <article key={expense.id}>
                    <span>{orderExpenseCategoryLabels[expense.category]}</span>
                    <small>{expense.reference} | {dateLabel(expense.incurredAt)}</small>
                    <strong>{money(expense.amount)}</strong>
                  </article>
                )) : <p className="empty-history">Sin gastos operativos registrados.</p>}
              </div>
              {message ? <p className="form-message">{message}</p> : null}
            </>
          ) : <p className="empty-history">Selecciona un pedido.</p>}
        </section>
      </div>
    </section>
  );
}
