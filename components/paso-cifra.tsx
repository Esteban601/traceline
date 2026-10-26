"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ReferenciasParciales, SugerenciaBloque } from "@/components/sugerencia-bloque";
import { cn } from "@/lib/cn";
import { capturarCifra, type CifraState } from "@/lib/evidencias/acciones-lectura";
import type { EstadoLectura } from "@/lib/evidencias/estado-lectura";
import type { ConsultaLectura } from "@/app/api/evidencias/lectura/route";

// =============================================================================
// PASO 3 «LA CIFRA QUE REPORTAS», DESPUÉS DE SUBIR (encargo 2026-10-26-carga-
// lectura-primero). Portal y panel.
//
//   · leyendo   → «Leyendo tu archivo…»; consulta cada 4 s, hasta 90 s, con
//                 GET /api/evidencias/lectura (una ruta, no una acción: las
//                 acciones van en fila y dejaban Confirmar en espera).
//   · sugerida  → la cifra, unidad, periodo, fuente y cita que encontró la
//                 lectura, con Confirmar / Corregir / Rechazar
//                 (fn_decidir_sugerencia, en SugerenciaBloque).
//   · lo demás  → la línea de por qué no hay sugerencia y el paso 3 manual
//                 (capturarCifra).
// Quien no quiere esperar puede escribir la cifra mientras se lee; con la cifra
// confirmada, la sugerencia ya no se genera ni se puede confirmar.
// =============================================================================

const SONDEO_MS = 4000;
const inicial: CifraState = { ok: false, error: null, mensaje: null };
const inputClass =
  "h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";

export function PasoCifra({
  solicitudId,
  nombreArchivo,
  unidadEsperada,
  periodoArchivo,
  periodoSolicitud = null,
  estadoInicial,
}: {
  solicitudId: string;
  nombreArchivo: string;
  unidadEsperada: string | null;
  periodoArchivo: string | null;
  /** El ejercicio del reporte: Corregir lo propone como periodo. */
  periodoSolicitud?: string | null;
  estadoInicial: EstadoLectura;
}) {
  const [estado, setEstado] = useState(estadoInicial);
  const [escribirYo, setEscribirYo] = useState(false);
  const [guardado, accion, pendiente] = useActionState(capturarCifra, inicial);
  const toast = useToast();
  const atendido = useRef(guardado);

  // La página se vuelve a pintar con su estado (revalidatePath): se adopta el nuevo.
  useEffect(() => setEstado(estadoInicial), [estadoInicial]);

  useEffect(() => {
    if (estado.fase !== "leyendo") return;
    const t = setTimeout(async () => {
      const q = new URLSearchParams({ solicitud: solicitudId, evidencia: estado.evidenciaId });
      const r: ConsultaLectura = await fetch(`/api/evidencias/lectura?${q}`, { cache: "no-store" })
        .then((x) => x.json() as Promise<ConsultaLectura>)
        .catch(() => ({ ok: false, error: "No pudimos consultar la lectura de tu archivo. Escribe la cifra." }));
      if (r.ok) setEstado(r.estado);
      else setEstado({ ...estado, fase: "fallo", linea: r.error });
    }, SONDEO_MS);
    return () => clearTimeout(t);
  }, [estado, solicitudId]);

  useEffect(() => {
    if (guardado === atendido.current) return;
    atendido.current = guardado;
    if (guardado.ok) toast.success(guardado.mensaje ?? "Cifra guardada.");
    else if (guardado.error) toast.error(guardado.error);
  }, [guardado, toast]);

  if (estado.fase === "con_cifra") return null;

  const manual = (
    <form action={accion} className="space-y-3" data-testid="paso3-manual">
      <input type="hidden" name="solicitud_id" value={solicitudId} />
      <input type="hidden" name="evidencia_id" value={estado.evidenciaId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="cifra-valor" className="block text-xs font-medium text-muted">
            Dato
          </label>
          <input id="cifra-valor" name="valor" inputMode="decimal" placeholder="0" className={cn(inputClass, "w-36")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cifra-unidad" className="block text-xs font-medium text-muted">
            Unidad
          </label>
          <input id="cifra-unidad" name="unidad" defaultValue={unidadEsperada ?? ""} placeholder="Ej. kWh" className={cn(inputClass, "w-32")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cifra-periodo" className="block text-xs font-medium text-muted">
            Periodo
          </label>
          <input id="cifra-periodo" name="periodo" defaultValue={periodoArchivo ?? ""} placeholder="Ej. 2025" className={cn(inputClass, "w-32")} />
        </div>
        <Button type="submit" loading={pendiente}>
          Guardar cifra
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex gap-4" data-testid="paso3" data-fase={estado.fase}>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-teal text-sm font-semibold text-crema">
        3
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="pt-1 text-sm font-semibold text-ink">La cifra que reportas</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Del archivo <span className="font-medium text-ink">{nombreArchivo}</span>.
          </p>
        </div>

        {estado.fase === "leyendo" && !escribirYo ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-teal/25 bg-teal/5 px-3.5 py-3 text-sm text-ink" role="status" aria-live="polite">
            <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
            <span className="flex-1">Leyendo tu archivo… Te proponemos la cifra en cuanto la encontremos; suele tardar menos de un minuto.</span>
            <button type="button" onClick={() => setEscribirYo(true)} className="text-xs font-medium text-teal underline-offset-2 hover:underline">
              Prefiero escribirla
            </button>
          </div>
        ) : estado.fase === "sugerida" && estado.bloque ? (
          <>
            <p className="text-xs text-muted">La encontramos en tu archivo. Confírmala o corrígela.</p>
            <SugerenciaBloque bloque={estado.bloque} solicitudId={solicitudId} periodoSolicitud={periodoSolicitud} />
          </>
        ) : (
          <>
            {estado.linea && !(estado.fase === "leyendo" && escribirYo) ? (
              <p className="rounded-lg border border-line bg-crema/40 px-3.5 py-2.5 text-sm text-ink" data-testid="paso3-linea">
                {estado.linea}
              </p>
            ) : null}
            {estado.fase === "sin_hallazgo" && estado.bloque?.sugerencia ? <ReferenciasParciales s={estado.bloque.sugerencia} /> : null}
            {manual}
          </>
        )}
      </div>
    </div>
  );
}
