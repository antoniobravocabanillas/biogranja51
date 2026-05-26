import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { originLabels } from "@/domain/commerce";
import { getPublicLotTraceability } from "@/lib/commerce-store";

type TraceabilityPageProps = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trazabilidad de lote",
  description: "Origen y controles verificables de un lote BioGranja 51.",
};

function dateLabel(value: string | null): string {
  if (!value) return "No aplica";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export default async function TraceabilityPage({ params }: TraceabilityPageProps) {
  const { token } = await params;
  const traceability = await getPublicLotTraceability(token);
  if (!traceability) notFound();

  return (
    <main className="public-page traceability-page">
      <SiteHeader />
      <section className="traceability-hero">
        <div>
          <p className="eyebrow">Origen claro | Lote verificado</p>
          <h1>{traceability.productName}</h1>
          <p className="traceability-code">{traceability.lotCode}</p>
          <p className="traceability-summary">{traceability.publicSummary}</p>
        </div>
        <aside className="traceability-status">
          <span>Control BioGranja 51</span>
          <strong>Verificado</strong>
          <small>{traceability.verificationLabel}</small>
        </aside>
      </section>

      <section className="traceability-card">
        <div className="traceability-grid">
          <article><span>Producto</span><strong>{traceability.presentation}</strong></article>
          <article><span>Origen declarado</span><strong>{originLabels[traceability.originType]}</strong></article>
          <article><span>Procedencia</span><strong>{traceability.sourceLabel}</strong></article>
          <article><span>Procesado o recibido</span><strong>{dateLabel(traceability.producedOrReceivedAt)}</strong></article>
          <article><span>Consumo recomendado antes de</span><strong>{dateLabel(traceability.expiresAt)}</strong></article>
          <article><span>Publicacion del control</span><strong>{dateLabel(traceability.publishedAt)}</strong></article>
        </div>
        <div className="traceability-privacy">
          <h2>Lo que significa este control</h2>
          <p>
            Esta ficha confirma la procedencia declarada y las validaciones
            habilitadas para el lote. Documentos internos, costos y datos de
            proveedores permanecen protegidos en nuestro sistema de gestion.
          </p>
        </div>
      </section>
      <section className="traceability-cta">
        <h2>Confianza alimentaria, no solo producto.</h2>
        <Link className="button-primary" href="/#productos">Ver productos</Link>
      </section>
    </main>
  );
}
