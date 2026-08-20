import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { enviarCorreo, modoConsola } from "@/lib/email/enviar";
import {
  plantillaRecordatorio,
  plantillaRecordatorioProgramado,
  type SolicitudEmail,
} from "@/lib/email/plantillas";
import { logCorreo } from "@/lib/bitacora";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { fechaDisparo } from "@/lib/recordatorios-plan";
import { hoyOperacion } from "@/lib/fechas";

/** Estados que ameritan recordatorio. */
const ESTADOS_RECORDABLES: EstadoSolicitud[] = ["solicitado", "observaciones"];

/** Días mínimos entre recordatorios a un mismo responsable (anti-spam). */
export const DIAS_ANTISPAM = 5;

export type ResumenRecordatorios = {
  modo: "resend" | "consola";
  enviados: number; // correos efectivamente enviados
  omitidos: number; // responsables saltados por la regla anti-spam
  fallidos: number; // envíos con error
  responsables: number; // total de responsables con pendientes
  detalles: {
    responsable: string;
    email: string;
    solicitudes: number;
    conObservaciones: number;
    resultado: "enviado" | "omitido" | "fallido";
    motivo?: string;
  }[];
};

type SolRow = {
  id: string;
  titulo: string;
  estado: string;
  fecha_limite: string | null;
  responsable_cliente_id: string;
  reporte: { tenant_id: string; tenant: { activo: boolean } | null } | null;
  responsable: { id: string; nombre: string; email: string } | null;
};

/**
 * Procesa los recordatorios: agrupa por responsable las solicitudes en
 * 'solicitado' u 'observaciones' y envía a cada uno UN digest, respetando la
 * regla anti-spam de {DIAS_ANTISPAM} días (según la bitácora). Registra cada
 * envío. Pensado para ejecutarse con el cliente admin (service_role).
 */
export async function procesarRecordatorios(
  db: SupabaseClient<Database>
): Promise<ResumenRecordatorios> {
  const resumen: ResumenRecordatorios = {
    modo: modoConsola() ? "consola" : "resend",
    enviados: 0,
    omitidos: 0,
    fallidos: 0,
    responsables: 0,
    detalles: [],
  };

  // 1. Solicitudes candidatas con responsable asignado.
  const { data, error } = await db
    .from("solicitudes")
    .select(
      "id, titulo, estado, fecha_limite, responsable_cliente_id, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id, tenant:tenants!reportes_tenant_id_fkey(activo)), responsable:perfiles_usuario!solicitudes_responsable_cliente_id_fkey(id, nombre, email)"
    )
    .in("estado", ESTADOS_RECORDABLES)
    // Una copia de difusión que el área declaró ajena —o que quien difundió
    // retiró— no se recuerda: sería insistirle a alguien por algo que ya dijo que
    // no le toca, que es la forma más rápida de que dejen de leer los correos.
    .eq("declinada", false)
    .eq("desactivada", false)
    .not("responsable_cliente_id", "is", null)
    .order("fecha_limite", { ascending: true });

  if (error) throw new Error(`No se pudieron leer las solicitudes: ${error.message}`);

  // Un cliente desactivado no recibe recordatorios: sus usuarios no pueden
  // entrar al portal, así que pedirles evidencia por correo sería mandarlos a
  // una puerta cerrada.
  const sols = ((data ?? []) as unknown as SolRow[]).filter(
    (s) => s.reporte?.tenant?.activo !== false
  );

  // 2. Regla anti-spam: responsables con recordatorio en los últimos N días.
  const cutoff = new Date(Date.now() - DIAS_ANTISPAM * 24 * 60 * 60 * 1000).toISOString();
  // Cuentan las dos formas de recordatorio: el digest y los PROGRAMADOS por
  // solicitud. A quien ya se le escribió por un vencimiento concreto no se le
  // manda además el resumen "tienes N pendientes" el mismo día — desde su bandeja
  // son dos correos nuestros seguidos diciendo casi lo mismo.
  const { data: recientes } = await db
    .from("bitacora")
    .select("detalle, created_at")
    .in("accion", ["recordatorio_enviado", "recordatorio_programado_enviado"])
    .gte("created_at", cutoff);

  const bloqueados = new Set<string>();
  for (const r of recientes ?? []) {
    const d = r.detalle as { responsable_id?: string; destinatario_id?: string } | null;
    // El digest agrupa por responsable; el programado escribe a cada persona del
    // área. Las dos claves apuntan a un perfil y las dos bloquean.
    if (d?.responsable_id) bloqueados.add(d.responsable_id);
    if (d?.destinatario_id) bloqueados.add(d.destinatario_id);
  }

  // 3. Agrupar por responsable.
  type Grupo = {
    responsableId: string;
    nombre: string;
    email: string;
    tenantId: string | null;
    items: SolicitudEmail[];
  };
  const grupos = new Map<string, Grupo>();
  for (const s of sols) {
    if (!s.responsable || !s.responsable.email) continue;
    const g = grupos.get(s.responsable_cliente_id) ?? {
      responsableId: s.responsable_cliente_id,
      nombre: s.responsable.nombre,
      email: s.responsable.email,
      tenantId: s.reporte?.tenant_id ?? null,
      items: [],
    };
    g.items.push({
      id: s.id,
      titulo: s.titulo,
      fechaLimite: s.fecha_limite,
      esObservacion: s.estado === "observaciones",
    });
    grupos.set(s.responsable_cliente_id, g);
  }

  resumen.responsables = grupos.size;

  // 4. Enviar digest por responsable (respetando anti-spam).
  for (const g of grupos.values()) {
    const conObs = g.items.filter((i) => i.esObservacion).length;

    if (bloqueados.has(g.responsableId)) {
      resumen.omitidos += 1;
      resumen.detalles.push({
        responsable: g.nombre.replace(/\[DEMO\]\s*/i, "").trim(),
        email: g.email,
        solicitudes: g.items.length,
        conObservaciones: conObs,
        resultado: "omitido",
        motivo: `Recordatorio enviado hace menos de ${DIAS_ANTISPAM} días`,
      });
      continue;
    }

    const plantilla = plantillaRecordatorio(g.nombre, g.items);
    const r = await enviarCorreo(g.email, plantilla);

    if (!r.ok) {
      resumen.fallidos += 1;
      resumen.detalles.push({
        responsable: g.nombre.replace(/\[DEMO\]\s*/i, "").trim(),
        email: g.email,
        solicitudes: g.items.length,
        conObservaciones: conObs,
        resultado: "fallido",
        motivo: r.error,
      });
      continue;
    }

    await logCorreo(db, {
      tenantId: g.tenantId,
      usuarioId: null, // acción de sistema/cron
      accion: "recordatorio_enviado",
      entidadId: null,
      detalle: {
        responsable_id: g.responsableId,
        email: g.email,
        nombre: g.nombre,
        solicitud_ids: g.items.map((i) => i.id),
        total: g.items.length,
        con_observaciones: conObs,
        modo: r.modo,
      },
    });

    resumen.enviados += 1;
    resumen.detalles.push({
      responsable: g.nombre.replace(/\[DEMO\]\s*/i, "").trim(),
      email: g.email,
      solicitudes: g.items.length,
      conObservaciones: conObs,
      resultado: "enviado",
    });
  }

  return resumen;
}

