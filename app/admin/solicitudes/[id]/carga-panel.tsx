"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { subirEvidenciaPanel, type CargaPanelState } from "./actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { EstadoSolicitud } from "@/lib/estados";

const initial: CargaPanelState = { ok: false, error: null, mensaje: null };

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";
const labelCls = "block text-xs font-medium text-muted";

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Carga de evidencia DESDE EL PANEL. Un solo componente para dos usos:
 *
 *   * ADMINISTRADOR DEL CLIENTE (`comoStaff = false`) — carga en nombre de
 *     cualquier área de su cliente. Siempre habilitado.
 *   * STAFF DE IRSTRAT (`comoStaff = true`) — solo si el cliente tiene el toggle
 *     "carga por IRStrat" encendido. Apagado, la zona se muestra EN GRIS y
 *     bloqueada (presente, no escondida: así se ve que existe y de quién es la
 *     tarea), y un POST directo lo rechaza igual la server action y el trigger.
 *
 * El área es OBLIGATORIA: la evidencia se carga en nombre de un área y el
 * historial tiene que poder decirlo.
 */
export function CargaPanel({
  solicitudId,
  esCuantitativa,
  unidadEsperada,
  areas,
  areaSugerida,
  reporteEjercicio,
  estado,
  comoStaff,
  habilitada,
}: {
  solicitudId: string;
  esCuantitativa: boolean;
  unidadEsperada: string | null;
  /** Catálogo de áreas del cliente dueño de la solicitud. */
  areas: string[];
  areaSugerida: string | null;
  reporteEjercicio: number | null;
  estado: EstadoSolicitud;
  comoStaff: boolean;
  habilitada: boolean;
}) {
  const periodoDefault = reporteEjercicio != null ? String(reporteEjercicio) : "";
  const [state, formAction, pending] = useActionState(subirEvidenciaPanel, initial);
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [area, setArea] = useState(areaSugerida ?? "");
  const [periodo, setPeriodo] = useState(periodoDefault);
  const [valor, setValor] = useState("");
  const [unidad, setUnidad] = useState(unidadEsperada ?? "");
  const [justificacion, setJustificacion] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const congelado = estado === "congelado";
  const justObligatoria = estado === "validado";

  useEffect(() => {
    if (state.ok) {
      setFile(null);
      setPeriodo(periodoDefault);
      setValor("");
      setJustificacion("");
      setAbierta(false);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(state.mensaje ?? "Evidencia registrada.");
      if (state.error) toast.error(state.error); // captura parcial
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (congelado) {
    return (
      <div className="rounded-card border border-gris/25 bg-gris/10 px-4 py-3.5 text-sm">
        <p className="font-medium text-ink">Carga cerrada</p>
        <p className="mt-0.5 text-muted">
          El reporte está congelado; la evidencia quedó cerrada para aseguramiento.
        </p>
      </div>
    );
  }

  // Toggle apagado (solo aplica al staff): la zona está, en gris y bloqueada.
  if (comoStaff && !habilitada) {
    return (
      <div
        aria-disabled
        className="rounded-card border border-line bg-ink/[0.03] px-4 py-3.5 text-sm"
      >
        <div className="flex items-start gap-2.5">
          <span aria-hidden className="mt-0.5 text-gris">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10.5" width="16" height="10" rx="2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-medium text-gris">Cargar evidencia</p>
            <p className="mt-0.5 text-muted">La carga de evidencia corresponde al cliente.</p>
          </div>
        </div>
      </div>
    );
  }

  function elegirArchivo(f: File | null) {
    setLocalError(null);
    setFile(f);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setLocalError("Falta el archivo: arrástralo o selecciónalo.");
      return;
    }
    if (!area.trim()) {
      setLocalError(
        comoStaff
          ? "Elige el área en cuyo nombre cargas la evidencia."
          : "Elige el área de origen de la evidencia."
      );
      return;
    }
    if (!periodo.trim()) {
      setLocalError("Indica el periodo que cubre el archivo (por ejemplo, 2025).");
      return;
    }
    if (justObligatoria && justificacion.trim().length < 20) {
      setLocalError("Explica el motivo del ajuste (mínimo 20 caracteres).");
      return;
    }
    const fd = new FormData();
    fd.set("solicitud_id", solicitudId);
    fd.set("file", file);
    fd.set("area_origen", area);
    fd.set("periodo_cubierto", periodo);
    fd.set("justificacion", justificacion);
    if (esCuantitativa) {
      fd.set("valor", valor);
      fd.set("unidad", unidad);
      fd.set("periodo_captura", periodo);
    }
    startTransition(() => formAction(fd));
  }

  if (!abierta) {
    return (
      <div className="rounded-card border border-line bg-crema/30 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Cargar evidencia</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {comoStaff
                ? "IRStrat carga en nombre de un área. La autoría queda registrada en el historial y en la bitácora."
                : "Sube el archivo en nombre del área que lo entrega."}
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAbierta(true)}>
            Cargar archivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-card border border-teal/25 bg-teal/[0.03] p-4"
    >
      {comoStaff && (
        <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs leading-relaxed text-ink">
          Esta carga quedará registrada como{" "}
          <strong>hecha por IRStrat en nombre del área que elijas</strong>. La marca
          de autoría no se puede quitar.
        </p>
      )}

      {/* Archivo */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) elegirArchivo(f);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-6 text-center transition duration-150",
          dragging ? "border-teal bg-teal/5" : "border-line bg-surface hover:border-teal/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          id={`carga-panel-file-${solicitudId}`}
          className="sr-only"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-medium text-ink">{file.name}</div>
              <div className="text-xs text-muted">{tamano(file.size)}</div>
            </div>
            <button
              type="button"
              onClick={() => elegirArchivo(null)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-rojo"
            >
              Quitar
            </button>
          </div>
        ) : (
          <label htmlFor={`carga-panel-file-${solicitudId}`} className="block cursor-pointer text-sm">
            <span className="font-medium text-ink">Arrastra el archivo o </span>
            <span className="text-teal underline underline-offset-2">explóralo</span>
          </label>
        )}
      </div>

      {/* Área (obligatoria) + periodo */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`carga-area-${solicitudId}`} className={labelCls}>
            {comoStaff ? "Se carga en nombre del área" : "Área de origen"}
          </label>
          {areas.length > 0 ? (
            <select
              id={`carga-area-${solicitudId}`}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={cn(inputCls, "mt-1")}
            >
              <option value="">Elige un área…</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`carga-area-${solicitudId}`}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ej. Operaciones"
              className={cn(inputCls, "mt-1")}
            />
          )}
        </div>
        <div>
          <label htmlFor={`carga-periodo-${solicitudId}`} className={labelCls}>
            Periodo cubierto
          </label>
          <input
            id={`carga-periodo-${solicitudId}`}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            placeholder="Ej. 2025"
            className={cn(inputCls, "mt-1")}
          />
        </div>
      </div>

      {/* Cifra (solo cuantitativas) */}
      {esCuantitativa && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`carga-valor-${solicitudId}`} className={labelCls}>
              Cifra <span className="font-normal">· opcional</span>
            </label>
            <input
              id={`carga-valor-${solicitudId}`}
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              className={cn(inputCls, "mt-1")}
            />
          </div>
          <div>
            <label htmlFor={`carga-unidad-${solicitudId}`} className={labelCls}>
              Unidad
            </label>
            <input
              id={`carga-unidad-${solicitudId}`}
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              placeholder="Ej. kWh"
              className={cn(inputCls, "mt-1")}
            />
          </div>
        </div>
      )}

      {/* Justificación: obligatoria si la solicitud ya está validada */}
      {justObligatoria && (
        <div className="space-y-1.5">
          <label htmlFor={`carga-just-${solicitudId}`} className={labelCls}>
            ¿Qué cambió respecto de lo ya validado?
          </label>
          <textarea
            id={`carga-just-${solicitudId}`}
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            rows={3}
            placeholder="Mínimo 20 caracteres. Con esto se reabre la revisión."
            className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50"
          />
          <p className="text-xs text-muted">{justificacion.trim().length}/20 caracteres.</p>
        </div>
      )}

      {localError && (
        <p role="alert" className="rounded-lg border border-rojo/25 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {localError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setAbierta(false)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          Cancelar
        </button>
        <Button type="submit" size="sm" loading={pending} disabled={!file}>
          Cargar evidencia
        </Button>
      </div>
    </form>
  );
}
