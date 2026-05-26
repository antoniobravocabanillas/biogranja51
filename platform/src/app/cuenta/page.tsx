import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerAuth } from "@/components/customer-auth";
import { SiteHeader } from "@/components/site-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mi cuenta",
};

export const dynamic = "force-dynamic";

export default async function CustomerAccountPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/mi-cuenta");
  }

  return (
    <main className="public-page">
      <SiteHeader />
      <CustomerAuth configured={configured} />
    </main>
  );
}
