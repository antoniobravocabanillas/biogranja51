"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import type {
  CustomerPortalProfile,
  CustomerPortalWorkspace,
  DeliveryZone,
  OrderStatus,
  PaymentMethod,
} from "@/domain/commerce";
import { orderStatusLabels } from "@/domain/commerce";

type CustomerPortalProps = {
  initialWorkspace: CustomerPortalWorkspace;
  deliveryZones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
};

const trackingStages: Array<{ status: OrderStatus; label: string; detail: string }> = [
  { status: "pending_confirmation", label: "Recibido", detail: "Solicitud registrada" },
  { status: "confirmed", label: "Confirmado", detail: "Venta validada" },
  { status: "preparing", label: "Preparando", detail: "Productos y lotes" },
  { status: "dispatched", label: "En camino", detail: "Ruta activa" },
  { status: "delivered", label: "Entregado", detail: "Recepción completa" },
];

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function currency(value: number | null): string {
  return value === null ? "Por confirmar" : `S/ ${value.toFixed(2)}`;
}

export function CustomerPortal({
  initialWorkspace,
  deliveryZones,
  paymentMethods,
}: CustomerPortalProps) {
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(initialWorkspace.profile);
  const [name, setName] = useState(initialWorkspace.profile?.name ?? "");
  const [phone, setPhone] = useState(initialWorkspace.profile?.phone ?? "");
  const [address, setAddress] = useState(initialWorkspace.profile?.lastAddress ?? "");
  const [deliveryZoneId, setDeliveryZoneId] = useState(initialWorkspace.profile?.deliveryZoneId ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(initialWorkspace.profile?.paymentMethodId ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/cuenta/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, address, deliveryZoneId, paymentMethodId }),
    });
    const result = (await response.json()) as CustomerPortalProfile & { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo guardar tu perfil.");
      setSaving(false);
      return;
    }
    setProfile(result);
    setMessage("Perfil actualizado.");
    setSaving(false);
  }

  return (
    <section className="customer-portal">
      <aside className="customer-profile-card">
        <p className="eyebrow">Perfil</p>
        <h2>{profile?.name ?? "Completa tus datos"}</h2>
        <p className="customer-profile-email">{profile?.email ?? "Tu correo autenticado"}</p>
        <form onSubmit={saveProfile}>
          <label className="form-field">
            <span>Nombre</span>
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Celular</span>
            <input required value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Dirección de entrega</span>
            <input
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Calle, número y referencia"
            />
          </label>
          <label className="form-field">
            <span>Zona preferida</span>
            <select
              required
              value={deliveryZoneId}
              onChange={(event) => setDeliveryZoneId(event.target.value)}
            >
              <option value="">Selecciona tu zona</option>
              {deliveryZones.map((zone) => (
                <option value={zone.id} key={zone.id}>
                  {zone.name} - S/ {zone.baseFee.toFixed(2)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Medio de pago preferido</span>
            <select
              required
              value={paymentMethodId}
              onChange={(event) => setPaymentMethodId(event.target.value)}
            >
              <option value="">Selecciona cómo pagar</option>
              {paymentMethods.map((payment) => (
                <option value={payment.id} key={payment.id}>{payment.name}</option>
              ))}
            </select>
          </label>
          <p className="customer-profile-autofill">
            Usaremos estos datos automáticamente cuando compres. Siempre podrás cambiarlos.
          </p>
          {message ? <p className="form-message">{message}</p> : null}
          <button className="save-button" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar perfil"}
          </button>
        </form>
        <p className="customer-profile-privacy">
          Solo tú puedes consultar los pedidos conectados a esta cuenta.
        </p>
      </aside>

      <div className="customer-orders">
        {initialWorkspace.orders.length === 0 ? (
          <article className="customer-empty-orders">
            <p className="eyebrow">Seguimiento</p>
            <h2>Aún no tienes pedidos vinculados.</h2>
            <p>
              Inicia sesión antes de comprar para visualizar cada avance desde
              la confirmación hasta la entrega.
            </p>
            <Link className="button-primary" href="/#productos">Comprar ahora</Link>
          </article>
        ) : initialWorkspace.orders.map((order) => {
          const activeIndex = trackingStages.findIndex((stage) => stage.status === order.status);
          return (
            <article className="customer-order-card" key={order.id}>
              <header>
                <div>
                  <p className="eyebrow">Pedido {order.number}</p>
                  <h2>{orderStatusLabels[order.status]}</h2>
                  <small>Registrado {dateLabel(order.createdAt)}</small>
                </div>
                <strong>{currency(order.total)}</strong>
              </header>
              {order.status === "cancelled" ? (
                <p className="customer-order-cancelled">Este pedido fue cancelado.</p>
              ) : (
                <ol className="customer-tracking">
                  {trackingStages.map((stage, index) => (
                    <li className={index < activeIndex ? "done" : index === activeIndex ? "active" : ""} key={stage.status}>
                      <strong>{stage.label}</strong>
                      <span>{stage.detail}</span>
                    </li>
                  ))}
                </ol>
              )}
              {order.delivery ? (
                <p className="customer-delivery-window">
                  Entrega prevista: <strong>{dateLabel(order.delivery.windowStart)} - {dateLabel(order.delivery.windowEnd)}</strong>
                </p>
              ) : (
                <p className="customer-delivery-window">La ventana de entrega aparecerá cuando confirmemos la ruta.</p>
              )}
              <div className="customer-order-lines">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.name}`}>
                    <span>{item.quantity} x {item.name} <small>{item.presentation}</small></span>
                    <strong>{currency(item.subtotal)}</strong>
                  </div>
                ))}
              </div>
              <footer>
                <span>Dirección: {order.address}</span>
                <Link href="/#productos">Volver a comprar</Link>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
