"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Tono } from "@/lib/estados";
import { GenerarDocumento } from "./generar-documento";
import type {
  BloqueEvaluado,
  EstadoBloque,
  Faltante,
  ResumenCompletitud,
} from "@/lib/suplemento/completitud";

// =============================================================================
// El semáforo, pintado. Nada se decide aquí: los estados y los faltantes llegan
// resueltos de `evaluarCompletitud`. Lo único que este archivo elige es el color
// y qué se ve plegado.
// =============================================================================

const META: Record<EstadoBloque, { label: string; tono: Tono; glifo: string }> = {
  completo: { label: "Completo", tono: "verde", glifo: "●" },
  parcial: { label: "Con pendientes", tono: "ambar", glifo: "◐" },
  vacio: { label: "Sin evidencia", tono: "rojo", glifo: "○" },
  // Neutro a propósito: no es un logro ni una carencia. El bloque se redacta
  // igual haya o no evidencia, así que pintarlo verde inflaría el avance.
  plantilla: { label: "De plantilla", tono: "gris", glifo: "▢" },
  no_aplica: { label: "No aplica", tono: "gris", glifo: "—" },
  sin_regimen: { label: "Sin régimen", tono: "gris", glifo: "?" },
};

/** El color del faltante distingue lo que falta pedir de lo que falta validar. */
const TONO_CAUSA: Record<Faltante["causa"], Tono> = {
  sin_solicitud: "rojo",
  sin_evidencia: "rojo",
  pendiente_validacion: "ambar",
  codigo_no_en_catalogo: "rojo",
  sin_registros: "rojo",
  sin_valores: "ambar",
  sin_objetivos: "rojo",
  objetivo_incompleto: "ambar",
  sin_detalle_objetivo: "ambar",
  sin_cuestionario: "rojo",
  cuestionario_incompleto: "ambar",
  perfil_vacio: "rojo",
  derivable_de_adjunto: "ambar",
};

const LABEL_CAUSA: Record<Faltante["causa"], string> = {
  sin_solicitud: "Sin solicitud en el reporte",
  sin_evidencia: "Sin evidencia",
  pendiente_validacion: "Pendiente de validación",
  codigo_no_en_catalogo: "Código fuera del catálogo",
  sin_registros: "Sin registros",
  sin_valores: "Sin cifras del ejercicio",
  sin_objetivos: "Sin objetivos",
  objetivo_incompleto: "Objetivo incompleto",
  sin_detalle_objetivo: "Sin enfoque documentado",
  sin_cuestionario: "Cuestionario no cargado",
  cuestionario_incompleto: "Cuestionario a medias",
  perfil_vacio: "Falta en el Perfil",
  derivable_de_adjunto: "Se derivará del documento adjunto",
};

