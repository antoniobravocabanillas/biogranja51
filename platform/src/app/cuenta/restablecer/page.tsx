import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/password-reset-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Nueva contraseña",
};

export default function CustomerPasswordPage() {
  return (
    <main className="public-page">
      <SiteHeader />
      <PasswordResetForm customer />
    </main>
  );
}
