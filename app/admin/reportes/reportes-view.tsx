"use client";

import { startTransition, useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { fmtDiaLargo } from "@/lib/fechas";
import { congelarReporte, guardarRegimen, type CongelarState, type RegimenState } from "./actions";
import { ALIVIOS, REGIMEN_LABEL, regimenDe, type Alivios } from "@/lib/perfil-emisor";

export type ReporteFila = {
  id: string;
  nombre: string;
  ejercicio: number;
  estado: "activo" | "congelado";
  fechaCongelamiento: string | null;
  tenantNombre: string;
  solicitudes: number;
  solicitudesCongeladas: number;
  anioAdopcion: number | null;
  alivios: Alivios;
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
  // Qué reporte tiene abierta su configuración de régimen. Uno a la vez: son
  // cinco casillas y un año, y verlas repetidas en toda la lista es ruido.
  const [configAbierta, setConfigAbierta] = useState<string | null>(null);

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
                <Chip tono={r.anioAdopcion == null ? "ambar" : "azul"}>
                  {REGIMEN_LABEL[regimenDe(r.ejercicio, r.anioAdopcion)]}
                </Chip>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{limpiar(r.tenantNombre)}</span>
                <span>
                  {r.solicitudes} {r.solicitudes === 1 ? "solicitud" : "solicitudes"}
                </span>
                {r.estado === "congelado" && r.fechaCongelamiento && (
                  <span>
                    Cerrado el{" "}
                    {fmtDiaLargo(r.fechaCongelamiento)}
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

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfigAbierta((a) => (a === r.id ? null : r.id))}
              aria-expanded={configAbierta === r.id}
            >
              {configAbierta === r.id ? "Cerrar régimen" : "Régimen S1 / S2"}
            </Button>

            {configAbierta === r.id && (
              <div className="w-full border-t border-line pt-4">
                <RegimenForm reporte={r} />
              </div>
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

const regimenInicial: RegimenState = { ok: false, error: null, mensaje: null };

/**
 * Régimen del ejercicio. El año de adopción y los alivios deciden la forma de
 * medio suplemento (§3.1), así que la pantalla muestra el resultado calculado en
 * cuanto se escribe el año: sin eso, quien lo captura no tiene forma de saber si
 * acertó hasta ver el documento.
 */
function RegimenForm({ reporte }: { reporte: ReporteFila }) {
  const [state, dispatch, pending] = useActionState(guardarRegimen, regimenInicial);
  const [anio, setAnio] = useState<string>(
    reporte.anioAdopcion == null ? "" : String(reporte.anioAdopcion)
  );
  const regimen = regimenDe(reporte.ejercicio, anio === "" ? null : Number(anio));

  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="reporte_id" value={reporte.id} />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            className="block text-xs font-medium uppercase tracking-wide text-muted"
            htmlFor={`adopcion-${reporte.id}`}
          >
            Año de adopción NIIF
          </label>
          <input
            id={`adopcion-${reporte.id}`}
            name="anio_adopcion"
            inputMode="numeric"
            value={anio}
            onChange={(e) => setAnio(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="2025"
            className="mt-2 h-11 w-32 rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 focus:bg-surface"
          />
        </div>
        <div className="pb-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            Régimen de este ejercicio ({reporte.ejercicio})
          </span>
          <span className="mt-2 inline-block font-medium text-ink">
            {REGIMEN_LABEL[regimen]}
          </span>
        </div>
      </div>

      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">
          Alivios transitorios adoptados
        </legend>
        <div className="mt-2 space-y-2">
          {ALIVIOS.map((a) => (
            <label
              key={a.clave}
              className="flex cursor-pointer gap-3 rounded-xl border border-line bg-crema/30 p-3 transition hover:border-teal/40"
            >
              <input
                type="checkbox"
                name={`alivio_${a.clave}`}
                defaultChecked={reporte.alivios[a.clave] === true}
                className="mt-0.5 size-4 shrink-0 accent-teal"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{a.titulo}</span>
                <span className="block text-xs text-muted">{a.ayuda}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={pending}>
          Guardar régimen
        </Button>
        {state.error && <span className="text-sm text-rojo">{state.error}</span>}
        {state.ok && state.mensaje && (
          <span className="text-sm text-teal">{state.mensaje}</span>
        )}
      </div>
    </form>
  );
}
