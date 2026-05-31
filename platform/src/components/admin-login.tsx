"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountContext } from "@/domain/commerce";
import { createClient } from "@/lib/supabase/client";

type AdminLoginProps = {
  configured: boolean;
};

function signInErrorMessage(code?: string) {
  switch (code) {
    case "email_not_confirmed":
      return "Tu correo aún no está confirmado. Revisa el enlace de activación o contacta al administrador.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.";
    case "invalid_credentials":
      return "Correo o contraseña incorrectos. Usa Mostrar para comprobar la clave escrita.";
    default:
      return "No se pudo iniciar sesión. Intenta nuevamente o contacta al administrador.";
  }
}

export function AdminLogin({ configured }: AdminLoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      return;
    }
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setMessage(signInErrorMessage(error.code));
      setLoading(false);
      return;
    }
    const contextResponse = await fetch("/api/auth/context");
    const context = contextResponse.ok
      ? ((await contextResponse.json()) as AccountContext)
      : { accountType: "unknown", destination: "/gestion/login" };
    router.replace(context.accountType === "customer" ? "/mi-cuenta" : context.destination || "/gestion");
    router.refresh();
  }

  if (!configured) {
    return (
      <section className="login-panel">
        <p className="eyebrow">Configuración pendiente</p>
        <h1>Conecta Supabase para activar acceso seguro</h1>
        <p>
          En desarrollo local el panel puede seguir operando con datos de prueba.
          En producción se habilita únicamente con Supabase Auth y roles.
        </p>
        <Link className="button-primary" href="/gestion">
          Volver a gestión local
        </Link>
      </section>
    );
  }

  return (
    <form className="login-panel" onSubmit={signIn}>
      <p className="eyebrow">Centro de gestión</p>
      <h1>Acceso operativo</h1>
      <p>Ingresa con tu cuenta autorizada. El sistema te llevara a gestion o reparto segun tu perfil.</p>
      <label className="form-field">
        <span>Correo</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <div className="form-field">
        <label htmlFor="staff-password">Contraseña</label>
        <div className="password-input">
          <input
            id="staff-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            className="password-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      <Link className="password-recovery-link" href="/gestion/recuperar">
        ¿Olvidaste tu contraseña?
      </Link>
      {message ? <p className="form-message">{message}</p> : null}
      <button className="save-button" disabled={loading} type="submit">
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
