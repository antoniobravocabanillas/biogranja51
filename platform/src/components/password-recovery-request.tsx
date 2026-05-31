"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type PasswordRecoveryRequestProps = {
  configured: boolean;
  customer?: boolean;
};

export function PasswordRecoveryRequest({ configured, customer = false }: PasswordRecoveryRequestProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      return;
    }

    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const redirectTo =
      `${window.location.origin}/auth/confirm?next=${customer ? "/cuenta/restablecer" : "/gestion/restablecer"}`;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    );

    if (error) {
      setMessage(
        error.code === "over_email_send_rate_limit"
          ? "Ya se solicitó un enlace recientemente. Espera unos minutos antes de reenviarlo."
          : "No pudimos enviar el enlace. Intenta nuevamente en unos minutos.",
      );
      setLoading(false);
      return;
    }

    setSent(true);
    setMessage(
      "Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.",
    );
    setLoading(false);
  }

  return (
    <form className="login-panel" onSubmit={sendRecovery}>
      <p className="eyebrow">{customer ? "Mi cuenta" : "Recuperación segura"}</p>
      <h1>Restablecer contraseña</h1>
      <p>
        Ingresa el correo de tu {customer ? "cuenta BioGranja" : "cuenta administrativa"}.
        Te enviaremos un enlace temporal para definir una nueva contraseña.
      </p>
      <label className="form-field">
        <span>Correo</span>
        <input
          autoComplete="email"
          disabled={sent}
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {message ? <p className="form-message">{message}</p> : null}
      {!sent ? (
        <button className="save-button" disabled={loading || !configured} type="submit">
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      ) : null}
      <Link className="password-back-link" href={customer ? "/cuenta" : "/gestion/login"}>
        Volver al acceso
      </Link>
    </form>
  );
}
