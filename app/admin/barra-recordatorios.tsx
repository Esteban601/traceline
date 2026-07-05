"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dispararRecordatorios } from "./actions";
import type { ResumenRecordatorios } from "@/lib/recordatorios";

export function BarraRecordatorios() {
  const [resultado, setResultado] = useState<(ResumenRecordatorios & { error?: string }) | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const disparar = () =>
    startTransition(async () => {
      const r = await dispararRecordatorios();
      setResultado(r);
    });

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <Button variant="secondary" size="sm" onClick={disparar} loading={pending}>
        {!pending && (
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )}
        {pending ? "Enviando…" : "Enviar recordatorios ahora"}
      </Button>

      {resultado &&
        (resultado.error ? (
          <p role="alert" className="text-xs text-rojo sm:text-right">
            {resultado.error}
          </p>
        ) : (
          <p role="status" className="max-w-xs text-xs text-muted sm:text-right">
            <span className="font-semibold text-verde">
              {resultado.enviados} {resultado.enviados === 1 ? "recordatorio enviado" : "recordatorios enviados"}
            </span>
            {resultado.omitidos > 0 && (
              <> · {resultado.omitidos} omitidos (regla de 5 días)</>
            )}
            {resultado.fallidos > 0 && (
              <span className="text-rojo"> · {resultado.fallidos} con error</span>
            )}
            {resultado.responsables === 0 && " · sin pendientes por recordar"}
            {resultado.modo === "consola" && (
              <span className="block">Modo consola: revisa el log del servidor.</span>
            )}
          </p>
        ))}
    </div>
  );
}
