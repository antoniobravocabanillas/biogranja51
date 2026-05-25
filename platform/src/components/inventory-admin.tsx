"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BusinessLocation,
  DispatchableOrderItem,
  InventoryLot,
  InventoryUnit,
  InventoryWorkspace,
  Product,
} from "@/domain/commerce";
import {
  inventoryLotStatusLabels,
  inventoryMovementLabels,
  originLabels,
} from "@/domain/commerce";

type InventoryAdminProps = {
  initialWorkspace: InventoryWorkspace;
  products: Product[];
  locations: BusinessLocation[];
  editable: boolean;
};

type LotDraft = {
  productId: string;
  locationId: string;
  quantity: string;
  unit: InventoryUnit;
  unitCost: string;
  receivedAt: string;
  expiresAt: string;
  supplierName: string;
  notes: string;
};

function dateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateLabel(value: string | null): string {
  if (!value) {
    return "Sin vencimiento registrado";
  }
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function quantityLabel(quantity: number, unit: InventoryUnit): string {
  const label = unit === "kg" ? "kg" : unit === "maple" ? "maples" : "unidades";
  return `${quantity.toFixed(unit === "kg" ? 3 : 0)} ${label}`;
}

function money(value: number): string {
  return `S/ ${value.toFixed(2)}`;
}

function defaultUnit(product: Product | undefined): InventoryUnit {
  return product?.priceUnit === "kg" ? "kg" : product?.priceUnit ?? "unit";
}

export function InventoryAdmin({
  initialWorkspace,
  products,
  locations,
  editable,
}: InventoryAdminProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialWorkspace.lots[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const directReceiptProducts = products.filter((product) => product.originType !== "own");
  const defaultProduct = directReceiptProducts[0];
  const [lotDraft, setLotDraft] = useState<LotDraft>({
    productId: defaultProduct?.id ?? "",
    locationId: locations.find((location) => location.type === "warehouse" || location.type === "mill")?.id ?? locations[0]?.id ?? "",
    quantity: "",
    unit: defaultUnit(defaultProduct),
    unitCost: "",
    receivedAt: dateInputValue(new Date()),
    expiresAt: "",
    supplierName: "",
    notes: "",
  });
  const [movementType, setMovementType] = useState<"waste" | "adjustment_in">("waste");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [allocationDrafts, setAllocationDrafts] = useState<
    Record<string, { lotId: string; quantity: string }>
  >({});

  const selectedLot =
    initialWorkspace.lots.find((lot) => lot.id === selectedId) ?? initialWorkspace.lots[0] ?? null;
  const draftProduct = products.find((product) => product.id === lotDraft.productId);

  const availableByProduct = useMemo(() => {
    const index = new Map<string, InventoryLot[]>();
    initialWorkspace.lots
      .filter((lot) => lot.status === "available" && lot.quantity > 0)
      .forEach((lot) => {
        index.set(lot.productId, [...(index.get(lot.productId) ?? []), lot]);
      });
    return index;
  }, [initialWorkspace.lots]);

  async function createLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/inventario/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...lotDraft,
        quantity: Number(lotDraft.quantity),
        unitCost: lotDraft.unitCost ? Number(lotDraft.unitCost) : null,
        receivedAt: new Date(lotDraft.receivedAt).toISOString(),
        expiresAt: lotDraft.expiresAt ? new Date(lotDraft.expiresAt).toISOString() : null,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar el lote.");
      setSaving(false);
      return;
    }
    setMessage("Lote recibido y stock actualizado.");
    setLotDraft((current) => ({ ...current, quantity: "", unitCost: "", supplierName: "", notes: "" }));
    setSaving(false);
    router.refresh();
  }

  async function registerMovement() {
    if (!selectedLot || !editable) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/inventario/lotes/${selectedLot.id}/movimientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: movementType,
        quantity: Number(movementQuantity),
        reason: movementReason,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar el movimiento.");
      setSaving(false);
      return;
    }
    setMessage(movementType === "waste" ? "Merma registrada en el lote." : "Ingreso adicional registrado.");
    setMovementQuantity("");
    setMovementReason("");
    setSaving(false);
    router.refresh();
  }

  async function allocate(item: DispatchableOrderItem) {
    if (!editable) return;
    const draft = allocationDrafts[item.orderItemId];
    if (!draft?.lotId || !draft.quantity) {
      setMessage("Selecciona lote y cantidad para reservar el despacho.");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/inventario/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderItemId: item.orderItemId,
        lotId: draft.lotId,
        quantity: Number(draft.quantity),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo reservar stock para el pedido.");
      setSaving(false);
      return;
    }
    setMessage(`Lote asignado al pedido ${item.orderNumber}.`);
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="inventory-workspace">
      <div className="inventory-kpis">
        <article>
          <span>Lotes vendibles</span>
          <strong>{initialWorkspace.activeLotCount}</strong>
          <small>Con saldo listo para asignar</small>
        </article>
        <article>
          <span>Stock valorizado</span>
          <strong>{money(initialWorkspace.availableStockValue)}</strong>
          <small>A costo registrado</small>
        </article>
        <article>
          <span>Por vencer</span>
          <strong>{initialWorkspace.expiringLotCount}</strong>
          <small>Vencen en los próximos 5 días</small>
        </article>
        <article>
          <span>Pedidos sin lote</span>
          <strong>{initialWorkspace.pendingAssignmentCount}</strong>
          <small>Confirmados o preparando</small>
        </article>
      </div>

      <div className="inventory-top-grid">
        <section className="records-panel inventory-list">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Stock listo para venta</p>
              <h2>{initialWorkspace.lots.length} lotes</h2>
            </div>
          </div>
          {initialWorkspace.lots.length ? (
            initialWorkspace.lots.map((lot) => (
              <button
                className={selectedLot?.id === lot.id ? "selected" : ""}
                key={lot.id}
                type="button"
                onClick={() => setSelectedId(lot.id)}
              >
                <div>
                  <strong>{lot.code}</strong>
                  <small>{lot.productName} | {lot.locationName}</small>
                </div>
                <span className={`lot-state lot-${lot.status}`}>
                  {inventoryLotStatusLabels[lot.status]}
                </span>
                <b>{quantityLabel(lot.quantity, lot.unit)}</b>
              </button>
            ))
          ) : (
            <div className="orders-empty">
              <strong>Sin lotes registrados.</strong>
              <p>Recibe un producto ya listo para vender o procesa pollo desde crianza.</p>
            </div>
          )}
        </section>

        <form className="inventory-receipt settings-panel" onSubmit={createLot}>
          <p className="eyebrow">Compra comercial</p>
          <h2>Recibir producto listo para venta</h2>
          <p className="inventory-boundary">
            Los pollitos vivos no ingresan aquí. Se registran en{" "}
            <Link href="/gestion/crianza">Crianza avícola</Link> y, tras la faena,
            generan automáticamente stock de pollo entero en kg.
          </p>
          <div className="field-pair">
            <label className="form-field">
              <span>Producto</span>
              <select
                value={lotDraft.productId}
                onChange={(event) => {
                  const product = products.find((entry) => entry.id === event.target.value);
                  setLotDraft({ ...lotDraft, productId: event.target.value, unit: defaultUnit(product) });
                }}
              >
                {directReceiptProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Origen declarado</span>
              <input disabled value={draftProduct ? originLabels[draftProduct.originType] : ""} />
            </label>
          </div>
          <div className="field-pair">
            <label className="form-field">
              <span>Sede de ingreso</span>
              <select
                value={lotDraft.locationId}
                onChange={(event) => setLotDraft({ ...lotDraft, locationId: event.target.value })}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Proveedor del producto</span>
              <input
                value={lotDraft.supplierName}
                onChange={(event) => setLotDraft({ ...lotDraft, supplierName: event.target.value })}
                placeholder={draftProduct?.originType === "selected_supplier" ? "Obligatorio" : "Indicar origen"}
              />
            </label>
          </div>
          <div className="field-triple">
            <label className="form-field">
              <span>Cantidad</span>
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={lotDraft.quantity}
                onChange={(event) => setLotDraft({ ...lotDraft, quantity: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Unidad</span>
              <select
                value={lotDraft.unit}
                onChange={(event) => setLotDraft({ ...lotDraft, unit: event.target.value as InventoryUnit })}
              >
                <option value="kg">Kg</option>
                <option value="unit">Unidades</option>
                <option value="maple">Maples</option>
              </select>
            </label>
            <label className="form-field">
              <span>Costo unitario S/</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={lotDraft.unitCost}
                onChange={(event) => setLotDraft({ ...lotDraft, unitCost: event.target.value })}
              />
            </label>
          </div>
          <div className="field-pair">
            <label className="form-field">
              <span>Recepción lista para venta</span>
              <input
                type="datetime-local"
                required
                value={lotDraft.receivedAt}
                onChange={(event) => setLotDraft({ ...lotDraft, receivedAt: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Vencimiento</span>
              <input
                type="datetime-local"
                value={lotDraft.expiresAt}
                onChange={(event) => setLotDraft({ ...lotDraft, expiresAt: event.target.value })}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Control de recepción</span>
            <textarea
              rows={2}
              value={lotDraft.notes}
              onChange={(event) => setLotDraft({ ...lotDraft, notes: event.target.value })}
              placeholder="Documento, condición del producto, temperatura o responsable"
            />
          </label>
          <button className="save-button" type="submit" disabled={!editable || saving}>
            {saving ? "Registrando..." : "Recibir producto terminado"}
          </button>
        </form>
      </div>

      <div className="inventory-bottom-grid">
        <section className="settings-panel lot-detail">
          <p className="eyebrow">Control de lote</p>
          {selectedLot ? (
            <>
              <div className="lot-detail-heading">
                <div>
                  <h2>{selectedLot.code}</h2>
                  <p>
                    {selectedLot.productName} | {originLabels[selectedLot.originType]}
                    {selectedLot.sourceBirdBatchCode ? ` | Crianza ${selectedLot.sourceBirdBatchCode}` : ""}
                    {selectedLot.sourceLayerFlockCode ? ` | Ponedoras ${selectedLot.sourceLayerFlockCode}` : ""}
                  </p>
                </div>
                <strong>{quantityLabel(selectedLot.quantity, selectedLot.unit)}</strong>
              </div>
              <dl className="lot-metadata">
                <div><dt>Ingreso</dt><dd>{dateLabel(selectedLot.receivedAt)}</dd></div>
                <div><dt>Vence</dt><dd>{dateLabel(selectedLot.expiresAt)}</dd></div>
                <div><dt>Costo</dt><dd>{selectedLot.unitCost === null ? "Sin costo" : money(selectedLot.unitCost)}</dd></div>
                <div><dt>Proveedor</dt><dd>{selectedLot.supplierName || "Origen propio / no indicado"}</dd></div>
                {selectedLot.processedUnits !== null ? (
                  <div><dt>Faenados</dt><dd>{selectedLot.processedUnits} pollos</dd></div>
                ) : null}
              </dl>
              <div className="movement-entry">
                <h3>Registrar movimiento</h3>
                <div className="field-triple">
                  <label className="form-field">
                    <span>Tipo</span>
                    <select
                      value={movementType}
                      onChange={(event) => setMovementType(event.target.value as "waste" | "adjustment_in")}
                    >
                      <option value="waste">Merma</option>
                      <option value="adjustment_in">Ingreso adicional</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Cantidad ({selectedLot.unit})</span>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={movementQuantity}
                      onChange={(event) => setMovementQuantity(event.target.value)}
                    />
                  </label>
                  <button type="button" disabled={!editable || saving} onClick={registerMovement}>
                    Registrar
                  </button>
                </div>
                <label className="form-field">
                  <span>Motivo / evidencia</span>
                  <input
                    value={movementReason}
                    onChange={(event) => setMovementReason(event.target.value)}
                    placeholder="Ej. merma por manipulación o ajuste de pesaje"
                  />
                </label>
              </div>
              <div className="movement-history">
                <h3>Movimientos</h3>
                {selectedLot.movements.map((movement) => (
                  <div key={movement.id}>
                    <span>{inventoryMovementLabels[movement.type]}</span>
                    <small>{movement.reason || dateLabel(movement.createdAt)}</small>
                    <strong className={movement.quantityDelta < 0 ? "out" : ""}>
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {quantityLabel(movement.quantityDelta, movement.unit)}
                    </strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="orders-empty">
              <strong>Selecciona un lote.</strong>
              <p>Aquí podrás registrar mermas y revisar movimientos.</p>
            </div>
          )}
        </section>

        <section className="settings-panel dispatch-assignments">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Preparación</p>
              <h2>Asignar lotes a pedidos</h2>
            </div>
          </div>
          {initialWorkspace.pendingAssignments.length ? (
            initialWorkspace.pendingAssignments.map((item) => {
              const lots = availableByProduct.get(item.productId) ?? [];
              const draft = allocationDrafts[item.orderItemId] ?? {
                lotId: "",
                quantity: item.requiredStockQuantity?.toString() ?? "",
              };
              return (
                <article key={item.orderItemId}>
                  <header>
                    <strong>{item.orderNumber}</strong>
                    <span>{item.productName} | {item.presentation}</span>
                  </header>
                  <p>
                    Solicitado: {item.requiredStockQuantity === null
                      ? "peso final por confirmar"
                      : quantityLabel(item.requiredStockQuantity, item.inventoryUnit)}
                  </p>
                  <div className="assignment-fields">
                    <select
                      value={draft.lotId}
                      onChange={(event) =>
                        setAllocationDrafts({
                          ...allocationDrafts,
                          [item.orderItemId]: { ...draft, lotId: event.target.value },
                        })
                      }
                    >
                      <option value="">Seleccionar lote</option>
                      {lots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.code} - {quantityLabel(lot.quantity, lot.unit)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={draft.quantity}
                      placeholder={item.inventoryUnit}
                      onChange={(event) =>
                        setAllocationDrafts({
                          ...allocationDrafts,
                          [item.orderItemId]: { ...draft, quantity: event.target.value },
                        })
                      }
                    />
                    <button type="button" disabled={!editable || saving || !lots.length} onClick={() => allocate(item)}>
                      Reservar
                    </button>
                  </div>
                  {!lots.length ? <small className="no-stock">No hay stock del producto.</small> : null}
                </article>
              );
            })
          ) : (
            <div className="orders-empty">
              <strong>No hay reservas pendientes.</strong>
              <p>Los pedidos confirmados o en preparación aparecerán aquí.</p>
            </div>
          )}
        </section>
      </div>
      {message ? <p className="inventory-message form-message">{message}</p> : null}
    </section>
  );
}
