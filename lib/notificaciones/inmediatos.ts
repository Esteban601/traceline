import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { logCorreo, type AccionCorreo } from "@/lib/bitacora";
import {
  entregar,
  noEntregable,
  plantillaComentarioAuditor,
  plantillaDocumentoAprobado,
  plantillaRespuestaAuditor,
  plantillaAvisosAgrupados,
  type ObjetoAviso,
  type Plantilla,
  type ResultadoEnvio,
} from "@/lib/email";
import type { ObjetoAuditado } from "@/lib/comentarios-auditor";

// =============================================================================
// AVISOS INMEDIATOS (encargo 2026-10-06-sistema-de-alertas, Paso 1).
//
// Tres eventos conversacionales: comentario del auditor, respuesta a un
// comentario del auditor y documento del Suplemento aprobado. Se llaman desde
// `after()` en la server action que produjo el evento: el correo nunca frena la
// pantalla ni tumba el acto (la regla del transporte, lib/email/enviar.ts).
//
// CRITERIO ÚNICO DE OMISIÓN: usuario inactivo o dirección que no recibe correo
// (`.example` y demás reservados) → no se envía, en ningún transporte, y queda
// una fila de bitácora con `modo = omitido` y el motivo.
//
// BITÁCORA: una fila POR DESTINATARIO, con su id y NUNCA su dirección
// (decisión 6 del Paso 0): `destinatario_id`, el evento que lo originó, `modo`
// (enviado / omitido / fallido) y, según el caso, `transporte`, `motivo`,
// `error` o `resend_id`.
// =============================================================================

type Db = SupabaseClient<Database>;

type Destinatario = { id: string; nombre: string; email: string; activo: boolean };

/** El hecho que originó el correo. En el resumen diario, `id` es la fecha evaluada. */
export type Evento = {
  tipo:
    | "comentario_auditor"
    | "respuesta_auditor"
    | "documento_aprobado"
    | "resumen_diario"
    | "avisos_agrupados"
    | "recordatorio_programado"
    | "solicitud_enviada"
    | "observacion";
  id: string;
};

/** Lo que va al `detalle` de la bitácora: sin dirección, sin nombre. */
export function detalleAviso(destinatarioId: string, evento: Evento, r: ResultadoEnvio): Record<string, unknown> {
  const modo = r.modo === "omitido" ? "omitido" : r.ok ? "enviado" : "fallido";
  return {
    destinatario_id: destinatarioId,
    evento,
    modo,
    ...(modo !== "omitido" ? { transporte: r.modo } : {}),
    ...(r.id && r.modo === "resend" ? { resend_id: r.id } : {}),
    ...(r.motivo ? { motivo: r.motivo } : {}),
    ...(r.error ? { error: r.error } : {}),
  };
}

function motivoOmision(d: Destinatario): string | null {
  if (!d.activo) return "usuario inactivo";
  return noEntregable(d.email);
}

// -----------------------------------------------------------------------------
// TOPE: máximo 20 avisos inmediatos por emisora y hora (encargo, §2). Cuentan los
// que SALIERON (modo enviado) en los últimos 60 minutos, incluidos los
// agrupados. Al pasar el tope el aviso no se manda suelto: se guarda en
// `correos_retenidos` y el job de 10 minutos lo manda en un correo agrupado por
// destinatario (vaciarRetenidos). Lo omitido (inactivo, dirección reservada) no
// cuenta ni se retiene.
// -----------------------------------------------------------------------------
export const TOPE_INMEDIATOS_POR_HORA = 20;
export const ACCIONES_INMEDIATAS: AccionCorreo[] = [
  "aviso_comentario_auditor",
  "aviso_respuesta_auditor",
  "aviso_documento_aprobado",
  "avisos_agrupados",
];

async function enviadosUltimaHora(db: Db, tenantId: string): Promise<number> {
  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("bitacora")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("accion", ACCIONES_INMEDIATAS)
    .eq("detalle->>modo", "enviado")
    .gte("created_at", desde);
  return count ?? 0;
}

