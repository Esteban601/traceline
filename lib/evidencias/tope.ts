import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// TOPE MENSUAL DE LECTURAS (`tenants.lecturas_mes_max`).
//
// Cuenta como lectura:
//   · cada evidencia leída este mes (estado `extraido`); su sugerencia va
//     incluida, no cuenta aparte;
//   · cada regeneración de sugerencia por /api/evidencias/sugerir, porque es lo
//     que se puede repetir (decisión al aprobar el Paso 2).
// Lo usan la cola de lectura y la regeneración, para que las dos midan igual.
// =============================================================================

type Db = ReturnType<typeof createAdminClient>;

export function inicioDeMes(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function lecturasDelMes(db: Db, tenantId: string): Promise<number> {
  const desde = inicioDeMes();
  const [{ count: leidas }, { count: regeneradas }] = await Promise.all([
    db.from("evidencias_contenido").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("estado", "extraido").gte("procesado_en", desde),
    db.from("sugerencias_captura").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("regenerada", true).gte("created_at", desde),
  ]);
  return (leidas ?? 0) + (regeneradas ?? 0);
}

export function mensajeTope(max: number): string {
  return `Se alcanzó el tope de ${max} lecturas de este mes para la emisora.`;
}
