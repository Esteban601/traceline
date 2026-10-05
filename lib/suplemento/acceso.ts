import "server-only";
import type { createClient } from "@/lib/supabase/server";

// =============================================================================
// ACCESO AL GENERADOR POR EMISORA (encargo 2026-10-05-generador-a-produccion).
//
// Dos reglas, aplicadas en el SERVIDOR por las rutas de /api/suplemento —la
// pantalla solo esconde el botón; aunque alguien llame a la ruta, se rechaza—:
//
//   · `tenants.generador_activo`: si está apagado, el generador no corre para
//     esa emisora (sus datos irían a la API de Anthropic). Lo exigen las tres
//     rutas: generar, bloque y word. 403.
//   · `tenants.generaciones_mes_max`: corridas completas del documento por mes
//     natural y emisora, las lance quien las lance. Solo lo exige la corrida
//     completa (POST …/generar); regenerar un bloque no cuenta. 0 apaga el
//     generador. 429.
//
// La corrida completa se cuenta por la bitácora (`suplemento_documento_abierto`,
// que la ruta de generar escribe una vez por corrida), la misma fuente con la que
// /admin/clientes muestra el consumo.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

export type Acceso = { ok: true } | { ok: false; status: 403 | 404 | 429; error: string };

export function inicioDeMes(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Corridas completas del documento en el mes en curso, para una emisora. */
export async function corridasDelMes(db: Db, tenantId: string): Promise<number> {
  const { count } = await db
    .from("bitacora")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("accion", "suplemento_documento_abierto")
    .gte("created_at", inicioDeMes());
  return count ?? 0;
}

export async function accesoAlGenerador(
  db: Db,
  tenantId: string,
  { corridaCompleta = false }: { corridaCompleta?: boolean } = {}
): Promise<Acceso> {
  const { data: t } = await db
    .from("tenants")
    .select("generador_activo, generaciones_mes_max")
    .eq("id", tenantId)
    .maybeSingle();
  if (!t) return { ok: false, status: 404, error: "No se encontró la emisora." };
  if (!t.generador_activo || t.generaciones_mes_max === 0) {
    return { ok: false, status: 403, error: "El generador del suplemento está apagado para esta emisora." };
  }
  if (corridaCompleta) {
    const usadas = await corridasDelMes(db, tenantId);
    if (usadas >= t.generaciones_mes_max) {
      return {
        ok: false,
        status: 429,
        error: `Esta emisora ya usó sus ${t.generaciones_mes_max} generaciones completas del mes. Puedes regenerar bloques sueltos.`,
      };
    }
  }
  return { ok: true };
}

/** Emisora de un destino de la ruta, que puede ser un documento o un reporte. */
export async function tenantDeDestino(db: Db, destino: string): Promise<string | null> {
  const { data: doc } = await db.from("documentos_generados").select("tenant_id").eq("id", destino).maybeSingle();
  if (doc) return doc.tenant_id;
  const { data: rep } = await db.from("reportes").select("tenant_id").eq("id", destino).maybeSingle();
  return rep?.tenant_id ?? null;
}
