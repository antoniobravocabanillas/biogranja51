import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConfigurationAdmin } from "@/components/configuration-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Configuración operativa",
  description: "Delivery, pagos, sedes y roles de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const state = await getCommerceState();

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading compact-admin">
        <div>
          <p className="eyebrow">Operación escalable</p>
          <h1>Delivery, pagos y estructura</h1>
          <p>
            La comercializadora inicia con una tienda y un almacén/molino,
            pero el modelo admite nuevas sedes y responsables.
          </p>
        </div>
      </section>
      <ConfigurationAdmin initialState={state} editable={await writesAreEnabled()} />
    </main>
  );
}
