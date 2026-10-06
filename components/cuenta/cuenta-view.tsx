"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { cambiarResumenDiario } from "./actions";

/**
 * «Mi cuenta», mínima (encargo sistema de alertas, Paso 2): quién eres y el
 * interruptor del resumen diario. Los avisos inmediatos no se apagan, y se dice.
 */
export function CuentaView(p: {
  nombre: string;
  email: string;
  rolLabel: string;
  recibe: boolean;
  esAuditor: boolean;
}) {
  const [activo, setActivo] = useState(p.recibe);
  const [pending, start] = useTransition();
  const toast = useToast();

  const aplicar = (recibir: boolean) =>
    start(async () => {
      const r = await cambiarResumenDiario(recibir);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo guardar tu preferencia.");
        return;
      }
      setActivo(!!r.recibir);
      toast.success(r.recibir ? "Resumen diario encendido." : "Resumen diario apagado.");
    });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Nombre</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{p.nombre.replace(/\[DEMO\]\s*/i, "")}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Correo</dt>
            <dd className="mt-1 break-all text-sm text-ink">{p.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Rol</dt>
            <dd className="mt-1 text-sm text-ink">{p.rolLabel}</dd>
          </div>
        </dl>
      </Card>

      <Card className="flex items-start justify-between gap-6 p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Recibir resumen diario</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            {p.esAuditor
              ? "El auditor externo no recibe resumen diario. Te seguirán llegando los avisos de respuesta a tus comentarios."
              : "Un correo cada mañana con lo que tienes pendiente y lo que cambió ayer. Los avisos de comentarios del auditor y de documentos aprobados te llegan siempre, aunque lo apagues."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={p.esAuditor ? false : activo}
          aria-label="Recibir resumen diario"
          disabled={pending || p.esAuditor}
          onClick={() => aplicar(!activo)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill border transition duration-150 disabled:opacity-50",
            activo && !p.esAuditor ? "border-teal bg-teal" : "border-line bg-crema"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "inline-block size-4 rounded-full bg-surface shadow-soft transition-transform duration-150",
              activo && !p.esAuditor ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </Card>
    </div>
  );
}
