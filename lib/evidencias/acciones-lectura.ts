"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esAuditor, esStaff, getPerfilActual } from "@/lib/data";
import { evidenciasConCifra } from "@/lib/evidencias/con-cifra";

// =============================================================================
// CARGA EN DOS MOMENTOS: CIFRA MANUAL (encargo 2026-10-26-carga-lectura-
// primero). La usan el portal y el panel.
//
//   · capturarCifra: el paso 3 manual, cuando no hay sugerencia que confirmar
//     (lectura apagada, tope, fallo, sin hallazgo, rechazada o más de 90 s).
//     El sondeo de la lectura va por GET /api/evidencias/lectura, no aquí.
//     La sugerida se confirma o corrige con fn_decidir_sugerencia, no aquí.
//
// Una evidencia tiene a lo más UNA cifra confirmada: la acción lo comprueba, la
// generación de la sugerencia no sugiere sobre una evidencia con cifra, y
// fn_decidir_sugerencia responde 409 si ya la hay.
// =============================================================================

export type CifraState = { ok: boolean; error: string | null; mensaje: string | null };

export async function capturarCifra(_prev: CifraState, formData: FormData): Promise<CifraState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida.", mensaje: null };
  if (esAuditor(perfil)) return { ok: false, error: "El auditor externo no puede realizar esta acción.", mensaje: null };

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const evidenciaId = String(formData.get("evidencia_id") ?? "");
  const valorRaw = String(formData.get("valor") ?? "").trim().replace(/,/g, "");
  const unidad = String(formData.get("unidad") ?? "").trim();
  const periodo = String(formData.get("periodo") ?? "").trim();
  const valor = Number(valorRaw);
  if (!solicitudId || !evidenciaId) return { ok: false, error: "Solicitud no válida.", mensaje: null };
  if (!valorRaw || !Number.isFinite(valor)) return { ok: false, error: "Escribe la cifra como número, por ejemplo 1240 o 1,240.5.", mensaje: null };
  if (!unidad) return { ok: false, error: "Escribe la unidad de la cifra.", mensaje: null };

  const db = await createClient();
  const { data: sol } = await db
    .from("solicitudes")
    .select("id, estado, es_cuantitativa, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id, estado)")
    .eq("id", solicitudId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "No se encontró la solicitud o no tienes acceso.", mensaje: null };
  const reporte = sol.reporte as unknown as { tenant_id: string; estado: string } | null;
  if (sol.estado === "congelado" || reporte?.estado === "congelado") return { ok: false, error: "El reporte está congelado; ya no se capturan cifras.", mensaje: null };
  if (!sol.es_cuantitativa) return { ok: false, error: "Esta solicitud no pide una cifra.", mensaje: null };
  // El staff, solo donde el cliente le permite cargar (la base lo vuelve a exigir).
  if (esStaff(perfil) && reporte) {
    const { data: t } = await db.from("tenants").select("staff_puede_cargar").eq("id", reporte.tenant_id).maybeSingle();
    if (!t?.staff_puede_cargar) return { ok: false, error: "La captura corresponde al cliente.", mensaje: null };
  }

  // La cifra va con la evidencia vigente: la más reciente de la solicitud.
  const { data: ultima } = await db.from("evidencias").select("id, periodo_cubierto").eq("solicitud_id", solicitudId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!ultima || ultima.id !== evidenciaId) return { ok: false, error: "Hay una versión más reciente del archivo; recarga la página.", mensaje: null };

  if ((await evidenciasConCifra(db, [evidenciaId])).has(evidenciaId)) return { ok: false, error: "Esta evidencia ya tiene una cifra confirmada.", mensaje: null };

  const { error } = await db.from("capturas_valor").insert({
    solicitud_id: solicitudId,
    evidencia_id: evidenciaId,
    valor,
    unidad,
    periodo: periodo || ultima.periodo_cubierto || null,
    capturado_por: perfil.id,
    confirmado: true,
    justificacion: null,
  });
  if (error) return { ok: false, error: `No se guardó la cifra: ${error.message}`, mensaje: null };

  revalidatePath(`/portal/solicitudes/${solicitudId}`);
  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/portal");
  revalidatePath("/admin");
  return { ok: true, error: null, mensaje: "Cifra guardada." };
}
