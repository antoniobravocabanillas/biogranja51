"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { DeliveryPortalOrder, DeliveryPortalWorkspace } from "@/domain/commerce";
import { deliveryOperationStatusLabels, orderStatusLabels } from "@/domain/commerce";

type DeliveryPortalProps = {
  initialWorkspace: DeliveryPortalWorkspace;
};

function dateInputValue(value?: string | null): string {
  const source = value ? new Date(value) : new Date();
  const offset = source.getTimezoneOffset();
  const local = new Date(source.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateLabel(value: string | null): string {
  if (!value) return "No registrado";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function currency(value: number | null): string {
  return value === null ? "Por confirmar" : `S/ ${value.toFixed(2)}`;
}

function routeWindow(order: DeliveryPortalOrder): string {
  return `${dateLabel(order.windowStart)} - ${dateLabel(order.windowEnd)}`;
}

export function DeliveryPortal({ initialWorkspace }: DeliveryPortalProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedId, setSelectedId] = useState(initialWorkspace.deliveries[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const selected = useMemo(
    () => workspace.deliveries.find((delivery) => delivery.id === selectedId) ?? workspace.deliveries[0] ?? null,
    [selectedId, workspace.deliveries],
  );

  async function refreshWorkspace() {
    const response = await fetch("/api/reparto");
    if (!response.ok) return;
    const next = (await response.json()) as DeliveryPortalWorkspace;
    setWorkspace(next);
    setSelectedId((current) => next.deliveries.find((delivery) => delivery.id === current)?.id ?? next.deliveries[0]?.id ?? "");
  }

  async function submitDispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setLoadingAction("dispatch");
    setMessage("");
    const response = await fetch(`/api/reparto/${selected.orderId}/despacho`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dispatchedAt: new Date(String(form.get("dispatchedAt"))).toISOString(),
        temperatureC: Number(form.get("temperatureC")),
        packagingCondition: form.get("packagingCondition"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Despacho registrado. El cliente ya ve el pedido en camino." : result.error || "No se pudo registrar despacho.");
    setLoadingAction(null);
    if (response.ok) await refreshWorkspace();
  }

  async function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setLoadingAction("delivery");
    setMessage("");
    const response = await fetch(`/api/reparto/${selected.orderId}/recepcion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveredAt: new Date(String(form.get("deliveredAt"))).toISOString(),
        temperatureC: Number(form.get("temperatureC")),
        receivedBy: form.get("receivedBy"),
        notes: form.get("notes"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Entrega cerrada. Pedido marcado como entregado." : result.error || "No se pudo cerrar entrega.");
    setLoadingAction(null);
    if (response.ok) await refreshWorkspace();
  }

  return (
    <section className="delivery-portal">
      <aside className="delivery-portal-sidebar">
        <p className="eyebrow">Reparto activo</p>
        <h2>{workspace.profile.name}</h2>
        <p>{workspace.profile.vehicleReference}</p>
        {workspace.profile.phone ? <span>{workspace.profile.phone}</span> : null}
        <form action="/api/auth/logout" method="post">
          <input name="next" type="hidden" value="/reparto/login" />
          <button className="outline-button" type="submit">Cerrar sesion</button>
        </form>
        <div className="delivery-route-list">
          {workspace.deliveries.map((delivery) => (
            <button
              className={delivery.id === selected?.id ? "selected" : ""}
              key={delivery.id}
              onClick={() => setSelectedId(delivery.id)}
              type="button"
            >
              <strong>{delivery.orderNumber}</strong>
              <small>{delivery.customerName}</small>
              <span>{deliveryOperationStatusLabels[delivery.status]}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="delivery-portal-detail">
        {!selected ? (
          <article className="delivery-empty">
            <p className="eyebrow">Ruta limpia</p>
            <h1>No tienes entregas asignadas.</h1>
            <p>Cuando gestion programe una ruta con tu perfil, aparecera aqui con cliente, ventana y control de temperatura.</p>
          </article>
        ) : (
          <article className="delivery-task-card">
            <header>
              <div>
                <p className="eyebrow">Pedido asignado</p>
                <h1>{selected.orderNumber}</h1>
                <span>{orderStatusLabels[selected.orderStatus]} | {deliveryOperationStatusLabels[selected.status]}</span>
              </div>
              <strong>{currency(selected.total)}</strong>
            </header>

            <div className="delivery-task-grid">
              <div>
                <span>Cliente</span>
                <strong>{selected.customerName}</strong>
                <small>{selected.phone}</small>
              </div>
              <div>
                <span>Direccion</span>
                <strong>{selected.address}</strong>
                <small>{selected.deliveryZoneName}</small>
              </div>
              <div>
                <span>Ventana</span>
                <strong>{routeWindow(selected)}</strong>
                <small>{selected.paymentMethodName}</small>
              </div>
            </div>

            {selected.planningNotes ? (
              <p className="delivery-route-note">{selected.planningNotes}</p>
            ) : null}

            <div className="delivery-items">
              {selected.items.map((item) => (
                <div key={`${selected.id}-${item.name}-${item.presentation}`}>
                  <span>{item.quantity} x {item.name}</span>
                  <small>{item.presentation}{item.lotCode ? ` | Lote ${item.lotCode}` : " | Lote pendiente"}</small>
                  <strong>{currency(item.subtotal)}</strong>
                </div>
              ))}
            </div>

            {selected.status === "planned" ? (
              <form className="delivery-action-form" onSubmit={submitDispatch}>
                <h3>Registrar salida</h3>
                <div className="delivery-fields two-columns">
                  <label>
                    <span>Hora de salida</span>
                    <input name="dispatchedAt" type="datetime-local" defaultValue={dateInputValue()} required />
                  </label>
                  <label>
                    <span>Temperatura C</span>
                    <input name="temperatureC" type="number" step="0.1" min="-5" max="12" defaultValue="4" required />
                  </label>
                </div>
                <label>
                  <span>Condicion de empaque</span>
                  <input name="packagingCondition" defaultValue="Empaque sellado y cadena de frio conforme" required />
                </label>
                <button disabled={loadingAction === "dispatch"} type="submit">
                  {loadingAction === "dispatch" ? "Registrando..." : "Marcar como despachado"}
                </button>
              </form>
            ) : null}

            {selected.status === "dispatched" ? (
              <form className="delivery-action-form" onSubmit={submitDelivery}>
                <h3>Cerrar entrega</h3>
                <div className="delivery-fields two-columns">
                  <label>
                    <span>Hora de entrega</span>
                    <input name="deliveredAt" type="datetime-local" defaultValue={dateInputValue()} required />
                  </label>
                  <label>
                    <span>Temperatura C</span>
                    <input name="temperatureC" type="number" step="0.1" min="-5" max="12" defaultValue="4" required />
                  </label>
                </div>
                <label>
                  <span>Recibido por</span>
                  <input name="receivedBy" placeholder="Nombre de quien recibe" required />
                </label>
                <label>
                  <span>Notas</span>
                  <textarea name="notes" placeholder="Observaciones, evidencia o detalle de entrega" />
                </label>
                <button disabled={loadingAction === "delivery"} type="submit">
                  {loadingAction === "delivery" ? "Cerrando..." : "Marcar como entregado"}
                </button>
              </form>
            ) : null}

            {selected.status === "delivered" ? (
              <div className="delivery-complete">
                <strong>Entrega cerrada</strong>
                <span>{dateLabel(selected.deliveredAt)} | Recibio {selected.receivedBy}</span>
              </div>
            ) : null}

            {message ? <p className="form-message">{message}</p> : null}
          </article>
        )}
      </div>
    </section>
  );
}
