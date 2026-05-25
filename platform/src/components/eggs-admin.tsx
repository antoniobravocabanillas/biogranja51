"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BusinessLocation,
  EggWorkspace,
  LayerEventType,
  LayerFlock,
  PoultryExpenseCategory,
  Product,
} from "@/domain/commerce";
import {
  layerEventLabels,
  layerFlockStatusLabels,
  poultryExpenseCategories,
  poultryExpenseCategoryLabels,
} from "@/domain/commerce";

type EggsAdminProps = {
  initialWorkspace: EggWorkspace;
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

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function money(value: number | null): string {
  return value === null ? "Sin costo" : `S/ ${value.toFixed(2)}`;
}

function flockMetrics(flock: LayerFlock) {
  const totalCollected = flock.collections.reduce((sum, entry) => sum + entry.collectedEggs, 0);
  const rejected = flock.collections.reduce((sum, entry) => sum + entry.rejectedEggs, 0);
  const usable = totalCollected - rejected;
  const totalFeed = flock.events
    .filter((event) => event.type === "feed_consumption")
    .reduce((sum, event) => sum + (event.feedKg ?? 0), 0);
  const feedCost = flock.events
    .filter((event) => event.type === "feed_consumption")
    .reduce((sum, event) => sum + (event.amount ?? 0), 0);
  const expenseCost = flock.events
    .filter((event) => event.type === "expense")
    .reduce((sum, event) => sum + (event.amount ?? 0), 0);
  const initialCost = flock.costPerHen === null ? null : flock.initialHens * flock.costPerHen;
  const totalCost = (initialCost ?? 0) + feedCost + expenseCost;
  const mortality = flock.events
    .filter((event) => event.type === "mortality")
    .reduce((sum, event) => sum + (event.count ?? 0), 0);
  const lastCollection = [...flock.collections].sort((a, b) =>
    b.collectedAt.localeCompare(a.collectedAt),
  )[0];
  return {
    totalCollected,
    rejected,
    usable,
    totalFeed,
    feedCost,
    expenseCost,
    initialCost,
    totalCost,
    mortality,
    survivalRate: flock.initialHens ? (flock.currentHens / flock.initialHens) * 100 : null,
    usableRate: totalCollected ? (usable / totalCollected) * 100 : null,
    costPerEgg: usable ? totalCost / usable : null,
    costPerMaple: usable ? (totalCost / usable) * 30 : null,
    layRate:
      lastCollection && flock.currentHens
        ? (lastCollection.collectedEggs / flock.currentHens) * 100
        : null,
    collections: [...flock.collections].sort((a, b) => a.collectedAt.localeCompare(b.collectedAt)),
  };
}

function ProductionBars({ flock }: { flock: LayerFlock }) {
  const collections = [...flock.collections]
    .sort((a, b) => a.collectedAt.localeCompare(b.collectedAt))
    .slice(-10);
  if (!collections.length) {
    return <p className="chart-empty">Registra la primera recolección diaria.</p>;
  }
  const max = Math.max(...collections.map((entry) => entry.collectedEggs));
  return (
    <div className="egg-bars">
      {collections.map((entry) => (
        <div key={entry.id}>
          <span style={{ height: `${Math.max(8, (entry.collectedEggs / max) * 94)}%` }} />
          <small>{shortDate(entry.collectedAt)}</small>
          <b>{entry.collectedEggs}</b>
        </div>
      ))}
    </div>
  );
}

export function EggsAdmin({ initialWorkspace, locations, products, editable }: EggsAdminProps) {
  const router = useRouter();
  const farmLocations = locations.filter((location) => location.type === "farm");
  const commercialLocations = locations.filter((location) => location.type !== "farm");
  const mapleProducts = products.filter(
    (product) => product.originType === "own" && product.priceUnit === "maple",
  );
  const [selectedId, setSelectedId] = useState(initialWorkspace.flocks[0]?.id ?? "");
  const selected =
    initialWorkspace.flocks.find((flock) => flock.id === selectedId) ??
    initialWorkspace.flocks[0] ??
    null;
  const metrics = selected ? flockMetrics(selected) : null;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [flockDraft, setFlockDraft] = useState({
    sourceName: "",
    breed: "",
    locationId: farmLocations[0]?.id ?? locations[0]?.id ?? "",
    startedAt: dateInputValue(new Date()),
    initialHens: "",
    costPerHen: "",
    notes: "",
  });
  const [collectionDraft, setCollectionDraft] = useState({
    collectedAt: dateInputValue(new Date()),
    collectedEggs: "",
    rejectedEggs: "0",
    notes: "",
  });
  const [eventDraft, setEventDraft] = useState<{
    type: LayerEventType;
    eventAt: string;
    count: string;
    feedKg: string;
    feedUnitCost: string;
    amount: string;
    expenseCategory: PoultryExpenseCategory;
    notes: string;
  }>({
    type: "feed_consumption",
    eventAt: dateInputValue(new Date()),
    count: "",
    feedKg: "",
    feedUnitCost: "",
    amount: "",
    expenseCategory: "health",
    notes: "",
  });
  const [packDraft, setPackDraft] = useState({
    productId: mapleProducts[0]?.id ?? "",
    locationId: commercialLocations[0]?.id ?? locations[0]?.id ?? "",
    mapleCount: "",
    unitCost: "",
    packedAt: dateInputValue(new Date()),
    expiresAt: "",
    notes: "",
  });

  async function submitFlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/huevos/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...flockDraft,
        initialHens: Number(flockDraft.initialHens),
        costPerHen: flockDraft.costPerHen ? Number(flockDraft.costPerHen) : null,
        startedAt: new Date(flockDraft.startedAt).toISOString(),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar el lote.");
      setSaving(false);
      return;
    }
    setMessage("Lote de ponedoras registrado.");
    setFlockDraft((current) => ({ ...current, sourceName: "", breed: "", initialHens: "", costPerHen: "", notes: "" }));
    setSaving(false);
    router.refresh();
  }

  async function collect() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/huevos/lotes/${selected.id}/recolecciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...collectionDraft,
        collectedAt: new Date(collectionDraft.collectedAt).toISOString(),
        collectedEggs: Number(collectionDraft.collectedEggs),
        rejectedEggs: Number(collectionDraft.rejectedEggs),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar la recolección.");
      setSaving(false);
      return;
    }
    setMessage("Recolección registrada; huevos aptos disponibles para empaque.");
    setCollectionDraft((current) => ({ ...current, collectedEggs: "", rejectedEggs: "0", notes: "" }));
    setSaving(false);
    router.refresh();
  }

  async function recordEvent() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/huevos/lotes/${selected.id}/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: eventDraft.type,
        eventAt: new Date(eventDraft.eventAt).toISOString(),
        count: eventDraft.count ? Number(eventDraft.count) : null,
        feedKg: eventDraft.feedKg ? Number(eventDraft.feedKg) : null,
        feedUnitCost: eventDraft.feedUnitCost ? Number(eventDraft.feedUnitCost) : null,
        amount: eventDraft.amount ? Number(eventDraft.amount) : null,
        expenseCategory: eventDraft.type === "expense" ? eventDraft.expenseCategory : null,
        notes: eventDraft.notes,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar el seguimiento.");
      setSaving(false);
      return;
    }
    setMessage("Seguimiento productivo registrado.");
    setEventDraft((current) => ({ ...current, count: "", feedKg: "", feedUnitCost: "", amount: "", notes: "" }));
    setSaving(false);
    router.refresh();
  }

  async function packMaples() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/huevos/lotes/${selected.id}/maples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...packDraft,
        mapleCount: Number(packDraft.mapleCount),
        unitCost: packDraft.unitCost ? Number(packDraft.unitCost) : null,
        packedAt: new Date(packDraft.packedAt).toISOString(),
        expiresAt: packDraft.expiresAt ? new Date(packDraft.expiresAt).toISOString() : null,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo empacar maples.");
      setSaving(false);
      return;
    }
    setMessage("Maples empacados y enviados a inventario comercial.");
    setPackDraft((current) => ({ ...current, mapleCount: "", unitCost: "", notes: "" }));
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="egg-workspace">
      <div className="inventory-kpis">
        <article><span>Lotes activos</span><strong>{initialWorkspace.activeFlockCount}</strong><small>En postura</small></article>
        <article><span>Ponedoras vivas</span><strong>{initialWorkspace.liveHenCount}</strong><small>Saldo actual</small></article>
        <article><span>Huevos cosechados</span><strong>{initialWorkspace.collectedEggCount}</strong><small>Total registrado</small></article>
        <article><span>Maples empacados</span><strong>{initialWorkspace.packedMapleCount}</strong><small>Enviados a inventario</small></article>
      </div>

      <div className="egg-flow">
        <strong>Ponedoras vivas</strong><span>→</span><strong>Recolección y descarte</strong><span>→</span>
        <strong>Empaque de 30 huevos</strong><span>→</span><strong>Inventario comercial</strong>
      </div>

      <div className="egg-top-grid">
        <section className="records-panel egg-list">
          <div className="panel-heading">
            <div><p className="eyebrow">Lotes ponedores</p><h2>{initialWorkspace.flocks.length} lotes</h2></div>
          </div>
          {initialWorkspace.flocks.length ? initialWorkspace.flocks.map((flock) => (
            <button key={flock.id} className={selected?.id === flock.id ? "selected" : ""} type="button" onClick={() => setSelectedId(flock.id)}>
              <div><strong>{flock.code}</strong><small>{flock.sourceName} | {flock.locationName}</small></div>
              <span className="batch-stage">{layerFlockStatusLabels[flock.status]}</span>
              <b>{flock.currentHens} aves</b>
            </button>
          )) : (
            <div className="orders-empty"><strong>Sin ponedoras registradas.</strong><p>Registra un lote vivo para iniciar el control de postura.</p></div>
          )}
        </section>

        <form className="settings-panel egg-entry" onSubmit={submitFlock}>
          <p className="eyebrow">Ingreso productivo</p>
          <h2>Registrar lote de ponedoras</h2>
          <div className="field-pair">
            <label className="form-field"><span>Origen / proveedor</span><input required value={flockDraft.sourceName} onChange={(event) => setFlockDraft({ ...flockDraft, sourceName: event.target.value })} /></label>
            <label className="form-field"><span>Raza o línea</span><input value={flockDraft.breed} onChange={(event) => setFlockDraft({ ...flockDraft, breed: event.target.value })} /></label>
          </div>
          <div className="field-pair">
            <label className="form-field"><span>Unidad productiva</span><select value={flockDraft.locationId} onChange={(event) => setFlockDraft({ ...flockDraft, locationId: event.target.value })}>{(farmLocations.length ? farmLocations : locations).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
            <label className="form-field"><span>Inicio de postura / ingreso</span><input type="datetime-local" required value={flockDraft.startedAt} onChange={(event) => setFlockDraft({ ...flockDraft, startedAt: event.target.value })} /></label>
          </div>
          <div className="field-pair">
            <label className="form-field"><span>Cantidad de ponedoras</span><input type="number" min="1" step="1" required value={flockDraft.initialHens} onChange={(event) => setFlockDraft({ ...flockDraft, initialHens: event.target.value })} /></label>
            <label className="form-field"><span>Costo por ponedora S/</span><input type="number" min="0" step="0.01" value={flockDraft.costPerHen} onChange={(event) => setFlockDraft({ ...flockDraft, costPerHen: event.target.value })} /></label>
          </div>
          <label className="form-field"><span>Observación inicial</span><textarea rows={2} value={flockDraft.notes} onChange={(event) => setFlockDraft({ ...flockDraft, notes: event.target.value })} /></label>
          <button className="save-button" type="submit" disabled={!editable || saving}>{saving ? "Registrando..." : "Registrar ponedoras"}</button>
        </form>
      </div>

      {selected && metrics ? (
        <section className="settings-panel egg-dashboard">
          <div className="analytics-heading">
            <div><p className="eyebrow">Tablero de postura</p><h2>{selected.code}</h2></div>
            <p>{selected.currentHens} ponedoras vivas | {layerFlockStatusLabels[selected.status]}</p>
          </div>
          <div className="production-metrics">
            <article><span>Postura reciente</span><strong>{metrics.layRate === null ? "Sin dato" : `${metrics.layRate.toFixed(1)}%`}</strong><small>Huevos / ponedora última cosecha</small></article>
            <article><span>Aptos acumulados</span><strong>{metrics.usable}</strong><small>{metrics.usableRate === null ? "Sin cosecha" : `${metrics.usableRate.toFixed(1)}% aprovechable`}</small></article>
            <article><span>Huevos para empacar</span><strong>{selected.availableEggs}</strong><small>{Math.floor(selected.availableEggs / 30)} maples posibles</small></article>
            <article><span>Alimento acumulado</span><strong>{metrics.totalFeed.toFixed(2)} kg</strong><small>Seguimiento del lote</small></article>
            <article><span>Costo acumulado</span><strong>{money(metrics.totalCost)}</strong><small>Documentado a la fecha</small></article>
            <article><span>Costo por huevo apto</span><strong>{money(metrics.costPerEgg)}</strong><small>Referencia acumulada</small></article>
            <article><span>Costo absorbido / maple</span><strong>{money(metrics.costPerMaple)}</strong><small>Incluye inversión inicial</small></article>
            <article><span>Supervivencia</span><strong>{metrics.survivalRate === null ? "Sin dato" : `${metrics.survivalRate.toFixed(2)}%`}</strong><small>{metrics.mortality} bajas</small></article>
          </div>
          <div className="egg-dashboard-grid">
            <article className="chart-panel">
              <header><h3>Postura por recolección</h3><span>Huevos recolectados</span></header>
              <ProductionBars flock={selected} />
            </article>
            <article className="cost-panel">
              <header><h3>Costos del lote</h3><span>Base productiva acumulada</span></header>
              <dl>
                <div><dt>Ponedoras</dt><dd>{money(metrics.initialCost)}</dd></div>
                <div><dt>Alimento</dt><dd>{money(metrics.feedCost)}</dd></div>
                <div><dt>Operación</dt><dd>{money(metrics.expenseCost)}</dd></div>
                <div className="cost-total"><dt>Total acumulado</dt><dd>{money(metrics.totalCost)}</dd></div>
              </dl>
            </article>
          </div>
        </section>
      ) : null}

      <div className="egg-operations-grid">
        <section className="settings-panel">
          <p className="eyebrow">Cosecha</p>
          <h2>Registrar recolección</h2>
          {selected ? (
            <>
              <label className="form-field"><span>Fecha y hora</span><input type="datetime-local" value={collectionDraft.collectedAt} onChange={(event) => setCollectionDraft({ ...collectionDraft, collectedAt: event.target.value })} /></label>
              <div className="field-pair">
                <label className="form-field"><span>Huevos recolectados</span><input type="number" min="1" step="1" value={collectionDraft.collectedEggs} onChange={(event) => setCollectionDraft({ ...collectionDraft, collectedEggs: event.target.value })} /></label>
                <label className="form-field"><span>Descarte / rotos</span><input type="number" min="0" step="1" value={collectionDraft.rejectedEggs} onChange={(event) => setCollectionDraft({ ...collectionDraft, rejectedEggs: event.target.value })} /></label>
              </div>
              <label className="form-field"><span>Control de recolección</span><input value={collectionDraft.notes} onChange={(event) => setCollectionDraft({ ...collectionDraft, notes: event.target.value })} placeholder="Clasificación, limpieza o responsable" /></label>
              <button className="save-button" type="button" disabled={!editable || saving} onClick={collect}>Guardar recolección</button>
              <div className="egg-history">
                {selected.collections.slice(0, 6).map((collection) => (
                  <div key={collection.id}><span>{dateLabel(collection.collectedAt)}</span><strong>{collection.collectedEggs} huevos</strong><small>{collection.rejectedEggs} descarte</small></div>
                ))}
              </div>
            </>
          ) : <p className="empty-history">Selecciona un lote de ponedoras.</p>}
        </section>

        <section className="settings-panel">
          <p className="eyebrow">Costos y sanidad</p>
          <h2>Seguimiento del lote</h2>
          {selected ? (
            <>
              <div className="field-pair">
                <label className="form-field"><span>Registro</span><select value={eventDraft.type} onChange={(event) => setEventDraft({ ...eventDraft, type: event.target.value as LayerEventType })}><option value="feed_consumption">Alimento consumido</option><option value="mortality">Mortalidad</option><option value="expense">Costo operativo</option></select></label>
                <label className="form-field"><span>Fecha</span><input type="datetime-local" value={eventDraft.eventAt} onChange={(event) => setEventDraft({ ...eventDraft, eventAt: event.target.value })} /></label>
              </div>
              {eventDraft.type === "feed_consumption" ? (
                <div className="field-pair">
                  <label className="form-field"><span>Alimento (kg)</span><input type="number" min="0.001" step="0.001" value={eventDraft.feedKg} onChange={(event) => setEventDraft({ ...eventDraft, feedKg: event.target.value })} /></label>
                  <label className="form-field"><span>Costo S/ kg</span><input type="number" min="0" step="0.0001" value={eventDraft.feedUnitCost} onChange={(event) => setEventDraft({ ...eventDraft, feedUnitCost: event.target.value })} /></label>
                </div>
              ) : null}
              {eventDraft.type === "mortality" ? (
                <label className="form-field"><span>Ponedoras fallecidas</span><input type="number" min="1" step="1" value={eventDraft.count} onChange={(event) => setEventDraft({ ...eventDraft, count: event.target.value })} /></label>
              ) : null}
              {eventDraft.type === "expense" ? (
                <div className="field-pair">
                  <label className="form-field"><span>Tipo de costo</span><select value={eventDraft.expenseCategory} onChange={(event) => setEventDraft({ ...eventDraft, expenseCategory: event.target.value as PoultryExpenseCategory })}>{poultryExpenseCategories.map((category) => <option key={category} value={category}>{poultryExpenseCategoryLabels[category]}</option>)}</select></label>
                  <label className="form-field"><span>Monto S/</span><input type="number" min="0.01" step="0.01" value={eventDraft.amount} onChange={(event) => setEventDraft({ ...eventDraft, amount: event.target.value })} /></label>
                </div>
              ) : null}
              <label className="form-field"><span>Observación</span><input value={eventDraft.notes} onChange={(event) => setEventDraft({ ...eventDraft, notes: event.target.value })} /></label>
              <button className="save-button" type="button" disabled={!editable || saving} onClick={recordEvent}>Guardar seguimiento</button>
              <div className="egg-history">
                {selected.events.slice(0, 6).map((entry) => (
                  <div key={entry.id}><span>{layerEventLabels[entry.type]}</span><strong>{entry.type === "mortality" ? `-${entry.count} aves` : entry.type === "feed_consumption" ? `${entry.feedKg} kg` : money(entry.amount)}</strong><small>{dateLabel(entry.eventAt)}</small></div>
                ))}
              </div>
            </>
          ) : <p className="empty-history">Selecciona un lote de ponedoras.</p>}
        </section>

        <section className="settings-panel egg-pack">
          <p className="eyebrow">Paso a venta</p>
          <h2>Empacar maples</h2>
          {selected ? (
            <>
              {!mapleProducts.length ? (
                <p className="inventory-boundary">
                  Para empacar producción propia, actualiza <Link href="/gestion/productos">Huevos frescos</Link> a origen propio.
                </p>
              ) : null}
              <div className="field-pair">
                <label className="form-field"><span>Producto vendible</span><select value={packDraft.productId} onChange={(event) => setPackDraft({ ...packDraft, productId: event.target.value })}>{mapleProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                <label className="form-field"><span>Sede de stock</span><select value={packDraft.locationId} onChange={(event) => setPackDraft({ ...packDraft, locationId: event.target.value })}>{(commercialLocations.length ? commercialLocations : locations).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              </div>
              <div className="field-pair">
                <label className="form-field"><span>Maples de 30</span><input type="number" min="1" step="1" value={packDraft.mapleCount} onChange={(event) => setPackDraft({ ...packDraft, mapleCount: event.target.value })} /></label>
                <label className="form-field"><span>Costo por maple S/</span><input type="number" min="0" step="0.01" value={packDraft.unitCost} onChange={(event) => setPackDraft({ ...packDraft, unitCost: event.target.value })} /></label>
              </div>
              {metrics?.costPerMaple !== null && metrics?.costPerMaple !== undefined ? (
                <p className="suggested-cost">Costo por absorción acumulada: <strong>{money(metrics.costPerMaple)} / maple</strong><button type="button" onClick={() => setPackDraft({ ...packDraft, unitCost: metrics.costPerMaple!.toFixed(2) })}>Usar cálculo</button></p>
              ) : null}
              <div className="field-pair">
                <label className="form-field"><span>Fecha de empaque</span><input type="datetime-local" value={packDraft.packedAt} onChange={(event) => setPackDraft({ ...packDraft, packedAt: event.target.value })} /></label>
                <label className="form-field"><span>Vencimiento</span><input type="datetime-local" value={packDraft.expiresAt} onChange={(event) => setPackDraft({ ...packDraft, expiresAt: event.target.value })} /></label>
              </div>
              <label className="form-field"><span>Control de empaque</span><input value={packDraft.notes} onChange={(event) => setPackDraft({ ...packDraft, notes: event.target.value })} /></label>
              <button className="save-button" type="button" disabled={!editable || saving || !mapleProducts.length} onClick={packMaples}>Enviar maples a inventario</button>
              <Link className="inventory-link" href="/gestion/inventario">Ver inventario comercial</Link>
            </>
          ) : <p className="empty-history">Registra ponedoras antes de empacar.</p>}
        </section>
      </div>
      {message ? <p className="inventory-message form-message">{message}</p> : null}
    </section>
  );
}
