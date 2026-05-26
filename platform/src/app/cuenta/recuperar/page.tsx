import type { Metadata } from "next";
import { PasswordRecoveryRequest } from "@/components/password-recovery-request";
import { SiteHeader } from "@/components/site-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Recuperar mi cuenta",
};

export default function CustomerRecoveryPage() {
  return (
    <main className="public-page">
      <SiteHeader />
      <PasswordRecoveryRequest configured={isSupabaseConfigured()} customer />
    </main>
  );
}
