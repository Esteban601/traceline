"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";

export type CongelarState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
};

/**
 * Congela un reporte: reportes.estado='congelado', fecha_congelamiento=now() y
 * TODAS sus solicitudes pasan a 'congelado'. Solo rol 'admin' (no analista).
 * Confirmación reforzada: el llamador debe reescribir el nombre exacto del
 * reporte.
 *
 * Orden importante: primero se congelan las solicitudes (mientras el reporte
 * sigue 'activo', para que el trigger de solo-lectura no las bloquee) y al final
 * el reporte; a partir de ahí el candado a nivel BD deja todo en solo-lectura.
 */
export async function congelarReporte(
  _prev: CongelarState,
  fd: FormData
): Promise<CongelarState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }
  if (perfil.rol !== "admin") {
    return {
      ok: false,
      error: "Congelar un reporte es una acción de administrador.",
    };
  }

  const reporteId = String(fd.get("reporte_id") ?? "").trim();
  const confirmacion = String(fd.get("confirmacion") ?? "").trim();
  if (!reporteId) return { ok: false, error: "Reporte no válido." };

  const db = await createClient();

  const { data: reporte, error: repErr } = await db
    .from("reportes")
    .select("id, nombre, estado, tenant_id")
    .eq("id", reporteId)
    .single();
  if (repErr || !reporte) return { ok: false, error: "No se encontró el reporte." };

  if (reporte.estado === "congelado") {
    return { ok: false, error: "El reporte ya está congelado." };
  }
  if (confirmacion !== reporte.nombre) {
    return {
      ok: false,
      error: "El nombre no coincide. Escríbelo exactamente para confirmar.",
    };
  }

  // 1) Congelar solicitudes (reporte aún 'activo' → el trigger las deja pasar).
  const { error: solErr } = await db
    .from("solicitudes")
    .update({ estado: "congelado" })
    .eq("reporte_id", reporteId)
    .neq("estado", "congelado");
  if (solErr) {
    return { ok: false, error: `No se pudieron congelar las solicitudes: ${solErr.message}` };
  }

  // 2) Congelar el reporte (a partir de aquí el candado BD deja todo read-only).
  const { error: upErr } = await db
    .from("reportes")
    .update({ estado: "congelado", fecha_congelamiento: new Date().toISOString() })
    .eq("id", reporteId);
  if (upErr) {
    return { ok: false, error: `No se pudo congelar el reporte: ${upErr.message}` };
  }

  await logEvento(db, {
    tenantId: reporte.tenant_id,
    usuarioId: perfil.id,
    accion: "reporte_congelado",
    entidad: "reportes",
    entidadId: reporteId,
    detalle: { nombre: reporte.nombre },
  });

  revalidatePath("/admin/reportes");
  revalidatePath("/admin");
  revalidatePath("/portal");
  return { ok: true, error: null, mensaje: "Reporte congelado. Quedó en solo-lectura." };
}

// =============================================================================
// Régimen del ejercicio: año de adopción y alivios transitorios.
//
// De estos dos campos depende la FORMA de medio suplemento (§3.1): si lleva
// comparativos, si incluye Alcance 3, si los bloques de S1 general aplican. Por
// eso vive junto al reporte y no en el perfil del emisor: el alivio se toma un
// año y se deja de tomar al siguiente.
// =============================================================================

export type RegimenState = { ok: boolean; error?: string | null; mensaje?: string | null };

const CLAVES_ALIVIO = ["E4", "E5", "C3", "C4", "C5"] as const;

export async function guardarRegimen(
  _prev: RegimenState,
  fd: FormData
): Promise<RegimenState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const reporteId = String(fd.get("reporte_id") ?? "").trim();
  if (!reporteId) return { ok: false, error: "Falta el reporte." };

  const crudo = String(fd.get("anio_adopcion") ?? "").trim();
  let anio: number | null = null;
  if (crudo !== "") {
    const n = Number(crudo);
    // Un año fuera de rango es casi siempre un dedazo (202 en vez de 2025), y
    // dejaría el régimen calculado al revés sin que nadie lo note.
    if (!Number.isInteger(n) || n < 2020 || n > 2100) {
      return { ok: false, error: "El año de adopción debe estar entre 2020 y 2100." };
    }
    anio = n;
  }

  const alivios: Record<string, boolean> = {};
  for (const c of CLAVES_ALIVIO) if (fd.get(`alivio_${c}`) === "on") alivios[c] = true;

  const db = await createClient();
  const { error } = await db
    .from("reportes")
    .update({ anio_adopcion: anio, alivios })
    .eq("id", reporteId);
  if (error) return { ok: false, error: "No se pudo guardar el régimen." };

  const { data: rep } = await db
    .from("reportes")
    .select("tenant_id")
    .eq("id", reporteId)
    .single();

  await logEvento(db, {
    tenantId: rep?.tenant_id ?? null,
    usuarioId: perfil.id,
    accion: "reporte_regimen_actualizado",
    entidad: "reportes",
    entidadId: reporteId,
    detalle: { anio_adopcion: anio, alivios: Object.keys(alivios) },
  });

  revalidatePath("/admin/reportes");
  return { ok: true, error: null, mensaje: "Régimen actualizado." };
}
