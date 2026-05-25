"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("Validando el enlace seguro...");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function establishRecoverySession() {
      const code = new URLSearchParams(window.location.search).get("code");
      const queryError = new URLSearchParams(window.location.search).get("error");
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const linkError = fragment.get("error_description");

      if (linkError || queryError === "invalid_link") {
        if (active) {
          setMessage("El enlace venció o ya fue utilizado. Solicita uno nuevo.");
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) {
            setMessage("El enlace venció o ya fue utilizado. Solicita uno nuevo.");
          }
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active && session) {
        setReady(true);
        setMessage("");
      } else if (active && !code && !window.location.hash) {
        setMessage("Abre esta página desde el enlace enviado a tu correo.");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") {
        setReady(true);
        setMessage("");
      }
    });

    void establishRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("No se pudo cambiar la contraseña. Solicita un enlace nuevo.");
      setLoading(false);
      return;
    }

    router.replace("/gestion");
    router.refresh();
  }

  return (
    <form className="login-panel" onSubmit={updatePassword}>
      <p className="eyebrow">Recuperación segura</p>
      <h1>Nueva contraseña</h1>
      <p>Define una nueva contraseña para volver al centro de gestión.</p>
      {ready ? (
        <>
          <div className="form-field">
            <label htmlFor="new-password">Nueva contraseña</label>
            <div className="password-input">
              <input
                autoComplete="new-password"
                id="new-password"
                minLength={8}
                required
                type={showPassword ? "text" : "password"}
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
          <label className="form-field">
            <span>Confirmar contraseña</span>
            <input
              autoComplete="new-password"
              minLength={8}
              required
              type={showPassword ? "text" : "password"}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        </>
      ) : null}
      {message ? <p className="form-message">{message}</p> : null}
      {ready ? (
        <button className="save-button" disabled={loading} type="submit">
          {loading ? "Guardando..." : "Guardar nueva contraseña"}
        </button>
      ) : null}
      <Link className="password-back-link" href="/gestion/recuperar">
        Solicitar nuevo enlace
      </Link>
    </form>
  );
}
