import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomersAdmin } from "@/components/customers-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState, listCustomersWithMetrics } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Clientes y recurrencia",
  description: "CRM comercial y seguimiento de recompra de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const [state, customers, editable] = await Promise.all([
    getCommerceState(),
    listCustomersWithMetrics(),
    writesAreEnabled(),
  ]);

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Relación y recompra</p>
          <h1>Clientes</h1>
          <p>
            Consolida cada hogar por celular, registra preferencias y convierte
            pedidos aislados en relaciones recurrentes.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Datos protegidos</strong>
          <span>
            Este módulo solo está disponible al equipo autenticado y prepara
            suscripciones y seguimiento comercial.
          </span>
        </aside>
      </section>
      <CustomersAdmin
        initialCustomers={customers}
        deliveryZones={state.deliveryZones}
        editable={editable}
      />
    </main>
  );
}
