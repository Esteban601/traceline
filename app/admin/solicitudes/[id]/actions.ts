"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { transicionValida } from "@/lib/transiciones";
import type { EstadoSolicitud } from "@/lib/estados";
import { enviarSolicitudesCore } from "@/lib/solicitar";
import { enviarCorreo } from "@/lib/email/enviar";
import { plantillaObservacion } from "@/lib/email/plantillas";
import { logCorreo } from "@/lib/bitacora";

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
    .select(
      "id, titulo, estado, fecha_limite, responsable_cliente_id, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id), responsable:perfiles_usuario!solicitudes_responsable_cliente_id_fkey(nombre, email)"
    )
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

  // Aviso por correo al responsable (plantilla c). Sin responsable, no se envía.
  const reporte = sol.reporte as unknown as { tenant_id: string } | null;
  const responsable = sol.responsable as unknown as { nombre: string; email: string } | null;

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");

  if (!responsable || !responsable.email) {
    return {
      ok: true,
      error: null,
      mensaje: "Observación registrada. Sin responsable asignado: no se envió correo.",
    };
  }

  const plantilla = plantillaObservacion(
    responsable.nombre,
    { id: sol.id, titulo: sol.titulo, fechaLimite: sol.fecha_limite },
    contenido
  );
  const envio = await enviarCorreo(responsable.email, plantilla);

  if (!envio.ok) {
    return {
      ok: true,
      error: null,
      mensaje: `Observación registrada, pero el correo no pudo enviarse: ${envio.error ?? ""}`,
    };
  }

  await logCorreo(supabase, {
    tenantId: reporte?.tenant_id ?? null,
    usuarioId: perfil.id,
    accion: "aviso_observacion",
    entidadId: sol.id,
    detalle: {
      responsable_id: sol.responsable_cliente_id,
      email: responsable.email,
      nombre: responsable.nombre,
      solicitud_id: sol.id,
      modo: envio.modo,
    },
  });

  return {
    ok: true,
    error: null,
    mensaje:
      envio.modo === "consola"
        ? "Observación registrada. Aviso impreso en consola (modo sin envío)."
        : "Observación registrada y aviso enviado al responsable.",
  };
}

/**
 * Envío individual de solicitud (botón del detalle). Reutiliza la lógica del
 * envío masivo con un solo id.
 */
export async function enviarSolicitud(
  _prev: AccionState,
  formData: FormData
): Promise<AccionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  if (!solicitudId) return { ok: false, error: "Solicitud no válida." };

  const supabase = await createClient();
  const r = await enviarSolicitudesCore(supabase, perfil.id, [solicitudId]);

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");

  if (r.fallidos > 0) {
    return { ok: false, error: r.detalles[0]?.motivo ?? "No se pudo enviar la solicitud." };
  }
  if (r.correos === 0) {
    return {
      ok: false,
      error:
        "No se envió: la solicitud debe estar en 'pendiente' y tener responsable asignado.",
    };
  }
  return {
    ok: true,
    error: null,
    mensaje:
      r.modo === "consola"
        ? "Solicitud impresa en consola (modo sin envío) y marcada como solicitada."
        : "Solicitud enviada al responsable y marcada como solicitada.",
  };
}
