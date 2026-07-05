"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { subirEvidencia, type SubirState } from "./actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { EstadoSolicitud } from "@/lib/estados";

const initial: SubirState = { ok: false, error: null };

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadEvidencia({
  solicitudId,
  esCuantitativa,
  unidadEsperada,
  areaUsuario,
  estado,
}: {
  solicitudId: string;
  esCuantitativa: boolean;
  unidadEsperada: string | null;
  areaUsuario: string | null;
  estado: EstadoSolicitud;
}) {
  const [state, formAction, pending] = useActionState(subirEvidencia, initial);
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("");
  const [area, setArea] = useState(areaUsuario ?? "");
  const [valor, setValor] = useState("");
  const [unidad, setUnidad] = useState(unidadEsperada ?? "");
  const [periodoCaptura, setPeriodoCaptura] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const congelado = estado === "congelado";
  const validado = estado === "validado";
  const bloqueado = congelado;

  useEffect(() => {
    if (state.ok) {
      setFile(null);
      setPeriodo("");
      setValor("");
      setPeriodoCaptura("");
      if (inputRef.current) inputRef.current.value = "";
      toast.success(
        state.version != null
          ? `Evidencia registrada como versión v${state.version}.`
          : "Evidencia registrada."
      );
      if (state.error) toast.error(state.error); // captura parcial
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (bloqueado) {
    return (
      <div className="rounded-card border border-gris/25 bg-gris/10 px-5 py-6 text-sm text-ink">
        <p className="font-medium">Carga deshabilitada</p>
        <p className="mt-1 text-muted">
          Esta solicitud está <strong>congelada</strong> por el cierre del
          reporte. Para reemplazar evidencia, contacta a tu coordinador de
          IRStrat.
        </p>
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
      setLocalError("Selecciona o arrastra un archivo.");
      return;
    }
    const fd = new FormData();
    fd.set("solicitud_id", solicitudId);
    fd.set("file", file);
    fd.set("periodo_cubierto", periodo);
    fd.set("area_origen", area);
    if (esCuantitativa) {
      fd.set("valor", valor);
      fd.set("unidad", unidad);
      fd.set("periodo_captura", periodoCaptura);
    }
    formAction(fd);
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {validado && (
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-sm text-ink">
          Esta solicitud ya fue <strong>validada</strong>. Cargar una nueva
          versión requerirá una justificación de reemplazo (próximamente).
        </div>
      )}

      {/* Dropzone */}
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
          "relative rounded-card border-2 border-dashed px-5 py-8 text-center transition duration-150 ease-out",
          dragging
            ? "border-teal bg-teal/5 shadow-lift"
            : "border-line bg-crema/30 hover:border-teal/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          id="evidencia-file"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </span>
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-medium text-ink">{file.name}</div>
              <div className="text-xs text-muted">{tamano(file.size)}</div>
            </div>
            <button
              type="button"
              onClick={() => elegirArchivo(null)}
              className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-rojo"
            >
              Quitar
            </button>
          </div>
        ) : (
          <label htmlFor="evidencia-file" className="block cursor-pointer">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-teal/10 text-teal">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M6 10l6-6 6 6" />
                <path d="M4 20h16" />
              </svg>
            </span>
            <span className="mt-3 block text-sm font-medium text-ink">
              Arrastra tu archivo aquí o{" "}
              <span className="text-teal underline underline-offset-2">explóralo</span>
            </span>
            <span className="mt-1 block text-xs text-muted">
              Excel, PDF, imágenes u otro formato de respaldo
            </span>
          </label>
        )}
      </div>

      {/* Metadatos de la evidencia */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="periodo" className="block text-sm font-medium text-ink">
            Periodo cubierto <span className="text-rojo">*</span>
          </label>
          <input
            id="periodo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            required
            placeholder="Ej. 2025 o Q1–Q4 2025"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="area_origen" className="block text-sm font-medium text-ink">
            Área de origen
          </label>
          <input
            id="area_origen"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Ej. Operaciones"
            className={inputClass}
          />
        </div>
      </div>

      {/* Captura de valor (solicitudes cuantitativas) */}
      {esCuantitativa && (
        <div className="rounded-card border border-gold/25 bg-gold/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">
            Captura de valor
          </p>
          <p className="mt-1 text-xs text-muted">
            Registra el dato numérico que respalda esta evidencia (opcional).
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="valor" className="block text-sm font-medium text-ink">
                Valor
              </label>
              <input
                id="valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="unidad" className="block text-sm font-medium text-ink">
                Unidad
              </label>
              <input
                id="unidad"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="Ej. kWh"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="periodo_captura" className="block text-sm font-medium text-ink">
                Periodo
              </label>
              <input
                id="periodo_captura"
                value={periodoCaptura}
                onChange={(e) => setPeriodoCaptura(e.target.value)}
                placeholder="Ej. 2025"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error de validación previo al envío (el resultado del servidor va a toast) */}
      {localError && (
        <p role="alert" className="rounded-lg border border-rojo/25 bg-rojo/10 px-3.5 py-2.5 text-sm text-rojo">
          {localError}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!file}>
          Enviar evidencia
        </Button>
      </div>
    </form>
  );
}