// =============================================================================
// RECORDATORIOS PROGRAMADOS por solicitud (fecha_limite - dias_antes = hoy)
//
// Complementan al digest de arriba: hablan de UNA solicitud, van a los usuarios
// del ÁREA responsable y se disparan por el calendario que alguien configuró.
// Reutilizan el mismo transporte, la misma bitácora y el mismo CRON_SECRET.
// =============================================================================

/**
 * Estados que NO se recuerdan. 'validado' y 'congelado' están cumplidos: recordar
 * lo cumplido es ruido, y el ruido enseña a ignorar los recordatorios que sí
 * importan. Los demás estados sí (incluido 'recibido' y 'en_revision': la entrega
 * puede estar incompleta y el plazo sigue siendo el plazo).
 */
const ESTADOS_NO_RECORDABLES: EstadoSolicitud[] = ["validado", "congelado"];

/** Qué falta, en una frase, según el estado en que está la solicitud. */
function queFalta(estado: EstadoSolicitud): string {
  switch (estado) {
    case "pendiente":
      return "Todavía no se ha registrado ninguna entrega.";
    case "solicitado":
      return "Está pendiente de tu entrega: carga el archivo de respaldo.";
    case "observaciones":
      return "Tiene observaciones de la revisión: hay que corregir y volver a entregar.";
    case "recibido":
      return "Ya hay una entrega registrada; si está incompleta, puedes cargar una versión nueva antes del plazo.";
    case "en_revision":
      return "Está en revisión. Si te piden un ajuste, tendrás que atenderlo antes del plazo.";
    default:
      return "Revisa la solicitud para ver qué falta.";
  }
}

export type ResumenProgramados = {
  modo: "resend" | "consola";
  fechaEvaluada: string;
  /** Recordatorios activos cuya fecha de disparo es hoy. */
  disparos: number;
  enviados: number;
  omitidos: number;
  fallidos: number;
  detalles: {
    solicitud: string;
    solicitudId: string;
    diasAntes: number;
    destinatarios: number;
    resultado: "enviado" | "omitido" | "fallido";
    motivo?: string;
  }[];
};

