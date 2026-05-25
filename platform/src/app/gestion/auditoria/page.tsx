import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuditDashboard } from "@/components/audit-dashboard";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled } from "@/lib/admin-guard";
import { getAuditWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Auditoria operativa",
  description: "Excepciones, evidencia y trazabilidad integral de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const audit = await getAuditWorkspace();

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Gobierno y evidencia</p>
          <h1>Auditoria integral</h1>
          <p>
            Revisa excepciones que impiden demostrar origen, costo y margen:
            calidad de insumos, valorizacion productiva e inventario asignado.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Control vivo</strong>
          <span>
            Este tablero señala brechas automaticas. La evidencia sanitaria,
            tributaria y de frio se incorporara en el siguiente bloque.
          </span>
        </aside>
      </section>
      <AuditDashboard workspace={audit} />
    </main>
  );
}
