"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { transicionValida } from "@/lib/transiciones";
import type { EstadoSolicitud } from "@/lib/estados";

export type AccionState = { ok: boolean; error?: string | null; mensaje?: string | null };

const ESTADOS_VALIDOS: EstadoSolicitud[] = [
  "pendiente",
  "solicitado",
  "recibido",
  "en_revision",
  "validado",
  "observaciones",
  "congelado",
];

/**
 * Cambia el estado de una solicitud validando que la transición sea permitida.
 * Solo staff. La bitácora la registra el trigger de UPDATE de solicitudes.
 */
export async function cambiarEstado(
  _prev: AccionState,
  formData: FormData
): Promise<AccionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const nuevoEstado = String(formData.get("estado") ?? "") as EstadoSolicitud;

  if (!ESTADOS_VALIDOS.includes(nuevoEstado) || nuevoEstado === "congelado") {
    return { ok: false, error: "Estado destino no válido." };
  }

  const supabase = await createClient();

  const { data: sol, error: solErr } = await supabase
    .from("solicitudes")
    .select("id, estado")
    .eq("id", solicitudId)
    .single();

  if (solErr || !sol) {
    return { ok: false, error: "No se encontró la solicitud." };
  }

  const actual = sol.estado as EstadoSolicitud;
  if (actual === nuevoEstado) {
    return { ok: true, mensaje: "La solicitud ya estaba en ese estado.", error: null };
  }
  if (!transicionValida(actual, nuevoEstado)) {
    return { ok: false, error: "Esa transición de estado no está permitida." };
  }

  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: nuevoEstado })
    .eq("id", solicitudId);

  if (error) {
    return { ok: false, error: "No se pudo actualizar el estado." };
  }

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");
  return { ok: true, error: null, mensaje: "Estado actualizado." };
}

/**
 * Registra una observación formal de IRStrat (comentario con es_observacion) y
 * mueve la solicitud a 'observaciones'. Solo staff.
 */
export async function agregarObservacion(
  _prev: AccionState,
  formData: FormData
): Promise<AccionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const contenido = String(formData.get("contenido") ?? "").trim();

  if (!contenido) return { ok: false, error: "Escribe la observación." };

  const supabase = await createClient();

  const { data: sol, error: solErr } = await supabase
    .from("solicitudes")
    .select("id, estado")
    .eq("id", solicitudId)
    .single();

  if (solErr || !sol) {
    return { ok: false, error: "No se encontró la solicitud." };
  }
  if ((sol.estado as EstadoSolicitud) === "congelado") {
    return { ok: false, error: "La solicitud está congelada; no admite cambios." };
  }

  const { error: comErr } = await supabase.from("comentarios").insert({
    solicitud_id: solicitudId,
    autor_id: perfil.id,
    contenido,
    es_observacion: true,
  });

  if (comErr) {
    return { ok: false, error: "No se pudo registrar la observación." };
  }

  // Mover a 'observaciones' (si no lo estaba ya). El trigger registra el cambio.
  if ((sol.estado as EstadoSolicitud) !== "observaciones") {
    const { error: estErr } = await supabase
      .from("solicitudes")
      .update({ estado: "observaciones" })
      .eq("id", solicitudId);
    if (estErr) {
      return {
        ok: true,
        error: null,
        mensaje: "Observación registrada, pero el estado no pudo actualizarse.",
      };
    }
  }

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");
  return { ok: true, error: null, mensaje: "Observación enviada al cliente." };
}
