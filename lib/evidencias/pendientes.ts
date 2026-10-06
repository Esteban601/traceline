import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { IdentidadRol } from "@/lib/roles";
import { esAuditor, esStaffRol } from "@/lib/roles";

// =============================================================================
// SUGERENCIAS PENDIENTES DE DECISIÓN — captura sugerida, Paso 4.
//
// Las solicitudes con una sugerencia `sugerida` que el usuario PUEDE decidir,
// para el aviso y la marca en la matriz y en el tablero del portal. Misma regla
// que fn_puede_decidir_sugerencia, en lote:
//   · RLS ya acota lo visible (área propia para responsable y jefe; el tenant
//     para coordinador y administrador del cliente);
//   · el staff, solo en emisoras con `staff_puede_cargar`;
//   · el auditor, nada: lo pendiente de decidir es asunto de quien decide, y
//     mostrárselo se leería como una presión (mismo criterio que los
//     comentarios sin responder).
// `sin_hallazgo` no cuenta: no hay nada que decidir.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

export async function pendientesDeDecision(db: Db, perfil: IdentidadRol): Promise<Set<string>> {
  if (esAuditor(perfil)) return new Set();
  const { data } = await db.from("sugerencias_captura").select("solicitud_id, tenant_id").eq("estado", "sugerida");
  let filas = data ?? [];
  if (esStaffRol(perfil) && filas.length) {
    const { data: tenants } = await db.from("tenants").select("id").eq("staff_puede_cargar", true);
    const conCarga = new Set((tenants ?? []).map((t) => t.id));
    filas = filas.filter((f) => conCarga.has(f.tenant_id));
  }
  return new Set(filas.map((f) => f.solicitud_id));
}

/** «Operaciones 2 · RH 1», ordenado por cantidad. */
export function conteoPorArea(areas: (string | null)[]): { area: string; n: number }[] {
  const m = new Map<string, number>();
  for (const a of areas) m.set(a ?? "Sin área", (m.get(a ?? "Sin área") ?? 0) + 1);
  return [...m.entries()].map(([area, n]) => ({ area, n })).sort((a, b) => b.n - a.n || a.area.localeCompare(b.area));
}
