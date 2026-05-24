import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin-login";
import { SiteHeader } from "@/components/site-header";
import { managementAccessIsEnabled } from "@/lib/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Acceso de equipo",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  if (configured && (await managementAccessIsEnabled())) {
    redirect("/gestion");
  }

  return (
    <main className="management-page">
      <SiteHeader />
      <AdminLogin configured={configured} />
    </main>
  );
}
