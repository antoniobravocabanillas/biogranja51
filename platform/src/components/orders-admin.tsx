"use client";

import { useMemo, useState } from "react";
import type {
  DeliveryZone,
  Order,
  OrderStatus,
  PaymentMethod,
} from "@/domain/commerce";
import {
  orderStatusActions,
  orderStatusLabels,
  orderStatuses,
} from "@/domain/commerce";

type OrdersAdminProps = {
  initialOrders: Order[];
  deliveryZones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
  editable: boolean;
};

function currency(value: number | null): string {
  return value === null ? "Por confirmar" : `S/ ${value.toFixed(2)}`;
}

function orderDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export function OrdersAdmin({
  initialOrders,
  deliveryZones,
  paymentMethods,
  editable,
}: OrdersAdminProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [selectedId, setSelectedId] = useState(initialOrders[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleOrders = useMemo(
    () => orders.filter((order) => filter === "all" || order.status === filter),
    [filter, orders],
  );
  const selected =
    visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0] ?? null;

  async function changeStatus(nextStatus: OrderStatus) {
    if (!selected || !editable) {
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/pedidos/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = (await response.json()) as Order & { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo actualizar el pedido.");
      setSaving(false);
      return;
    }
    setOrders((current) =>
      current.map((order) => (order.id === result.id ? result : order)),
    );
    setMessage(`Pedido ${result.number}: ${orderStatusLabels[result.status]}.`);
    setSaving(false);
  }

  function zoneName(id: string): string {
    return deliveryZones.find((zone) => zone.id === id)?.name ?? "Zona no registrada";
  }

  function paymentName(id: string): string {
    return paymentMethods.find((payment) => payment.id === id)?.name ?? "Pago no registrado";
  }

  return (
    <section className="orders-layout">
      <div className="records-panel orders-list">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Cola comercial</p>
            <h2>{visibleOrders.length} pedidos</h2>
          </div>
          <label className="status-filter">
            <span>Filtrar</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as "all" | OrderStatus)}
            >
              <option value="all">Todos</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visibleOrders.length === 0 ? (
          <div className="orders-empty">
            <strong>No hay pedidos en esta vista.</strong>
            <p>Los pedidos de la tienda aparecerán aquí para confirmación y despacho.</p>
          </div>
        ) : (
          <div className="orders-records">
            {visibleOrders.map((order) => (
              <button
                className={selected?.id === order.id ? "selected" : ""}
                type="button"
                key={order.id}
                onClick={() => setSelectedId(order.id)}
              >
                <div>
                  <strong>{order.number}</strong>
                  <small>{order.customerName} | {orderDate(order.createdAt)}</small>
                </div>
                <span className={`order-status status-${order.status}`}>
                  {orderStatusLabels[order.status]}
                </span>
                <b>{currency(order.total)}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="order-detail">
        {selected ? (
          <>
            <div className="order-detail-heading">
              <div>
                <p className="eyebrow">Pedido</p>
                <h2>{selected.number}</h2>
              </div>
              <span className={`order-status status-${selected.status}`}>
                {orderStatusLabels[selected.status]}
              </span>
            </div>
            <div className="customer-detail">
              <strong>{selected.customerName}</strong>
              <span>{selected.phone}</span>
              <span>{selected.address}</span>
              <span>{zoneName(selected.deliveryZoneId)} | {paymentName(selected.paymentMethodId)}</span>
            </div>
            <div className="order-products">
              {selected.items.map((item) => (
                <div key={item.productId}>
                  <span>{item.quantity} x {item.name}</span>
                  <small>
                    {item.presentation}
                    {item.lotCode
                      ? ` | Lote ${item.lotCode}${item.costTotal === null ? "" : ` | Costo ${currency(item.costTotal)}`}`
                      : " | Sin lote asignado"}
                  </small>
                  <strong>{currency(item.subtotal)}</strong>
                </div>
              ))}
            </div>
            <dl className="detail-totals">
              <div><dt>Subtotal conocido</dt><dd>S/ {selected.subtotal.toFixed(2)}</dd></div>
              <div><dt>Entrega</dt><dd>S/ {selected.deliveryFee.toFixed(2)}</dd></div>
              <div><dt>Total</dt><dd>{currency(selected.total)}</dd></div>
            </dl>
            <div className="status-actions">
              {(orderStatusActions[selected.status] ?? []).map((status) => (
                <button
                  className={status === "cancelled" ? "cancel" : ""}
                  disabled={!editable || saving}
                  key={status}
                  type="button"
                  onClick={() => changeStatus(status)}
                >
                  {status === "cancelled" ? "Cancelar" : `Marcar: ${orderStatusLabels[status]}`}
                </button>
              ))}
              {selected.status === "delivered" || selected.status === "cancelled" ? (
                <p className="terminal-order">Pedido finalizado sin acciones pendientes.</p>
              ) : null}
            </div>
            {message ? <p className="form-message">{message}</p> : null}
          </>
        ) : (
          <div className="orders-empty">
            <strong>Aún no hay pedidos.</strong>
            <p>Registra un pedido desde la tienda para activar el flujo operativo.</p>
          </div>
        )}
      </aside>
    </section>
  );
}
