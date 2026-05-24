"use client";

import { useState } from "react";
import type { CommerceState, DeliveryZone, PaymentMethod } from "@/domain/commerce";

type ConfigurationAdminProps = {
  initialState: CommerceState;
  editable: boolean;
};

export function ConfigurationAdmin({ initialState, editable }: ConfigurationAdminProps) {
  const [zones, setZones] = useState(initialState.deliveryZones);
  const [payments, setPayments] = useState(initialState.paymentMethods);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function changeZone(id: string, updates: Partial<DeliveryZone>) {
    setZones((current) =>
      current.map((zone) => (zone.id === id ? { ...zone, ...updates } : zone)),
    );
  }

  function changePayment(id: string, updates: Partial<PaymentMethod>) {
    setPayments((current) =>
      current.map((payment) =>
        payment.id === id ? { ...payment, ...updates } : payment,
      ),
    );
  }

  async function saveConfiguration() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/configuracion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryZones: zones, paymentMethods: payments }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Configuración guardada. El cotizador público usa estas tarifas."
        : result.error || "No se pudo guardar la configuración.",
    );
    setSaving(false);
  }

  return (
    <div className="configuration-layout">
      <section className="settings-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Delivery</p>
            <h2>Zonas iniciales de Trujillo</h2>
          </div>
        </div>
        <p className="settings-note">
          Las zonas se definen por cobertura logística. En una fase posterior,
          geocodificación y ruteo calcularán la tarifa desde la dirección exacta.
        </p>
        <div className="zones-editor">
          {zones.map((zone) => (
            <article key={zone.id}>
              <div className="zone-title">
                <strong>{zone.name}</strong>
                <label>
                  <input
                    type="checkbox"
                    checked={zone.active}
                    onChange={(event) => changeZone(zone.id, { active: event.target.checked })}
                  />
                  Activa
                </label>
              </div>
              <p>{zone.neighborhoods}</p>
              <div className="zone-inputs">
                <label className="form-field">
                  <span>Tarifa S/</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={zone.baseFee}
                    onChange={(event) =>
                      changeZone(zone.id, { baseFee: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Gratis desde S/</span>
                  <input
                    type="number"
                    min="0"
                    value={zone.freeFrom ?? ""}
                    onChange={(event) =>
                      changeZone(zone.id, {
                        freeFrom: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-side">
        <article className="settings-panel">
          <p className="eyebrow">Cobros</p>
          <h2>Medios de pago</h2>
          <div className="payment-editor">
            {payments.map((payment) => (
              <label key={payment.id}>
                <input
                  type="checkbox"
                  checked={payment.active}
                  onChange={(event) =>
                    changePayment(payment.id, { active: event.target.checked })
                  }
                />
                <span>
                  <strong>{payment.name}</strong>
                  <small>{payment.instructions}</small>
                </span>
              </label>
            ))}
          </div>
        </article>

        <article className="settings-panel">
          <p className="eyebrow">Escalabilidad</p>
          <h2>Sedes y responsables</h2>
          <div className="location-list">
            {initialState.locations.map((location) => (
              <div key={location.id}>
                <strong>{location.name}</strong>
                <span>{location.type} | {location.address}</span>
              </div>
            ))}
          </div>
          <div className="role-list">
            {initialState.roles.map((role) => (
              <div key={role.id}>
                <strong>{role.name}</strong>
                <span>{role.scope}</span>
              </div>
            ))}
          </div>
        </article>

        {message ? <p className="form-message">{message}</p> : null}
        <button
          className="save-button"
          type="button"
          disabled={!editable || saving}
          onClick={saveConfiguration}
        >
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </section>
    </div>
  );
}
