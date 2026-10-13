import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// =============================================================================
// EDICIONES HUMANAS ANTES DE REGENERAR — A6, encargo suplemento-calidad, Paso 4.
//
// CLAUDE.md §5: una regeneración nunca borra una edición humana sin
// confirmación. Un bloque «lleva edición» cuando su texto actual tiene
// `editado_en`: lo escribió o lo retocó una persona (también si se restauró una
// versión editada). Regenerarlo, o regenerar el documento entero, pide
// confirmación con quién y cuándo; el texto no se pierde, queda en el historial.
// =============================================================================

export type Edicion = { numero: number; titulo: string; autor: string; fecha: string };

/** «6 de octubre de 2026», en hora de la Ciudad de México. */
export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
}

export function mensajeEdicion(e: Pick<Edicion, "autor" | "fecha">): string {
  return `Se perderá la edición de ${e.autor} del día ${fechaLarga(e.fecha)}; queda en el historial.`;
}

/** Bloques del documento cuyo texto actual lleva una edición humana. */
export async function edicionesDelDocumento(
  db: SupabaseClient<Database>,
  documentoId: string,
  numero?: number
): Promise<Edicion[]> {
  let q = db
    .from("documentos_bloques")
    .select("numero, titulo, texto, editado_en, editado:perfiles_usuario!documentos_bloques_editado_por_fkey(nombre)")
    .eq("documento_id", documentoId)
    .not("editado_en", "is", null)
    .not("texto", "is", null);
  if (numero !== undefined) q = q.eq("numero", numero);
  const { data } = await q.order("numero");
  return (data ?? []).map((b) => ({
    numero: b.numero,
    titulo: b.titulo,
    autor: (b.editado as unknown as { nombre: string } | null)?.nombre ?? "una persona",
    fecha: b.editado_en!,
  }));
}
