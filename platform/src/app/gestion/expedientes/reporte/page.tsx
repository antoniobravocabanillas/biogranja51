import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DossierPrintButton } from "@/components/dossier-print-button";
import { evidenceCategoryLabels, evidenceEntityLabels } from "@/domain/commerce";
import { managementAccessIsEnabled } from "@/lib/admin-guard";
import { getDossierWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Reporte de expedientes",
  description: "Reporte imprimible de evidencia documental BioGranja 51.",
};

export const dynamic = "force-dynamic";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export default async function ExpedientesReportPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const workspace = await getDossierWorkspace();
  const generatedAt = dateLabel(new Date().toISOString());

  return (
    <main className="dossier-report">
      <header>
        <div>
          <p className="eyebrow">BioGranja 51 | Control interno</p>
          <h1>Reporte de expedientes digitales</h1>
          <p>Generado el {generatedAt}. Los archivos originales permanecen en repositorio privado.</p>
        </div>
        <div className="dossier-report-actions">
          <Link href="/gestion/expedientes">Volver</Link>
          <DossierPrintButton />
        </div>
      </header>
      <section className="dossier-report-kpis">
        <article><span>Evidencias activas</span><strong>{workspace.activeEvidenceCount}</strong></article>
        <article><span>Casos controlados</span><strong>{workspace.targets.length}</strong></article>
        <article><span>Completos</span><strong>{workspace.completeTargetCount}</strong></article>
        <article><span>Cobertura</span><strong>{workspace.coveragePercent === null ? "Sin casos" : `${workspace.coveragePercent.toFixed(0)}%`}</strong></article>
      </section>
      <section className="dossier-report-table">
        <div className="dossier-report-row heading">
          <span>Expediente</span>
          <span>Respaldo requerido</span>
          <span>Evidencia activa</span>
          <span>Resultado</span>
        </div>
        {workspace.targets.map((target) => (
          <article className="dossier-report-row" key={target.key}>
            <div>
              <strong>{target.label}</strong>
              <small>{evidenceEntityLabels[target.type]} | {target.detail}</small>
            </div>
            <p>{target.expectedCategories.map((category) => evidenceCategoryLabels[category]).join(", ")}</p>
            <p>
              {target.evidence.length
                ? target.evidence.map((entry) => entry.title).join(", ")
                : "Sin archivo"}
            </p>
            <b className={target.complete ? "complete" : "pending"}>
              {target.complete ? "Completo" : "Pendiente"}
            </b>
          </article>
        ))}
        {!workspace.targets.length ? <p className="empty-history">Sin casos exigibles registrados.</p> : null}
      </section>
      {workspace.evidence.some((entry) => entry.status === "voided") ? (
        <section className="dossier-report-voided">
          <h2>Evidencias anuladas conservadas en bitacora</h2>
          {workspace.evidence.filter((entry) => entry.status === "voided").map((entry) => (
            <p key={entry.id}>
              {entry.title} | {evidenceCategoryLabels[entry.category]} | {dateLabel(entry.createdAt)} | {entry.voidReason}
            </p>
          ))}
        </section>
      ) : null}
    </main>
  );
}
