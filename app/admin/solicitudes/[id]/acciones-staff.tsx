"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  cambiarEstado,
  agregarObservacion,
  enviarSolicitud,
  type AccionState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { TRANSICIONES } from "@/lib/transiciones";

const initial: AccionState = { ok: false, error: null, mensaje: null };

export function AccionesStaff({
  solicitudId,
  estadoActual,
  responsable,
}: {
  solicitudId: string;
  estadoActual: EstadoSolicitud;
  responsable: string | null;
}) {
  const destinos = TRANSICIONES[estadoActual] ?? [];
  const puedeSolicitar = estadoActual === "pendiente" && !!responsable;
  const toast = useToast();

  const [estadoState, estadoAction, estadoPending] = useActionState(cambiarEstado, initial);
  const [obsState, obsAction, obsPending] = useActionState(agregarObservacion, initial);
  const [solState, solAction, solPending] = useActionState(enviarSolicitud, initial);
  const [destino, setDestino] = useState<string>("");
  const [confirmar, setConfirmar] = useState(false);
  const obsRef = useRef<HTMLTextAreaElement>(null);

  // Feedback de cambio de estado.
  useEffect(() => {
    if (estadoState.ok) {
      setDestino("");
      if (estadoState.mensaje) toast.success(estadoState.mensaje);
    } else if (estadoState.error) {
      toast.error(estadoState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoState]);

  // Feedback de observación.
  useEffect(() => {
    if (obsState.ok) {
      if (obsRef.current) obsRef.current.value = "";
      toast.success(obsState.mensaje ?? "Observación enviada.");
    } else if (obsState.error) {
      toast.error(obsState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obsState]);

  // Feedback de envío de solicitud.
  useEffect(() => {
    if (solState.ok) {
      toast.success(solState.mensaje ?? "Solicitud enviada.");
    } else if (solState.error) {
      toast.error(solState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solState]);

  const aplicarEstado = () => {
    const fd = new FormData();
    fd.set("solicitud_id", solicitudId);
    fd.set("estado", destino);
    estadoAction(fd);
  };

  const onAplicar = () => {
    if (!destino) return;
    // 'validado' se percibe como irreversible en la demo → confirmar.
    if (destino === "validado") setConfirmar(true);
    else aplicarEstado();
  };

  const selectCls =
    "h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 focus:bg-surface disabled:opacity-55";

  return (
    <div className="space-y-6">
      {/* Enviar solicitud (solo pendientes con responsable) */}
      {estadoActual === "pendiente" && (
        <>
          <div>
            <h3 className="font-display text-base font-semibold text-ink">
              Solicitar información
            </h3>
            {puedeSolicitar ? (
              <form action={solAction} className="mt-3 space-y-3">
                <input type="hidden" name="solicitud_id" value={solicitudId} />
                <p className="text-sm text-muted">
                  Envía la solicitud a{" "}
                  <span className="font-medium text-ink">{responsable}</span> y márcala
                  como <span className="font-medium">Solicitada</span>.
                </p>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" loading={solPending}>
                    Enviar solicitud
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-3 text-sm text-muted">
                Asigna un responsable cliente para poder enviar la solicitud.
              </p>
            )}
          </div>
          <div className="h-px bg-line" aria-hidden />
        </>
      )}

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
          <div className="mt-3 space-y-3">
            <label htmlFor="nuevo-estado" className="sr-only">
              Nuevo estado
            </label>
            <select
              id="nuevo-estado"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className={selectCls}
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
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={onAplicar}
                loading={estadoPending}
                disabled={!destino}
              >
                Aplicar
              </Button>
            </div>
          </div>
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
          <label htmlFor="obs-contenido" className="sr-only">
            Observación
          </label>
          <textarea
            id="obs-contenido"
            ref={obsRef}
            name="contenido"
            required
            rows={4}
            placeholder="Describe qué debe corregir o aclarar el cliente…"
            className="w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="danger" loading={obsPending}>
              Enviar observación
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmar}
        titulo="¿Validar esta solicitud?"
        descripcion="Marcarás la solicitud como validada. Es la señal de que la evidencia quedó aceptada; en la demo se trata como un paso definitivo."
        confirmar="Sí, validar"
        cancelar="Cancelar"
        cargando={estadoPending}
        onConfirm={() => {
          setConfirmar(false);
          aplicarEstado();
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  );
}
