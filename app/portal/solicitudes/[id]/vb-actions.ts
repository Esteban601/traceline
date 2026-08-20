"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import { esJefeArea } from "@/lib/roles";
import { puedeDarVB, puedeRetirarVB, esJefeDeSuArea } from "@/lib/vb-area";
import type { EstadoSolicitud } from "@/lib/estados";

export type VBState = { ok: boolean; error?: string | null; mensaje?: string | null };

/**
 * Visto bueno del ÁREA: lo da y lo retira el jefe del área, desde su portal.
 *
 * La autoridad real es la base —política `solicitudes_jefe_area_vb` + trigger
 * `trg_solicitud_vb_area`, que además CALCULA quién firma y cuándo—. Aquí se
 * comprueba lo mismo para dar un mensaje humano en vez de un error de constraint,
 * y para dejar la entrada de bitácora con su autor y su rol.
 */
async function mover(
  solicitudId: string,
  firmar: boolean
): Promise<VBState> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };
  if (!esJefeArea(perfil)) {
    return {
      ok: false,
      error: "El visto bueno del área lo da el jefe del área.",
    };
  }

  const db = await createClient();

  const { data: sol, error: solErr } = await db
    .from("solicitudes")
    .select(
      "id, titulo, area_asignada, estado, vb_area_por, vb_area_fecha, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"
    )
    .eq("id", solicitudId)
    .single();
  if (solErr || !sol) {
    return { ok: false, error: "No se encontró la solicitud o no tienes acceso." };
  }

  const solVB = {
    area_asignada: sol.area_asignada,
    estado: sol.estado as EstadoSolicitud,
    vb_area_por: sol.vb_area_por,
    vb_area_fecha: sol.vb_area_fecha,
  };
  if (!esJefeDeSuArea(perfil, solVB)) {
    return { ok: false, error: "Esta solicitud es de otra área." };
  }

  // ¿Hay evidencia? Es la condición del visto bueno y se comprueba aquí para
  // explicarla; el trigger la vuelve a exigir, que es donde no se puede saltar.
  const { count } = await db
    .from("evidencias")
    .select("id", { count: "exact", head: true })
    .eq("solicitud_id", solicitudId);
  const tieneEvidencia = (count ?? 0) > 0;

  if (firmar && !puedeDarVB(perfil, solVB, tieneEvidencia)) {
    return {
      ok: false,
      error: tieneEvidencia
        ? "No se puede dar el visto bueno en este estado."
        : "No hay evidencia cargada: el visto bueno respalda un archivo.",
    };
  }
  if (!firmar && !puedeRetirarVB(perfil, solVB)) {
    return { ok: false, error: "No se puede retirar el visto bueno en este estado." };
  }

  // Los valores que se envían son irrelevantes: el trigger fija autor y fecha.
  // Se manda `auth.uid()` de todas formas para que la intención sea explícita.
  const { data: actualizada, error: upErr } = await db
    .from("solicitudes")
    .update(
      firmar
        ? { vb_area_por: perfil.id, vb_area_fecha: new Date().toISOString() }
        : { vb_area_por: null, vb_area_fecha: null }
    )
    .eq("id", solicitudId)
    .select("id, vb_area_por, vb_area_fecha")
    .single();

  if (upErr || !actualizada) {
    return {
      ok: false,
      error: upErr?.message ?? "No se pudo registrar el visto bueno.",
    };
  }

  const tenantId = (sol.reporte as unknown as { tenant_id: string } | null)?.tenant_id ?? null;
  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: firmar ? "vb_area_dado" : "vb_area_retirado",
    entidad: "solicitudes",
    entidadId: solicitudId,
    detalle: {
      solicitud_id: solicitudId,
      titulo: sol.titulo,
      area: sol.area_asignada,
      rol: perfil.rol,
      // La fecha que quedó es la que calculó la base, no la que envió el cliente.
      vb_area_fecha: actualizada.vb_area_fecha,
    },
  });

  revalidatePath(`/portal/solicitudes/${solicitudId}`);
  revalidatePath("/portal");
  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");
  return {
    ok: true,
    error: null,
    mensaje: firmar
      ? "Visto bueno del área registrado."
      : "Visto bueno del área retirado.",
  };
}

export async function darVistoBuenoArea(solicitudId: string): Promise<VBState> {
  return mover(solicitudId, true);
}

export async function retirarVistoBuenoArea(solicitudId: string): Promise<VBState> {
  return mover(solicitudId, false);
}
