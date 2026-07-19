"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  CUESTIONARIOS,
  BOOLEANO_OPCIONES,
  SEPARADOR_ENUM,
  type SeccionCuestionario,
  type PreguntaCuestionario,
} from "@/lib/cuestionarios";
import { guardarSeccion, type CuestionarioState } from "./actions";

export type RespuestaFila = {
  reporteId: string;
  hoja: string;
  orden: number;
  respuesta: string | null;
  tipoDato: string | null;
  notas: string | null;
};
export type ReporteOpcion = { id: string; nombre: string; ejercicio: number };

const initial: CuestionarioState = { ok: false, error: null, mensaje: null };

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";
const areaCls =
  "mt-1.5 w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";

// -----------------------------------------------------------------------------
// Vista principal — selector de reporte + una sección por hoja.
// -----------------------------------------------------------------------------
export function CuestionariosView({
  respuestas,
  reportes,
}: {
  respuestas: RespuestaFila[];
  reportes: ReporteOpcion[];
}) {
  const [reporteId, setReporteId] = useState(reportes[0]?.id ?? "");

  if (reportes.length === 0) {
    return (
      <EmptyState
        glifo="❔"
        titulo="No hay reportes activos"
        descripcion="Los cuestionarios se responden sobre un reporte activo. Crea o activa un reporte primero."
      />
    );
  }

  return (
    <div className="space-y-8">
      {reportes.length > 1 && (
        <div className="max-w-md">
          <label htmlFor="c-reporte" className={labelCls}>
            Reporte
          </label>
          <select
            id="c-reporte"
            value={reporteId}
            onChange={(e) => setReporteId(e.target.value)}
            className={inputCls}
          >
            {reportes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre} · {r.ejercicio}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-6">
        {CUESTIONARIOS.map((sec) => (
          <SeccionForm
            key={sec.hoja}
            seccion={sec}
            reporteId={reporteId}
            respuestas={respuestas.filter(
              (r) => r.reporteId === reporteId && r.hoja === sec.hoja
            )}
          />
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sección (hoja) — formulario con guardado por sección.
// -----------------------------------------------------------------------------
type Campos = Record<string, string>; // r_<orden> | t_<orden> | n_<orden>

function desdeRespuestas(sec: SeccionCuestionario, respuestas: RespuestaFila[]): Campos {
  const porOrden = new Map(respuestas.map((r) => [r.orden, r]));
  const c: Campos = {};
  for (const p of sec.preguntas) {
    const r = porOrden.get(p.orden);
    c[`r_${p.orden}`] = r?.respuesta ?? "";
    c[`t_${p.orden}`] = r?.tipoDato ?? "";
    c[`n_${p.orden}`] = r?.notas ?? "";
  }
  return c;
}

function SeccionForm({
  seccion,
  reporteId,
  respuestas,
}: {
  seccion: SeccionCuestionario;
  reporteId: string;
  respuestas: RespuestaFila[];
}) {
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [state, dispatch, pending] = useActionState(guardarSeccion, initial);
  // El reporte seleccionado forma parte de la identidad de los datos: al cambiarlo
  // se rehidrata el formulario con las respuestas de ESE reporte.
  const inicial = useMemo(
    () => desdeRespuestas(seccion, respuestas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seccion, reporteId]
  );
  const [c, setC] = useState<Campos>(inicial);
  useEffect(() => setC(inicial), [inicial]);
  const set = (k: string, v: string) => setC((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (state.ok) toast.success(state.mensaje ?? "Guardado.");
    else if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const respondidas = seccion.preguntas.filter(
    (p) => (c[`r_${p.orden}`] ?? "").trim() !== ""
  ).length;
  const total = seccion.preguntas.length;
  const completa = respondidas === total;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporteId) return toast.error("Selecciona el reporte.");
    const fd = new FormData();
    fd.set("reporte_id", reporteId);
    fd.set("hoja", seccion.hoja);
    for (const p of seccion.preguntas) {
      fd.set(`r_${p.orden}`, c[`r_${p.orden}`] ?? "");
      fd.set(`t_${p.orden}`, c[`t_${p.orden}`] ?? "");
      fd.set(`n_${p.orden}`, c[`n_${p.orden}`] ?? "");
    }
    startTransition(() => dispatch(fd));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border border-line bg-surface shadow-soft"
    >
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
        aria-expanded={abierta}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gold">
              {seccion.hoja}
            </span>
            <span className="font-display text-base font-semibold text-ink">
              {seccion.titulo}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "rounded-pill px-2.5 py-0.5 text-xs font-medium",
              completa ? "bg-verde/10 text-verde" : "bg-gold/10 text-gold"
            )}
          >
            {respondidas}/{total}
          </span>
          <span
            className={cn("text-muted transition duration-150", abierta && "rotate-180")}
            aria-hidden
          >
            ▾
          </span>
        </span>
      </button>

      {abierta && (
        <div className="space-y-5 border-t border-line px-5 py-5 sm:px-6">
          {seccion.preguntas.map((p) => (
            <PreguntaFieldset
              key={p.orden}
              seccion={seccion}
              pregunta={p}
              campos={c}
              set={set}
            />
          ))}

          <div className="flex justify-end border-t border-line pt-5">
            <Button type="submit" loading={pending}>
              Guardar sección
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

// -----------------------------------------------------------------------------
// Una pregunta — control de respuesta según su tipo (texto / booleano / enum).
// -----------------------------------------------------------------------------
function PreguntaFieldset({
  seccion,
  pregunta: p,
  campos: c,
  set,
}: {
  seccion: SeccionCuestionario;
  pregunta: PreguntaCuestionario;
  campos: Campos;
  set: (k: string, v: string) => void;
}) {
  const rKey = `r_${p.orden}`;
  const valor = c[rKey] ?? "";
  return (
    <fieldset className="space-y-2.5 border-b border-line/60 pb-5 last:border-0 last:pb-0">
      <legend className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">
          {p.orden}. {p.texto}
        </span>
        <span className="rounded-pill bg-ink/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          {p.inciso}
        </span>
      </legend>

      {/* Respuesta — control por tipo de dato oficial */}
      {p.control === "texto" && (
        <textarea
          value={valor}
          onChange={(e) => set(rKey, e.target.value)}
          rows={2}
          placeholder="Respuesta…"
          aria-label="Respuesta"
          className={areaCls}
        />
      )}
      {p.control === "booleano" && (
        <ControlBooleano value={valor} onChange={(v) => set(rKey, v)} />
      )}
      {p.control === "enum_multi" && (
        <ControlEnum
          opciones={p.opciones ?? []}
          value={valor}
          onChange={(v) => set(rKey, v)}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {p.tipoDatoLabel ? (
          <div>
            <span className={cn(labelCls, "text-xs")}>Tipo de dato</span>
            <p className="mt-1.5 inline-flex h-11 items-center rounded-xl border border-dashed border-line bg-crema/20 px-3.5 text-sm text-muted">
              {p.tipoDatoLabel}
            </p>
          </div>
        ) : (
          <div>
            <label className={cn(labelCls, "text-xs")}>
              Tipo de dato <span className="font-normal text-muted">· opcional</span>
            </label>
            <input
              value={c[`t_${p.orden}`] ?? ""}
              onChange={(e) => set(`t_${p.orden}`, e.target.value)}
              placeholder="Cualitativo / Cuantitativo…"
              className={inputCls}
            />
          </div>
        )}
        <div>
          <label className={cn(labelCls, "text-xs")}>
            Notas / Brechas <span className="font-normal text-muted">· opcional</span>
          </label>
          <input
            value={c[`n_${p.orden}`] ?? ""}
            onChange={(e) => set(`n_${p.orden}`, e.target.value)}
            placeholder="Nota o brecha…"
            className={inputCls}
          />
        </div>
      </div>
    </fieldset>
  );
}

// Toggle Verdadero / Falso. Clic en la opción activa la limpia (vuelve a sin responder).
function ControlBooleano({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Verdadero o Falso"
      className="inline-flex rounded-xl border border-line bg-crema/40 p-0.5"
    >
      {BOOLEANO_OPCIONES.map((op) => {
        const activo = value === op;
        return (
          <button
            key={op}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(activo ? "" : op)}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-medium transition duration-150",
              activo ? "bg-teal text-crema shadow-soft" : "text-muted hover:text-ink"
            )}
          >
            {op}
          </button>
        );
      })}
    </div>
  );
}

// Selección múltiple (checkboxes). Serializa en el orden del catálogo.
function ControlEnum({
  opciones,
  value,
  onChange,
}: {
  opciones: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const seleccionadas = value
    .split(SEPARADOR_ENUM)
    .map((s) => s.trim())
    .filter(Boolean);
  const toggle = (op: string) => {
    const activa = seleccionadas.includes(op);
    const next = opciones.filter((o) =>
      o === op ? !activa : seleccionadas.includes(o)
    );
    onChange(next.join(SEPARADOR_ENUM));
  };
  return (
    <div className="space-y-2">
      {opciones.map((op) => {
        const checked = seleccionadas.includes(op);
        return (
          <label
            key={op}
            className="flex cursor-pointer items-center gap-2.5 text-sm text-ink"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(op)}
              className="size-4 rounded border-line text-teal focus:ring-2 focus:ring-teal/40"
            />
            {op}
          </label>
        );
      })}
    </div>
  );
}