export function SuplementoView({
  nombreReporte,
  ejercicio,
  emisora,
  regimenLabel,
  sinRegimen,
  anioAdopcion,
  aliviosActivos,
  bloques,
  resumen,
  reporteId,
  puedeGenerar,
}: {
  nombreReporte: string;
  ejercicio: number;
  emisora: string;
  regimenLabel: string;
  sinRegimen: boolean;
  anioAdopcion: number | null;
  aliviosActivos: string[];
  bloques: BloqueEvaluado[];
  resumen: ResumenCompletitud;
  reporteId: string;
  /** Solo el staff genera el documento en A5a; el admin del cliente en A8. */
  puedeGenerar: boolean;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (clave: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });

  // Las cinco secciones, en el orden de §3. Se derivan de los bloques en vez de
  // escribirlas aquí: añadir un bloque a una sección nueva no exige tocar la UI.
  const secciones: { nombre: string; items: BloqueEvaluado[] }[] = [];
  for (const b of bloques) {
    const ultima = secciones[secciones.length - 1];
    if (ultima && ultima.nombre === b.seccion) ultima.items.push(b);
    else secciones.push({ nombre: b.seccion, items: [b] });
  }

  return (
    <div className="space-y-6">
      {/* -- Régimen y resumen ------------------------------------------------ */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Reporte</p>
            <p className="mt-0.5 font-display text-lg font-semibold text-ink">
              {nombreReporte}
            </p>
            <p className="text-sm text-muted">
              {emisora} · ejercicio {ejercicio}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Régimen</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{regimenLabel}</p>
            {anioAdopcion != null && (
              <p className="text-xs text-muted">Año de adopción {anioAdopcion}</p>
            )}
          </div>
        </div>

        {sinRegimen && (
          // Sin año de adopción no se puede decidir si medio documento lleva
          // comparativos. No se adivina: se pide el dato y se dice dónde.
          <div className="mt-4 rounded-lg border border-ambar/30 bg-ambar/10 px-4 py-3 text-sm text-ink">
            <strong className="font-semibold">Falta el año de adopción del reporte.</strong>{" "}
            Sin él no se puede saber si este ejercicio es el primero —con sus alivios y sin
            comparativos— o uno subsecuente, así que ningún bloque puede evaluarse todavía.{" "}
            <Link href="/admin/reportes" className="font-medium text-teal hover:underline">
              Declararlo en Reportes
            </Link>
            .
          </div>
        )}

        {aliviosActivos.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              Alivios transitorios adoptados
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {aliviosActivos.map((a) => (
                <li key={a} className="text-sm text-ink">
                  · {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Contador label="Completos" n={resumen.completos} tono="verde" />
          <Contador label="Con pendientes" n={resumen.parciales} tono="ambar" />
          <Contador label="Sin evidencia" n={resumen.vacios} tono="rojo" />
          <Contador label="De plantilla" n={resumen.plantilla} tono="gris" />
          <Contador label="No aplican" n={resumen.noAplican} tono="gris" />
          <Contador label="Sin régimen" n={resumen.sinRegimen} tono="gris" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {puedeGenerar ? (
            <GenerarDocumento reporteId={reporteId} />
          ) : (
            <>
              <Button disabled title="Disponible para el equipo de IRStrat">
                Generar suplemento
              </Button>
              <span className="text-sm text-muted">
                La generación del documento la hace el equipo de IRStrat.
              </span>
            </>
          )}
        </div>
      </Card>

      {/* -- Los 40 bloques --------------------------------------------------- */}
      {secciones.map((sec) => (
        <section key={sec.nombre} aria-label={sec.nombre}>
          <h2 className="mb-2.5 font-display text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            {sec.nombre}
          </h2>
          <div className="space-y-2">
            {sec.items.map((b) => (
              <BloqueFila
                key={b.clave}
                bloque={b}
                abierto={abiertos.has(b.clave)}
                onToggle={() => alternar(b.clave)}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="pb-4 text-xs text-muted">
        Evaluado contra el reporte {reporteId.slice(0, 8)}… con las mismas reglas que llenan
        el Excel de taxonomía.
      </p>
    </div>
  );
}

function Contador({ label, n, tono }: { label: string; n: number; tono: Tono }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Punto tono={tono} />
        <span className="font-display text-xl font-semibold text-ink">{n}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function Punto({ tono }: { tono: Tono }) {
  const clase =
    tono === "verde"
      ? "bg-verde"
      : tono === "ambar"
        ? "bg-ambar"
        : tono === "rojo"
          ? "bg-rojo"
          : tono === "azul"
            ? "bg-azul"
            : "bg-gris";
  return <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", clase)} />;
}

function BloqueFila({
  bloque,
  abierto,
  onToggle,
}: {
  bloque: BloqueEvaluado;
  abierto: boolean;
  onToggle: () => void;
}) {
  const meta = META[bloque.estado];
  const expandible = bloque.faltantes.length > 0 || bloque.motivoNoAplica != null;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={expandible ? onToggle : undefined}
        aria-expanded={expandible ? abierto : undefined}
        disabled={!expandible}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition",
          expandible ? "hover:bg-ink/[0.02]" : "cursor-default"
        )}
      >
        <Punto tono={meta.tono} />
        <span className="w-7 shrink-0 text-right font-mono text-xs text-muted">
          {bloque.numero}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{bloque.titulo}</span>
          <span className="block truncate text-xs text-muted">
            {bloque.referencias.length > 0
              ? bloque.referencias.join(" · ")
              : `${bloque.tipo} · sin referencia de taxonomía`}
          </span>
        </span>
        {bloque.exigidos > 0 && (
          <span className="hidden shrink-0 font-mono text-xs text-muted sm:block">
            {bloque.cumplidos}/{bloque.exigidos}
          </span>
        )}
        <Chip tono={meta.tono}>{meta.label}</Chip>
        {expandible && (
          <span
            aria-hidden
            className={cn("shrink-0 text-muted transition", abierto ? "rotate-90" : "")}
          >
            ›
          </span>
        )}
      </button>

      {abierto && expandible && (
        <div className="border-t border-line px-4 py-3.5">
          {bloque.motivoNoAplica && (
            <p className="text-sm text-muted">{bloque.motivoNoAplica}</p>
          )}

          {bloque.faltantes.length > 0 && (
            <ul className="space-y-2">
              {bloque.faltantes.map((f, i) => (
                <li key={`${f.causa}-${f.etiqueta}-${i}`} className="flex items-start gap-2.5">
                  <Punto tono={TONO_CAUSA[f.causa]} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {f.enlace ? (
                        <Link href={f.enlace} className="font-medium text-teal hover:underline">
                          {f.etiqueta}
                        </Link>
                      ) : (
                        <span className="font-medium">{f.etiqueta}</span>
                      )}
                      <span className="text-muted"> — {LABEL_CAUSA[f.causa]}</span>
                    </span>
                    {f.detalle && <span className="block text-xs text-muted">{f.detalle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

        </div>
      )}
    </Card>
  );
}
