import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { correccionesPorBloque, validarCruzado } from "@/lib/suplemento/hechos/cruzado";

export const runtime = "nodejs";

// =============================================================================
// GET /api/suplemento/{documento}/cruzado
//
// Validador cruzado sobre el libro (Paso 5b, punto 1): sin modelo, sobre las
// anclas de los bloques. Devuelve las discrepancias y, por bloque, la
// corrección que el orquestador manda en el reintento
// (POST …/bloque/{n} con { correccion }). Solo el equipo de IRStrat.
// =============================================================================

export async function GET(_req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: documentoId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil)) return NextResponse.json({ error: "Disponible para el equipo de IRStrat." }, { status: 403 });
  const db = await createClient();
  const { data: doc } = await db.from("documentos_generados").select("tenant_id").eq("id", documentoId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Ese documento no existe o no es visible." }, { status: 404 });
  const acceso = await accesoAlGenerador(db, doc.tenant_id);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  const discrepancias = await validarCruzado(db, documentoId);
  return NextResponse.json({
    discrepancias,
    correcciones: Object.fromEntries(correccionesPorBloque(discrepancias)),
  });
}
