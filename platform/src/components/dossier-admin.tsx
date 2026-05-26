"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { DossierTarget, DossierWorkspace, EvidenceCategory } from "@/domain/commerce";
import { evidenceCategoryLabels, evidenceEntityLabels } from "@/domain/commerce";

type DossierAdminProps = {
  workspace: DossierWorkspace;
  editable: boolean;
};

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function fileSizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(Math.round(bytes / 1024), 1)} KB`;
}

function missingCategories(target: DossierTarget): EvidenceCategory[] {
  return target.expectedCategories.filter(
    (category) => !target.evidence.some((evidence) => evidence.category === category),
  );
}

export function DossierAdmin({ workspace, editable }: DossierAdminProps) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState(workspace.targets[0]?.key ?? "");
  const [category, setCategory] = useState<EvidenceCategory>(
    workspace.targets[0]?.expectedCategories[0] ?? "other",
  );
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = workspace.targets.find((target) => target.key === selectedKey) ?? workspace.targets[0] ?? null;

  function selectTarget(target: DossierTarget) {
    setSelectedKey(target.key);
    setCategory(missingCategories(target)[0] ?? target.expectedCategories[0] ?? "other");
    setMessage("");
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editable) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) {
      setMessage("Selecciona un archivo.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("entityType", selected.type);
    body.append("entityId", selected.id);
    body.append("category", category);
    body.append("title", title.trim());
    body.append("notes", notes.trim());
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/expedientes", { method: "POST", body });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo anexar la evidencia.");
      setSaving(false);
      return;
    }
    form.reset();
    setTitle("");
    setNotes("");
    setMessage("Evidencia almacenada de forma privada.");
    setSaving(false);
    router.refresh();
  }

  async function voidEvidence(id: string) {
    if (!editable) return;
    const reason = window.prompt("Motivo de anulacion del respaldo:");
    if (!reason?.trim()) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/expedientes/${id}/anulacion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo anular el respaldo.");
      setSaving(false);
      return;
    }
    setMessage("Evidencia anulada; el registro permanece en la bitacora.");
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="dossier-workspace">
      <div className="inventory-kpis">
        <article><span>Evidencias activas</span><strong>{workspace.activeEvidenceCount}</strong><small>Archivos protegidos</small></article>
        <article><span>Expedientes cubiertos</span><strong>{workspace.completeTargetCount}</strong><small>Con respaldo requerido</small></article>
        <article><span>Pendientes</span><strong>{workspace.pendingTargetCount}</strong><small>Requieren adjuntos</small></article>
        <article><span>Cobertura documental</span><strong>{workspace.coveragePercent === null ? "Sin casos" : `${workspace.coveragePercent.toFixed(0)}%`}</strong><small>Control exigible actual</small></article>
      </div>

      <div className="dossier-grid">
        <section className="records-panel dossier-targets">
          <div className="panel-heading">
            <div><p className="eyebrow">Casos exigibles</p><h2>{workspace.targets.length} expedientes</h2></div>
            <Link href="/gestion/expedientes/reporte">Reporte</Link>
          </div>
          {workspace.targets.length ? workspace.targets.map((target) => (
            <button
              className={selected?.key === target.key ? "selected" : ""}
              key={target.key}
              onClick={() => selectTarget(target)}
              type="button"
            >
              <div>
                <strong>{target.label}</strong>
                <small>{evidenceEntityLabels[target.type]} | {target.detail}</small>
              </div>
              <span className={target.complete ? "covered" : "pending"}>
                {target.complete ? "Completo" : `${missingCategories(target).length} pendiente(s)`}
              </span>
            </button>
          )) : <p className="empty-history">Todavia no hay operaciones que requieran expediente.</p>}
        </section>

        <section className="settings-panel dossier-detail">
          {selected ? (
            <>
              <div className="panel-heading">
                <div><p className="eyebrow">Archivo privado</p><h2>{selected.label}</h2></div>
                <Link href={selected.href}>Ver origen</Link>
              </div>
              <p className="dossier-requirement">
                Requerido: {selected.expectedCategories.map((entry) => evidenceCategoryLabels[entry]).join(", ")}.
              </p>
              <form className="dossier-form" onSubmit={uploadEvidence}>
                <div className="field-pair">
                  <label className="form-field">
                    <span>Tipo de respaldo</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value as EvidenceCategory)}>
                      {Object.entries(evidenceCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Titulo</span>
                    <input required minLength={3} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Guia del proveedor mayo" />
                  </label>
                </div>
                <label className="form-field">
                  <span>Archivo protegido</span>
                  <input accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" name="file" required type="file" />
                  <small>PDF o imagen, maximo 10 MB. Disponible solo para usuarios autorizados.</small>
                </label>
                <label className="form-field">
                  <span>Nota de auditoria</span>
                  <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Referencia, responsable o validacion" />
                </label>
                <button className="save-button" disabled={!editable || saving} type="submit">Adjuntar evidencia</button>
              </form>
              <div className="dossier-files">
                <h3>Documentos anexados</h3>
                {selected.evidence.length ? selected.evidence.map((evidence) => (
                  <article key={evidence.id}>
                    <div>
                      <strong>{evidence.title}</strong>
                      <small>{evidenceCategoryLabels[evidence.category]} | {evidence.fileName} | {fileSizeLabel(evidence.fileSize)}</small>
                      <small>{dateLabel(evidence.createdAt)}{evidence.notes ? ` | ${evidence.notes}` : ""}</small>
                    </div>
                    <a href={`/api/expedientes/${evidence.id}/descarga`} target="_blank" rel="noreferrer">Abrir</a>
                    <button disabled={!editable || saving} onClick={() => voidEvidence(evidence.id)} type="button">Anular</button>
                  </article>
                )) : <p className="empty-history">Sin documentos activos para este expediente.</p>}
              </div>
              {message ? <p className="form-message">{message}</p> : null}
            </>
          ) : <p className="empty-history">Selecciona un expediente para adjuntar evidencias.</p>}
        </section>
      </div>
    </section>
  );
}
