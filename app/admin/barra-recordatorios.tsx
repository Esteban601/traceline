"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { dispararRecordatorios } from "./actions";

export function BarraRecordatorios() {
  const [confirmar, setConfirmar] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // Envío de recordatorios: confirmado por ConfirmDialog (efecto externo: manda
  // correos), resultado por toast (enviados/omitidos por la regla anti-spam).
  const disparar = () =>
    startTransition(async () => {
      const r = await dispararRecordatorios();
      setConfirmar(false);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.responsables === 0) {
        toast.success("Sin pendientes por recordar.");
        return;
      }
      const nota = r.modo === "consola" ? " (modo consola: revisa el log)" : "";
      const partes = [
        `${r.enviados} ${r.enviados === 1 ? "recordatorio enviado" : "recordatorios enviados"}`,
      ];
      if (r.omitidos > 0) partes.push(`${r.omitidos} omitidos (regla de 5 días)`);
      if (r.fallidos > 0) {
        toast.error(`${partes.join(" · ")} · ${r.fallidos} con error${nota}`);
      } else {
        toast.success(`${partes.join(" · ")}${nota}`);
      }
    });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setConfirmar(true)} loading={pending}>
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

      <ConfirmDialog
        open={confirmar}
        titulo="¿Enviar recordatorios ahora?"
        descripcion="Se enviará un correo digest a cada responsable con solicitudes pendientes o con observaciones. No se reenvía a quien recibió uno en los últimos 5 días."
        confirmar="Enviar recordatorios"
        cancelar="Cancelar"
        cargando={pending}
        onConfirm={disparar}
        onCancel={() => setConfirmar(false)}
      />
    </>
  );
}
