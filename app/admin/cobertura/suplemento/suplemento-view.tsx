"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Tono } from "@/lib/estados";
import { GenerarDocumento } from "./generar-documento";
import { bloquePorClave, editorialesPorDefecto, type ClaseBloque } from "@/lib/suplemento/bloques";
import type { OpcionLiteral } from "@/lib/suplemento/texto-del-emisor";
import type {
  BloqueEvaluado,
  EstadoBloque,
  Faltante,
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
  reporteId,
  puedeGenerar,
  generadorActivo,
  seleccionInicial,
  opcionesLiterales = {},
  literalesIniciales,
}: {
  nombreReporte: string;
  ejercicio: number;
  emisora: string;
  regimenLabel: string;
  sinRegimen: boolean;
  anioAdopcion: number | null;
  aliviosActivos: string[];
  bloques: BloqueEvaluado[];
  reporteId: string;
  /** Solo el staff genera el documento en A5a; el admin del cliente en A8. */
  puedeGenerar: boolean;
  /** `tenants.generador_activo`: apagado, no se ofrece generar y se dice por qué. */
  generadorActivo: boolean;
  /** Editoriales del último documento abierto, si lo hay; si no, los recomendados. */
  seleccionInicial?: string[] | null;
  /** Por editorial, los adjuntos del Perfil que puede usar sin reescribir (Paso 3). */
  opcionesLiterales?: Record<string, OpcionLiteral[]>;
  /** Textos literales del último documento: {clave: adjunto}. */
  literalesIniciales?: Record<string, string> | null;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  // SELECCIÓN DE EDITORIALES (encargo suplemento-calidad): los recomendados
  // encendidos, los opcionales apagados. Lo que no se selecciona no se genera,
  // no va en el índice ni en el Word, y no cuenta en el semáforo.
  const [editoriales, setEditoriales] = useState<Set<string>>(() => new Set(seleccionInicial ?? editorialesPorDefecto()));
  // TEXTO DEL EMISOR SIN REESCRIBIR (Paso 3): por editorial, el adjunto cuyo
  // texto va literal. Solo se conserva lo que sigue siendo una opción válida.
  const [literales, setLiterales] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(literalesIniciales ?? {}).filter(([clave, adj]) => (opcionesLiterales[clave] ?? []).some((o) => o.adjuntoId === adj))
    )
  );
  const elegirLiteral = (clave: string, adjunto: string) =>
    setLiterales((prev) => {
      const s = { ...prev };
      if (adjunto) s[clave] = adjunto;
      else delete s[clave];
      return s;
    });
  // Solo viajan los de editoriales seleccionados.
  const literalesPedidos = Object.fromEntries(Object.entries(literales).filter(([clave]) => editoriales.has(clave)));
  const claseDe = (clave: string): ClaseBloque => bloquePorClave(clave)?.clase ?? "normativo";
  const incluido = (b: BloqueEvaluado) => claseDe(b.clave) === "normativo" || editoriales.has(b.clave);
  const alternarEditorial = (clave: string) =>
    setEditoriales((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  // El semáforo, contado SOLO sobre lo seleccionado.
  const cuenta = useMemo(() => {
    const sel = bloques.filter((b) => (bloquePorClave(b.clave)?.clase ?? "normativo") === "normativo" || editoriales.has(b.clave));
    const n = (e: EstadoBloque) => sel.filter((b) => b.estado === e).length;
    return {
      completos: n("completo"),
      parciales: n("parcial"),
      vacios: n("vacio"),
      plantilla: n("plantilla"),
      noAplican: n("no_aplica"),
      sinRegimen: n("sin_regimen"),
      seleccionados: sel.length,
      fuera: bloques.length - sel.length,
    };
  }, [bloques, editoriales]);
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
          <Contador label="Completos" n={cuenta.completos} tono="verde" />
          <Contador label="Con pendientes" n={cuenta.parciales} tono="ambar" />
          <Contador label="Sin evidencia" n={cuenta.vacios} tono="rojo" />
          <Contador label="De plantilla" n={cuenta.plantilla} tono="gris" />
          <Contador label="No aplican" n={cuenta.noAplican} tono="gris" />
          <Contador label="Sin régimen" n={cuenta.sinRegimen} tono="gris" />
        </div>
        <p className="mt-3 text-xs text-muted">
          {cuenta.seleccionados} de {bloques.length} bloques en el documento
          {cuenta.fuera > 0 ? ` · ${cuenta.fuera} editorial(es) sin seleccionar` : ""}. Los normativos van siempre;
          los editoriales se eligen abajo.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {!generadorActivo ? (
            <span className="text-sm text-muted">
              El generador del suplemento está apagado para esta emisora. Se enciende en Clientes cuando su
              contrato de encargado lo cubra.
            </span>
          ) : puedeGenerar ? (
            <GenerarDocumento reporteId={reporteId} editoriales={[...editoriales]} literales={literalesPedidos} />
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
                clase={claseDe(b.clave)}
                incluido={incluido(b)}
                onIncluir={puedeGenerar && generadorActivo ? () => alternarEditorial(b.clave) : undefined}
                opciones={opcionesLiterales[b.clave] ?? []}
                literal={literales[b.clave] ?? ""}
                onLiteral={puedeGenerar && generadorActivo ? (adj) => elegirLiteral(b.clave, adj) : undefined}
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

const CLASE_LABEL: Record<ClaseBloque, string | null> = {
  normativo: null,
  editorial_recomendado: "Editorial · recomendado",
  editorial_opcional: "Editorial · opcional",
};

function BloqueFila({
  bloque,
  abierto,
  onToggle,
  clase,
  incluido,
  onIncluir,
  opciones = [],
  literal = "",
  onLiteral,
}: {
  bloque: BloqueEvaluado;
  abierto: boolean;
  onToggle: () => void;
  clase: ClaseBloque;
  incluido: boolean;
  /** Solo editoriales, y solo si quien mira puede generar. */
  onIncluir?: () => void;
  /** Adjuntos que el editorial puede usar sin reescribir, y el elegido ("" = redactar). */
  opciones?: OpcionLiteral[];
  literal?: string;
  onLiteral?: (adjunto: string) => void;
}) {
  const meta = incluido ? META[bloque.estado] : { label: "No seleccionado", tono: "gris" as Tono, glifo: "—" };
  const etiquetaClase = CLASE_LABEL[clase];
  const expandible = bloque.faltantes.length > 0 || bloque.motivoNoAplica != null;

  return (
    <Card className={cn("overflow-hidden", !incluido && "opacity-60")}>
      {etiquetaClase && (
        <div className="flex items-center justify-between gap-3 border-b border-line/60 bg-crema/40 px-4 py-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{etiquetaClase}</span>
          {onLiteral && incluido && opciones.length > 0 && (
            <select
              value={literal}
              onChange={(e) => onLiteral(e.target.value)}
              aria-label={`Texto del bloque ${bloque.numero}`}
              className="ml-auto max-w-[22rem] truncate rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
            >
              <option value="">Redactar con el generador</option>
              {opciones.map((o) => (
                <option key={o.adjuntoId} value={o.adjuntoId}>
                  Usar el texto de «{o.archivo}» sin reescribir
                </option>
              ))}
            </select>
          )}
          {onIncluir && (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
              <input
                type="checkbox"
                checked={incluido}
                onChange={onIncluir}
                aria-label={`Incluir el bloque ${bloque.numero} · ${bloque.titulo}`}
                className="size-4 accent-teal"
              />
              Incluir
            </label>
          )}
        </div>
      )}
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
