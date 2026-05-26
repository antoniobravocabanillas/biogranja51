import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerPortal } from "@/components/customer-portal";
import { SiteHeader } from "@/components/site-header";
import { getCustomerPortalWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mis pedidos",
};

export const dynamic = "force-dynamic";

export default async function CustomerPortalPage() {
  if (!isSupabaseConfigured()) redirect("/cuenta");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/cuenta");

  const workspace = await getCustomerPortalWorkspace();
  return (
    <main className="public-page">
      <SiteHeader />
      <section className="customer-dashboard-heading">
        <div>
          <p className="eyebrow">Mi BioGranja</p>
          <h1>Mis pedidos</h1>
          <p>Revisa tu compra y sigue la entrega con claridad.</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <input name="next" type="hidden" value="/cuenta" />
          <button className="button-secondary" type="submit">Cerrar sesión</button>
        </form>
      </section>
      <CustomerPortal initialWorkspace={workspace} />
    </main>
  );
}