/** Entrega (o retiene) y registra, destinatario por destinatario. Nunca lanza. */
async function avisar(
  db: Db,
  opts: {
    tenantId: string;
    accion: AccionCorreo;
    entidadId: string;
    evento: Evento;
    destinatarios: Destinatario[];
    plantilla: (d: Destinatario) => Plantilla;
    /** Para el correo agrupado si se retiene: una línea y el enlace. */
    extracto: string | null;
    ruta: string;
  }
): Promise<{ enviados: number; omitidos: number; fallidos: number; retenidos: number }> {
  const cuenta = { enviados: 0, omitidos: 0, fallidos: 0, retenidos: 0 };
  // Una persona, un correo: el admin del cliente que además fuera staff (no
  // ocurre hoy) o un id repetido por dos caminos no recibe dos.
  const unicos = [...new Map(opts.destinatarios.map((d) => [d.id, d])).values()];
  let salieron = await enviadosUltimaHora(db, opts.tenantId);
  for (const d of unicos) {
    const omitir = motivoOmision(d);
    if (!omitir && salieron >= TOPE_INMEDIATOS_POR_HORA) {
      let asunto = "Aviso";
      try { asunto = opts.plantilla(d).subject; } catch { /* asunto genérico */ }
      const { error } = await db.from("correos_retenidos").insert({
        tenant_id: opts.tenantId,
        destinatario_id: d.id,
        accion: opts.accion,
        evento: opts.evento,
        asunto,
        extracto: opts.extracto,
        ruta: opts.ruta,
      });
      cuenta.retenidos += 1;
      await logCorreo(db, {
        tenantId: opts.tenantId,
        usuarioId: null,
        accion: opts.accion,
        entidadId: opts.entidadId,
        detalle: error
          ? { destinatario_id: d.id, evento: opts.evento, modo: "fallido", error: `no se pudo retener: ${error.message}` }
          : { destinatario_id: d.id, evento: opts.evento, modo: "retenido", motivo: `tope de ${TOPE_INMEDIATOS_POR_HORA} avisos por emisora y hora` },
      });
      continue;
    }
    let r: ResultadoEnvio;
    try {
      r = await entregar(d.email, opts.plantilla(d), { omitir });
    } catch (e) {
      r = { ok: false, modo: "resend", error: e instanceof Error ? e.message : "error al armar el correo" };
    }
    if (r.modo === "omitido") cuenta.omitidos += 1;
    else if (r.ok) { cuenta.enviados += 1; salieron += 1; }
    else cuenta.fallidos += 1;
    await logCorreo(db, {
      tenantId: opts.tenantId,
      usuarioId: null, // lo envía el sistema; quién provocó el evento está en su propia fila
      accion: opts.accion,
      entidadId: opts.entidadId,
      detalle: detalleAviso(d.id, opts.evento, r),
    });
  }
  return cuenta;
}

/**
 * Vacía `correos_retenidos`: un correo agrupado por destinatario y emisora con
 * todo lo retenido, y marca `agrupado_en`. Lo llama el job de 10 minutos. Nunca
 * lanza; devuelve cuántos correos agrupados salieron y cuántos avisos llevaban.
 */
