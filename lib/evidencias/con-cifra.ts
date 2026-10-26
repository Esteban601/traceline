import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// =============================================================================
// EVIDENCIAS CON CIFRA CONFIRMADA (encargo carga-lectura-primero).
//
// Una sugerencia sobre una evidencia que ya tiene su cifra confirmada no espera
// decisión: la cifra entró por el paso 3 manual mientras la lectura corría, o
// por otra vía. «Por decidir» (portada del portal, matriz, resumen diario) las
// excluye. Con la sesión de quien mira, RLS acota lo visible; con service role,
// todo.
// =============================================================================

export async function evidenciasConCifra(db: SupabaseClient<Database>, evidenciaIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(evidenciaIds)];
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("capturas_valor").select("evidencia_id").in("evidencia_id", ids.slice(i, i + 100)).eq("confirmado", true);
    // Falla cerrado: un permiso que falta no puede leerse como «sin cifra».
    if (error) throw new Error(`capturas_valor: ${error.message}`);
    for (const c of data ?? []) if (c.evidencia_id) out.add(c.evidencia_id);
  }
  return out;
}
