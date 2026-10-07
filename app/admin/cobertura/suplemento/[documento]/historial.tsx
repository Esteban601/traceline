"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { Tono } from "@/lib/estados";
import { diffPalabras } from "@/lib/diff-palabras";
import { restaurarVersion, type EstadoAccion } from "./actions";

// =============================================================================
// Historial de un bloque (A6, encargo suplemento-calidad, Paso 4).
//
// Cada texto que tuvo el bloque —generado, editado a mano, copiado literal del
// emisor o restaurado—, con autor, fecha, versión del prompt y fuentes. Se puede
// ver qué cambia entre una versión y la actual, y restaurarla: la restauración
// entra como versión nueva y la que estaba queda en el historial.
// =============================================================================

export type VersionVista = {
  id: string;
  version: number;
  origen: "generacion" | "edicion" | "literal" | "restauracion";
  texto: string;
  fuentes: string[];
  promptVersion: string | null;
  modelo: string | null;
  autor: string | null;
  creadaEn: string;
  /** Número de la versión restaurada, si esta es una restauración. */
  restauradaDe: number | null;
  /** Si esta es la versión que compone el documento aprobado. */
  aprobada: boolean;
};

const ORIGEN: Record<VersionVista["origen"], { label: string; tono: Tono }> = {
  generacion: { label: "Generación", tono: "azul" },
  edicion: { label: "Edición manual", tono: "ambar" },
  literal: { label: "Texto del emisor", tono: "azul" },
  restauracion: { label: "Restauración", tono: "gris" },
};

const VACIO: EstadoAccion = { ok: false, error: null, mensaje: null };

export function Historial({
  documentoId,
  numero,
  versiones,
  textoActual,
  puedeRestaurar,
}: {
  documentoId: string;
  numero: number;
  /** De la más reciente a la más antigua. */
  versiones: VersionVista[];
  textoActual: string | null;
  puedeRestaurar: boolean;
}) {
  const [comparando, setComparando] = useState<string | null>(null);
  const [aRestaurar, setARestaurar] = useState<VersionVista | null>(null);
  const [estado, accion, restaurando] = useActionState(restaurarVersion, VACIO);
  const toast = useToast();

  useEffect(() => {
    if (estado.mensaje) { toast.success(estado.mensaje); setARestaurar(null); setComparando(null); }
    else if (estado.error) { toast.error(estado.error); setARestaurar(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (!versiones.length) return null;
  // La actual es la más reciente cuyo texto coincide con el del bloque.
  const actual = versiones.find((v) => v.texto === textoActual)?.id ?? null;

  return (
    <details className="rounded-xl border border-line bg-crema/20 px-3.5 py-2.5" data-historial={numero}>
      <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Historial ({versiones.length} {versiones.length === 1 ? "versión" : "versiones"})
      </summary>
      <ol className="mt-3 space-y-2">
        {versiones.map((v) => (
          <li key={v.id} className="rounded-lg border border-line/70 bg-surface px-3 py-2" data-version={v.version}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-ink">v{v.version}</span>
              <Chip tono={ORIGEN[v.origen].tono}>{ORIGEN[v.origen].label}</Chip>
              {v.id === actual && <Chip tono="verde">Actual</Chip>}
              {v.aprobada && <Chip tono="verde">En el documento aprobado</Chip>}
              <span className="text-xs text-muted">
                {v.autor ?? "—"} · {new Date(v.creadaEn).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                {v.promptVersion ? ` · ${v.promptVersion}` : ""}
                {v.restauradaDe ? ` · restaura la v${v.restauradaDe}` : ""}
                {` · ${v.fuentes.length} fuente(s)`}
              </span>
              <span className="ml-auto flex gap-1.5">
                {v.id !== actual && textoActual !== null && (
                  <Button size="sm" variant="ghost" onClick={() => setComparando(comparando === v.id ? null : v.id)}>
                    {comparando === v.id ? "Ocultar cambios" : "Ver cambios"}
                  </Button>
                )}
                {puedeRestaurar && v.id !== actual && (
                  <Button size="sm" variant="secondary" onClick={() => setARestaurar(v)}>
                    Restaurar
                  </Button>
                )}
              </span>
            </div>
            {comparando === v.id && textoActual !== null && <Diferencias antes={v.texto} despues={textoActual} version={v.version} />}
          </li>
        ))}
      </ol>

      <ConfirmDialog
        open={!!aRestaurar}
        titulo={`Restaurar la versión ${aRestaurar?.version ?? ""}`}
        descripcion="El texto de esa versión vuelve a ser el del bloque. El texto actual no se borra: queda en el historial."
        confirmar="Restaurar"
        cargando={restaurando}
        onConfirm={() => {
          if (!aRestaurar) return;
          const fd = new FormData();
          fd.set("documento_id", documentoId);
          fd.set("version_id", aRestaurar.id);
          accion(fd);
        }}
        onCancel={() => setARestaurar(null)}
      />
    </details>
  );
}

function Diferencias({ antes, despues, version }: { antes: string; despues: string; version: number }) {
  const trozos = useMemo(() => diffPalabras(antes, despues), [antes, despues]);
  return (
    <div className="mt-2 rounded-lg border border-line/70 bg-crema/30 px-3 py-2">
      <p className="mb-1.5 text-xs text-muted">
        De la v{version} a la actual: <span className="bg-rojo/10 text-rojo line-through">quitado</span>{" "}
        <span className="bg-verde/15 text-verde">agregado</span>
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink" data-diff>
        {trozos.map((t, i) => (
          <span
            key={i}
            className={cn(t.tipo === "quitado" && "bg-rojo/10 text-rojo line-through", t.tipo === "agregado" && "bg-verde/15 text-verde")}
            data-tipo={t.tipo}
          >
            {t.texto}
          </span>
        ))}
      </p>
    </div>
  );
}