type RecordatorioRow = {
  id: string;
  dias_antes: number;
  solicitud: {
    id: string;
    titulo: string;
    estado: EstadoSolicitud;
    fecha_limite: string | null;
    area_asignada: string | null;
    responsable_cliente_id: string | null;
    declinada: boolean;
    desactivada: boolean;
    reporte: { tenant_id: string; tenant: { activo: boolean } | null } | null;
  } | null;
};

/**
 * Procesa los recordatorios PROGRAMADOS para `hoy` (YYYY-MM-DD, por default la
 * fecha del servidor). Un recordatorio dispara cuando
 * `fecha_limite - dias_antes = hoy`; el cálculo se hace en JS sobre la fecha
 * pelada (`lib/recordatorios-plan.ts`) para no arrastrar husos a una comparación
 * de calendario.
 *
 * ANTI-SPAM. La regla de {DIAS_ANTISPAM} días del digest NO puede aplicarse aquí:
 * la escalera normal es 7-3-1 y entre el de 3 y el de 1 hay dos días, así que
 * bloquearía justo el aviso más útil. Lo que se garantiza en su lugar es que un
 * recordatorio dado no se manda DOS VECES (idempotencia si el cron corre de más),
 * y que quien recibió uno no recibe además el digest ese mismo periodo — eso lo
 * aplica `procesarRecordatorios` leyendo esta misma bitácora.
 *
 * Pensado para ejecutarse con el cliente admin (service_role).
 */
