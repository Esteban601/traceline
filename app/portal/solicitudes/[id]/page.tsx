import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { Chip, OrigenBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { TONO_CLASSES, type EstadoSolicitud } from "@/lib/estados";
import type { OrigenSolicitud } from "@/lib/origen";
import { fmtFecha, fmtFechaHora, fmtFechaLarga, fmtDiaLargo } from "@/lib/fechas";
import { accionCliente, IconoAccion } from "@/app/portal/estado-cliente";
import { MarcasVerificacion } from "@/components/marcas-verificacion";
import { cargarVerificaciones } from "@/lib/verificaciones";
import { esJefeDeSuArea, puedeDarVB, puedeRetirarVB, motivoSinVB } from "@/lib/vb-area";
import {
  esDeSuArea,
  esDifundida,
  motivoSinDeclinar,
  puedeDeclinar,
  puedeRetomar,
} from "@/lib/difusion";
import { UploadEvidencia } from "./upload-evidencia";
import { ComentarioForm } from "./comentario-form";
import { VBAreaJefe } from "./vb-area-jefe";
import { NoAplica } from "./no-aplica";

export const metadata: Metadata = { title: "Solicitud" };

const fmtNum = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

function limpiar(nombre?: string | null): string {
  return (nombre ?? "—").replace(/\[DEMO\]\s*/i, "");
}

type EvidenciaRow = {
  id: string;
  version: number;
  nombre_original: string;
  periodo_cubierto: string | null;
  area_origen: string | null;
  justificacion: string | null;
  /** Marca inborrable: la cargó IRStrat en nombre del área. */
  cargado_por_staff: boolean;
  created_at: string;
  /** Quién la cargó. Decide si la frase puede decir «entregaste». */
  subido_por: string;
  subio: { nombre: string } | null;
};
type CapturaRow = {
  id: string;
  valor: number;
  unidad: string;
  periodo: string | null;
  confirmado: boolean;
  evidencia_id: string;
};
type ComentarioRow = {
  id: string;
  contenido: string;
  es_observacion: boolean;
  created_at: string;
  autor: { nombre: string } | null;
};

export default async function SolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getPerfilActual();
  if (!perfil) return null;

  const supabase = await createClient();

  const { data: sol } = await supabase
    .from("solicitudes")
    .select(
      "id, titulo, descripcion, area_asignada, estado, origen, es_cuantitativa, unidad_esperada, fecha_limite, vb_area_por, vb_area_fecha, grupo_difusion_id, declinada, desactivada, reporte:reportes!solicitudes_reporte_id_fkey(nombre, ejercicio, estado, fecha_congelamiento)"
    )
    .eq("id", id)
    .single();

  if (!sol) notFound();

  const [{ data: evidencias }, { data: capturas }, { data: comentarios }] =
    await Promise.all([
      supabase
        .from("evidencias")
        .select(
          "id, version, nombre_original, periodo_cubierto, area_origen, justificacion, cargado_por_staff, created_at, subido_por, subio:perfiles_usuario!evidencias_subido_por_fkey(nombre)"
        )
        .eq("solicitud_id", id)
        .order("version", { ascending: false }),
      supabase
        .from("capturas_valor")
        .select("id, valor, unidad, periodo, confirmado, evidencia_id")
        .eq("solicitud_id", id),
      supabase
        .from("comentarios")
        .select(
          "id, contenido, es_observacion, created_at, autor:perfiles_usuario!comentarios_autor_id_fkey(nombre)"
        )
        .eq("solicitud_id", id)
        .order("created_at", { ascending: true }),
    ]);

  const evs = (evidencias ?? []) as unknown as EvidenciaRow[];
  const caps = (capturas ?? []) as unknown as CapturaRow[];
  const coms = (comentarios ?? []) as unknown as ComentarioRow[];
  const estado = sol.estado as EstadoSolicitud;
  const reporte = sol.reporte as unknown as {
    nombre: string;
    ejercicio: number;
    estado: "activo" | "congelado";
    fecha_congelamiento: string | null;
  } | null;
  const reporteCongelado = reporte?.estado === "congelado";

  const capsPorEvidencia = new Map<string, CapturaRow[]>();
  for (const c of caps) {
    const arr = capsPorEvidencia.get(c.evidencia_id) ?? [];
    arr.push(c);
    capsPorEvidencia.set(c.evidencia_id, arr);
  }

  // Acción esperada del cliente (idioma del cliente). Rige la jerarquía: si el
  // cliente debe actuar, la carga es la protagonista; si no, lo es el resumen.
  const accion = accionCliente(estado);
  // Una copia declinada o retirada no espera evidencia: el trigger la rechazaría,
  // y ofrecer el formulario sería invitar a un error.
  const fueraDeJuego = sol.declinada || sol.desactivada;
  const esperaEvidencia = accion.esperaCarga && !reporteCongelado && !fueraDeJuego;
  const tAccion = TONO_CLASSES[accion.tono];

  // LAS DOS VERIFICACIONES: el visto bueno del área y la validación final. Se
  // muestran a todos —también al responsable de área que cargó—, porque saber si
  // su jefe ya respaldó la entrega es parte de saber en qué va su trabajo.
  const solVB = {
    area_asignada: sol.area_asignada,
    estado,
    vb_area_por: sol.vb_area_por,
    vb_area_fecha: sol.vb_area_fecha,
  };
  const verificaciones = await cargarVerificaciones(supabase, {
    id: sol.id,
    estado,
    origen: sol.origen as OrigenSolicitud,
    vb_area_por: sol.vb_area_por,
    vb_area_fecha: sol.vb_area_fecha,
  });
  // DIFUSIÓN: esta copia es una de varias preguntas a distintas áreas. El acto de
  // "no aplica" es del área a la que se preguntó — el responsable y su jefe—, y no
  // de quien coordina: declarar que algo no te corresponde lo dice quien hace el
  // trabajo.
  const solDif = {
    area_asignada: sol.area_asignada,
    estado,
    grupo_difusion_id: sol.grupo_difusion_id,
    declinada: sol.declinada,
    desactivada: sol.desactivada,
  };
  const bloqueNoAplica =
    esDifundida(solDif) && esDeSuArea(perfil, solDif) ? (
      <NoAplica
        solicitudId={sol.id}
        declinada={sol.declinada}
        puedeDeclinar={puedeDeclinar(perfil, solDif, evs.length > 0)}
        puedeRetomar={puedeRetomar(perfil, solDif)}
        motivo={motivoSinDeclinar(perfil, solDif, evs.length > 0)}
      />
    ) : null;

  // El acto del jefe solo se le ofrece al jefe DE ESTA área.
  const soyJefeDeEsta = esJefeDeSuArea(perfil, solVB);
  const bloqueVB = soyJefeDeEsta ? (
    <VBAreaJefe
      solicitudId={sol.id}
      firmado={sol.vb_area_por != null}
      puedeFirmar={puedeDarVB(perfil, solVB, evs.length > 0)}
      puedeRetirar={puedeRetirarVB(perfil, solVB)}
      motivo={motivoSinVB(perfil, solVB, evs.length > 0)}
    />
  ) : null;

  // ---- Bloques reutilizables (se colocan según la jerarquía) ---------------
  const bloqueCarga = (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="font-display text-lg font-semibold text-ink">
        {estado === "observaciones"
          ? "Corrige y vuelve a enviar"
          : esperaEvidencia
            ? "Sube tu información"
            : "¿Necesitas actualizar algo?"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {esperaEvidencia
          ? "Adjunta el archivo que respalda esta solicitud. Cada carga guarda una versión nueva; la anterior se conserva."
          : "Puedes cargar una versión nueva si algo cambió. La anterior se conserva."}
      </p>
      <div className="mt-5">
        <UploadEvidencia
          solicitudId={sol.id}
          esCuantitativa={sol.es_cuantitativa}
          unidadEsperada={sol.unidad_esperada}
          areaUsuario={perfil.area ?? sol.area_asignada}
          reporteEjercicio={reporte?.ejercicio ?? null}
          estado={estado}
          tieneVersionPrevia={evs.length > 0}
          fechaCongelamiento={reporte?.fecha_congelamiento ?? null}
        />
      </div>
    </div>
  );

  const bloqueHistorial = (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-ink">
        {/* El encabezado tampoco puede decir «tus entregas» de una lista donde hay
            cargas de IRStrat: se neutraliza en ese caso y se conserva la voz del
            cliente cuando todo lo entregó él. */}
        {evs.some((e) => e.cargado_por_staff || e.subido_por !== perfil.id)
          ? "Entregas registradas"
          : accion.completada
            ? "Lo que entregaste"
            : "Tus entregas"}
      </h2>
      {evs.length === 0 ? (
        <EmptyState
          compacto
          glifo="↑"
          titulo={soyJefeDeEsta ? "El área todavía no entrega nada" : "Aún no has entregado nada"}
          descripcion={
            soyJefeDeEsta
              ? "Cuando alguien de tu área suba un archivo aparecerá aquí, con su periodo y su cifra, y podrás dar el visto bueno."
              : "Cuando subas un archivo aparecerá aquí, con su periodo y su cifra."
          }
        />
      ) : (
        <ul className="space-y-3">
          {evs.map((ev, i) => {
            const capturasEv = capsPorEvidencia.get(ev.id) ?? [];
            const vigente = i === 0;
            const previa = evs[i + 1]; // versión inmediatamente anterior (orden desc)
            return (
              <li
                key={ev.id}
                className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Frase, no metadata. Y la frase tiene que decir la verdad de
                        QUIÉN entregó: «Entregaste» solo si la carga es de quien está
                        mirando. Con IRStrat cargando en nombre del área era falso, y
                        con el JEFE DE ÁREA —que ve las entregas de su gente— también
                        lo sería. El acto tiene autor y la página lo nombra. */}
                    <p className="text-sm leading-relaxed text-ink">
                      {ev.cargado_por_staff ? (
                        <>
                          <span className="font-medium">IRStrat cargó</span>{" "}
                          <span className="font-medium">{ev.nombre_original}</span> el{" "}
                          {fmtFechaLarga(ev.created_at)}
                          {ev.area_origen ? (
                            <>
                              {" "}
                              en nombre de <span className="font-medium">{ev.area_origen}</span>
                            </>
                          ) : null}
                        </>
                      ) : ev.subido_por === perfil.id ? (
                        <>
                          Entregaste{" "}
                          <span className="font-medium">{ev.nombre_original}</span> el{" "}
                          {fmtFechaLarga(ev.created_at)}
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{limpiar(ev.subio?.nombre)}</span> entregó{" "}
                          <span className="font-medium">{ev.nombre_original}</span> el{" "}
                          {fmtFechaLarga(ev.created_at)}
                        </>
                      )}
                      {ev.periodo_cubierto ? (
                        <>
                          {" "}
                          — cubre <span className="font-medium">{ev.periodo_cubierto}</span>
                        </>
                      ) : null}
                      .
                    </p>

                    {capturasEv.map((c) => (
                      <p key={c.id} className="mt-1.5 text-sm text-ink">
                        {/* Misma verdad que la frase de arriba, y por la misma
                            regla: la cifra viaja pegada a esa evidencia, así que
                            «Reportaste» solo vale si la entrega es de quien mira.
                            Con la carga de IRStrat era falso; con el JEFE DE ÁREA
                            —que ve las cifras de su gente— también. */}
                        <span className="text-muted">
                          {ev.cargado_por_staff || ev.subido_por !== perfil.id
                            ? "Cifra registrada: "
                            : "Reportaste: "}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {fmtNum.format(c.valor)}
                        </span>{" "}
                        <span>{c.unidad}</span>
                        {c.periodo ? <span className="text-muted"> ({c.periodo})</span> : null}
                        {!c.confirmado && (
                          <span className="text-muted"> · por confirmar</span>
                        )}
                      </p>
                    ))}

                    {/* La versión pasa a secundario */}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {vigente ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-verde/10 px-2 py-0.5 font-medium text-verde">
                          Versión vigente
                        </span>
                      ) : null}
                      <span>
                        versión {ev.version}
                        {previa
                          ? `, reemplazó a la del ${fmtFecha(previa.created_at)}`
                          : ""}
                      </span>
                      {/* La frase de arriba ya dice que la cargó IRStrat; aquí va
                          quién, con nombre, que es lo que un rastro necesita. */}
                      {ev.cargado_por_staff ? (
                        <span className="font-medium text-gold-dark">
                          · {limpiar(ev.subio?.nombre)} (IRStrat)
                        </span>
                      ) : (
                        <span>· {limpiar(ev.subio?.nombre)}</span>
                      )}
                    </p>
                  </div>

                  <a
                    href={`/portal/descargar/${ev.id}`}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 4v12M6 10l6 6 6-6" />
                      <path d="M4 20h16" />
                    </svg>
                    Descargar
                  </a>
                </div>

                {ev.justificacion && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gold">
                      Motivo del reemplazo
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                      {ev.justificacion}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const bloqueConversacion = (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-ink">Conversación</h2>
      {coms.length === 0 ? (
        <EmptyState
          compacto
          glifo="“"
          titulo="Sin comentarios todavía"
          descripcion="Si tienes dudas sobre esta solicitud, escríbelas abajo."
        />
      ) : (
        <ul className="space-y-3">
          {coms.map((c) => (
            <li
              key={c.id}
              className={
                "rounded-card border p-4 " +
                (c.es_observacion
                  ? "border-rojo/30 bg-rojo/5"
                  : "border-line bg-surface shadow-soft")
              }
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {/* El perfil del staff IRStrat no es visible al cliente (RLS);
                        lo atribuimos al equipo de IRStrat. */}
                    {c.autor?.nombre ? limpiar(c.autor.nombre) : "Equipo IRStrat"}
                  </span>
                  {c.es_observacion && (
                    <span className="rounded-pill bg-rojo/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rojo">
                      Observación
                    </span>
                  )}
                </div>
                <time className="text-xs text-muted">{fmtFechaHora(c.created_at)}</time>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                {c.contenido}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
        <ComentarioForm solicitudId={sol.id} />
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Breadcrumb
          items={[
            { label: "Portal", href: "/portal" },
            { label: "Solicitudes", href: "/portal" },
            { label: sol.titulo },
          ]}
        />
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition duration-150 hover:text-teal"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver al tablero
        </Link>
      </div>

      {reporteCongelado && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-card border border-gris/30 bg-gris/10 px-5 py-4"
        >
          <span aria-hidden className="mt-0.5 text-gris">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10.5" width="16" height="10" rx="2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            </svg>
          </span>
          <div className="text-sm text-ink">
            <p className="font-medium">Informe cerrado</p>
            <p className="mt-0.5 text-muted">
              {reporte?.fecha_congelamiento
                ? `Este informe fue cerrado el ${fmtDiaLargo(
                    reporte.fecha_congelamiento
                  )}; la evidencia quedó congelada para aseguramiento.`
                : "Este informe fue cerrado; la evidencia quedó congelada para aseguramiento."}{" "}
              Todo está en solo-lectura.
            </p>
          </div>
        </div>
      )}

      {/* Encabezado de la solicitud */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Declinada o retirada: el estado que importa al área es ese, y en gris.
              El de la máquina de estados sigue existiendo, pero decirle "pendiente
              de tu información" a algo que declaró no ser suyo sería contradecirla. */}
          {fueraDeJuego ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-gris/12 px-3 py-1 text-sm font-medium text-gris">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12h8" />
              </svg>
              {sol.declinada ? "Declinada — no aplica a esta área" : "Copia retirada"}
            </span>
          ) : (
            <span
              className={
                "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-medium " +
                `${tAccion.bg} ${tAccion.text}`
              }
            >
              <IconoAccion tipo={accion.icono} className="size-4" />
              {accion.titulo}
            </span>
          )}
          {esDifundida(solDif) && (
            <Chip tono="teal">Difusión a varias áreas</Chip>
          )}
          {/* Badge de ORIGEN: quién pidió el dato. Visible también para el área,
              que tiene derecho a saber si la petición viene de IRStrat o de la
              propia organización. */}
          <OrigenBadge origen={sol.origen as OrigenSolicitud} />
          {sol.area_asignada && <Chip>{sol.area_asignada}</Chip>}
          {sol.es_cuantitativa && (
            <Chip tono="verde">
              Cuantitativa{sol.unidad_esperada ? ` · ${sol.unidad_esperada}` : ""}
            </Chip>
          )}
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {sol.titulo}
        </h1>
        {sol.descripcion && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {sol.descripcion}
          </p>
        )}
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {reporte && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Reporte</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {limpiar(reporte.nombre)} · {reporte.ejercicio}
              </dd>
            </div>
          )}
          {sol.fecha_limite && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Fecha límite</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {fmtDiaLargo(sol.fecha_limite)}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <MarcasVerificacion verificaciones={verificaciones} />

      {esperaEvidencia ? (
        <div className="space-y-10">
          {/* Protagonista: la carga */}
          {bloqueCarga}
          {bloqueNoAplica}
          {bloqueVB}
          {/* Secundario: entregas + conversación */}
          <div className="grid gap-8 lg:grid-cols-2">
            {bloqueHistorial}
            {bloqueConversacion}
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Protagonista: el resumen de lo entregado */}
          <div className="space-y-10">
            {bloqueHistorial}
            {bloqueConversacion}
          </div>
          {/* Secundario: el visto bueno del jefe y cargar una versión nueva */}
          <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
            {bloqueNoAplica}
            {bloqueVB}
            {!fueraDeJuego && bloqueCarga}
          </aside>
        </div>
      )}
    </div>
  );
}
