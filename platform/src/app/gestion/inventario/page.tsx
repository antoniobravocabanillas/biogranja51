import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InventoryAdmin } from "@/components/inventory-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState, getInventoryWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Inventario comercial",
  description: "Stock listo para venta, mermas y trazabilidad de BioGranja 51.",
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
          <h1>Inventario comercial</h1>
          <p>
            Administra producto listo para entregar: carnes compradas procesadas
            y liberadas bajo cadena de frio, o pollo propio despues de faena.
            Los animales vivos se controlan en Crianza avicola.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Cuarentena obligatoria</strong>
          <span>
            Las compras solo se asignan a pedidos despues de registrar evidencia
            e inspeccion sanitaria del equipo.
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