export async function vaciarRetenidos(db: Db = createAdminClient()): Promise<{ correos: number; avisos: number }> {
  const { data: pendientes } = await db
    .from("correos_retenidos")
    .select("id, tenant_id, destinatario_id, asunto, extracto, ruta, created_at")
    .is("agrupado_en", null)
    .order("created_at", { ascending: true })
    .limit(2000);
  const grupos = new Map<string, NonNullable<typeof pendientes>>();
  for (const p of pendientes ?? []) {
    const k = `${p.tenant_id}|${p.destinatario_id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  let correos = 0;
  let avisos = 0;
  for (const filas of grupos.values()) {
    const { tenant_id: tenantId, destinatario_id: destinatarioId } = filas[0];
    const { data: d } = await db.from("perfiles_usuario").select(PERFIL).eq("id", destinatarioId).maybeSingle();
    const em = await emisora(db, tenantId);
    let r: ResultadoEnvio;
    if (!d) {
      r = { ok: true, modo: "omitido", motivo: "el destinatario ya no existe" };
    } else {
      try {
        r = await entregar(
          d.email,
          plantillaAvisosAgrupados(d.nombre, { emisora: em.nombre, avisos: filas.map((f) => ({ asunto: f.asunto, extracto: f.extracto, ruta: f.ruta })) }),
          { omitir: motivoOmision(d as Destinatario) }
        );
      } catch (e) {
        r = { ok: false, modo: "resend", error: e instanceof Error ? e.message : "error al armar el correo" };
      }
    }
    // Un fallo deja los avisos pendientes para la siguiente vuelta del job.
    if (r.ok) {
      await db.from("correos_retenidos").update({ agrupado_en: new Date().toISOString() }).in("id", filas.map((f) => f.id));
      if (r.modo !== "omitido") { correos += 1; avisos += filas.length; }
    }
    await logCorreo(db, {
      tenantId,
      usuarioId: null,
      accion: "avisos_agrupados",
      entidadId: null,
      detalle: { ...detalleAviso(destinatarioId, { tipo: "avisos_agrupados", id: tenantId }, r), avisos: filas.length },
    });
  }
  return { correos, avisos };
}

// -----------------------------------------------------------------------------
// Destinatarios
// -----------------------------------------------------------------------------

const PERFIL = "id, nombre, email, activo";

async function adminsDelCliente(db: Db, tenantId: string): Promise<Destinatario[]> {
  const { data } = await db
    .from("perfiles_usuario")
    .select(PERFIL)
    .eq("tenant_id", tenantId)
    .eq("rol", "admin_cliente");
  return (data ?? []) as Destinatario[];
}

/**
 * TODO el staff (decisión 1 del Paso 0: IRStrat son cuatro personas y no existe
 * la asignación de staff a una emisora; `tenant_staff` es deuda). Staff = perfil
 * sin tenant. Se incluyen los inactivos para que queden registrados como omitidos.
 */
async function todoElStaff(db: Db): Promise<Destinatario[]> {
  const { data } = await db.from("perfiles_usuario").select(PERFIL).is("tenant_id", null);
  return (data ?? []) as Destinatario[];
}

async function emisora(db: Db, tenantId: string): Promise<{ nombre: string; esDemo: boolean }> {
  const { data } = await db.from("tenants").select("nombre, es_demo").eq("id", tenantId).maybeSingle();
  return { nombre: data?.nombre ?? "Emisora", esDemo: data?.es_demo ?? false };
}

/** El objeto comentado, para la ficha y el enlace del panel. */
async function objetoAuditado(db: Db, tipo: ObjetoAuditado, id: string): Promise<ObjetoAviso> {
  if (tipo === "solicitud") {
    const { data } = await db.from("solicitudes").select("titulo").eq("id", id).maybeSingle();
    return { etiqueta: "la solicitud", titulo: data?.titulo ?? "Solicitud", ruta: `/admin/solicitudes/${id}` };
  }
  if (tipo === "registro_clima") {
    const { data } = await db.from("registros_clima").select("nombre").eq("id", id).maybeSingle();
    return { etiqueta: "el registro climático", titulo: data?.nombre ?? "Registro climático", ruta: "/admin/registros" };
  }
  if (tipo === "objetivo") {
    const { data } = await db.from("objetivos").select("nombre").eq("id", id).maybeSingle();
    return { etiqueta: "el objetivo", titulo: data?.nombre ?? "Objetivo", ruta: "/admin/objetivos" };
  }
  const { data } = await db
    .from("cuestionarios_respuestas")
    .select("hoja, pregunta_orden")
    .eq("id", id)
    .maybeSingle();
  return {
    etiqueta: "el cuestionario",
    titulo: data ? `${data.hoja} · pregunta ${data.pregunta_orden}` : "Cuestionario",
    ruta: "/admin/cuestionarios",
  };
}

// -----------------------------------------------------------------------------
// Los tres eventos
// -----------------------------------------------------------------------------

/**
 * Comentario del auditor → administrador(es) del cliente y staff. En una emisora
 * de DEMOSTRACIÓN no se avisa al staff: mismo criterio que la decisión 3 del
 * Paso 0 para los digests (la actividad de un mockup no es trabajo de IRStrat).
 */
export async function avisarComentarioAuditor(comentarioId: string): Promise<void> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("comentarios_auditor")
    .select("id, tenant_id, objeto_tipo, objeto_id, texto")
    .eq("id", comentarioId)
    .maybeSingle();
  if (!c) return;
  const em = await emisora(db, c.tenant_id);
  const objeto = await objetoAuditado(db, c.objeto_tipo as ObjetoAuditado, c.objeto_id);
  const destinatarios = [
    ...(await adminsDelCliente(db, c.tenant_id)),
    ...(em.esDemo ? [] : await todoElStaff(db)),
  ];
  await avisar(db, {
    tenantId: c.tenant_id,
    accion: "aviso_comentario_auditor",
    entidadId: c.id,
    evento: { tipo: "comentario_auditor", id: c.id },
    destinatarios,
    plantilla: (d) => plantillaComentarioAuditor(d.nombre, { emisora: em.nombre, objeto, texto: c.texto }),
    extracto: `Comentario sobre ${objeto.etiqueta}: ${objeto.titulo}`,
    ruta: objeto.ruta,
  });
}

/** Respuesta a un comentario del auditor → el auditor que lo escribió. */
export async function avisarRespuestaAuditor(comentarioId: string): Promise<void> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("comentarios_auditor")
    .select("id, tenant_id, objeto_tipo, objeto_id, texto, respuesta, autor_id")
    .eq("id", comentarioId)
    .maybeSingle();
  if (!c || !c.respuesta) return;
  const { data: autor } = await db.from("perfiles_usuario").select(PERFIL).eq("id", c.autor_id).maybeSingle();
  if (!autor) return;
  const em = await emisora(db, c.tenant_id);
  const objeto = await objetoAuditado(db, c.objeto_tipo as ObjetoAuditado, c.objeto_id);
  await avisar(db, {
    tenantId: c.tenant_id,
    accion: "aviso_respuesta_auditor",
    entidadId: c.id,
    evento: { tipo: "respuesta_auditor", id: c.id },
    destinatarios: [autor as Destinatario],
    plantilla: (d) =>
      plantillaRespuestaAuditor(d.nombre, {
        emisora: em.nombre,
        objeto,
        comentario: c.texto,
        respuesta: c.respuesta!,
      }),
    extracto: `Respuesta sobre ${objeto.etiqueta}: ${objeto.titulo}`,
    ruta: objeto.ruta,
  });
}

/** Documento del Suplemento aprobado → administrador(es) del cliente. */
export async function avisarDocumentoAprobado(documentoId: string): Promise<void> {
  const db = createAdminClient();
  const { data: doc } = await db
    .from("documentos_generados")
    .select("id, tenant_id, estado, version, reporte:reportes!documentos_generados_reporte_id_fkey(nombre, ejercicio)")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc || doc.estado !== "aprobado") return;
  const reporte = doc.reporte as unknown as { nombre: string; ejercicio: number } | null;
  const em = await emisora(db, doc.tenant_id);
  const titulo = `Suplemento NIIF S1/S2${reporte ? ` · ${reporte.nombre}` : ""} · versión ${doc.version}`;
  await avisar(db, {
    tenantId: doc.tenant_id,
    accion: "aviso_documento_aprobado",
    entidadId: doc.id,
    evento: { tipo: "documento_aprobado", id: doc.id },
    destinatarios: await adminsDelCliente(db, doc.tenant_id),
    plantilla: (d) =>
      plantillaDocumentoAprobado(d.nombre, {
        emisora: em.nombre,
        documento: titulo,
        ejercicio: reporte?.ejercicio ?? null,
        ruta: `/admin/cobertura/suplemento/${doc.id}`,
      }),
    extracto: titulo,
    ruta: `/admin/cobertura/suplemento/${doc.id}`,
  });
}
