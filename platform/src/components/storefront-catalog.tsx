"use client";

import Link from "next/link";
import { useState } from "react";
import type { DeliveryZone, PaymentMethod, Product } from "@/domain/commerce";
import {
  formatPrice,
  originLabels,
  productPriceDetail,
  productSalePrice,
} from "@/domain/commerce";

type StorefrontCatalogProps = {
  products: Product[];
  deliveryZones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
};

export function StorefrontCatalog({
  products,
  deliveryZones,
  paymentMethods,
}: StorefrontCatalogProps) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedZone, setSelectedZone] = useState("");
  const [address, setAddress] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState("");

  const cartItems = products
    .filter((product) => cart[product.id])
    .map((product) => {
      const unitPrice = productSalePrice(product);
      return {
        product,
        quantity: cart[product.id],
        subtotal: unitPrice === null ? null : unitPrice * cart[product.id],
      };
    });

  const subtotal = cartItems.reduce(
    (sum, item) => sum + (item.subtotal ?? 0),
    0,
  );
  const hasPendingPrice = cartItems.some((item) => item.subtotal === null);
  const zone = deliveryZones.find((current) => current.id === selectedZone);
  const fee =
    zone && (hasPendingPrice || !zone.freeFrom || subtotal < zone.freeFrom)
      ? zone.baseFee
      : 0;
  const estimatedTotal = subtotal + fee;
  const activePayments = paymentMethods.filter((payment) => payment.active);

  const canSubmit =
    cartItems.length > 0 &&
    Boolean(zone) &&
    Boolean(address.trim()) &&
    Boolean(customerName.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(paymentMethodId);

  function addProduct(productId: string) {
    setCart((current) => ({
      ...current,
      [productId]: (current[productId] ?? 0) + 1,
    }));
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => {
      const nextQuantity = (current[productId] ?? 0) + delta;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: nextQuantity };
    });
  }

  async function createOrder() {
    if (!canSubmit) {
      setOrderFeedback("Completa tus datos, entrega y medio de pago.");
      return;
    }

    setSubmitting(true);
    setOrderFeedback("");
    const response = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        phone,
        address,
        deliveryZoneId: selectedZone,
        paymentMethodId,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      order?: { number: string };
      whatsappUrl?: string;
    };
    if (!response.ok || !result.whatsappUrl || !result.order) {
      setOrderFeedback(result.error || "No se pudo registrar el pedido.");
      setSubmitting(false);
      return;
    }

    setOrderFeedback(`Pedido ${result.order.number} registrado. Puedes seguirlo desde Mi cuenta. Abriendo WhatsApp...`);
    window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
    setSubmitting(false);
  }

  return (
    <div className="commerce-grid">
      <div className="catalog-product-grid">
        {products.map((product) => (
          <article className="catalog-card" key={product.id}>
            <div className={`product-visual visual-${product.category.toLowerCase()}`}>
              {product.imageUrl ? (
                // Product imagery is administrator-provided and stored externally in production.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={product.name} />
              ) : (
                <span>{product.category}</span>
              )}
            </div>
            <div className="catalog-body">
              <span className={`origin-pill origin-${product.originType}`}>
                {originLabels[product.originType]}
              </span>
              <h3>{product.name}</h3>
              <p className="presentation">{product.presentation}</p>
              <p className="product-description">{product.description}</p>
              <p className="trace-message">
                {product.originType === "pending_confirmation"
                  ? "Procedencia pendiente de validación antes de publicarla."
                  : product.traceable
                    ? "Origen registrado; lote visible cuando el despacho lo respalde."
                    : "Origen declarado en ficha comercial."}
              </p>
              <div className="catalog-pricing">
                <strong>{formatPrice(product)}</strong>
                <small>{productPriceDetail(product)}</small>
              </div>
              <button type="button" onClick={() => addProduct(product.id)}>
                Agregar al pedido
              </button>
            </div>
          </article>
        ))}
      </div>

      <aside className="order-builder" aria-label="Cotizador de pedido">
        <div className="order-heading">
          <p className="eyebrow">Cotizador</p>
          <h3>Tu pedido</h3>
          <span>{cartItems.length} productos</span>
        </div>
        <p className="customer-order-prompt">
          <Link href="/cuenta">Ingresa o crea tu cuenta</Link> antes de pedir para
          seguir preparación y entrega en línea.
        </p>

        {cartItems.length === 0 ? (
          <p className="empty-order">
            Agrega productos para estimar entrega y coordinar el pedido.
          </p>
        ) : (
          <div className="cart-lines">
            {cartItems.map(({ product, quantity, subtotal: itemSubtotal }) => (
              <div className="cart-line" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {itemSubtotal === null
                      ? "Precio pendiente"
                      : `S/ ${itemSubtotal.toFixed(2)}`}
                  </span>
                </div>
                <div className="quantity">
                  <button
                    type="button"
                    onClick={() => changeQuantity(product.id, -1)}
                    aria-label={`Reducir ${product.name}`}
                  >
                    -
                  </button>
                  <b>{quantity}</b>
                  <button
                    type="button"
                    onClick={() => changeQuantity(product.id, 1)}
                    aria-label={`Aumentar ${product.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label className="form-field">
          <span>Zona de entrega</span>
          <select
            value={selectedZone}
            onChange={(event) => setSelectedZone(event.target.value)}
          >
            <option value="">Selecciona tu zona</option>
            {deliveryZones.map((deliveryZone) => (
              <option value={deliveryZone.id} key={deliveryZone.id}>
                {deliveryZone.name} - S/ {deliveryZone.baseFee.toFixed(2)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Dirección exacta</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Calle, número y referencia"
          />
        </label>
        <div className="field-pair customer-fields">
          <label className="form-field">
            <span>Nombre</span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Tu nombre"
            />
          </label>
          <label className="form-field">
            <span>Celular</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="999 999 999"
            />
          </label>
        </div>
        <label className="form-field">
          <span>Medio de pago</span>
          <select
            value={paymentMethodId}
            onChange={(event) => setPaymentMethodId(event.target.value)}
          >
            <option value="">Selecciona cómo pagar</option>
            {activePayments.map((payment) => (
              <option value={payment.id} key={payment.id}>
                {payment.name}
              </option>
            ))}
          </select>
        </label>
        {zone ? (
          <p className="zone-detail">
            Cobertura: {zone.neighborhoods}. Tarifa estimada; la ruta final
            se confirma con tu dirección.
          </p>
        ) : null}

        <dl className="order-total">
          <div>
            <dt>Subtotal conocido</dt>
            <dd>S/ {subtotal.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Delivery estimado</dt>
            <dd>{zone ? `S/ ${fee.toFixed(2)}` : "--"}</dd>
          </div>
          <div className="grand-total">
            <dt>Total estimado</dt>
            <dd>{hasPendingPrice ? "Por confirmar" : `S/ ${estimatedTotal.toFixed(2)}`}</dd>
          </div>
        </dl>
        <p className="payments-accepted">
          Pago: {activePayments.map((payment) => payment.name).join(", ")}
        </p>
        {orderFeedback ? (
          <p className="order-feedback">
            {orderFeedback} <Link href="/mi-cuenta">Ver mis pedidos</Link>
          </p>
        ) : null}
        <button
          className="checkout-link"
          type="button"
          disabled={!canSubmit || submitting}
          onClick={createOrder}
        >
          {submitting ? "Registrando pedido..." : "Registrar y coordinar por WhatsApp"}
        </button>
      </aside>
    </div>
  );
}
