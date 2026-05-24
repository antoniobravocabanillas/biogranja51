import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/password-reset-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Nueva contraseña",
};

export default function RestablecerPage() {
  return (
    <main className="management-page">
      <SiteHeader />
      <PasswordResetForm />
    </main>
  );
}
