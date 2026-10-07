"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { Tono } from "@/lib/estados";

// =============================================================================
// Observaciones de la pasada de coherencia (suplemento-calidad, Paso 3 (d)).
//
// Una lista para el revisor: qué es incoherente, en qué bloques, con la cita
// literal y una sugerencia. No edita nada; el revisor decide y corrige en el
// bloque. El staff puede volver a correr la pasada (cuesta una llamada).
// =============================================================================

export type ObservacionVista = {
  tipo: string;
  gravedad: "alta" | "media" | "baja";
  bloques: number[];
  bloque_de_la_cita: number;
  cita: string;
  observacion: string;
  sugerencia: string;
  afecta_texto_del_emisor: boolean;
};

export type PasadaVista = {
  estado: "generando" | "lista" | "error";
  observaciones: ObservacionVista[];
  descartadas: number;
  bloquesRevisados: number;
  costoUsd: number;
  duracionMs: number;
  modelo: string | null;
  error: string | null;
  creadaEn: string;
};

const TIPO: Record<string, string> = {
  terminologia: "Terminología",
  repeticion: "Repetición entre bloques",
  referencia_cruzada: "Referencia cruzada",
  anuncio_de_pendiente: "Anuncia lo que termina en pendiente",
  contradiccion: "Contradicción entre bloques",
};
const GRAVEDAD: Record<string, { label: string; tono: Tono; orden: number }> = {
  alta: { label: "Alta", tono: "rojo", orden: 0 },
  media: { label: "Media", tono: "ambar", orden: 1 },
  baja: { label: "Baja", tono: "gris", orden: 2 },
};

export function CoherenciaPanel({
  documentoId,
  inicial,
  puedeRevisar,
}: {
  documentoId: string;
  inicial: PasadaVista | null;
  /** Staff con el generador activo: puede correr la pasada. */
  puedeRevisar: boolean;
}) {
  const [pasada, setPasada] = useState<PasadaVista | null>(inicial);
  const [corriendo, setCorriendo] = useState(inicial?.estado === "generando");
  const toast = useToast();
  const router = useRouter();

  const esperar = useCallback(async () => {
    const hasta = Date.now() + 8 * 60 * 1000;
    while (Date.now() < hasta) {
      await new Promise((r) => setTimeout(r, 4000));
      const r = await fetch(`/api/suplemento/${documentoId}/coherencia`);
      if (!r.ok) continue;
      const d = await r.json();
      if (d.estado === "generando") continue;
      setPasada(aVista(d));
      return d.estado as string;
    }
    return "generando";
  }, [documentoId]);

  const revisar = useCallback(async () => {
    setCorriendo(true);
    try {
      const r = await fetch(`/api/suplemento/${documentoId}/coherencia`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origen: "manual" }),
      });
      if (r.status !== 202 && r.status !== 409) {
        toast.error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
        return;
      }
      const estado = await esperar();
      if (estado === "lista") toast.success("Pasada de coherencia lista.");
      else if (estado === "error") toast.error("La pasada de coherencia falló.");
      router.refresh();
    } finally {
      setCorriendo(false);
    }
  }, [documentoId, esperar, toast, router]);

  const obs = [...(pasada?.observaciones ?? [])].sort(
    (a, b) => (GRAVEDAD[a.gravedad]?.orden ?? 3) - (GRAVEDAD[b.gravedad]?.orden ?? 3) || a.bloque_de_la_cita - b.bloque_de_la_cita
  );

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Coherencia del documento</h2>
          <p className="mt-0.5 text-xs text-muted">
            {pasada && pasada.estado !== "generando"
              ? `${new Date(pasada.creadaEn).toLocaleString("es-MX")} · ${pasada.bloquesRevisados} bloques · ${pasada.modelo ?? "—"} · $${pasada.costoUsd.toFixed(4)} · ${(pasada.duracionMs / 1000).toFixed(0)} s${pasada.descartadas ? ` · ${pasada.descartadas} descartada(s) por cita que no está en el bloque` : ""}`
              : corriendo
                ? "Leyendo el documento completo…"
                : "Sin pasada todavía. Se corre al terminar de generar el documento, o desde aquí."}
          </p>
        </div>
        {puedeRevisar && (
          <Button size="sm" variant="secondary" onClick={revisar} loading={corriendo} disabled={corriendo}>
            {pasada ? "Volver a revisar" : "Revisar coherencia"}
          </Button>
        )}
      </div>

      {pasada?.estado === "error" && <p className="mt-3 text-sm text-rojo">La pasada falló: {pasada.error ?? "sin detalle"}.</p>}
      {pasada?.estado === "lista" && obs.length === 0 && (
        <p className="mt-3 text-sm text-muted">Sin observaciones: no se encontraron incoherencias entre bloques.</p>
      )}
      {obs.length > 0 && (
        <ol className="mt-4 space-y-3">
          {obs.map((o, i) => (
            <li key={i} className="rounded-xl border border-line bg-crema/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tono={GRAVEDAD[o.gravedad]?.tono ?? "gris"}>{GRAVEDAD[o.gravedad]?.label ?? o.gravedad}</Chip>
                <span className="text-sm font-medium text-ink">{TIPO[o.tipo] ?? o.tipo}</span>
                <span className="text-xs text-muted">· bloques {o.bloques.join(", ")}</span>
                {o.afecta_texto_del_emisor && <Chip tono="azul">Involucra texto del emisor</Chip>}
              </div>
              <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm italic text-ink/80">
                «{o.cita}» <span className="not-italic text-xs text-muted">— bloque {o.bloque_de_la_cita}</span>
              </blockquote>
              <p className="mt-2 text-sm text-ink">{o.observacion}</p>
              <p className="mt-1 text-sm text-muted">
                <span className="font-medium text-ink">Sugerencia:</span> {o.sugerencia}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** De la fila de `observaciones_coherencia` a la vista (la página arma la suya en el servidor). */
function aVista(d: {
  estado: string;
  observaciones: unknown;
  descartadas: number;
  bloques_revisados: number;
  costo_usd: number | string;
  duracion_ms: number;
  modelo: string | null;
  error: string | null;
  created_at: string;
}): PasadaVista {
  return {
    estado: d.estado as PasadaVista["estado"],
    observaciones: (Array.isArray(d.observaciones) ? d.observaciones : []) as ObservacionVista[],
    descartadas: d.descartadas,
    bloquesRevisados: d.bloques_revisados,
    costoUsd: Number(d.costo_usd ?? 0),
    duracionMs: d.duracion_ms,
    modelo: d.modelo,
    error: d.error,
    creadaEn: d.created_at,
  };
}
