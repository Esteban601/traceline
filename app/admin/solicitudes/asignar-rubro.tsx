"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { asignarRubroTaxonomia } from "./gestion-actions";
import type { RubroOpcion } from "./solicitud-form";

// =============================================================================
// Asignación del rubro de taxonomía sobre una solicitud YA VALIDADA. Vive en la
// pantalla de "no editable" a propósito: es lo único que sigue siendo ajustable
// ahí, porque no es contenido de la solicitud sino el mapeo a la celda de la
// plantilla oficial. Sin esto, un reporte validado antes de tener rubros no
// podría llenar su Excel nunca.
// =============================================================================

export function AsignarRubro({
  solicitudId,
  rubros,
  inicial,
}: {
  solicitudId: string;
  rubros: RubroOpcion[];
  inicial: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [rubro, setRubro] = useState(inicial);
  const [pending, startTransition] = useTransition();

  const guardar = () => {
    startTransition(async () => {
      const r = await asignarRubroTaxonomia(solicitudId, rubro || null);
      if (r.ok) {
        toast.success(r.mensaje ?? "Listo.");
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudo asignar el rubro.");
        setRubro(inicial);
      }
    });
  };

  return (
    <div className="mt-8 border-t border-line pt-6 text-left">
      <label htmlFor="rubro-validada" className="block text-sm font-medium text-ink">
        Rubro de taxonomía
      </label>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Esto sí se puede ajustar: no cambia lo que se le pidió al cliente ni su
        valor, solo qué celda de la plantilla oficial llena.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <select
          id="rubro-validada"
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          disabled={pending}
          className="h-11 min-w-64 flex-1 rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 focus:bg-surface disabled:opacity-60"
        >
          <option value="">Ninguno — no alimenta una celda de la plantilla</option>
          {rubros.map((r) => (
            <option key={r.clave} value={r.clave}>
              {r.grupoLabel} · {r.etiqueta}
            </option>
          ))}
        </select>
        <Button onClick={guardar} loading={pending} disabled={rubro === inicial}>
          Guardar rubro
        </Button>
      </div>
    </div>
  );
}
