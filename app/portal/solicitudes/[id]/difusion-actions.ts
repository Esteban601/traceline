"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import {
  comentarioDeclinar,
  esDeSuArea,
  puedeDeclinar,
  puedeRetomar,
  NOTA_DECLINAR_MAX,
} from "@/lib/difusion";
import type { EstadoSolicitud } from "@/lib/estados";

export type DifusionState = { ok: boolean; error?: string | null; mensaje?: string | null };

/**
 * "No aplica a mi área" y su reverso ("Retomar"), desde el portal.
 *
 * Las barreras reales están en la base (política `solicitudes_area_declina` +
 * trigger `trg_solicitud_difusion`): solo el área a la que se preguntó, solo en una
 * difusión, solo sin evidencia entregada y solo mientras el expediente esté abierto.
 * Aquí se repite el criterio para dar un mensaje humano, y se hacen las dos cosas
 * que el trigger no puede hacer: publicar el comentario que deja constancia en la
 * conversación, y registrar el acto con su autor y su rol.
 */
async function mover(
  solicitudId: string,
  declinar: boolean,
  nota: string | null
): Promise<DifusionState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };

  const db = await createClient();

  const { data: sol, error: solErr } = await db
    .from("solicitudes")
    .select(
      "id, titulo, area_asignada, estado, grupo_difusion_id, declinada, desactivada, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"
    )
    .eq("id", solicitudId)
    .single();
  if (solErr || !sol) {
    return { ok: false, error: "No se encontró la solicitud o no tienes acceso." };
  }

  const s = {
    area_asignada: sol.area_asignada,
    estado: sol.estado as EstadoSolicitud,
    grupo_difusion_id: sol.grupo_difusion_id,
    declinada: sol.declinada,
    desactivada: sol.desactivada,
  };

  if (!esDeSuArea(perfil, s)) {
    return {
      ok: false,
      error: "Solo el área a la que se preguntó puede declarar si le corresponde.",
    };
  }
  if (!sol.grupo_difusion_id) {
    return {
      ok: false,
      error:
        "Esta solicitud se dirigió a tu área en particular, no es una difusión: respóndela o escribe en la conversación si crees que no te corresponde.",
    };
  }

  const { count } = await db
    .from("evidencias")
    .select("id", { count: "exact", head: true })
    .eq("solicitud_id", solicitudId);
  const tieneEvidencia = (count ?? 0) > 0;

  if (declinar && !puedeDeclinar(perfil, s, tieneEvidencia)) {
    return {
      ok: false,
      error: tieneEvidencia
        ? "Ya entregaste un archivo en esta solicitud: la información sí le correspondía a tu área."
        : "No se puede declarar como no aplicable en este estado.",
    };
  }
  if (!declinar && !puedeRetomar(perfil, s)) {
    return { ok: false, error: "No se puede retomar esta solicitud." };
  }

  const notaLimpia = (nota ?? "").trim().slice(0, NOTA_DECLINAR_MAX) || null;

  // 1. El COMENTARIO primero: es lo que ve el área que difundió, y si la marca se
  //    escribiera sin él, la solicitud saldría de los pendientes sin explicación.
  if (declinar) {
    const { error: comErr } = await db.from("comentarios").insert({
      solicitud_id: solicitudId,
      autor_id: perfil.id,
      contenido: comentarioDeclinar(sol.area_asignada, notaLimpia),
      es_observacion: false,
    });
    if (comErr) {
      return { ok: false, error: `No se pudo publicar la declaración: ${comErr.message}` };
    }
  }

  const { data: actualizada, error: upErr } = await db
    .from("solicitudes")
    .update({ declinada: declinar })
    .eq("id", solicitudId)
    .select("id, declinada")
    .single();
  if (upErr || !actualizada) {
    return {
      ok: false,
      error: upErr?.message ?? "No se pudo registrar la declaración.",
    };
  }

  // Al RETOMAR también queda constancia en la conversación: el área que difundió
  // tiene que saber que esta copia volvió al juego.
  if (!declinar) {
    await db.from("comentarios").insert({
      solicitud_id: solicitudId,
      autor_id: perfil.id,
      contenido: `Esta área retomó la solicitud: la información sí le corresponde.${
        notaLimpia ? `\n\n${notaLimpia}` : ""
      }`,
      es_observacion: false,
    });
  }

  const tenantId = (sol.reporte as unknown as { tenant_id: string } | null)?.tenant_id ?? null;
  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: declinar ? "solicitud_declinada" : "solicitud_retomada",
    entidad: "solicitudes",
    entidadId: solicitudId,
    detalle: {
      solicitud_id: solicitudId,
      titulo: sol.titulo,
      area: sol.area_asignada,
      grupo_difusion_id: sol.grupo_difusion_id,
      nota: notaLimpia,
      rol: perfil.rol,
    },
  });

  revalidatePath(`/portal/solicitudes/${solicitudId}`);
  revalidatePath("/portal");
  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");
  return {
    ok: true,
    error: null,
    mensaje: declinar
      ? "Registrado: esta solicitud no aplica a tu área."
      : "Solicitud retomada.",
  };
}

export async function declinarSolicitud(
  solicitudId: string,
  nota: string | null
): Promise<DifusionState> {
  return mover(solicitudId, true, nota);
}

export async function retomarSolicitud(solicitudId: string): Promise<DifusionState> {
  return mover(solicitudId, false, null);
}
