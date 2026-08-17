"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { solicitarRecuperacion, type RecuperarState } from "./actions";

const initial: RecuperarState = { ok: false, error: null, mensaje: null };

export function RecuperarForm() {
  const [state, formAction, pending] = useActionState(solicitarRecuperacion, initial);

  if (state.ok && state.mensaje) {
    return (
      <div className="space-y-5">
        <p
          role="status"
          className="rounded-lg border border-verde/25 bg-verde/10 px-3.5 py-3 text-sm leading-relaxed text-verde"
        >
          {state.mensaje}
        </p>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
        >
          Volver al ingreso
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="tu.correo@empresa.com"
          className="h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-rojo/25 bg-rojo/10 px-3.5 py-2.5 text-sm text-rojo"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Enviando…" : "Enviar instrucciones"}
      </Button>

      <Link
        href="/login"
        className="block text-center text-sm font-medium text-teal transition duration-150 hover:text-teal-dark"
      >
        Volver al ingreso
      </Link>
    </form>
  );
}
