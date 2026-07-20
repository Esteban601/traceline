"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  cambiarEstado,
  agregarObservacion,
  enviarSolicitud,
  type AccionState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { TRANSICIONES } from "@/lib/transiciones";
import { cn } from "@/lib/cn";

const initial: AccionState = { ok: false, error: null, mensaje: null };

/** Verbo de acción para cada transición (idioma del staff, orientado a la tarea). */
function etiqueta(desde: EstadoSolicitud, hacia: EstadoSolicitud): string {
  if (hacia === "validado") return "Validar";
  if (hacia === "en_revision")
    return desde === "observaciones" || desde === "validado"
      ? "Reabrir revisión"
      : "Poner en revisión";
  if (hacia === "pendiente") return "Marcar como pendiente";
  if (hacia === "observaciones") return "Solicitar corrección";
  return ESTADO_META[hacia].label;
}

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
  const esPendiente = estadoActual === "pendiente";
  // 'pendiente' → 'solicitado' se hace SOLO vía enviarSolicitud (manda correo y
  // exige responsable), nunca por cambio de estado directo; por eso pendiente no
  // ofrece botones de estado. 'observaciones' se alcanza escribiendo la observación.
  const directos = (
    esPendiente ? [] : destinos.filter((d) => d !== "observaciones")
  ) as EstadoSolicitud[];
  const puedeObservar = destinos.includes("observaciones");
  const puedeSolicitar = esPendiente && !!responsable;

  const toast = useToast();
  const [estadoState, estadoAction, estadoPending] = useActionState(cambiarEstado, initial);
  const [obsState, obsAction, obsPending] = useActionState(agregarObservacion, initial);
  const [solState, solAction, solPending] = useActionState(enviarSolicitud, initial);
  const [confirmar, setConfirmar] = useState<EstadoSolicitud | null>(null);
  const [obsAbierta, setObsAbierta] = useState(false);
  const obsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (estadoState.ok) {
      if (estadoState.mensaje) toast.success(estadoState.mensaje);
    } else if (estadoState.error) toast.error(estadoState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoState]);

  useEffect(() => {
    if (obsState.ok) {
      if (obsRef.current) obsRef.current.value = "";
      setObsAbierta(false);
      toast.success(obsState.mensaje ?? "Observación enviada.");
    } else if (obsState.error) toast.error(obsState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obsState]);

  useEffect(() => {
    if (solState.ok) toast.success(solState.mensaje ?? "Solicitud enviada.");
    else if (solState.error) toast.error(solState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solState]);

  const aplicar = (destino: EstadoSolicitud) => {
    const fd = new FormData();
    fd.set("solicitud_id", solicitudId);
    fd.set("estado", destino);
    startTransition(() => estadoAction(fd));
  };
  const onDirecto = (destino: EstadoSolicitud) => {
    if (destino === "validado") setConfirmar("validado"); // percibido como definitivo
    else aplicar(destino);
  };

  const sinAcciones = !puedeSolicitar && directos.length === 0 && !puedeObservar && !esPendiente;

  return (
    <div className="space-y-4">
      {/* Enviar solicitud (pendiente) */}
      {esPendiente &&
        (puedeSolicitar ? (
          <form action={solAction}>
            <input type="hidden" name="solicitud_id" value={solicitudId} />
            <p className="mb-3 text-sm text-muted">
              Envía la solicitud a{" "}
              <span className="font-medium text-ink">{responsable}</span>; pasará a{" "}
              <span className="font-medium">Solicitada</span>.
            </p>
            <Button type="submit" loading={solPending} className="w-full">
              Enviar solicitud
            </Button>
          </form>
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-3 text-sm text-muted">
            Asigna un responsable cliente para poder enviar la solicitud.
          </p>
        ))}

      {/* Botones de acción directa (transiciones ≤ 3). Select como fallback si hay más. */}
      {directos.length > 3 ? (
        <SelectFallback
          desde={estadoActual}
          destinos={directos}
          onAplicar={onDirecto}
          pending={estadoPending}
        />
      ) : (
        directos.map((d) => {
          const esValidar = d === "validado";
          const label = etiqueta(estadoActual, d);
          return (
            <Button
              key={d}
              type="button"
              onClick={() => onDirecto(d)}
              loading={estadoPending}
              variant={esValidar ? "primary" : "secondary"}
              className="w-full"
            >
              {label}
            </Button>
          );
        })
      )}

      {/* Solicitar corrección → abre la observación (mueve a Con observaciones) */}
      {puedeObservar && (
        <div>
          {!obsAbierta ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setObsAbierta(true)}
              className="w-full"
            >
              Solicitar corrección
            </Button>
          ) : (
            <form action={obsAction} className="space-y-3 rounded-xl border border-rojo/25 bg-rojo/[0.04] p-3.5">
              <input type="hidden" name="solicitud_id" value={solicitudId} />
              <p className="text-sm text-ink">
                Se envía como observación formal y mueve la solicitud a{" "}
                <span className="font-medium text-rojo">Con observaciones</span>.
              </p>
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
                className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-rojo/40"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setObsAbierta(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
                >
                  Cancelar
                </button>
                <Button type="submit" size="sm" variant="danger" loading={obsPending}>
                  Enviar observación
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {sinAcciones && (
        <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-3 text-sm text-muted">
          No hay acciones disponibles desde este estado.
        </p>
      )}

      <ConfirmDialog
        open={confirmar === "validado"}
        titulo="¿Validar esta solicitud?"
        descripcion="Marcarás la solicitud como validada. Es la señal de que la evidencia quedó aceptada; en la demo se trata como un paso definitivo."
        confirmar="Sí, validar"
        cancelar="Cancelar"
        cargando={estadoPending}
        onConfirm={() => {
          setConfirmar(null);
          aplicar("validado");
        }}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}

/** Fallback general: select + Aplicar (para cuando haya >3 transiciones directas). */
function SelectFallback({
  desde,
  destinos,
  onAplicar,
  pending,
}: {
  desde: EstadoSolicitud;
  destinos: EstadoSolicitud[];
  onAplicar: (d: EstadoSolicitud) => void;
  pending: boolean;
}) {
  const [destino, setDestino] = useState<string>("");
  const selectCls =
    "h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 focus:bg-surface";
  return (
    <div className="space-y-3">
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
            {etiqueta(desde, e)}
          </option>
        ))}
      </select>
      <Button
        type="button"
        onClick={() => destino && onAplicar(destino as EstadoSolicitud)}
        loading={pending}
        disabled={!destino}
        className={cn("w-full")}
      >
        Aplicar
      </Button>
    </div>
  );
}
