"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordFields } from "@/components/ui/password-fields";
import { actualizarContrasena, type RestablecerState } from "./actions";

const initial: RestablecerState = { error: null };

export function RestablecerForm() {
  const [state, formAction, pending] = useActionState(actualizarContrasena, initial);

  return (
    <form action={formAction} className="space-y-5">
      <PasswordFields disabled={pending} />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-rojo/25 bg-rojo/10 px-3.5 py-2.5 text-sm text-rojo"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
