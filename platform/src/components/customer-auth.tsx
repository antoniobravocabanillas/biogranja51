"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountContext } from "@/domain/commerce";
import { createClient } from "@/lib/supabase/client";

type CustomerAuthProps = {
  configured: boolean;
};

type AuthMode = "signin" | "signup";

function customerAuthError(code?: string): string {
  switch (code) {
    case "email_not_confirmed":
      return "Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Este correo ya tiene cuenta. Ingresa con tu contraseña.";
    case "weak_password":
      return "Elige una contraseña más segura, de al menos 8 caracteres.";
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Espera unos minutos antes de volver a intentarlo.";
    default:
      return "No se pudo completar el acceso. Intenta nuevamente.";
  }
}

export function CustomerAuth({ configured }: CustomerAuthProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;

    setLoading(true);
    setMessage("");
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setMessage(customerAuthError(error.code));
        setLoading(false);
        return;
      }
      const contextResponse = await fetch("/api/auth/context");
      const context = contextResponse.ok
        ? ((await contextResponse.json()) as AccountContext)
        : { accountType: "customer", destination: "/mi-cuenta" };
      router.replace(context.destination || "/mi-cuenta");
      router.refresh();
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (name.trim().length < 2 || normalizedPhone.length < 9 || password.length < 8) {
      setMessage("Completa tu nombre, celular y una contraseña de al menos 8 caracteres.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/mi-cuenta`,
        data: {
          account_type: "customer",
          full_name: name.trim(),
          phone: phone.trim(),
        },
      },
    });
    if (error) {
      setMessage(customerAuthError(error.code));
      setLoading(false);
      return;
    }
    if (data.session) {
      const contextResponse = await fetch("/api/auth/context");
      const context = contextResponse.ok
        ? ((await contextResponse.json()) as AccountContext)
        : { accountType: "customer", destination: "/mi-cuenta" };
      router.replace(context.destination || "/mi-cuenta");
      router.refresh();
      return;
    }
    setMessage("Cuenta creada. Revisa tu correo para confirmar el acceso y ver tus pedidos.");
    setLoading(false);
  }

  return (
    <section className="customer-access">
      <div className="customer-access-copy">
        <p className="eyebrow">Tu cuenta BioGranja</p>
        <h1>Tu compra, visible de principio a fin.</h1>
        <p>
          Sigue confirmación, preparación, despacho y entrega desde un espacio
          privado. Tus nuevos pedidos quedarán conectados a tu perfil.
        </p>
        <div className="customer-account-benefits">
          <span>Estado en tiempo real</span>
          <span>Ventana de entrega</span>
          <span>Historial de compras</span>
        </div>
        <Link className="customer-team-link" href="/gestion/login">
          Acceso para equipo y reparto
        </Link>
      </div>
      <form className="login-panel customer-login" onSubmit={submit}>
        <div className="customer-auth-tabs" aria-label="Tipo de acceso">
          <button className={mode === "signin" ? "active" : ""} type="button" onClick={() => { setMode("signin"); setMessage(""); }}>
            Ingresar
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => { setMode("signup"); setMessage(""); }}>
            Crear cuenta
          </button>
        </div>
        <p className="eyebrow">{mode === "signin" ? "Bienvenido de vuelta" : "Registro fácil"}</p>
        <h2>{mode === "signin" ? "Ver mis pedidos" : "Crear mi perfil"}</h2>
        {mode === "signup" ? (
          <div className="field-pair">
            <label className="form-field">
              <span>Nombre</span>
              <input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Celular</span>
              <input autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
          </div>
        ) : null}
        <label className="form-field">
          <span>Correo</span>
          <input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <div className="form-field">
          <label htmlFor="customer-password">Contraseña</label>
          <div className="password-input">
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              id="customer-password"
              minLength={8}
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
        {mode === "signin" ? (
          <Link className="password-recovery-link" href="/cuenta/recuperar">
            ¿Olvidaste tu contraseña?
          </Link>
        ) : (
          <p className="customer-safety-note">
            Por seguridad, las compras anteriores podrán vincularse más adelante mediante soporte verificado.
          </p>
        )}
        {message ? <p className="form-message">{message}</p> : null}
        <button className="save-button" disabled={!configured || loading} type="submit">
          {loading ? "Procesando..." : mode === "signin" ? "Ingresar a mi cuenta" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}
