"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BirdBatchEventType,
  BirdBatchStage,
  BusinessLocation,
  PoultryWorkspace,
  Product,
} from "@/domain/commerce";
import {
  birdBatchEventLabels,
  birdBatchStageLabels,
  birdBatchStages,
} from "@/domain/commerce";

type PoultryAdminProps = {
  initialWorkspace: PoultryWorkspace;
  locations: BusinessLocation[];
  products: Product[];
  editable: boolean;
};

function dateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function money(value: number | null): string {
  return value === null ? "Sin costo" : `S/ ${value.toFixed(2)}`;
}

export function PoultryAdmin({
  initialWorkspace,
  locations,
  products,
  editable,
}: PoultryAdminProps) {
  const router = useRouter();
  const farmLocations = locations.filter((location) => location.type === "farm");
  const commercialLocations = locations.filter((location) => location.type !== "farm");
  const saleProducts = products.filter(
    (product) => product.originType === "own" && product.priceUnit === "kg",
  );
  const [selectedId, setSelectedId] = useState(initialWorkspace.batches[0]?.id ?? "");
  const selected =
    initialWorkspace.batches.find((batch) => batch.id === selectedId) ??
    initialWorkspace.batches[0] ??
    null;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [batchDraft, setBatchDraft] = useState({
    sourceName: "",
    breed: "",
    locationId: farmLocations[0]?.id ?? locations[0]?.id ?? "",
    receivedAt: dateInputValue(new Date()),
    initialCount: "",
    initialAvgWeightGrams: "",
    costPerChick: "",
    notes: "",
  });
  const [eventDraft, setEventDraft] = useState<{
    type: Exclude<BirdBatchEventType, "processing">;
    eventAt: string;
    count: string;
    avgWeightGrams: string;
    feedKg: string;
    stage: BirdBatchStage;
    notes: string;
  }>({
    type: "mortality",
    eventAt: dateInputValue(new Date()),
    count: "",
    avgWeightGrams: "",
    feedKg: "",
    stage: "brooding",
    notes: "",
  });
  const [harvestDraft, setHarvestDraft] = useState({
    productId: saleProducts[0]?.id ?? "",
    locationId: commercialLocations[0]?.id ?? locations[0]?.id ?? "",
    processedUnits: "",
    netWeightKg: "",
    unitCost: "",
    processedAt: dateInputValue(new Date()),
    expiresAt: "",
    notes: "",
  });

  async function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/crianza/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...batchDraft,
        initialCount: Number(batchDraft.initialCount),
        initialAvgWeightGrams: batchDraft.initialAvgWeightGrams
          ? Number(batchDraft.initialAvgWeightGrams)
          : null,
        costPerChick: batchDraft.costPerChick ? Number(batchDraft.costPerChick) : null,
        receivedAt: new Date(batchDraft.receivedAt).toISOString(),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar el lote vivo.");
      setSaving(false);
      return;
    }
    setMessage("Lote de pollitos registrado en crianza.");
    setBatchDraft((current) => ({
      ...current,
      sourceName: "",
      breed: "",
      initialCount: "",
      initialAvgWeightGrams: "",
      costPerChick: "",
      notes: "",
    }));
    setSaving(false);
    router.refresh();
  }

  async function recordEvent() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/crianza/lotes/${selected.id}/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: eventDraft.type,
        eventAt: new Date(eventDraft.eventAt).toISOString(),
        count: eventDraft.count ? Number(eventDraft.count) : null,
        avgWeightGrams: eventDraft.avgWeightGrams ? Number(eventDraft.avgWeightGrams) : null,
        feedKg: eventDraft.feedKg ? Number(eventDraft.feedKg) : null,
        stage: eventDraft.type === "stage_change" ? eventDraft.stage : null,
        notes: eventDraft.notes,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar el seguimiento.");
      setSaving(false);
      return;
    }
    setMessage("Seguimiento de crianza registrado.");
    setEventDraft((current) => ({
      ...current,
      count: "",
      avgWeightGrams: "",
      feedKg: "",
      notes: "",
    }));
    setSaving(false);
    router.refresh();
  }

  async function harvest() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/crianza/lotes/${selected.id}/faena`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...harvestDraft,
        processedUnits: Number(harvestDraft.processedUnits),
        netWeightKg: Number(harvestDraft.netWeightKg),
        unitCost: harvestDraft.unitCost ? Number(harvestDraft.unitCost) : null,
        processedAt: new Date(harvestDraft.processedAt).toISOString(),
        expiresAt: harvestDraft.expiresAt
          ? new Date(harvestDraft.expiresAt).toISOString()
          : null,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo llevar el faenado a inventario.");
      setSaving(false);
      return;
    }
    setMessage("Pollo faenado enviado a inventario comercial en kg.");
    setHarvestDraft((current) => ({
      ...current,
      processedUnits: "",
      netWeightKg: "",
      unitCost: "",
      notes: "",
    }));
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="poultry-workspace">
      <div className="inventory-kpis">
        <article>
          <span>Lotes en crianza</span>
          <strong>{initialWorkspace.activeBatchCount}</strong>
          <small>Activos antes de faena</small>
        </article>
        <article>
          <span>Aves vivas</span>
          <strong>{initialWorkspace.liveBirdCount}</strong>
          <small>Saldo productivo actual</small>
        </article>
        <article>
          <span>Mortalidad</span>
          <strong>{initialWorkspace.mortalityCount}</strong>
          <small>Registrada por eventos</small>
        </article>
        <article>
          <span>Faenados</span>
          <strong>{initialWorkspace.processedCount}</strong>
          <small>Pasaron a inventario</small>
        </article>
      </div>

      <div className="flow-definition">
        <article>
          <strong>1. Pollitos vivos</strong>
          <p>Se registran aquí por unidades y peso inicial en gramos.</p>
        </article>
        <span aria-hidden="true">→</span>
        <article>
          <strong>2. Crianza</strong>
          <p>Mortalidad, pesajes, alimento y etapa productiva.</p>
        </article>
        <span aria-hidden="true">→</span>
        <article>
          <strong>3. Faena</strong>
          <p>La salida genera pollo vendible en kg para inventario.</p>
        </article>
      </div>

      <div className="poultry-top-grid">
        <section className="records-panel poultry-list">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Lotes vivos</p>
              <h2>{initialWorkspace.batches.length} lotes</h2>
            </div>
          </div>
          {initialWorkspace.batches.length ? (
            initialWorkspace.batches.map((batch) => (
              <button
                key={batch.id}
                className={selected?.id === batch.id ? "selected" : ""}
                type="button"
                onClick={() => setSelectedId(batch.id)}
              >
                <div>
                  <strong>{batch.code}</strong>
                  <small>{batch.sourceName} | {batch.locationName}</small>
                </div>
                <span className="batch-stage">{birdBatchStageLabels[batch.stage]}</span>
                <b>{batch.currentCount} aves</b>
              </button>
            ))
          ) : (
            <div className="orders-empty">
              <strong>Sin lotes de crianza.</strong>
              <p>Registra el ingreso de pollitos bebés, no como producto de venta.</p>
            </div>
          )}
        </section>

        <form className="settings-panel poultry-entry" onSubmit={submitBatch}>
          <p className="eyebrow">Ingreso productivo</p>
          <h2>Recibir pollitos vivos</h2>
          <div className="field-pair">
            <label className="form-field">
              <span>Proveedor / incubadora</span>
              <input
                required
                value={batchDraft.sourceName}
                onChange={(event) => setBatchDraft({ ...batchDraft, sourceName: event.target.value })}
                placeholder="Ej. Virgen del Cisne"
              />
            </label>
            <label className="form-field">
              <span>Raza o línea</span>
              <input
                value={batchDraft.breed}
                onChange={(event) => setBatchDraft({ ...batchDraft, breed: event.target.value })}
              />
            </label>
          </div>
          <div className="field-pair">
            <label className="form-field">
              <span>Unidad productiva</span>
              <select
                value={batchDraft.locationId}
                onChange={(event) => setBatchDraft({ ...batchDraft, locationId: event.target.value })}
              >
                {(farmLocations.length ? farmLocations : locations).map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Fecha de ingreso</span>
              <input
                type="datetime-local"
                required
                value={batchDraft.receivedAt}
                onChange={(event) => setBatchDraft({ ...batchDraft, receivedAt: event.target.value })}
              />
            </label>
          </div>
          <div className="field-triple">
            <label className="form-field">
              <span>Cantidad de pollitos</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={batchDraft.initialCount}
                onChange={(event) => setBatchDraft({ ...batchDraft, initialCount: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Peso promedio (g)</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={batchDraft.initialAvgWeightGrams}
                onChange={(event) => setBatchDraft({ ...batchDraft, initialAvgWeightGrams: event.target.value })}
                placeholder="45"
              />
            </label>
            <label className="form-field">
              <span>Costo por pollito S/</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={batchDraft.costPerChick}
                onChange={(event) => setBatchDraft({ ...batchDraft, costPerChick: event.target.value })}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Observación inicial</span>
            <textarea
              rows={2}
              value={batchDraft.notes}
              onChange={(event) => setBatchDraft({ ...batchDraft, notes: event.target.value })}
              placeholder="Condición de llegada, guía, responsable o vacunación"
            />
          </label>
          <button className="save-button" type="submit" disabled={!editable || saving}>
            {saving ? "Registrando..." : "Registrar lote de crianza"}
          </button>
        </form>
      </div>

      <div className="poultry-bottom-grid">
        <section className="settings-panel poultry-control">
          <p className="eyebrow">Seguimiento</p>
          {selected ? (
            <>
              <div className="bird-detail-heading">
                <div>
                  <h2>{selected.code}</h2>
                  <p>{birdBatchStageLabels[selected.stage]} | ingreso {dateLabel(selected.receivedAt)}</p>
                </div>
                <strong>{selected.currentCount} vivos</strong>
              </div>
              <dl className="lot-metadata">
                <div><dt>Ingreso</dt><dd>{selected.initialCount} pollitos</dd></div>
                <div><dt>Procesados</dt><dd>{selected.processedCount} pollos</dd></div>
                <div><dt>Peso inicial</dt><dd>{selected.initialAvgWeightGrams ? `${selected.initialAvgWeightGrams} g` : "Sin registro"}</dd></div>
                <div><dt>Costo inicial</dt><dd>{money(selected.costPerChick)} / pollito</dd></div>
              </dl>
              <div className="movement-entry poultry-event">
                <h3>Registrar evolución</h3>
                <div className="field-pair">
                  <label className="form-field">
                    <span>Registro</span>
                    <select
                      value={eventDraft.type}
                      onChange={(event) =>
                        setEventDraft({
                          ...eventDraft,
                          type: event.target.value as Exclude<BirdBatchEventType, "processing">,
                        })
                      }
                    >
                      <option value="mortality">Mortalidad</option>
                      <option value="weight_sample">Pesaje promedio</option>
                      <option value="feed_consumption">Alimento consumido</option>
                      <option value="stage_change">Cambiar etapa</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Fecha</span>
                    <input
                      type="datetime-local"
                      value={eventDraft.eventAt}
                      onChange={(event) => setEventDraft({ ...eventDraft, eventAt: event.target.value })}
                    />
                  </label>
                </div>
                {eventDraft.type === "mortality" ? (
                  <label className="form-field">
                    <span>Aves fallecidas</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={eventDraft.count}
                      onChange={(event) => setEventDraft({ ...eventDraft, count: event.target.value })}
                    />
                  </label>
                ) : null}
                {eventDraft.type === "weight_sample" ? (
                  <label className="form-field">
                    <span>Peso promedio de muestra (g)</span>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={eventDraft.avgWeightGrams}
                      onChange={(event) => setEventDraft({ ...eventDraft, avgWeightGrams: event.target.value })}
                    />
                  </label>
                ) : null}
                {eventDraft.type === "feed_consumption" ? (
                  <label className="form-field">
                    <span>Alimento consumido (kg)</span>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={eventDraft.feedKg}
                      onChange={(event) => setEventDraft({ ...eventDraft, feedKg: event.target.value })}
                    />
                  </label>
                ) : null}
                {eventDraft.type === "stage_change" ? (
                  <label className="form-field">
                    <span>Nueva etapa</span>
                    <select
                      value={eventDraft.stage}
                      onChange={(event) =>
                        setEventDraft({ ...eventDraft, stage: event.target.value as BirdBatchStage })
                      }
                    >
                      {birdBatchStages
                        .filter((stage) => stage !== "processed" && stage !== "closed")
                        .map((stage) => (
                          <option key={stage} value={stage}>{birdBatchStageLabels[stage]}</option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <label className="form-field">
                  <span>Observación</span>
                  <input
                    value={eventDraft.notes}
                    onChange={(event) => setEventDraft({ ...eventDraft, notes: event.target.value })}
                  />
                </label>
                <button className="save-button" type="button" disabled={!editable || saving} onClick={recordEvent}>
                  Guardar seguimiento
                </button>
              </div>
              <div className="movement-history">
                <h3>Bitácora</h3>
                {selected.events.length ? selected.events.map((event) => (
                  <div key={event.id}>
                    <span>{birdBatchEventLabels[event.type]}</span>
                    <small>{dateLabel(event.eventAt)}{event.notes ? ` | ${event.notes}` : ""}</small>
                    <strong>
                      {event.type === "mortality" ? `-${event.count} aves` : null}
                      {event.type === "weight_sample" ? `${event.avgWeightGrams} g` : null}
                      {event.type === "feed_consumption" ? `${event.feedKg} kg` : null}
                      {event.type === "stage_change" && event.stage ? birdBatchStageLabels[event.stage] : null}
                      {event.type === "processing" ? `${event.count} faenados` : null}
                    </strong>
                  </div>
                )) : <p className="empty-history">Sin movimientos registrados.</p>}
              </div>
            </>
          ) : (
            <div className="orders-empty">
              <strong>Selecciona un lote vivo.</strong>
              <p>La crianza inicia con el ingreso de pollitos.</p>
            </div>
          )}
        </section>

        <section className="settings-panel harvest-panel">
          <p className="eyebrow">Paso a comercialización</p>
          <h2>Registrar pollo faenado</h2>
          <p className="handoff-note">
            Solo este paso crea stock disponible para pedidos. El inventario
            recibe kilos netos de producto ya faenado.
          </p>
          {selected ? (
            <>
              <div className="field-pair">
                <label className="form-field">
                  <span>Producto vendible</span>
                  <select
                    value={harvestDraft.productId}
                    onChange={(event) => setHarvestDraft({ ...harvestDraft, productId: event.target.value })}
                  >
                    {saleProducts.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Sede de stock</span>
                  <select
                    value={harvestDraft.locationId}
                    onChange={(event) => setHarvestDraft({ ...harvestDraft, locationId: event.target.value })}
                  >
                    {(commercialLocations.length ? commercialLocations : locations).map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-triple">
                <label className="form-field">
                  <span>Pollos faenados</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={harvestDraft.processedUnits}
                    onChange={(event) => setHarvestDraft({ ...harvestDraft, processedUnits: event.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Peso neto (kg)</span>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={harvestDraft.netWeightKg}
                    onChange={(event) => setHarvestDraft({ ...harvestDraft, netWeightKg: event.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Costo final / kg S/</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={harvestDraft.unitCost}
                    onChange={(event) => setHarvestDraft({ ...harvestDraft, unitCost: event.target.value })}
                  />
                </label>
              </div>
              <div className="field-pair">
                <label className="form-field">
                  <span>Fecha de faena</span>
                  <input
                    type="datetime-local"
                    value={harvestDraft.processedAt}
                    onChange={(event) => setHarvestDraft({ ...harvestDraft, processedAt: event.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Vencimiento</span>
                  <input
                    type="datetime-local"
                    value={harvestDraft.expiresAt}
                    onChange={(event) => setHarvestDraft({ ...harvestDraft, expiresAt: event.target.value })}
                  />
                </label>
              </div>
              <label className="form-field">
                <span>Observaciones de faena / frío</span>
                <textarea
                  rows={2}
                  value={harvestDraft.notes}
                  onChange={(event) => setHarvestDraft({ ...harvestDraft, notes: event.target.value })}
                />
              </label>
              <button className="save-button" type="button" disabled={!editable || saving || !saleProducts.length} onClick={harvest}>
                Enviar lote faenado a inventario
              </button>
              <Link className="inventory-link" href="/gestion/inventario">
                Ver inventario comercial
              </Link>
            </>
          ) : (
            <div className="orders-empty">
              <strong>Aún no hay lote para faenar.</strong>
              <p>Registra primero el ingreso de pollitos vivos.</p>
            </div>
          )}
        </section>
      </div>
      {message ? <p className="inventory-message form-message">{message}</p> : null}
    </section>
  );
}
