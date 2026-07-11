"use client";

import { startTransition, useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { fmtFechaLarga, deFechaLocal } from "@/lib/fechas";
import { congelarReporte, type CongelarState } from "./actions";

export type ReporteFila = {
  id: string;
  nombre: string;
  ejercicio: number;
  estado: "activo" | "congelado";
  fechaCongelamiento: string | null;
  tenantNombre: string;
  solicitudes: number;
  solicitudesCongeladas: number;
};

function limpiar(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

const initial: CongelarState = { ok: false, error: null };

export function ReportesView({
  reportes,
  esAdmin,
}: {
  reportes: ReporteFila[];
  esAdmin: boolean;
}) {
  const [aCongelar, setACongelar] = useState<ReporteFila | null>(null);

  if (reportes.length === 0) {
    return (
      <EmptyState
        glifo="—"
        titulo="Sin reportes"
        descripcion="Crea un reporte desde una plantilla para empezar."
      />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {reportes.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line bg-surface p-5 shadow-soft"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold text-ink">
                  {limpiar(r.nombre)} · {r.ejercicio}
                </h2>
                {r.estado === "congelado" ? (
                  <Chip tono="gris">Congelado</Chip>
                ) : (
                  <Chip tono="verde">Activo</Chip>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{limpiar(r.tenantNombre)}</span>
                <span>
                  {r.solicitudes} {r.solicitudes === 1 ? "solicitud" : "solicitudes"}
                </span>
                {r.estado === "congelado" && r.fechaCongelamiento && (
                  <span>
                    Cerrado el{" "}
                    {fmtFechaLarga(deFechaLocal(r.fechaCongelamiento.slice(0, 10)))}
                  </span>
                )}
              </div>
            </div>

            {r.estado === "activo" && esAdmin && (
              <Button size="sm" variant="secondary" onClick={() => setACongelar(r)}>
                Congelar reporte
              </Button>
            )}
            {r.estado === "activo" && !esAdmin && (
              <span className="text-xs text-muted">Congelar requiere rol admin</span>
            )}
          </li>
        ))}
      </ul>

      {aCongelar && (
        <CongelarDialog reporte={aCongelar} onClose={() => setACongelar(null)} />
      )}
    </>
  );
}

function CongelarDialog({
  reporte,
  onClose,
}: {
  reporte: ReporteFila;
  onClose: () => void;
}) {
  const toast = useToast();
  const inputId = useId();
  const [state, dispatch, pending] = useActionState(congelarReporte, initial);
  const [texto, setTexto] = useState("");
  const coincide = texto.trim() === reporte.nombre;

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Reporte congelado.");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onConfirm = () => {
    if (!coincide) return;
    const fd = new FormData();
    fd.set("reporte_id", reporte.id);
    fd.set("confirmacion", texto.trim());
    startTransition(() => dispatch(fd));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => !pending && onClose()}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[1px]"
      />
      <div className="toast-enter relative w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-lift">
        <h2 id={`${inputId}-title`} className="font-display text-lg font-semibold text-ink">
          Congelar “{limpiar(reporte.nombre)}”
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Esto cierra el reporte para aseguramiento:{" "}
          <span className="font-medium text-ink">
            todas sus {reporte.solicitudes} solicitudes pasan a congeladas
          </span>{" "}
          y no se podrá cargar evidencia, capturar valores, comentar ni cambiar
          estados. <span className="font-medium text-ink">No se puede deshacer.</span>
        </p>
        <div className="mt-4">
          <label htmlFor={inputId} className="block text-sm font-medium text-ink">
            Para confirmar, escribe el nombre exacto del reporte:
          </label>
          <p className="mt-1 select-all rounded-lg bg-crema/50 px-2.5 py-1.5 font-mono text-xs text-ink">
            {reporte.nombre}
          </p>
          <input
            id={inputId}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 focus:border-rojo/50 focus:bg-surface"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            loading={pending}
            disabled={!coincide}
          >
            Congelar reporte
          </Button>
        </div>
      </div>
    </div>
  );
}
