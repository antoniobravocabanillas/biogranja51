import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinanceAdmin } from "@/components/finance-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState, getFinanceWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Finanzas y conciliacion",
  description: "Cobros, comprobantes y margen auditable de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function FinanzasPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const [state, workspace, editable] = await Promise.all([
    getCommerceState(),
    getFinanceWorkspace(),
    writesAreEnabled(),
  ]);
  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Control financiero</p>
          <h1>Cobros y margen</h1>
          <p>
            Concilia Yape, Plin o transferencias; registra comprobantes y gastos
            por pedido para conocer margen basado en evidencia.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Cierre auditable</strong>
          <span>
            Un pedido entregado debe quedar cobrado, comprobado y costeado para
            incorporarse al margen validado.
          </span>
        </aside>
      </section>
      <FinanceAdmin workspace={workspace} paymentMethods={state.paymentMethods} editable={editable} />
    </main>
  );
}
