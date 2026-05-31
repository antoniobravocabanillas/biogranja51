import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManagementNav } from "@/components/management-nav";
import { ProductAdmin } from "@/components/product-admin";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getCommerceState } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Productos y precios",
  description: "Administración del catálogo comercial de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const usingSupabase = isSupabaseConfigured();

  if (usingSupabase && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const state = await getCommerceState();
  const editable = await writesAreEnabled();

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Administración comercial</p>
          <h1>Productos y precios</h1>
          <p>
            Publica, edita y desactiva productos. Los cambios actualizan el
            catálogo que ve el cliente.
          </p>
        </div>
        <aside className="security-notice">
          <strong>
            {usingSupabase && editable
              ? "Acceso administrativo activo"
              : editable
                ? "Modo local editable"
                : "Edición protegida"}
          </strong>
          <span>
            {usingSupabase && editable
              ? "Sesión autenticada. Los cambios se publican desde Supabase."
              : editable
              ? "Antes de producción conectaremos autenticación y auditoría."
              : "Configura acceso administrativo para modificar información."}
          </span>
        </aside>
      </section>
      <ProductAdmin initialProducts={state.products} editable={editable} />
    </main>
  );
}
