import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin-login";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled } from "@/lib/admin-guard";
import { getAccountContext } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Acceso de equipo",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      const context = await getAccountContext();
      if (context.accountType !== "unknown") {
        redirect(context.destination);
      }
      if (await managementAccessIsEnabled()) {
        redirect("/gestion");
      }
    }
  }

  return (
    <main className="management-page">
      <SiteHeader />
      <AdminLogin configured={configured} />
    </main>
  );
}
