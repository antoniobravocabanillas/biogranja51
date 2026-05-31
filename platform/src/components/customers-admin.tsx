"use client";

import { useMemo, useState } from "react";
import type { Customer, CustomerMetrics, CustomerSegment, DeliveryZone } from "@/domain/commerce";
import { customerSegmentLabels, customerSegments, orderStatusLabels } from "@/domain/commerce";

type CustomersAdminProps = {
  initialCustomers: CustomerMetrics[];
  deliveryZones: DeliveryZone[];
  editable: boolean;
};

type CustomerDraft = Pick<
  Customer,
  "name" | "phone" | "email" | "document" | "notes" | "segment" | "subscriptionInterest"
>;

function fromCustomer(customer: Customer): CustomerDraft {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    document: customer.document,
    notes: customer.notes,
    segment: customer.segment,
    subscriptionInterest: customer.subscriptionInterest,
  };
}

function money(value: number): string {
  return `S/ ${value.toFixed(2)}`;
}

function shortDate(value: string | null): string {
  if (!value) {
    return "Sin pedidos";
  }
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export function CustomersAdmin({ initialCustomers, deliveryZones, editable }: CustomersAdminProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedId, setSelectedId] = useState(initialCustomers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return customers;
    }
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email ?? "", customer.segment]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [customers, query]);

  const selected =
    customers.find((customer) => customer.id === selectedId) ?? customers[0] ?? null;
  const [draft, setDraft] = useState<CustomerDraft | null>(
    initialCustomers[0] ? fromCustomer(initialCustomers[0]) : null,
  );

  function selectCustomer(customer: CustomerMetrics) {
    setSelectedId(customer.id);
    setDraft(fromCustomer(customer));
    setMessage("");
  }

  async function saveCustomer() {
    if (!selected || !draft || !editable) {
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/clientes/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const result = (await response.json()) as Customer & { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo guardar el cliente.");
      setSaving(false);
      return;
    }
    setCustomers((current) =>
      current.map((customer) => (customer.id === result.id ? { ...customer, ...result } : customer)),
    );
    setDraft(fromCustomer(result));
    setMessage("Ficha del cliente actualizada.");
    setSaving(false);
  }

  function zoneName(id: string | null): string {
    return deliveryZones.find((zone) => zone.id === id)?.name ?? "Zona no definida";
  }

  return (
    <section className="customers-layout">
      <div className="records-panel customers-list">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CRM comercial</p>
            <h2>{visibleCustomers.length} clientes</h2>
          </div>
        </div>
        <label className="customer-search">
          <span>Buscar cliente</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, celular o segmento"
          />
        </label>
        {visibleCustomers.length ? (
          <div className="customer-records">
            {visibleCustomers.map((customer) => (
              <button
                className={selected?.id === customer.id ? "selected" : ""}
                key={customer.id}
                type="button"
                onClick={() => selectCustomer(customer)}
              >
                <div>
                  <strong>{customer.name}</strong>
                  <small>{customer.phone} | {customerSegmentLabels[customer.segment]}</small>
                </div>
                <span>{customer.orderCount} pedidos</span>
                <b>{money(customer.lifetimeValue)}</b>
              </button>
            ))}
          </div>
        ) : (
          <div className="orders-empty">
            <strong>No se encontraron clientes.</strong>
            <p>Los clientes se crean automáticamente con su primer pedido.</p>
          </div>
        )}
      </div>

      <aside className="customer-profile">
        {selected && draft ? (
          <>
            <div className="customer-profile-head">
              <div>
                <p className="eyebrow">Ficha de cliente</p>
                <h2>{selected.name}</h2>
              </div>
              {selected.subscriptionInterest ? <span className="subscription-pill">Weekly Box</span> : null}
            </div>
            <dl className="customer-metrics">
              <div><dt>Pedidos</dt><dd>{selected.orderCount}</dd></div>
              <div><dt>Entregados</dt><dd>{selected.deliveredOrders}</dd></div>
              <div><dt>Valor</dt><dd>{money(selected.lifetimeValue)}</dd></div>
              <div><dt>Última compra</dt><dd>{shortDate(selected.lastOrderAt)}</dd></div>
            </dl>
            <p className="last-address">
              <strong>Última entrega</strong>
              {selected.lastAddress || "Dirección aún no registrada"}<br />
              <span>{zoneName(selected.deliveryZoneId)}</span>
            </p>
            <div className="customer-form">
              <div className="field-pair">
                <label className="form-field">
                  <span>Nombre</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Celular</span>
                  <input
                    value={draft.phone}
                    onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  />
                </label>
              </div>
              <div className="field-pair">
                <label className="form-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={draft.email ?? ""}
                    onChange={(event) => setDraft({ ...draft, email: event.target.value || null })}
                  />
                </label>
                <label className="form-field">
                  <span>Documento</span>
                  <input
                    value={draft.document ?? ""}
                    onChange={(event) => setDraft({ ...draft, document: event.target.value || null })}
                  />
                </label>
              </div>
              <label className="form-field">
                <span>Segmento</span>
                <select
                  value={draft.segment}
                  onChange={(event) =>
                    setDraft({ ...draft, segment: event.target.value as CustomerSegment })
                  }
                >
                  {customerSegments.map((segment) => (
                    <option key={segment} value={segment}>
                      {customerSegmentLabels[segment]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Notas comerciales</span>
                <textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Preferencias, horario, contacto y seguimiento"
                />
              </label>
              <label className="customer-check">
                <input
                  type="checkbox"
                  checked={draft.subscriptionInterest}
                  onChange={(event) =>
                    setDraft({ ...draft, subscriptionInterest: event.target.checked })
                  }
                />
                Interesado en suscripción Weekly Box
              </label>
              {message ? <p className="form-message">{message}</p> : null}
              <button
                className="save-button"
                type="button"
                disabled={!editable || saving}
                onClick={saveCustomer}
              >
                {saving ? "Guardando..." : "Guardar ficha"}
              </button>
            </div>
            <div className="customer-history">
              <h3>Historial reciente</h3>
              {selected.orders.slice(0, 4).map((order) => (
                <div key={order.id}>
                  <span>{order.number}</span>
                  <small>{shortDate(order.createdAt)} | {orderStatusLabels[order.status]}</small>
                  <strong>{order.total === null ? "Por confirmar" : money(order.total)}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="orders-empty">
            <strong>Aún no hay clientes.</strong>
            <p>Al registrar pedidos, aparecerán aquí para seguimiento y recompra.</p>
          </div>
        )}
      </aside>
    </section>
  );
}
