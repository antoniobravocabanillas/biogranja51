import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DossierAdmin } from "@/components/dossier-admin";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled, writesAreEnabled } from "@/lib/admin-guard";
import { getDossierWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Expedientes digitales",
  description: "Evidencias privadas y cobertura documental de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function ExpedientesPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const [workspace, editable] = await Promise.all([getDossierWorkspace(), writesAreEnabled()]);

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Gobierno documental</p>
          <h1>Expedientes digitales</h1>
          <p>
            Centraliza guias, temperaturas, liberaciones, comprobantes, cobros
            y constancias de entrega con acceso restringido para auditoria.
          </p>
        </div>
        <aside className="security-notice">
          <strong>Repositorio privado</strong>
          <span>
            Los archivos no son publicos: solo el equipo autorizado obtiene
            enlaces temporales de descarga.
          </span>
        </aside>
      </section>
      <DossierAdmin workspace={workspace} editable={editable} />
    </main>
  );
}
