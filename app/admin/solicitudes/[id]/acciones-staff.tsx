"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { cambiarEstado, agregarObservacion, type AccionState } from "./actions";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/ui/badge";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { TRANSICIONES } from "@/lib/transiciones";

const initial: AccionState = { ok: false, error: null, mensaje: null };

function Aviso({ state }: { state: AccionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-rojo">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.mensaje) {
    return (
      <p role="status" className="text-sm text-verde">
        {state.mensaje}
      </p>
    );
  }
  return null;
}

export function AccionesStaff({
  solicitudId,
  estadoActual,
}: {
  solicitudId: string;
  estadoActual: EstadoSolicitud;
}) {
  const destinos = TRANSICIONES[estadoActual] ?? [];

  const [estadoState, estadoAction, estadoPending] = useActionState(cambiarEstado, initial);
  const [obsState, obsAction, obsPending] = useActionState(agregarObservacion, initial);
  const [destino, setDestino] = useState<string>("");
  const obsRef = useRef<HTMLTextAreaElement>(null);

  // Al aplicar un cambio de estado, resetea la selección.
  useEffect(() => {
    if (estadoState.ok) setDestino("");
  }, [estadoState.ok]);

  // Al enviar una observación, limpia el textarea.
  useEffect(() => {
    if (obsState.ok && obsRef.current) obsRef.current.value = "";
  }, [obsState.ok]);

  const selectCls =
    "h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 focus:bg-surface disabled:opacity-55";

  return (
    <div className="space-y-6">
      {/* Cambiar estado */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-ink">Estado</h3>
          <EstadoBadge estado={estadoActual} />
        </div>
        {destinos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-3 text-sm text-muted">
            No hay transiciones disponibles desde este estado.
          </p>
        ) : (
          <form action={estadoAction} className="mt-3 space-y-3">
            <input type="hidden" name="solicitud_id" value={solicitudId} />
            <select
              name="estado"
              required
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className={selectCls}
              aria-label="Nuevo estado"
            >
              <option value="" disabled>
                Cambiar estado a…
              </option>
              {destinos.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_META[e].label}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between gap-3">
              <Aviso state={estadoState} />
              <Button
                type="submit"
                size="sm"
                loading={estadoPending}
                disabled={!destino}
                className="ml-auto"
              >
                Aplicar
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="h-px bg-line" aria-hidden />

      {/* Escribir observación */}
      <div>
        <h3 className="font-display text-base font-semibold text-ink">
          Observación al cliente
        </h3>
        <p className="mt-1 text-sm text-muted">
          Se envía como observación formal y mueve la solicitud a{" "}
          <span className="font-medium text-rojo">Con observaciones</span>.
        </p>
        <form action={obsAction} className="mt-3 space-y-3">
          <input type="hidden" name="solicitud_id" value={solicitudId} />
          <textarea
            ref={obsRef}
            name="contenido"
            required
            rows={4}
            placeholder="Describe qué debe corregir o aclarar el cliente…"
            className="w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
          />
          <div className="flex items-center justify-between gap-3">
            <Aviso state={obsState} />
            <Button
              type="submit"
              size="sm"
              variant="danger"
              loading={obsPending}
              className="ml-auto"
            >
              Enviar observación
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
