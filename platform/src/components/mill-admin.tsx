"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BusinessLocation,
  FeedFormula,
  FeedFormulaVersion,
  MillBatchUsage,
  MillWorkspace,
} from "@/domain/commerce";
import {
  feedFormulaStatusLabels,
  millBatchUsageLabels,
} from "@/domain/commerce";

type MillAdminProps = {
  initialWorkspace: MillWorkspace;
  locations: BusinessLocation[];
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
  return value === null ? "Sin valorizar" : `S/ ${value.toFixed(2)}`;
}

function versionMetrics(version: FeedFormulaVersion) {
  const totalKg = version.items.reduce((sum, item) => sum + item.quantityKg, 0);
  const pricedItems = version.items.filter((item) => item.costPerKg !== null);
  const totalCost = version.items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
  const missingPrices = version.items.filter(
    (item) => item.quantityKg > 0 && item.costPerKg === null,
  ).length;
  const deltaKg = totalKg - version.targetKg;
  return {
    totalKg,
    deltaKg,
    totalPercent: version.targetKg ? (totalKg / version.targetKg) * 100 : 0,
    missingPrices,
    totalCost,
    costPerKg:
      totalKg > 0 && pricedItems.length === version.items.filter((item) => item.quantityKg > 0).length
        ? totalCost / totalKg
        : null,
    validComposition: Math.abs(deltaKg) <= 0.01,
  };
}

function latestVersion(formula: FeedFormula | null): FeedFormulaVersion | null {
  return formula?.versions[0] ?? null;
}

