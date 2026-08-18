import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { enviarCorreo, modoConsola } from "@/lib/email/enviar";
import { plantillaSolicitud, type SolicitudEmail } from "@/lib/email/plantillas";
import { logCorreo } from "@/lib/bitacora";
import type { OrigenSolicitud } from "@/lib/origen";

export type ResumenSolicitud = {
  modo: "resend" | "consola";
  correos: number; // correos enviados (uno por responsable)
  solicitudes: number; // solicitudes que pasaron a 'solicitado'
  omitidas: number; // ids no elegibles (no 'pendiente' o sin responsable)
  fallidos: number; // responsables cuyo envío falló
  detalles: {
    responsable: string;
    email: string;
    solicitudes: number;
    resultado: "enviado" | "fallido";
    motivo?: string;
  }[];
};

type SolRow = {
  id: string;
  titulo: string;
  estado: string;
  origen: OrigenSolicitud;
  fecha_limite: string | null;
  responsable_cliente_id: string | null;
  reporte: { tenant_id: string } | null;
  responsable: { id: string; nombre: string; email: string } | null;
};

/**
 * Envía la solicitud de información y avanza el estado. Agrupa por responsable y
 * manda UN correo por persona con todas sus solicitudes elegibles (estado
 * 'pendiente' + responsable asignado). Sirve para el envío individual (un id) y
 * el masivo (varios ids). Se ejecuta con la sesión de quien envía — RLS acota lo
 * que puede leer y actualizar.
 *
 * `origenPermitido` aplica la REGLA DE ORIGEN también aquí: cada lado mueve sus
 * propias solicitudes. Sin este filtro, un envío masivo del administrador del
 * cliente intentaría transicionar las de IRStrat y el trigger de la base lo
 * cortaría a mitad del lote, con el correo ya enviado.
 */
export async function enviarSolicitudesCore(
  db: SupabaseClient<Database>,
  usuarioId: string | null,
  ids: string[],
  origenPermitido: OrigenSolicitud
): Promise<ResumenSolicitud> {
  const resumen: ResumenSolicitud = {
    modo: modoConsola() ? "consola" : "resend",
    correos: 0,
    solicitudes: 0,
    omitidas: 0,
    fallidos: 0,
    detalles: [],
  };

  const unicos = Array.from(new Set(ids)).filter(Boolean);
  if (unicos.length === 0) return resumen;

  const { data, error } = await db
    .from("solicitudes")
    .select(
      "id, titulo, estado, origen, fecha_limite, responsable_cliente_id, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id), responsable:perfiles_usuario!solicitudes_responsable_cliente_id_fkey(id, nombre, email)"
    )
    .in("id", unicos);

  if (error) throw new Error(`No se pudieron leer las solicitudes: ${error.message}`);

  const sols = (data ?? []) as unknown as SolRow[];

  // Elegibles: 'pendiente' con responsable (con email). El resto se omite.
  type Grupo = {
    responsableId: string;
    nombre: string;
    email: string;
    tenantId: string | null;
    items: SolicitudEmail[];
    ids: string[];
  };
  const grupos = new Map<string, Grupo>();
  for (const s of sols) {
    const elegible =
      s.estado === "pendiente" &&
      s.origen === origenPermitido &&
      s.responsable != null &&
      !!s.responsable.email;
    if (!elegible) {
      resumen.omitidas += 1;
      continue;
    }
    const g = grupos.get(s.responsable_cliente_id!) ?? {
      responsableId: s.responsable_cliente_id!,
      nombre: s.responsable!.nombre,
      email: s.responsable!.email,
      tenantId: s.reporte?.tenant_id ?? null,
      items: [],
      ids: [],
    };
    g.items.push({ id: s.id, titulo: s.titulo, fechaLimite: s.fecha_limite });
    g.ids.push(s.id);
    grupos.set(s.responsable_cliente_id!, g);
  }
  // ids solicitados que no existían (o RLS) también cuentan como omitidos.
  resumen.omitidas += unicos.length - sols.length;

  for (const g of grupos.values()) {
    const plantilla = plantillaSolicitud(g.nombre, g.items);
    const r = await enviarCorreo(g.email, plantilla);

    if (!r.ok) {
      resumen.fallidos += 1;
      resumen.detalles.push({
        responsable: g.nombre.replace(/\[DEMO\]\s*/i, "").trim(),
        email: g.email,
        solicitudes: g.items.length,
        resultado: "fallido",
        motivo: r.error,
      });
      continue;
    }

    // Avanza el estado (el trigger registra 'cambio_estado' aparte).
    const { error: upErr } = await db
      .from("solicitudes")
      .update({ estado: "solicitado" })
      .in("id", g.ids)
      .eq("estado", "pendiente");

    if (upErr) {
      resumen.fallidos += 1;
      resumen.detalles.push({
        responsable: g.nombre.replace(/\[DEMO\]\s*/i, "").trim(),
        email: g.email,
        solicitudes: g.items.length,
        resultado: "fallido",
        motivo: `Correo enviado pero no se pudo actualizar el estado: ${upErr.message}`,
      });
      continue;
    }

    await logCorreo(db, {
      tenantId: g.tenantId,
      usuarioId,
      accion: "solicitud_enviada",
      entidadId: g.ids.length === 1 ? g.ids[0] : null,
      detalle: {
        responsable_id: g.responsableId,
        email: g.email,
        nombre: g.nombre,
        solicitud_ids: g.ids,
        total: g.ids.length,
        modo: r.modo,
      },
    });

    resumen.correos += 1;
    resumen.solicitudes += g.ids.length;
    resumen.detalles.push({
      responsable: g.nombre.replace(/\[DEMO\]\s*/i, "").trim(),
      email: g.email,
      solicitudes: g.items.length,
      resultado: "enviado",
    });
  }

  return resumen;
}
