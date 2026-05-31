import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeliveryPortal } from "@/components/delivery-portal";
import { SiteHeader } from "@/components/site-header";
import { getAccountContext, getDeliveryPortalWorkspace } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portal de reparto",
};

export const dynamic = "force-dynamic";

export default async function DeliveryPortalPage() {
  if (!isSupabaseConfigured()) redirect("/gestion/login");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/reparto/login");

  const context = await getAccountContext();
  if (context.accountType === "staff") redirect("/gestion/pedidos");
  if (context.accountType !== "delivery") redirect(context.destination || "/gestion/login");

  const workspace = await getDeliveryPortalWorkspace();

  return (
    <main className="public-page">
      <SiteHeader />
      <section className="delivery-dashboard-heading">
        <div>
          <p className="eyebrow">Ultima milla</p>
          <h1>Mis entregas</h1>
          <p>Ruta, cliente, control termico y cierre de entrega desde un solo lugar.</p>
        </div>
      </section>
      <DeliveryPortal initialWorkspace={workspace} />
    </main>
  );
}
