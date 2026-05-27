"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import type {
  DeliveryZone,
  DeliveryProfile,
  Order,
  OrderStatus,
  PaymentMethod,
} from "@/domain/commerce";
import {
  deliveryOperationStatusLabels,
  orderStatusActions,
  orderStatusLabels,
  orderStatuses,
} from "@/domain/commerce";

type OrdersAdminProps = {
  initialOrders: Order[];
  deliveryZones: DeliveryZone[];
  deliveryProfiles: DeliveryProfile[];
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

function inputDate(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function timestamp(value: string): string {
  return new Date(value).toISOString();
}

function deliveryDraft(order: Order | null) {
  const delivery = order?.delivery;
  const initialEnd = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
  return {
    windowStart: inputDate(delivery?.windowStart),
    windowEnd: inputDate(delivery?.windowEnd ?? initialEnd),
    deliveryProfileId: delivery?.deliveryProfileId ?? "",
    driverName: delivery?.driverName ?? "",
    vehicleReference: delivery?.vehicleReference ?? "",
    planningNotes: delivery?.planningNotes ?? "",
    dispatchedAt: inputDate(delivery?.dispatchedAt),
    dispatchTemperatureC: delivery?.dispatchTemperatureC?.toString() ?? "",
    packagingCondition: delivery?.packagingCondition ?? "",
    deliveredAt: inputDate(delivery?.deliveredAt),
    deliveryTemperatureC: delivery?.deliveryTemperatureC?.toString() ?? "",
    receivedBy: delivery?.receivedBy ?? "",
    deliveryNotes: delivery?.deliveryNotes ?? "",
  };
}

function nextOrderStep(order: Order) {
  const hasMissingLot = order.items.some((item) => !item.lotCode);

  if (order.status === "pending_confirmation") {
    return {
      title: "Confirmar la venta",
      detail: "Valida disponibilidad y confirma el pedido para iniciar preparación.",
      href: null,
      action: "Usa el botón Marcar: Confirmado",
    };
  }
  if (order.status === "confirmed" && hasMissingLot) {
    return {
      title: "Reservar lotes del pedido",
      detail: "Asigna producto disponible antes de realizar el despacho.",
      href: "/gestion/inventario",
      action: "Abrir inventario",
    };
  }
  if ((order.status === "confirmed" || order.status === "preparing") && !order.delivery) {
    return {
      title: "Programar la ruta",
      detail: "Define ventana de entrega y responsable en el control inferior.",
      href: null,
      action: "Completa Programar ruta",
    };
  }
  if (order.status === "confirmed") {
    return {
      title: "Pasar a preparación",
      detail: "La ruta puede guardarse aquí; cambia el estado cuando el pedido esté listo.",
      href: null,
      action: "Usa el botón Marcar: En preparación",
    };
  }
  if (order.status === "preparing" && hasMissingLot) {
    return {
      title: "Asignar stock antes de salir",
      detail: "El sistema bloqueará el despacho mientras falte lote trazable.",
      href: "/gestion/inventario",
      action: "Abrir inventario",
    };
  }
  if (order.status === "preparing") {
    return {
      title: "Registrar salida",
      detail: "Completa temperatura y condición de empaque para despachar.",
      href: null,
      action: "Completa Registrar salida",
    };
  }
  if (order.status === "dispatched") {
    return {
      title: "Cerrar recepción",
      detail: "Registra temperatura de llegada y la persona que recibe.",
      href: null,
      action: "Completa Confirmar recepción",
    };
  }
  if (order.status === "delivered") {
    return {
      title: "Completar el expediente",
      detail: "Adjunta prueba de entrega y revisa conciliación financiera.",
      href: "/gestion/expedientes",
      action: "Adjuntar evidencia",
    };
  }
  return {
    title: "Pedido cancelado",
    detail: "No existen acciones logísticas pendientes para esta venta.",
    href: null,
    action: "Proceso finalizado",
  };
}

export function OrdersAdmin({
  initialOrders,
  deliveryZones,
  deliveryProfiles,
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
  const [logistics, setLogistics] = useState(() => deliveryDraft(selected));
  const nextStep = selected ? nextOrderStep(selected) : null;

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
    setLogistics(deliveryDraft(result));
    setMessage(`Pedido ${result.number}: ${orderStatusLabels[result.status]}.`);
    setSaving(false);
  }

  async function submitLogistics(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    method: "POST" | "PATCH",
    payload: object,
    success: string,
  ) {
    event.preventDefault();
    if (!selected || !editable) {
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/pedidos/${selected.id}/entrega${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as Order & { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo guardar el control de entrega.");
      setSaving(false);
      return;
    }
    setOrders((current) => current.map((order) => (order.id === result.id ? result : order)));
    setLogistics(deliveryDraft(result));
    setMessage(success);
    setSaving(false);
  }

  function zoneName(id: string): string {
    return deliveryZones.find((zone) => zone.id === id)?.name ?? "Zona no registrada";
  }

  function paymentName(id: string): string {
    return paymentMethods.find((payment) => payment.id === id)?.name ?? "Pago no registrado";
  }

  function deliveryProfileName(id: string): string {
    return deliveryProfiles.find((profile) => profile.id === id)?.name ?? "Delivery no registrado";
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
              onChange={(event) => {
                const nextFilter = event.target.value as "all" | OrderStatus;
                const nextSelected = orders.find(
                  (order) => nextFilter === "all" || order.status === nextFilter,
                ) ?? null;
                setFilter(nextFilter);
                if (nextSelected) {
                  setSelectedId(nextSelected.id);
                  setLogistics(deliveryDraft(nextSelected));
                }
              }}
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
                onClick={() => {
                  setSelectedId(order.id);
                  setLogistics(deliveryDraft(order));
                }}
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
            {nextStep ? (
              <section className="order-next-step">
                <div>
                  <p>Próximo paso</p>
                  <strong>{nextStep.title}</strong>
                  <span>{nextStep.detail}</span>
                </div>
                {nextStep.href ? (
                  <Link href={nextStep.href}>{nextStep.action}</Link>
                ) : (
                  <small>{nextStep.action}</small>
                )}
              </section>
            ) : null}
            <ol className="order-flow-status" aria-label="Avance del pedido">
              {["confirmed", "preparing", "dispatched", "delivered"].map((status) => {
                const index = orderStatuses.indexOf(selected.status);
                const stepIndex = orderStatuses.indexOf(status as OrderStatus);
                const reached = selected.status !== "cancelled" && index >= stepIndex;
                return (
                  <li className={reached ? "reached" : ""} key={status}>
                    {orderStatusLabels[status as OrderStatus]}
                  </li>
                );
              })}
            </ol>
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
              {(orderStatusActions[selected.status] ?? [])
                .filter((status) => status !== "dispatched" && status !== "delivered")
                .map((status) => (
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
              {selected.status === "cancelled" ? (
                <p className="terminal-order">Pedido finalizado sin acciones pendientes.</p>
              ) : null}
            </div>
            {selected.status !== "pending_confirmation" && selected.status !== "cancelled" ? (
              <section className="delivery-control">
                <div className="delivery-heading">
                  <div>
                    <p className="eyebrow">Ultima milla</p>
                    <h3>Control de entrega</h3>
                  </div>
                  {selected.delivery ? (
                    <span>{deliveryOperationStatusLabels[selected.delivery.status]}</span>
                  ) : null}
                </div>
                {selected.delivery ? (
                  <dl className="delivery-summary">
                    <div><dt>Ventana</dt><dd>{orderDate(selected.delivery.windowStart)} - {orderDate(selected.delivery.windowEnd)}</dd></div>
                    <div><dt>Delivery asignado</dt><dd>{selected.delivery.deliveryProfileId ? deliveryProfileName(selected.delivery.deliveryProfileId) : selected.delivery.driverName}</dd></div>
                    <div><dt>Contacto / unidad</dt><dd>{selected.delivery.driverName}{selected.delivery.vehicleReference ? ` | ${selected.delivery.vehicleReference}` : ""}</dd></div>
                    {selected.delivery.dispatchTemperatureC !== null ? (
                      <div><dt>Salida</dt><dd>{selected.delivery.dispatchTemperatureC.toFixed(1)} C | {selected.delivery.packagingCondition}</dd></div>
                    ) : null}
                    {selected.delivery.deliveryTemperatureC !== null ? (
                      <div><dt>Recepcion</dt><dd>{selected.delivery.deliveryTemperatureC.toFixed(1)} C | {selected.delivery.receivedBy}</dd></div>
                    ) : null}
                  </dl>
                ) : null}
                {(selected.status === "confirmed" || selected.status === "preparing") &&
                (!selected.delivery || selected.delivery.status === "planned") ? (
                  <form
                    className="delivery-form"
                    onSubmit={(event) => submitLogistics(event, "", "POST", {
                      windowStart: timestamp(logistics.windowStart),
                      windowEnd: timestamp(logistics.windowEnd),
                      deliveryProfileId: logistics.deliveryProfileId,
                      planningNotes: logistics.planningNotes,
                    }, "Ruta de entrega programada.")}
                  >
                    <strong>{selected.delivery ? "Actualizar programación" : "Programar ruta"}</strong>
                    <div className="delivery-fields two-columns">
                      <label><span>Desde</span><input type="datetime-local" value={logistics.windowStart} onChange={(event) => setLogistics({ ...logistics, windowStart: event.target.value })} required /></label>
                      <label><span>Hasta</span><input type="datetime-local" value={logistics.windowEnd} onChange={(event) => setLogistics({ ...logistics, windowEnd: event.target.value })} required /></label>
                    </div>
                    <label>
                      <span>Perfil delivery</span>
                      <select
                        value={logistics.deliveryProfileId}
                        onChange={(event) => setLogistics({ ...logistics, deliveryProfileId: event.target.value })}
                        required
                      >
                        <option value="">Selecciona responsable</option>
                        {deliveryProfiles.filter((profile) => profile.active).map((profile) => (
                          <option value={profile.id} key={profile.id}>
                            {profile.name} | {profile.vehicleReference}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label><span>Notas de ruta</span><textarea value={logistics.planningNotes} onChange={(event) => setLogistics({ ...logistics, planningNotes: event.target.value })} /></label>
                    <button disabled={!editable || saving} type="submit">
                      {selected.delivery ? "Actualizar programación" : "Guardar programación"}
                    </button>
                  </form>
                ) : null}
                {selected.status === "preparing" && selected.delivery?.status === "planned" ? (
                  <form
                    className="delivery-form"
                    onSubmit={(event) => submitLogistics(event, "/despacho", "PATCH", {
                      dispatchedAt: timestamp(logistics.dispatchedAt),
                      temperatureC: Number(logistics.dispatchTemperatureC),
                      packagingCondition: logistics.packagingCondition,
                    }, "Pedido despachado con temperatura registrada.")}
                  >
                    <strong>Registrar salida</strong>
                    <div className="delivery-fields two-columns">
                      <label><span>Hora de salida</span><input type="datetime-local" value={logistics.dispatchedAt} onChange={(event) => setLogistics({ ...logistics, dispatchedAt: event.target.value })} required /></label>
                      <label><span>Temperatura C</span><input type="number" min="-5" max="12" step="0.1" value={logistics.dispatchTemperatureC} onChange={(event) => setLogistics({ ...logistics, dispatchTemperatureC: event.target.value })} required /></label>
                    </div>
                    <label><span>Estado de empaque / frio</span><input value={logistics.packagingCondition} onChange={(event) => setLogistics({ ...logistics, packagingCondition: event.target.value })} required /></label>
                    <button disabled={!editable || saving} type="submit">Despachar pedido</button>
                  </form>
                ) : null}
                {selected.status === "dispatched" && selected.delivery?.status === "dispatched" ? (
                  <form
                    className="delivery-form"
                    onSubmit={(event) => submitLogistics(event, "/recepcion", "PATCH", {
                      deliveredAt: timestamp(logistics.deliveredAt),
                      temperatureC: Number(logistics.deliveryTemperatureC),
                      receivedBy: logistics.receivedBy,
                      notes: logistics.deliveryNotes,
                    }, "Entrega confirmada con recepcion controlada.")}
                  >
                    <strong>Confirmar recepcion</strong>
                    <div className="delivery-fields two-columns">
                      <label><span>Hora de entrega</span><input type="datetime-local" value={logistics.deliveredAt} onChange={(event) => setLogistics({ ...logistics, deliveredAt: event.target.value })} required /></label>
                      <label><span>Temperatura C</span><input type="number" min="-5" max="12" step="0.1" value={logistics.deliveryTemperatureC} onChange={(event) => setLogistics({ ...logistics, deliveryTemperatureC: event.target.value })} required /></label>
                    </div>
                    <label><span>Persona que recibe</span><input value={logistics.receivedBy} onChange={(event) => setLogistics({ ...logistics, receivedBy: event.target.value })} required /></label>
                    <label><span>Observaciones</span><textarea value={logistics.deliveryNotes} onChange={(event) => setLogistics({ ...logistics, deliveryNotes: event.target.value })} /></label>
                    <button disabled={!editable || saving} type="submit">Cerrar entrega</button>
                  </form>
                ) : null}
                {selected.status === "delivered" ? (
                  <p className="delivery-evidence">
                    Entrega cerrada. <Link href="/gestion/expedientes">Adjuntar evidencia de entrega</Link>
                  </p>
                ) : null}
              </section>
            ) : null}
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
