import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin-login";
import { SiteHeader } from "@/components/site-header";
import { getAccountContext } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Acceso reparto",
};

export const dynamic = "force-dynamic";

export default async function DeliveryLoginPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      const context = await getAccountContext();
      if (context.accountType === "delivery" || context.accountType === "staff") {
        redirect(context.destination);
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
