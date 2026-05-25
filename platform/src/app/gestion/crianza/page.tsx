import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PoultryAdmin } from "@/components/poultry-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState, getPoultryWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Crianza avícola",
  description: "Ingreso de pollitos, desarrollo y salida faenada de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function CrianzaPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const [state, poultry, editable] = await Promise.all([
    getCommerceState(),
    getPoultryWorkspace(),
    writesAreEnabled(),
  ]);

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Producción viva</p>
          <h1>Crianza avícola</h1>
          <p>
            Aquí ingresan pollitos vivos. Seguimos cantidad, peso, alimento y
            mortalidad hasta la faena; solo después pasan a inventario vendible.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Flujo separado</strong>
          <span>
            Un ave en crianza no es stock de venta. La salida faenada genera
            el lote comercial trazable.
          </span>
        </aside>
      </section>
      <PoultryAdmin
        initialWorkspace={poultry}
        locations={state.locations}
        products={state.products}
        editable={editable}
      />
    </main>
  );
}
