import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { enviarCorreo, modoConsola } from "@/lib/email/enviar";
import { plantillaRecordatorio, type SolicitudEmail } from "@/lib/email/plantillas";
import { logCorreo } from "@/lib/bitacora";
import type { EstadoSolicitud } from "@/lib/estados";

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
  const { data: recientes } = await db
    .from("bitacora")
    .select("detalle, created_at")
    .eq("accion", "recordatorio_enviado")
    .gte("created_at", cutoff);

  const bloqueados = new Set<string>();
  for (const r of recientes ?? []) {
    const rid = (r.detalle as { responsable_id?: string } | null)?.responsable_id;
    if (rid) bloqueados.add(rid);
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
