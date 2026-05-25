"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BirdBatch,
  BirdBatchEventType,
  BirdBatchStage,
  BusinessLocation,
  PoultryExpenseCategory,
  PoultryWorkspace,
  Product,
} from "@/domain/commerce";
import {
  birdBatchEventLabels,
  birdBatchStageLabels,
  birdBatchStages,
  poultryExpenseCategories,
  poultryExpenseCategoryLabels,
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

function decimal(value: number | null, digits = 2): string {
  return value === null ? "Sin dato" : value.toFixed(digits);
}

function dateShort(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function calculateBatchMetrics(batch: BirdBatch) {
  const chronological = [...batch.events].sort((a, b) => a.eventAt.localeCompare(b.eventAt));
  const weightPoints = [
    ...(batch.initialAvgWeightGrams
      ? [{ date: batch.receivedAt, value: batch.initialAvgWeightGrams }]
      : []),
    ...chronological
      .filter((event) => event.type === "weight_sample" && event.avgWeightGrams !== null)
      .map((event) => ({ date: event.eventAt, value: event.avgWeightGrams! })),
  ];
  const feedPoints = chronological
    .filter((event) => event.type === "feed_consumption" && event.feedKg !== null)
    .map((event) => ({ date: event.eventAt, value: event.feedKg!, amount: event.amount }));
  const currentWeight = weightPoints.at(-1)?.value ?? null;
  const totalFeedKg = feedPoints.reduce((sum, point) => sum + point.value, 0);
  const feedCost = feedPoints.reduce((sum, point) => sum + (point.amount ?? 0), 0);
  const unvaluedFeedKg = feedPoints
    .filter((point) => point.amount === null)
    .reduce((sum, point) => sum + point.value, 0);
  const unvaluedFeedEvents = chronological.filter(
    (event) => event.type === "feed_consumption" && event.feedKg !== null && event.amount === null,
  );
  const expenseCost = chronological
    .filter((event) => event.type === "expense")
    .reduce((sum, event) => sum + (event.amount ?? 0), 0);
  const chickCost =
    batch.costPerChick === null ? null : batch.initialCount * batch.costPerChick;
  const totalKnownCost = (chickCost ?? 0) + feedCost + expenseCost;
  const mortalityCount = chronological
    .filter((event) => event.type === "mortality")
    .reduce((sum, event) => sum + (event.count ?? 0), 0);
  const liveBiomassKg =
    currentWeight === null ? null : (currentWeight * batch.currentCount) / 1000;
  const gainBiomassKg =
    currentWeight === null || batch.initialAvgWeightGrams === null
      ? null
      : ((currentWeight - batch.initialAvgWeightGrams) * batch.currentCount) / 1000;
  const birdDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(batch.receivedAt).getTime()) / 86400000),
  );

  return {
    birdDays,
    weightPoints,
    feedPoints,
    currentWeight,
    weightGainGrams:
      currentWeight === null || batch.initialAvgWeightGrams === null
        ? null
        : currentWeight - batch.initialAvgWeightGrams,
    totalFeedKg,
    feedPerLiveBird: batch.currentCount ? totalFeedKg / batch.currentCount : null,
    dailyFeedPerLiveBirdGrams:
      batch.currentCount ? (totalFeedKg * 1000) / batch.currentCount / birdDays : null,
    feedConversion:
      gainBiomassKg !== null && gainBiomassKg > 0 ? totalFeedKg / gainBiomassKg : null,
    mortalityCount,
    survivalRate: batch.initialCount
      ? ((batch.initialCount - mortalityCount) / batch.initialCount) * 100
      : null,
    chickCost,
    feedCost,
    expenseCost,
    unvaluedFeedKg,
    unvaluedFeedEvents,
    totalKnownCost,
    costPerLiveBird: batch.currentCount ? totalKnownCost / batch.currentCount : null,
    costPerLiveKg:
      liveBiomassKg !== null && liveBiomassKg > 0 ? totalKnownCost / liveBiomassKg : null,
    costsIncomplete: chickCost === null || unvaluedFeedKg > 0,
  };
}

