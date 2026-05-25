import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InventoryAdmin } from "@/components/inventory-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState, getInventoryWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Inventario y lotes",
  description: "Recepción, stock, mermas y trazabilidad operativa de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const [state, inventory, editable] = await Promise.all([
    getCommerceState(),
    getInventoryWorkspace(),
    writesAreEnabled(),
  ]);

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Trazabilidad operativa</p>
          <h1>Inventario y lotes</h1>
          <p>
            Recibe producto por origen, controla costos y mermas, y reserva el
            lote exacto que se prepara para cada pedido.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Control por lote activo</strong>
          <span>
            Las existencias y asignaciones solo pueden modificarse con acceso
            autenticado del equipo.
          </span>
        </aside>
      </section>
      <InventoryAdmin
        initialWorkspace={inventory}
        products={state.products}
        locations={state.locations}
        editable={editable}
      />
    </main>
  );
}
