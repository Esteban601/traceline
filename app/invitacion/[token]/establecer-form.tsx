"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordFields } from "@/components/ui/password-fields";
import { establecerContrasena, type EstablecerState } from "./actions";

const initial: EstablecerState = { error: null };

export function EstablecerForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(establecerContrasena, initial);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

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
        {pending ? "Estableciendo…" : "Establecer contraseña y entrar"}
      </Button>
    </form>
  );
}