function WeightChart({ points }: { points: Array<{ date: string; value: number }> }) {
  if (points.length < 2) {
    return <p className="chart-empty">Registra dos pesajes para ver la curva de crecimiento.</p>;
  }
  const max = Math.max(...points.map((point) => point.value));
  const min = Math.min(...points.map((point) => point.value));
  const span = Math.max(1, max - min);
  const chartPoints = points
    .map((point, index) => {
      const x = points.length === 1 ? 15 : 15 + (index / (points.length - 1)) * 270;
      const y = 105 - ((point.value - min) / span) * 82;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <>
      <svg className="weight-chart" viewBox="0 0 300 120" role="img" aria-label="Evolución del peso promedio">
        <path d="M15 105 H285" />
        <polyline points={chartPoints} />
        {points.map((point, index) => {
          const x = points.length === 1 ? 15 : 15 + (index / (points.length - 1)) * 270;
          const y = 105 - ((point.value - min) / span) * 82;
          return <circle key={`${point.date}-${point.value}`} cx={x} cy={y} r="4" />;
        })}
      </svg>
      <div className="chart-axis">
        <span>{dateShort(points[0].date)} | {points[0].value.toFixed(0)} g</span>
        <strong>{points.at(-1)!.value.toFixed(0)} g</strong>
        <span>{dateShort(points.at(-1)!.date)}</span>
      </div>
    </>
  );
}

function FeedChart({ points }: { points: Array<{ date: string; value: number }> }) {
  if (!points.length) {
    return <p className="chart-empty">Registra alimento consumido para analizar el lote.</p>;
  }
  const max = Math.max(...points.map((point) => point.value));

  return (
    <div className="feed-chart">
      {points.slice(-8).map((point) => (
        <div key={`${point.date}-${point.value}`}>
          <span style={{ height: `${Math.max(8, (point.value / max) * 92)}%` }} />
          <small>{dateShort(point.date)}</small>
          <b>{point.value.toFixed(2)}</b>
        </div>
      ))}
    </div>
  );
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
  const metrics = selected ? calculateBatchMetrics(selected) : null;
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
    feedUnitCost: string;
    amount: string;
    expenseCategory: PoultryExpenseCategory;
    stage: BirdBatchStage;
    notes: string;
  }>({
    type: "mortality",
    eventAt: dateInputValue(new Date()),
    count: "",
    avgWeightGrams: "",
    feedKg: "",
    feedUnitCost: "",
    amount: "",
    expenseCategory: "health",
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
  const [valuationDraft, setValuationDraft] = useState({
    eventId: "",
    feedUnitCost: "",
  });
  const valuationEventId =
    metrics?.unvaluedFeedEvents.some((event) => event.id === valuationDraft.eventId)
      ? valuationDraft.eventId
      : metrics?.unvaluedFeedEvents[0]?.id ?? "";

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
        feedUnitCost: eventDraft.feedUnitCost ? Number(eventDraft.feedUnitCost) : null,
        amount: eventDraft.amount ? Number(eventDraft.amount) : null,
        expenseCategory: eventDraft.type === "expense" ? eventDraft.expenseCategory : null,
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
      feedUnitCost: "",
      amount: "",
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

  async function valuePendingFeed() {
    if (!selected || !metrics?.unvaluedFeedEvents.length) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(
      `/api/crianza/lotes/${selected.id}/eventos/${valuationEventId}/valorizar`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedUnitCost: Number(valuationDraft.feedUnitCost) }),
      },
    );
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo valorizar el consumo.");
      setSaving(false);
      return;
    }
    setMessage("Consumo de alimento valorizado para el cálculo de costos.");
    setValuationDraft({ eventId: "", feedUnitCost: "" });
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

      {selected && metrics ? (
        <section className="poultry-analytics settings-panel">
          <div className="analytics-heading">
            <div>
              <p className="eyebrow">Tablero técnico económico</p>
              <h2>{selected.code}</h2>
            </div>
            <p>
              Día <strong>{metrics.birdDays}</strong> | {birdBatchStageLabels[selected.stage]}
            </p>
          </div>
          <div className="production-metrics">
            <article>
              <span>Peso promedio actual</span>
              <strong>{metrics.currentWeight === null ? "Sin dato" : `${metrics.currentWeight.toFixed(0)} g`}</strong>
              <small>
                {metrics.weightGainGrams === null
                  ? "Registra pesajes"
                  : `+${metrics.weightGainGrams.toFixed(0)} g desde ingreso`}
              </small>
            </article>
            <article>
              <span>Supervivencia</span>
              <strong>{metrics.survivalRate === null ? "Sin dato" : `${metrics.survivalRate.toFixed(2)}%`}</strong>
              <small>{metrics.mortalityCount} bajas registradas</small>
            </article>
            <article>
              <span>Alimento acumulado</span>
              <strong>{metrics.totalFeedKg.toFixed(2)} kg</strong>
              <small>
                {metrics.feedPerLiveBird === null
                  ? "Sin aves vivas"
                  : `${metrics.feedPerLiveBird.toFixed(3)} kg / ave viva`}
              </small>
            </article>
            <article>
              <span>Conversión referencial</span>
              <strong>{decimal(metrics.feedConversion)}</strong>
              <small>kg alimento / kg ganado vivo</small>
            </article>
            <article>
              <span>Costo acumulado</span>
              <strong>{money(metrics.totalKnownCost)}</strong>
              <small>{metrics.costsIncomplete ? "Parcial: hay datos por valorizar" : "Costos valorizados"}</small>
            </article>
            <article>
              <span>Costo por ave viva</span>
              <strong>{money(metrics.costPerLiveBird)}</strong>
              <small>Antes de faena</small>
            </article>
            <article>
              <span>Costo por kg vivo</span>
              <strong>{money(metrics.costPerLiveKg)}</strong>
              <small>Referencia productiva actual</small>
            </article>
            <article>
              <span>Consumo diario</span>
              <strong>
                {metrics.dailyFeedPerLiveBirdGrams === null
                  ? "Sin dato"
                  : `${metrics.dailyFeedPerLiveBirdGrams.toFixed(1)} g`}
              </strong>
              <small>promedio diario / ave viva</small>
            </article>
          </div>
          <div className="analytics-grid">
            <article className="chart-panel">
              <header>
                <h3>Evolución de peso</h3>
                <span>Promedio del muestreo en gramos</span>
              </header>
              <WeightChart points={metrics.weightPoints} />
            </article>
            <article className="chart-panel">
              <header>
                <h3>Consumo registrado</h3>
                <span>Kg de alimento por registro</span>
              </header>
              <FeedChart points={metrics.feedPoints} />
            </article>
            <article className="cost-panel">
              <header>
                <h3>Estructura de costos</h3>
                <span>Control acumulado por lote</span>
              </header>
              <dl>
                <div><dt>Pollitos</dt><dd>{money(metrics.chickCost)}</dd></div>
                <div><dt>Alimento valorizado</dt><dd>{money(metrics.feedCost)}</dd></div>
                <div><dt>Sanidad y operación</dt><dd>{money(metrics.expenseCost)}</dd></div>
                <div className="cost-total"><dt>Total conocido</dt><dd>{money(metrics.totalKnownCost)}</dd></div>
              </dl>
              {metrics.unvaluedFeedKg > 0 ? (
                <div className="feed-valuation">
                  <p>{metrics.unvaluedFeedKg.toFixed(3)} kg de alimento aún sin costo asignado.</p>
                  <select
                    value={valuationEventId}
                    onChange={(event) =>
                      setValuationDraft({ ...valuationDraft, eventId: event.target.value })
                    }
                  >
                    {metrics.unvaluedFeedEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {dateShort(event.eventAt)} | {event.feedKg?.toFixed(3)} kg
                      </option>
                    ))}
                  </select>
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder="S/ por kg"
                      value={valuationDraft.feedUnitCost}
                      onChange={(event) =>
                        setValuationDraft({ ...valuationDraft, feedUnitCost: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      disabled={!editable || saving || valuationDraft.feedUnitCost === ""}
                      onClick={valuePendingFeed}
                    >
                      Valorizar
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          </div>
        </section>
      ) : null}

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
                      <option value="expense">Costo operativo</option>
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
                  <div className="field-pair">
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
                    <label className="form-field">
                      <span>Costo del alimento S/ kg</span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={eventDraft.feedUnitCost}
                        onChange={(event) => setEventDraft({ ...eventDraft, feedUnitCost: event.target.value })}
                        placeholder="Puede valorizarse luego"
                      />
                    </label>
                  </div>
                ) : null}
                {eventDraft.type === "expense" ? (
                  <div className="field-pair">
                    <label className="form-field">
                      <span>Tipo de costo</span>
                      <select
                        value={eventDraft.expenseCategory}
                        onChange={(event) =>
                          setEventDraft({
                            ...eventDraft,
                            expenseCategory: event.target.value as PoultryExpenseCategory,
                          })
                        }
                      >
                        {poultryExpenseCategories.map((category) => (
                          <option key={category} value={category}>
                            {poultryExpenseCategoryLabels[category]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Monto S/</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={eventDraft.amount}
                        onChange={(event) => setEventDraft({ ...eventDraft, amount: event.target.value })}
                      />
                    </label>
                  </div>
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
                      {event.type === "feed_consumption"
                        ? `${event.feedKg} kg${event.amount === null ? "" : ` | ${money(event.amount)}`}`
                        : null}
                      {event.type === "expense" && event.expenseCategory
                        ? `${poultryExpenseCategoryLabels[event.expenseCategory]} | ${money(event.amount)}`
                        : null}
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
              {metrics && Number(harvestDraft.netWeightKg) > 0 && metrics.totalKnownCost > 0 ? (
                <p className="suggested-cost">
                  Costo calculado con los registros actuales:{" "}
                  <strong>
                    S/ {(metrics.totalKnownCost / Number(harvestDraft.netWeightKg)).toFixed(2)} / kg
                  </strong>
                  {metrics.costsIncomplete ? " (parcial)" : ""}
                  <button
                    type="button"
                    onClick={() =>
                      setHarvestDraft({
                        ...harvestDraft,
                        unitCost: (metrics.totalKnownCost / Number(harvestDraft.netWeightKg)).toFixed(2),
                      })
                    }
                  >
                    Usar cálculo
                  </button>
                </p>
              ) : null}
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