export async function procesarRecordatoriosProgramados(
  db: SupabaseClient<Database>,
  hoy?: string
): Promise<ResumenProgramados> {
  // "Hoy" es el de MÉXICO, no el del servidor: en Heroku el proceso corre en UTC
  // y un cron de madrugada evaluaría el día siguiente, mandando los avisos con un
  // día de adelanto. Los plazos los pone una persona en su propio calendario.
  const hoyISO = hoy ?? hoyOperacion();
  const resumen: ResumenProgramados = {
    modo: modoConsola() ? "consola" : "resend",
    fechaEvaluada: hoyISO,
    disparos: 0,
    enviados: 0,
    omitidos: 0,
    fallidos: 0,
    detalles: [],
  };

  const { data, error } = await db
    .from("solicitudes_recordatorios")
    .select(
      "id, dias_antes, solicitud:solicitudes!solicitudes_recordatorios_solicitud_id_fkey(id, titulo, estado, fecha_limite, area_asignada, responsable_cliente_id, declinada, desactivada, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id, tenant:tenants!reportes_tenant_id_fkey(activo)))"
    )
    .eq("activo", true);

  if (error) {
    throw new Error(`No se pudieron leer los recordatorios programados: ${error.message}`);
  }

  const filas = ((data ?? []) as unknown as RecordatorioRow[]).filter((r) => {
    const s = r.solicitud;
    if (!s || !s.fecha_limite) return false;                      // sin plazo no hay disparo
    if (s.reporte?.tenant?.activo === false) return false;         // cliente desactivado
    if (ESTADOS_NO_RECORDABLES.includes(s.estado)) return false;   // cumplido: no se recuerda
    if (s.declinada || s.desactivada) return false;                 // no aplica a esa área
    return fechaDisparo(s.fecha_limite, r.dias_antes) === hoyISO;
  });

  resumen.disparos = filas.length;
  if (filas.length === 0) return resumen;

  // Idempotencia: un recordatorio no se manda dos veces EL MISMO DÍA (el cron
  // puede correr de más, o alguien lo dispara a mano). Si alguien mueve la fecha
  // límite, el disparo cae otro día y volver a avisar es lo correcto.
  //
  // La lectura va acotada al día evaluado: barrer toda la historia crecería sin
  // límite con cada mes de operación, y lo único que hace falta saber es si este
  // disparo ya salió hoy.
  const { data: yaEnviados } = await db
    .from("bitacora")
    .select("detalle")
    .eq("accion", "recordatorio_programado_enviado")
    .eq("detalle->>fecha_disparo", hoyISO);
  const enviadosPrevios = new Set<string>();
  for (const b of yaEnviados ?? []) {
    const d = b.detalle as { recordatorio_id?: string } | null;
    if (d?.recordatorio_id) enviadosPrevios.add(d.recordatorio_id);
  }

  for (const r of filas) {
    const s = r.solicitud!;
    const tenantId = s.reporte?.tenant_id ?? null;

    if (enviadosPrevios.has(r.id)) {
      resumen.omitidos += 1;
      resumen.detalles.push({
        solicitud: s.titulo,
        solicitudId: s.id,
        diasAntes: r.dias_antes,
        destinatarios: 0,
        resultado: "omitido",
        motivo: "Ya se envió hoy (el cron corrió de más)",
      });
      continue;
    }

    // Destinatarios: los usuarios ACTIVOS del área responsable, más el responsable
    // asignado si no estuviera en ella — es quien tiene la solicitud a su nombre y
    // saltárselo por una diferencia de catálogo sería el peor de los errores.
    const destinatarios = new Map<string, { id: string; nombre: string; email: string }>();
    if (tenantId && s.area_asignada) {
      const { data: delArea } = await db
        .from("perfiles_usuario")
        .select("id, nombre, email")
        .eq("tenant_id", tenantId)
        .eq("area", s.area_asignada)
        .eq("activo", true);
      for (const u of delArea ?? []) if (u.email) destinatarios.set(u.id, u);
    }
    if (s.responsable_cliente_id && !destinatarios.has(s.responsable_cliente_id)) {
      const { data: resp } = await db
        .from("perfiles_usuario")
        .select("id, nombre, email, activo")
        .eq("id", s.responsable_cliente_id)
        .maybeSingle();
      if (resp?.activo && resp.email) {
        destinatarios.set(resp.id, { id: resp.id, nombre: resp.nombre, email: resp.email });
      }
    }

    if (destinatarios.size === 0) {
      // Se REPORTA, no se calla: un recordatorio configurado que no tiene a quién
      // avisar es un hueco de operación (área sin usuarios activos, o solicitud sin
      // área), y el resumen del cron es donde se ve.
      resumen.omitidos += 1;
      resumen.detalles.push({
        solicitud: s.titulo,
        solicitudId: s.id,
        diasAntes: r.dias_antes,
        destinatarios: 0,
        resultado: "omitido",
        motivo: s.area_asignada
          ? `El área "${s.area_asignada}" no tiene usuarios activos con correo`
          : "La solicitud no tiene área asignada",
      });
      continue;
    }

    const solEmail: SolicitudEmail = {
      id: s.id,
      titulo: s.titulo,
      fechaLimite: s.fecha_limite,
      esObservacion: s.estado === "observaciones",
    };

    let fallo: string | null = null;
    const entregados: { id: string; email: string }[] = [];
    for (const u of destinatarios.values()) {
      const plantilla = plantillaRecordatorioProgramado(u.nombre, solEmail, {
        diasAntes: r.dias_antes,
        estadoLabel: ESTADO_META[s.estado].label,
        queFalta: queFalta(s.estado),
      });
      const envio = await enviarCorreo(u.email, plantilla);
      if (envio.ok) entregados.push({ id: u.id, email: u.email });
      else fallo = envio.error ?? "error desconocido";
    }

    if (entregados.length === 0) {
      resumen.fallidos += 1;
      resumen.detalles.push({
        solicitud: s.titulo,
        solicitudId: s.id,
        diasAntes: r.dias_antes,
        destinatarios: destinatarios.size,
        resultado: "fallido",
        motivo: fallo ?? "no se pudo enviar a ningún destinatario",
      });
      continue;
    }

    // Una entrada de bitácora POR DESTINATARIO: la regla anti-spam del digest se
    // aplica por persona, así que necesita saber a quién se le escribió. La
    // idempotencia se resuelve con `recordatorio_id` + `fecha_disparo`, iguales en
    // todas las entradas del mismo disparo.
    for (const e of entregados) {
      await logCorreo(db, {
        tenantId,
        usuarioId: null, // acto del sistema/cron
        accion: "recordatorio_programado_enviado",
        entidadId: s.id,
        detalle: {
          solicitud_id: s.id,
          titulo: s.titulo,
          recordatorio_id: r.id,
          dias_antes: r.dias_antes,
          fecha_limite: s.fecha_limite,
          fecha_disparo: hoyISO,
          area: s.area_asignada,
          estado: s.estado,
          destinatario_id: e.id,
          email: e.email,
          destinatarios: entregados.length,
          modo: modoConsola() ? "consola" : "resend",
        },
      });
    }

    resumen.enviados += 1;
    resumen.detalles.push({
      solicitud: s.titulo,
      solicitudId: s.id,
      diasAntes: r.dias_antes,
      destinatarios: entregados.length,
      resultado: "enviado",
      motivo: fallo ? `con ${destinatarios.size - entregados.length} fallo(s): ${fallo}` : undefined,
    });
  }

  return resumen;
}
