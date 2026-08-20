"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EstadoBadge, OrigenBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ESTADO_META, TONO_CLASSES, type EstadoSolicitud } from "@/lib/estados";
import { ORIGEN_META, type OrigenSolicitud } from "@/lib/origen";
import { MarcasCompactas } from "@/components/marcas-verificacion";
import { relativo, fmtFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/cn";
import { enviarSolicitudesMasivo } from "./actions";

export type FilaMatriz = {
  id: string;
  titulo: string;
  area: string | null;
  estado: EstadoSolicitud;
  orden: number;
  responsable: string | null;
  numVersiones: number;
  ultimaActividad: string;
  /** Quién pidió la información: IRStrat o el propio cliente. */
  origen: OrigenSolicitud;
  /** Cliente dueño de la solicitud (null si el reporte perdió su tenant). */
  tenantNombre: string | null;
  tenantLogo: string | null;
  /** Visto bueno del ÁREA (doble verificación). No es un estado: marca paralela. */
  vbFirmado: boolean;
  /** Copia de una difusión que el área declaró ajena, o que quien difundió retiró. */
  declinada: boolean;
  desactivada: boolean;
};

/**
 * Elegible para "Enviar solicitud": pendiente, con responsable asignado y **del
 * propio origen** — cada lado mueve las suyas (lib/origen.ts). Sin el filtro de
 * origen, el lote incluiría solicitudes que la base rechazaría.
 */
function elegible(f: FilaMatriz, origenPropio: OrigenSolicitud): boolean {
  return f.estado === "pendiente" && f.responsable != null && f.origen === origenPropio;
}

function grupoPrioridad(estado: EstadoSolicitud): number {
  switch (estado) {
    case "observaciones":
      return 0;
    case "recibido":
    case "en_revision":
      return 1;
    case "pendiente":
    case "solicitado":
      return 2;
    default:
      return 3;
  }
}

const ESTADOS_ORDEN: EstadoSolicitud[] = [
  "observaciones",
  "recibido",
  "en_revision",
  "pendiente",
  "solicitado",
  "validado",
  "congelado",
];

export function MatrizSolicitudes({
  filas,
  origenPropio,
}: {
  filas: FilaMatriz[];
  /** Origen de las solicitudes que ESTE usuario puede mover: 'irstrat' para el
   *  staff, 'cliente' para el administrador del cliente. */
  origenPropio: OrigenSolicitud;
}) {
  const [fEstado, setFEstado] = useState<EstadoSolicitud | "todos">("todos");
  const [fArea, setFArea] = useState<string>("todos");
  const [sel, setSel] = useState<Set<string>>(new Set());
  // Modo selección: los checkboxes se ocultan por defecto (95% del uso es leer y
  // abrir); aparecen al activar "Seleccionar" en la toolbar.
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const abrir = (id: string) => router.push(`/admin/solicitudes/${id}`);
  const salirSeleccion = () => {
    setModoSeleccion(false);
    setSel(new Set());
  };

  const areas = useMemo(
    () =>
      Array.from(new Set(filas.map((f) => f.area).filter((a): a is string => !!a))).sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [filas]
  );

  const estadosPresentes = useMemo(
    () => ESTADOS_ORDEN.filter((e) => filas.some((f) => f.estado === e)),
    [filas]
  );

  // La columna de cliente solo aparece cuando la vista mezcla varios: con el
  // selector puesto en uno, repetir su nombre en cada fila es ruido.
  const mostrarCliente = useMemo(
    () => new Set(filas.map((f) => f.tenantNombre ?? "—")).size > 1,
    [filas]
  );

  // La columna de origen solo aparece cuando la vista mezcla los dos: en un
  // cliente que nunca creó solicitudes internas, repetir "Solicitud IRStrat" en
  // cada fila es ruido.
  const mostrarOrigen = useMemo(
    () => new Set(filas.map((f) => f.origen)).size > 1,
    [filas]
  );

  const visibles = useMemo(() => {
    const base = filas.filter(
      (f) =>
        (fEstado === "todos" || f.estado === fEstado) &&
        (fArea === "todos" || f.area === fArea)
    );
    return [...base].sort((a, b) => {
      const ga = grupoPrioridad(a.estado);
      const gb = grupoPrioridad(b.estado);
      if (ga !== gb) return ga - gb;
      if (a.ultimaActividad !== b.ultimaActividad)
        return a.ultimaActividad > b.ultimaActividad ? -1 : 1;
      return a.orden - b.orden;
    });
  }, [filas, fEstado, fArea]);

  const elegiblesVisibles = useMemo(
    () => visibles.filter((f) => elegible(f, origenPropio)),
    [visibles, origenPropio]
  );
  const seleccionadas = useMemo(
    () => [...sel].filter((id) => filas.some((f) => f.id === id && elegible(f, origenPropio))),
    [sel, filas, origenPropio]
  );
  const todasSel =
    elegiblesVisibles.length > 0 && elegiblesVisibles.every((f) => sel.has(f.id));

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleTodas = () =>
    setSel((prev) => {
      const next = new Set(prev);
      if (todasSel) elegiblesVisibles.forEach((f) => next.delete(f.id));
      else elegiblesVisibles.forEach((f) => next.add(f.id));
      return next;
    });

  // Envío masivo: confirmado por ConfirmDialog (efecto externo: manda correos),
  // resultado por toast (enviados/omitidas).
  const enviar = () => {
    if (seleccionadas.length === 0) return;
    startTransition(async () => {
      const r = await enviarSolicitudesMasivo(seleccionadas);
      setConfirmar(false);
      setSel(new Set());
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const nota = r.modo === "consola" ? " (modo consola: revisa el log)" : "";
      const partes = [
        `${r.correos} ${r.correos === 1 ? "correo enviado" : "correos enviados"}`,
        `${r.solicitudes} ${r.solicitudes === 1 ? "solicitud" : "solicitudes"} marcadas`,
      ];
      if (r.omitidas > 0) partes.push(`${r.omitidas} omitidas`);
      if (r.fallidos > 0) {
        toast.error(`${partes.join(" · ")} · ${r.fallidos} con error${nota}`);
      } else {
        toast.success(`${partes.join(" · ")}${nota}`);
      }
    });
  };

  const selectCls =
    "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition duration-150 focus:border-teal/50";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Solicitudes
          <span className="ml-2 text-sm font-normal text-muted">{visibles.length}</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="f-estado">
            Filtrar por estado
          </label>
          <select
            id="f-estado"
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value as EstadoSolicitud | "todos")}
            className={selectCls}
          >
            <option value="todos">Todos los estados</option>
            {estadosPresentes.map((e) => (
              <option key={e} value={e}>
                {ESTADO_META[e].label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-area">
            Filtrar por área
          </label>
          <select
            id="f-area"
            value={fArea}
            onChange={(e) => setFArea(e.target.value)}
            className={selectCls}
          >
            <option value="todos">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {(fEstado !== "todos" || fArea !== "todos") && (
            <button
              onClick={() => {
                setFEstado("todos");
                setFArea("todos");
              }}
              className="h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
            >
              Limpiar
            </button>
          )}

          <div className="h-5 w-px bg-line" aria-hidden />
          <button
            onClick={() => (modoSeleccion ? salirSeleccion() : setModoSeleccion(true))}
            aria-pressed={modoSeleccion}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition duration-150",
              modoSeleccion
                ? "border-teal/40 bg-teal/10 text-teal"
                : "border-line text-muted hover:border-teal/30 hover:text-ink"
            )}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            {modoSeleccion ? "Cancelar selección" : "Seleccionar"}
          </button>
        </div>
      </div>

      {/* Barra de acción masiva */}
      {seleccionadas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-teal/25 bg-teal/[0.04] px-4 py-3">
          <span className="text-sm text-ink">
            <span className="font-semibold">{seleccionadas.length}</span>{" "}
            {seleccionadas.length === 1 ? "solicitud seleccionada" : "solicitudes seleccionadas"}
            <span className="ml-2 text-muted">se agrupan por responsable</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSel(new Set())}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
            >
              Cancelar
            </button>
            <Button size="sm" onClick={() => setConfirmar(true)} loading={pending}>
              {seleccionadas.length === 1
                ? "Enviar solicitud"
                : `Enviar solicitudes (${seleccionadas.length})`}
            </Button>
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <EmptyState
          glifo="⁝"
          titulo="Sin coincidencias"
          descripcion="Ninguna solicitud cumple los filtros seleccionados."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
          {/* Tabla en pantallas medianas+ */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  {modoSeleccion && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todas las pendientes visibles"
                        checked={todasSel}
                        onChange={toggleTodas}
                        disabled={elegiblesVisibles.length === 0}
                        className="size-4 accent-teal disabled:opacity-40"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Solicitud</th>
                  {mostrarOrigen && <th className="px-4 py-3 font-medium">Origen</th>}
                  {mostrarCliente && <th className="px-4 py-3 font-medium">Cliente</th>}
                  <th className="px-4 py-3 font-medium">Área</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  {/* Las dos verificaciones en dos puntos: en 135 renglones no cabe
                      la frase, pero sí la pregunta de quién ya pasó por las dos manos. */}
                  <th className="px-4 py-3 text-center font-medium" title="Visto bueno del área · Validación">
                    VB · Val.
                  </th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 text-center font-medium">Versiones</th>
                  <th className="px-4 py-3 font-medium">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const puede = elegible(f, origenPropio);
                  const dot = TONO_CLASSES[ESTADO_META[f.estado].tono].dot;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => abrir(f.id)}
                      className={cn(
                        "group cursor-pointer border-b border-line/70 transition duration-150 last:border-0 hover:bg-teal/[0.04]",
                        sel.has(f.id) && "bg-teal/[0.05]"
                      )}
                    >
                      {modoSeleccion && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${f.titulo}`}
                            checked={sel.has(f.id)}
                            onChange={() => toggle(f.id)}
                            disabled={!puede}
                            title={
                              puede
                                ? "Seleccionar para enviar solicitud"
                                : "Solo tus pendientes con responsable asignado"
                            }
                            className="size-4 accent-teal disabled:cursor-not-allowed disabled:opacity-30"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
                          <Link
                            href={`/admin/solicitudes/${f.id}`}
                            onClick={(e) => e.stopPropagation()}
                            title={f.titulo}
                            className="font-medium text-ink transition duration-150 group-hover:text-teal"
                          >
                            {f.titulo}
                          </Link>
                        </span>
                      </td>
                      {mostrarOrigen && (
                        <td className="px-4 py-3">
                          <OrigenBadge origen={f.origen} />
                        </td>
                      )}
                      {mostrarCliente && (
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 text-muted">
                            <TenantLogo
                              nombre={f.tenantNombre ?? "—"}
                              logoUrl={f.tenantLogo}
                              tamano="xs"
                            />
                            <span className="truncate">{f.tenantNombre ?? "—"}</span>
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-muted">{f.area ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <EstadoBadge estado={f.estado} />
                          {/* Una copia declinada aparecería como "Solicitado" —es su
                              estado real— y en la matriz eso se lee como trabajo
                              pendiente que nadie va a hacer. La marca lo aclara. */}
                          {(f.declinada || f.desactivada) && (
                            <span className="whitespace-nowrap rounded-pill border border-gris/25 bg-gris/10 px-2 py-0.5 text-[11px] font-medium text-gris">
                              {f.declinada ? "Declinada" : "Retirada"}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <MarcasCompactas
                          vbFirmado={f.vbFirmado}
                          validado={f.estado === "validado" || f.estado === "congelado"}
                        />
                      </td>
                      <td className="px-4 py-3 text-muted">{f.responsable ?? "—"}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-ink">
                        {f.numVersiones > 0 ? (
                          f.numVersiones
                        ) : (
                          <span className="text-muted/60">0</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-muted"
                        title={fmtFechaHora(f.ultimaActividad)}
                      >
                        {relativo(f.ultimaActividad)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas apiladas en móvil */}
          <ul className="divide-y divide-line/70 sm:hidden">
            {visibles.map((f) => {
              const puede = elegible(f, origenPropio);
              const dot = TONO_CLASSES[ESTADO_META[f.estado].tono].dot;
              return (
                <li key={f.id} className="flex items-start gap-3 px-4 py-3.5">
                  {modoSeleccion && (
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${f.titulo}`}
                      checked={sel.has(f.id)}
                      onChange={() => toggle(f.id)}
                      disabled={!puede}
                      className="mt-0.5 size-4 shrink-0 accent-teal disabled:opacity-30"
                    />
                  )}
                  <Link href={`/admin/solicitudes/${f.id}`} className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
                        <span className="font-medium text-ink">{f.titulo}</span>
                      </span>
                      <EstadoBadge estado={f.estado} className="shrink-0" />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      {mostrarOrigen && <span>{ORIGEN_META[f.origen].label}</span>}
                      {mostrarCliente && f.tenantNombre && (
                        <span className="font-medium text-ink">{f.tenantNombre}</span>
                      )}
                      {f.area && <span>{f.area}</span>}
                      <span>{f.responsable ?? "Sin responsable"}</span>
                      <span className={cn(f.numVersiones === 0 && "text-muted/60")}>
                        {f.numVersiones} {f.numVersiones === 1 ? "versión" : "versiones"}
                      </span>
                      <span title={fmtFechaHora(f.ultimaActividad)}>
                        {relativo(f.ultimaActividad)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmar}
        titulo={
          seleccionadas.length === 1
            ? "¿Enviar la solicitud?"
            : `¿Enviar ${seleccionadas.length} solicitudes?`
        }
        descripcion="Se enviará un correo por responsable con sus solicitudes y cada una pasará a “Solicitada”."
        confirmar="Enviar"
        cancelar="Cancelar"
        cargando={pending}
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      />
    </section>
  );
}
