import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { construirLibro, reclamarLibro } from "@/lib/suplemento/hechos/libro";

export const runtime = "nodejs";

// =============================================================================
// /api/suplemento/{reporte}/hechos — libro de hechos del reporte (encargo
// suplemento-calidad, Paso 5). El segmento se llama {destino} por la misma
// razón que en las otras rutas del suplemento; aquí siempre es un REPORTE.
//
//   POST: arma el libro en after() (son varias llamadas: minutos). Solo staff:
//         cuesta. Cuerpo opcional {forzar: true} para no reutilizar un libro
//         con la misma huella. 202 con el id; 409 si ya hay uno en curso.
//   GET:  el último libro del reporte con sus hechos.
// =============================================================================

export async function POST(req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: reporteId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil)) return NextResponse.json({ error: "Disponible para el equipo de IRStrat." }, { status: 403 });
  let forzar = false;
  try {
    forzar = ((await req.json()) as { forzar?: unknown } | null)?.forzar === true;
  } catch {
    /* sin cuerpo */
  }
  const db = await createClient();
  const { data: rep } = await db.from("reportes").select("tenant_id").eq("id", reporteId).maybeSingle();
  if (!rep) return NextResponse.json({ error: "Ese reporte no existe o no es visible." }, { status: 404 });
  const acceso = await accesoAlGenerador(db, rep.tenant_id);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  const r = await reclamarLibro(db, reporteId, perfil.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  after(async () => {
    await construirLibro(db, r.id, reporteId, { forzar });
  });
  return NextResponse.json({ id: r.id, estado: "generando" }, { status: 202 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: reporteId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  const db = await createClient();
  const { data: libro } = await db
    .from("libros_hechos")
    .select("*")
    .eq("reporte_id", reporteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!libro) return NextResponse.json({ error: "Este reporte no tiene libro de hechos." }, { status: 404 });
  const { data: hechos } = await db
    .from("hechos")
    .select("id, clave, enunciado, tipo, valor, unidad, periodo, rango_fuente, fuente_tipo, fuente_id, fuente_detalle, extracto, verificado, verificacion, bloque_dueno, bloques_referencia, grupo_conflicto, conflicto, estado")
    .eq("libro_id", libro.id)
    .order("bloque_dueno", { ascending: true });
  return NextResponse.json({ libro, hechos: hechos ?? [] });
}
