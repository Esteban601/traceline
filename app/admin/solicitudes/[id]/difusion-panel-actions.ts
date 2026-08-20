"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, puedeEntrarPanel } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import { puedeRevisarOrigen, type OrigenSolicitud } from "@/lib/origen";

export type PanelDifusionState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
};

/**
 * Retira copias de una difusión: ya se sabe qué área tenía la información.
 *
 * Quién puede hacerlo lo decide la REGLA DE ORIGEN de siempre —IRStrat sus
 * difusiones, el administrador del cliente las internas—, y el trigger
 * `trg_solicitud_difusion` lo vuelve a exigir junto con la condición que de verdad
 * protege el expediente: una copia con evidencia entregada no se retira.
 *
 * No borra: la copia conserva su conversación, su declaración y su historia. Lo
 * que cambia es que deja de pedir, de contar como brecha y de recordar.
 */
export async function desactivarCopias(ids: string[]): Promise<PanelDifusionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: "Acción reservada al panel de seguimiento." };
  }
  if (ids.length === 0) return { ok: false, error: "No seleccionaste ninguna copia." };

  const db = await createClient();

  const { data: copias, error } = await db
    .from("solicitudes")
    .select(
      "id, titulo, area_asignada, origen, grupo_difusion_id, declinada, desactivada, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"
    )
    .in("id", ids);
  if (error || !copias || copias.length === 0) {
    return { ok: false, error: "No se encontraron las copias." };
  }

  const retiradas: { id: string; area: string | null }[] = [];
  const rechazos: string[] = [];

  for (const c of copias) {
    if (!c.grupo_difusion_id) {
      rechazos.push(`${c.area_asignada ?? "—"}: no es una copia de difusión`);
      continue;
    }
    if (!puedeRevisarOrigen(c.origen as OrigenSolicitud, perfil)) {
      rechazos.push(
        `${c.area_asignada ?? "—"}: ${
          esStaff(perfil)
            ? "es una difusión interna del cliente"
            : "es una difusión de IRStrat"
        }`
      );
      continue;
    }
    const { error: upErr } = await db
      .from("solicitudes")
      .update({ desactivada: true })
      .eq("id", c.id);
    if (upErr) {
      // El mensaje del trigger es el que explica el caso real (por ejemplo, una
      // copia que sí entregó evidencia): se muestra tal cual.
      rechazos.push(`${c.area_asignada ?? "—"}: ${upErr.message}`);
      continue;
    }
    retiradas.push({ id: c.id, area: c.area_asignada });

    await logEvento(db, {
      tenantId: (c.reporte as unknown as { tenant_id: string } | null)?.tenant_id ?? null,
      usuarioId: perfil.id,
      accion: "copia_desactivada",
      entidad: "solicitudes",
      entidadId: c.id,
      detalle: {
        solicitud_id: c.id,
        titulo: c.titulo,
        area: c.area_asignada,
        grupo_difusion_id: c.grupo_difusion_id,
        estaba_declinada: c.declinada,
        rol: perfil.rol,
      },
    });
  }

  revalidatePath("/admin");
  for (const r of retiradas) revalidatePath(`/admin/solicitudes/${r.id}`);
  revalidatePath("/portal");

  if (retiradas.length === 0) {
    return {
      ok: false,
      error: `No se pudo retirar ninguna copia. ${rechazos.join("; ")}`,
    };
  }
  return {
    ok: true,
    error: null,
    mensaje:
      rechazos.length === 0
        ? `${retiradas.length} ${retiradas.length === 1 ? "copia retirada" : "copias retiradas"}.`
        : `${retiradas.length} retirada(s); ${rechazos.length} no se pudo: ${rechazos.join("; ")}`,
  };
}
