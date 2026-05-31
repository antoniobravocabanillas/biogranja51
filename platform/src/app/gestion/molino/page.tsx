import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManagementNav } from "@/components/management-nav";
import { MillAdmin } from "@/components/mill-admin";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState, getMillWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Molino y formulación",
  description: "Insumos, fórmulas versionadas y lotes de alimento de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function MolinoPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const [state, mill, editable] = await Promise.all([
    getCommerceState(),
    getMillWorkspace(),
    writesAreEnabled(),
  ]);

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Nutrición y costo propio</p>
          <h1>Molino y fórmulas</h1>
          <p>
            Recibe materia prima con documento y calidad, valida fórmulas de
            alimento y produce lotes internos con costo real trazable.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Fórmula validada</strong>
          <span>
            Solo se produce con fórmula aprobada y saldo de insumos liberado
            por control de calidad.
          </span>
        </aside>
      </section>
      <MillAdmin
        initialWorkspace={mill}
        locations={state.locations}
        editable={editable}
      />
    </main>
  );
}
