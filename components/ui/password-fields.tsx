"use client";

import { useState } from "react";
import { PASSWORD_MIN } from "@/lib/password";

// =============================================================================
// Par de campos "contraseña nueva" + "confirmación", compartido por el canje de
// invitación y el restablecimiento. Un solo lugar para el mínimo exigido y para
// el aviso de que no coinciden, para que ambas pantallas no se desalineen.
// =============================================================================

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";

export function PasswordFields({ disabled = false }: { disabled?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const corta = password.length > 0 && password.length < PASSWORD_MIN;
  const distintas = confirmacion.length > 0 && password !== confirmacion;

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Contraseña nueva
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          disabled={disabled}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          aria-describedby="password-ayuda"
          className={inputCls}
        />
        <p id="password-ayuda" className={corta ? "text-xs text-rojo" : "text-xs text-muted"}>
          Mínimo {PASSWORD_MIN} caracteres.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmacion" className="block text-sm font-medium text-ink">
          Confirma la contraseña
        </label>
        <input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          required
          disabled={disabled}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          placeholder="••••••••"
          aria-invalid={distintas ? true : undefined}
          className={inputCls}
        />
        {distintas && <p className="text-xs text-rojo">Las contraseñas no coinciden.</p>}
      </div>
    </>
  );
}
