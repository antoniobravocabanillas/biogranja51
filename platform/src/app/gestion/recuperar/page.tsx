import type { Metadata } from "next";
import { PasswordRecoveryRequest } from "@/components/password-recovery-request";
import { SiteHeader } from "@/components/site-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Restablecer contraseña",
};

export default function RecuperarPage() {
  return (
    <main className="management-page">
      <SiteHeader />
      <PasswordRecoveryRequest configured={isSupabaseConfigured()} />
    </main>
  );
}