export function MillAdmin({ initialWorkspace, locations, editable }: MillAdminProps) {
  const router = useRouter();
  const millLocations = locations.filter((location) => location.type === "mill");
  const [selectedFormulaId, setSelectedFormulaId] = useState(initialWorkspace.formulas[0]?.id ?? "");
  const selectedFormula =
    initialWorkspace.formulas.find((formula) => formula.id === selectedFormulaId) ??
    initialWorkspace.formulas[0] ??
    null;
  const selectedVersion = latestVersion(selectedFormula);
  const metrics = selectedVersion ? versionMetrics(selectedVersion) : null;
  const approvedVersions = initialWorkspace.formulas.flatMap((formula) =>
    formula.versions
      .filter((version) => version.status === "approved")
      .map((version) => ({ formula, version, metrics: versionMetrics(version) })),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedInputId, setSelectedInputId] = useState(initialWorkspace.inputs[0]?.id ?? "");
  const [priceDraft, setPriceDraft] = useState({
    costPerKg: "",
    effectiveAt: dateInputValue(new Date()),
    supplierName: "",
  });
  const [formulaDraft, setFormulaDraft] = useState<Record<string, string>>({});
  const [formulaNotes, setFormulaNotes] = useState("");
  const [batchDraft, setBatchDraft] = useState({
    versionId: approvedVersions[0]?.version.id ?? "",
    locationId: millLocations[0]?.id ?? locations[0]?.id ?? "",
    usage: "internal_broiler" as MillBatchUsage,
    producedKg: "40",
    producedAt: dateInputValue(new Date()),
    notes: "",
  });
  const currentItemDrafts =
    selectedVersion?.items.map((item) => ({
      inputId: item.inputId,
      quantityKg: formulaDraft[item.inputId] ?? item.quantityKg.toString(),
    })) ?? [];
  const selectedInput =
    initialWorkspace.inputs.find((input) => input.id === selectedInputId) ??
    initialWorkspace.inputs[0] ??
    null;

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInput) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/molino/insumos/${selectedInput.id}/precios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        costPerKg: Number(priceDraft.costPerKg),
        effectiveAt: new Date(priceDraft.effectiveAt).toISOString(),
        supplierName: priceDraft.supplierName,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo actualizar el insumo.");
      setSaving(false);
      return;
    }
    setMessage("Precio registrado. Las fórmulas se recalcularán con el costo vigente.");
    setPriceDraft((current) => ({ ...current, costPerKg: "", supplierName: "" }));
    setSaving(false);
    router.refresh();
  }

  async function createVersion() {
    if (!selectedFormula || !selectedVersion) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/molino/formulas/${selectedFormula.id}/versiones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetKg: selectedVersion.targetKg,
        notes: formulaNotes,
        items: currentItemDrafts.map((item) => ({
          inputId: item.inputId,
          quantityKg: Number(item.quantityKg),
        })),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo crear una versión.");
      setSaving(false);
      return;
    }
    setMessage("Nueva versión creada como borrador para revisión.");
    setFormulaDraft({});
    setFormulaNotes("");
    setSaving(false);
    router.refresh();
  }

  async function approveVersion() {
    if (!selectedVersion) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/molino/versiones/${selectedVersion.id}/aprobar`, {
      method: "POST",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo aprobar la fórmula.");
      setSaving(false);
      return;
    }
    setMessage("Fórmula aprobada para producción.");
    setSaving(false);
    router.refresh();
  }

  async function produceBatch() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/molino/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...batchDraft,
        producedKg: Number(batchDraft.producedKg),
        producedAt: new Date(batchDraft.producedAt).toISOString(),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo registrar la producción.");
      setSaving(false);
      return;
    }
    setMessage("Lote de alimento producido con costo trazable.");
    setBatchDraft((current) => ({ ...current, notes: "" }));
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="mill-workspace">
      <div className="inventory-kpis">
        <article><span>Insumos activos</span><strong>{initialWorkspace.activeInputCount}</strong><small>Catálogo del molino</small></article>
        <article><span>Fórmulas aprobadas</span><strong>{initialWorkspace.approvedFormulaCount}</strong><small>Listas para producir</small></article>
        <article><span>Alimento producido</span><strong>{initialWorkspace.producedKg.toFixed(2)} kg</strong><small>Lotes registrados</small></article>
        <article><span>Saldo disponible</span><strong>{initialWorkspace.availableKg.toFixed(2)} kg</strong><small>Para consumo interno</small></article>
        <article><span>Costo promedio</span><strong>{money(initialWorkspace.averageCostPerKg)}</strong><small>Por kg producido</small></article>
      </div>

      <section className="mill-source-note">
        <strong>Base importada: Alimentacion Actual.xlsx</strong>
        <p>
          Se cargan fórmulas iniciales para 40 kg. Las versiones con totales
          distintos al 100% quedan en borrador hasta su corrección y aprobación.
        </p>
      </section>

      <div className="mill-top-grid">
        <section className="settings-panel mill-inputs">
          <div className="panel-heading">
            <div><p className="eyebrow">Costeo</p><h2>Insumos y precios</h2></div>
          </div>
          <div className="feed-input-list">
            {initialWorkspace.inputs.map((input) => (
              <button
                key={input.id}
                type="button"
                className={selectedInput?.id === input.id ? "selected" : ""}
                onClick={() => setSelectedInputId(input.id)}
              >
                <strong>{input.name}</strong>
                <span>{money(input.latestCostPerKg)} / kg</span>
              </button>
            ))}
          </div>
          {selectedInput ? (
            <form className="feed-price-form" onSubmit={savePrice}>
              <h3>Nuevo costo: {selectedInput.name}</h3>
              <div className="field-pair">
                <label className="form-field"><span>Costo S/ kg</span><input type="number" min="0" step="0.0001" required value={priceDraft.costPerKg} onChange={(event) => setPriceDraft({ ...priceDraft, costPerKg: event.target.value })} /></label>
                <label className="form-field"><span>Vigente desde</span><input type="datetime-local" value={priceDraft.effectiveAt} onChange={(event) => setPriceDraft({ ...priceDraft, effectiveAt: event.target.value })} /></label>
              </div>
              <label className="form-field"><span>Proveedor / referencia</span><input value={priceDraft.supplierName} onChange={(event) => setPriceDraft({ ...priceDraft, supplierName: event.target.value })} /></label>
              <button className="save-button" type="submit" disabled={!editable || saving}>Registrar precio</button>
            </form>
          ) : null}
        </section>

        <section className="settings-panel formula-audit">
          <div className="panel-heading">
            <div><p className="eyebrow">Formulación</p><h2>Validar fórmula</h2></div>
            <select value={selectedFormulaId} onChange={(event) => { setSelectedFormulaId(event.target.value); setFormulaDraft({}); }}>
              {initialWorkspace.formulas.map((formula) => <option key={formula.id} value={formula.id}>{formula.name}</option>)}
            </select>
          </div>
          {selectedFormula && selectedVersion && metrics ? (
            <>
              <div className="formula-header">
                <div>
                  <strong>{selectedFormula.name}</strong>
                  <small>{selectedFormula.stage} | versión {selectedVersion.version}</small>
                </div>
                <span className={`formula-status status-${selectedVersion.status}`}>{feedFormulaStatusLabels[selectedVersion.status]}</span>
              </div>
              <div className="formula-summary">
                <article><span>Total</span><strong>{metrics.totalKg.toFixed(3)} kg</strong><small>{metrics.totalPercent.toFixed(2)}%</small></article>
                <article><span>Diferencia</span><strong>{metrics.deltaKg > 0 ? "+" : ""}{metrics.deltaKg.toFixed(3)} kg</strong><small>vs. {selectedVersion.targetKg} kg</small></article>
                <article><span>Costo / kg</span><strong>{money(metrics.costPerKg)}</strong><small>{metrics.missingPrices} precios faltantes</small></article>
              </div>
              <div className="formula-items">
                {selectedVersion.items.map((item) => (
                  <label key={item.id}>
                    <span>{item.inputName}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={formulaDraft[item.inputId] ?? item.quantityKg}
                      onChange={(event) => setFormulaDraft({ ...formulaDraft, [item.inputId]: event.target.value })}
                    />
                    <small>{money(item.costPerKg)} / kg</small>
                  </label>
                ))}
              </div>
              <label className="form-field"><span>Nota de nueva versión</span><input value={formulaNotes} onChange={(event) => setFormulaNotes(event.target.value)} placeholder="Ajuste realizado y motivo" /></label>
              <div className="formula-actions">
                <button type="button" disabled={!editable || saving} onClick={createVersion}>Guardar nueva versión</button>
                <button
                  className="primary"
                  type="button"
                  disabled={!editable || saving || selectedVersion.status === "approved" || !metrics.validComposition || metrics.missingPrices > 0}
                  onClick={approveVersion}
                >
                  Aprobar versión
                </button>
              </div>
              {!metrics.validComposition ? <p className="formula-alert">Corrige el total hasta {selectedVersion.targetKg.toFixed(3)} kg para poder aprobar.</p> : null}
              {metrics.missingPrices > 0 ? <p className="formula-alert">{metrics.missingPrices} insumos usados aún no tienen precio vigente.</p> : null}
            </>
          ) : <p className="empty-history">Sin fórmulas registradas.</p>}
        </section>
      </div>

      <div className="mill-bottom-grid">
        <section className="settings-panel mill-production">
          <p className="eyebrow">Producción</p>
          <h2>Registrar lote molido</h2>
          {approvedVersions.length ? (
            <>
              <div className="field-pair">
                <label className="form-field"><span>Fórmula aprobada</span><select value={batchDraft.versionId} onChange={(event) => setBatchDraft({ ...batchDraft, versionId: event.target.value })}>{approvedVersions.map(({ formula, version, metrics: entryMetrics }) => <option key={version.id} value={version.id}>{formula.name} v{version.version} | {money(entryMetrics.costPerKg)}/kg</option>)}</select></label>
                <label className="form-field"><span>Molino / almacén</span><select value={batchDraft.locationId} onChange={(event) => setBatchDraft({ ...batchDraft, locationId: event.target.value })}>{(millLocations.length ? millLocations : locations).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              </div>
              <div className="field-pair">
                <label className="form-field"><span>Uso del alimento</span><select value={batchDraft.usage} onChange={(event) => setBatchDraft({ ...batchDraft, usage: event.target.value as MillBatchUsage })}>{Object.entries(millBatchUsageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="form-field"><span>Producido (kg)</span><input type="number" min="0.001" step="0.001" value={batchDraft.producedKg} onChange={(event) => setBatchDraft({ ...batchDraft, producedKg: event.target.value })} /></label>
              </div>
              <label className="form-field"><span>Fecha de producción</span><input type="datetime-local" value={batchDraft.producedAt} onChange={(event) => setBatchDraft({ ...batchDraft, producedAt: event.target.value })} /></label>
              <label className="form-field"><span>Observación de molienda</span><textarea rows={2} value={batchDraft.notes} onChange={(event) => setBatchDraft({ ...batchDraft, notes: event.target.value })} /></label>
              <button className="save-button" type="button" disabled={!editable || saving} onClick={produceBatch}>Registrar producción</button>
            </>
          ) : (
            <p className="formula-alert">Aprueba al menos una fórmula con precios completos para producir.</p>
          )}
        </section>

        <section className="settings-panel mill-history">
          <p className="eyebrow">Lotes elaborados</p>
          <h2>Historial de alimento</h2>
          {initialWorkspace.batches.length ? initialWorkspace.batches.map((batch) => (
            <article key={batch.id}>
              <div><strong>{batch.code}</strong><small>{batch.formulaName} v{batch.formulaVersion} | {dateLabel(batch.producedAt)}</small></div>
              <span>{millBatchUsageLabels[batch.usage]}</span>
              <b>{batch.availableKg.toFixed(3)} kg disponibles<br />{batch.producedKg.toFixed(3)} kg producidos | {money(batch.costPerKg)}/kg</b>
            </article>
          )) : <p className="empty-history">Todavía no hay lotes de alimento producidos.</p>}
        </section>
      </div>
      {message ? <p className="inventory-message form-message">{message}</p> : null}
    </section>
  );
}
