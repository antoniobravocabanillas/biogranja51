import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EggsAdmin } from "@/components/eggs-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState, getEggWorkspace, getMillWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Producción de huevos",
  description: "Ponedoras, postura, costos y empaque trazable de maples en BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function HuevosPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const [state, eggs, mill, editable] = await Promise.all([
    getCommerceState(),
    getEggWorkspace(),
    getMillWorkspace(),
    writesAreEnabled(),
  ]);

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Producción diaria</p>
          <h1>Huevos y ponedoras</h1>
          <p>
            Controla el lote vivo de ponedoras, postura, descarte y costo de
            producción. Solo los maples empacados pasan a inventario comercial.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Origen verificable</strong>
          <span>
            Para vender huevos como producción propia, el producto debe estar
            marcado como origen propio y respaldado por este lote.
          </span>
        </aside>
      </section>
      <EggsAdmin
        initialWorkspace={eggs}
        locations={state.locations}
        products={state.products}
        millBatches={mill.batches.filter((batch) => batch.usage === "internal_layers" && batch.availableKg > 0)}
        editable={editable}
      />
    </main>
  );
}
