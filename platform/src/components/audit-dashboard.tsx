import Link from "next/link";
import type { AuditWorkspace } from "@/domain/commerce";

type AuditDashboardProps = {
  workspace: AuditWorkspace;
};

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function eventLabel(action: string): string {
  const labels: Record<string, string> = {
    "inventory_lot.created": "Ingreso de inventario comercial",
    "inventory_lot.movement": "Movimiento de inventario",
    "inventory_lot.sanitary_received": "Compra recibida en cuarentena",
    "inventory_lot.sanitary_evidence_recorded": "Expediente sanitario registrado",
    "inventory_lot.sanitary_reviewed": "Liberacion sanitaria revisada",
    "bird_batch.inventory_handoff": "Faena a inventario",
    "bird_batch.feed_valued": "Valorizacion de alimento",
    "layer_flock.inventory_handoff": "Maples a inventario",
    "mill_batch.created": "Lote de alimento producido",
    "mill_batch.consumed_broiler": "Alimento consumido por pollos",
    "mill_batch.consumed_layers": "Alimento consumido por ponedoras",
    "feed_input_lot.received": "Insumo recibido",
    "feed_input_lot.quality_reviewed": "Calidad de insumo revisada",
    "order.status_transition": "Estado de pedido actualizado",
    "order_payment.registered": "Cobro registrado",
    "order_payment.reviewed": "Cobro conciliado o rechazado",
    "sales_receipt.issued": "Comprobante emitido",
    "sales_receipt.voided": "Comprobante anulado",
    "order_expense.recorded": "Gasto de pedido registrado",
    "audit_evidence.registered": "Evidencia privada anexada",
    "audit_evidence.voided": "Evidencia anulada",
    "inventory_lot.traceability_published": "Ficha QR de lote publicada",
    "inventory_lot.traceability_unpublished": "Ficha QR de lote ocultada",
  };
  return labels[action] ?? action;
}

export function AuditDashboard({ workspace }: AuditDashboardProps) {
  const traceability =
    workspace.totalInventoryLots > 0
      ? (workspace.traceableInventoryLots / workspace.totalInventoryLots) * 100
      : null;

  return (
    <section className="audit-workspace">
      <div className="inventory-kpis">
        <article>
          <span>Alertas criticas</span>
          <strong>{workspace.criticalCount}</strong>
          <small>Bloquean margen o trazabilidad</small>
        </article>
        <article>
          <span>Advertencias</span>
          <strong>{workspace.warningCount}</strong>
          <small>Requieren regularizacion</small>
        </article>
        <article>
          <span>Trazabilidad comercial</span>
          <strong>{traceability === null ? "Sin lotes" : `${traceability.toFixed(0)}%`}</strong>
          <small>Lotes con costo y origen</small>
        </article>
        <article>
          <span>Insumo aprobado</span>
          <strong>{workspace.approvedInputKg.toFixed(2)} kg</strong>
          <small>Habilitado para molienda</small>
        </article>
        <article>
          <span>Alimento producido</span>
          <strong>{workspace.producedFeedKg.toFixed(2)} kg</strong>
          <small>Produccion acumulada</small>
        </article>
        <article>
          <span>Frio liberado</span>
          <strong>{workspace.approvedCommercialLots}/{workspace.controlledCommercialLots}</strong>
          <small>Lotes comprados aprobados</small>
        </article>
        <article>
          <span>Ingresos conciliados</span>
          <strong>S/ {workspace.reconciledRevenue.toFixed(2)}</strong>
          <small>Cobros verificados</small>
        </article>
        <article>
          <span>Cuentas por cobrar</span>
          <strong>S/ {workspace.accountsReceivable.toFixed(2)}</strong>
          <small>Saldo no conciliado</small>
        </article>
        <article>
          <span>Margen auditado</span>
          <strong>S/ {workspace.auditedMargin.toFixed(2)}</strong>
          <small>Entregado y cerrado</small>
        </article>
        <article>
          <span>Expediente digital</span>
          <strong>
            {workspace.documentaryCoveragePercent === null
              ? "Sin casos"
              : `${workspace.documentaryCoveragePercent.toFixed(0)}%`}
          </strong>
          <small>{workspace.activeEvidenceCount} archivos privados activos</small>
        </article>
        <article>
          <span>QR trazables</span>
          <strong>{workspace.publishedTraceabilityLots}</strong>
          <small>Lotes con ficha publica activa</small>
        </article>
      </div>

      <div className="audit-layout">
        <section className="settings-panel audit-findings">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Control interno</p>
              <h2>Hallazgos pendientes</h2>
            </div>
            <span className="audit-count">{workspace.issues.length} abiertos</span>
          </div>
          {workspace.issues.length ? workspace.issues.map((issue) => (
            <article className={`audit-issue audit-${issue.severity}`} key={issue.id}>
              <span>{issue.area}</span>
              <div>
                <strong>{issue.title}</strong>
                <p>{issue.detail}</p>
              </div>
              <Link href={issue.href}>Resolver</Link>
            </article>
          )) : (
            <p className="audit-clean">
              Sin excepciones automáticas abiertas. Continúa anexando comprobantes
              y evidencias para una auditoría documental completa.
            </p>
          )}
        </section>

        <aside className="settings-panel audit-events">
          <p className="eyebrow">Bitacora</p>
          <h2>Ultimos eventos</h2>
          <p className="audit-event-note">
            {workspace.auditEventCount} operaciones recientes disponibles para revision.
          </p>
          {workspace.events.length ? workspace.events.map((event) => (
            <article key={event.id}>
              <strong>{eventLabel(event.action)}</strong>
              <span>{event.entity}</span>
              <small>{dateLabel(event.createdAt)}</small>
            </article>
          )) : (
            <p className="empty-history">Aun no hay eventos auditables visibles.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
