"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { subirEvidencia, type SubirState } from "./actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { fmtFechaLarga, deFechaLocal } from "@/lib/fechas";
import type { EstadoSolicitud } from "@/lib/estados";

const initial: SubirState = { ok: false, error: null };

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";

/** Paso numerado dentro de la misma tarjeta (no wizard de páginas). */
function Paso({
  n,
  titulo,
  ayuda,
  children,
}: {
  n: number;
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-teal text-xs font-semibold text-crema"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{titulo}</p>
        {ayuda && <p className="mt-0.5 text-xs leading-relaxed text-muted">{ayuda}</p>}
        <div className="mt-2.5">{children}</div>
      </div>
    </div>
  );
}

export function UploadEvidencia({
  solicitudId,
  esCuantitativa,
  unidadEsperada,
  areaUsuario,
  reporteEjercicio,
  estado,
  tieneVersionPrevia,
  fechaCongelamiento,
}: {
  solicitudId: string;
  esCuantitativa: boolean;
  unidadEsperada: string | null;
  areaUsuario: string | null;
  reporteEjercicio: number | null;
  estado: EstadoSolicitud;
  tieneVersionPrevia: boolean;
  fechaCongelamiento?: string | null;
}) {
  const periodoDefault = reporteEjercicio != null ? String(reporteEjercicio) : "";
  const [state, formAction, pending] = useActionState(subirEvidencia, initial);
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(periodoDefault);
  // Área: pre-llenada con el área del usuario, mostrada como texto con 'cambiar'.
  const [area, setArea] = useState(areaUsuario ?? "");
  const [areaEditable, setAreaEditable] = useState(!areaUsuario);
  const [valor, setValor] = useState("");
  const [unidad, setUnidad] = useState(unidadEsperada ?? "");
  // Periodo de la captura: hereda del paso 2 salvo que el usuario lo cambie.
  const [periodoCaptura, setPeriodoCaptura] = useState("");
  const [capturaEditable, setCapturaEditable] = useState(false);
  const [justificacion, setJustificacion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const congelado = estado === "congelado";
  const validado = estado === "validado";
  const bloqueado = congelado;
  const justObligatoria = validado;
  const mostrarJustificacion = justObligatoria || tieneVersionPrevia;
  // Periodo efectivo de la captura (heredado o el editado).
  const periodoCapturaEfectivo = capturaEditable ? periodoCaptura : periodo;

  useEffect(() => {
    if (state.ok) {
      setFile(null);
      setPeriodo(periodoDefault);
      setValor("");
      setPeriodoCaptura("");
      setCapturaEditable(false);
      setJustificacion("");
      if (inputRef.current) inputRef.current.value = "";
      toast.success("Listo — recibimos tu archivo. Queda como la versión vigente.");
      if (state.error) toast.error(state.error); // captura parcial
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (bloqueado) {
    return (
      <div className="rounded-card border border-gris/25 bg-gris/10 px-5 py-6 text-sm text-ink">
        <p className="font-medium">Ya no se puede cargar</p>
        <p className="mt-1 text-muted">
          {fechaCongelamiento
            ? `Este informe se cerró el ${fmtFechaLarga(
                deFechaLocal(fechaCongelamiento.slice(0, 10))
              )} y la información quedó guardada tal cual.`
            : "Este informe se cerró y la información quedó guardada tal cual."}{" "}
          Si necesitas un ajuste, escríbele a tu coordinador de IRStrat.
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
      setLocalError("Falta tu archivo: arrástralo o selecciónalo en el paso 1.");
      return;
    }
    if (!periodo.trim()) {
      setLocalError("Dinos qué periodo cubre el archivo en el paso 2 (por ejemplo, 2025).");
      return;
    }
    if (justObligatoria && justificacion.trim().length < 20) {
      setLocalError(
        "Cuéntanos en una frase qué cambió, para revisarlo de nuevo."
      );
      return;
    }
    const fd = new FormData();
    fd.set("solicitud_id", solicitudId);
    fd.set("file", file);
    fd.set("periodo_cubierto", periodo);
    fd.set("area_origen", area);
    fd.set("justificacion", justificacion);
    if (esCuantitativa) {
      fd.set("valor", valor);
      fd.set("unidad", unidad);
      fd.set("periodo_captura", periodoCapturaEfectivo);
    }
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {validado && (
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-sm text-ink">
          Esta solicitud ya quedó <strong>validada</strong>. Si subes una versión
          nueva, <strong>la revisaremos otra vez</strong> y te pediremos que nos
          digas qué cambió.
        </div>
      )}

      {/* Paso 1 — Tu archivo */}
      <Paso n={1} titulo="Tu archivo">
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
            "relative rounded-card border-2 border-dashed px-5 py-9 text-center transition duration-150 ease-out",
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
      </Paso>

      {/* Paso 2 — Periodo cubierto */}
      <Paso
        n={2}
        titulo="¿Qué periodo cubre esta información?"
        ayuda="El año o los trimestres que abarca el archivo, ej. 2025."
      >
        <input
          id="periodo"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          placeholder="Ej. 2025 o Q1–Q4 2025"
          className={cn(inputClass, "sm:max-w-xs")}
        />
        {/* Área de origen: texto con 'cambiar' discreto, no un campo más. */}
        <div className="mt-3 text-xs text-muted">
          {areaEditable ? (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="area_origen" className="font-medium text-ink">
                Área de origen
              </label>
              <input
                id="area_origen"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ej. Operaciones"
                className={cn(inputClass, "h-9 w-auto min-w-[10rem] flex-1 sm:max-w-xs")}
              />
            </div>
          ) : (
            <span>
              Área de origen: <span className="font-medium text-ink">{area}</span>{" "}
              <button
                type="button"
                onClick={() => setAreaEditable(true)}
                className="font-medium text-teal underline-offset-2 hover:underline"
              >
                cambiar
              </button>
            </span>
          )}
        </div>
      </Paso>

      {/* Paso 3 — La cifra (solo cuantitativas) */}
      {esCuantitativa && (
        <Paso
          n={3}
          titulo="La cifra que reportas"
          ayuda="Escribe el dato principal que respalda este archivo."
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="valor" className="block text-xs font-medium text-muted">
                Dato
              </label>
              <input
                id="valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
                className={cn(inputClass, "w-36")}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="unidad" className="block text-xs font-medium text-muted">
                Unidad
              </label>
              <input
                id="unidad"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="Ej. kWh"
                className={cn(inputClass, "w-32")}
              />
            </div>
          </div>
          {/* El periodo de la captura se hereda del paso 2 (editable tras 'cambiar'). */}
          <div className="mt-2.5 text-xs text-muted">
            {capturaEditable ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="periodo_captura" className="font-medium text-ink">
                  Periodo de la cifra
                </label>
                <input
                  id="periodo_captura"
                  value={periodoCaptura}
                  onChange={(e) => setPeriodoCaptura(e.target.value)}
                  placeholder="Ej. 2025"
                  className={cn(inputClass, "h-9 w-32")}
                />
              </div>
            ) : (
              <span>
                Corresponde al periodo{" "}
                <span className="font-medium text-ink">
                  {periodo.trim() || "que indiques arriba"}
                </span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setPeriodoCaptura(periodo);
                    setCapturaEditable(true);
                  }}
                  className="font-medium text-teal underline-offset-2 hover:underline"
                >
                  cambiar
                </button>
              </span>
            )}
          </div>
        </Paso>
      )}

      {/* Justificación: obligatoria si validado, opcional si hay versión previa */}
      {mostrarJustificacion && (
        <div
          className={cn(
            "space-y-1.5 rounded-card border p-4",
            justObligatoria ? "border-gold/30 bg-gold/5" : "border-line bg-crema/30"
          )}
        >
          <label htmlFor="justificacion" className="block text-sm font-medium text-ink">
            {justObligatoria
              ? "¿Qué cambió respecto de lo que ya validamos?"
              : "¿Por qué reemplazas este archivo?"}
          </label>
          <p className="text-xs text-muted">
            {justObligatoria
              ? "Cuéntanoslo en una o dos líneas (al menos 20 caracteres); con esto reabrimos la revisión."
              : "Opcional. Una nota rápida nos ayuda a entender el cambio."}
          </p>
          <textarea
            id="justificacion"
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            rows={3}
            placeholder={
              justObligatoria
                ? "Ej. Corregimos el consumo de octubre con la factura definitiva…"
                : "Motivo del reemplazo (opcional)…"
            }
            className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50"
          />
          {justObligatoria && (
            <p className="text-xs text-muted">
              {justificacion.trim().length}/20 caracteres.
            </p>
          )}
        </div>
      )}

      {localError && (
        <p role="alert" className="rounded-lg border border-rojo/25 bg-rojo/10 px-3.5 py-2.5 text-sm text-rojo">
          {localError}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!file}>
          {estado === "observaciones" ? "Reenviar" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
