import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { completarRespuestas, reclamarRespuestas } from "@/lib/suplemento/respuestas";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";

// =============================================================================
// /api/suplemento/{documento}/respuestas
//
// Respuestas por datapoint para el Excel de taxonomía y el Formato electrónico
// (encargo 2026-10-13, Paso 2). Se generan solas al aprobar; esta ruta las
// vuelve a generar sobre un documento ya aprobado. Solo el equipo de IRStrat.
//
//   POST: reserva la generación y la corre en after() (molde del cierre: una
//         llamada al modelo por bloque, más de lo que aguanta el router de
//         Heroku). 202; 409 si ya hay una en curso o el documento no está
//         aprobado. Exige la bandera del generador.
//   GET:  estado: en_cola → ejecutando → listo | error, con el resultado.
// =============================================================================

export async function POST(_req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: documentoId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil)) return NextResponse.json({ error: "Disponible para el equipo de IRStrat." }, { status: 403 });
  const db = await createClient();
  const { data: doc } = await db.from("documentos_generados").select("tenant_id, estado").eq("id", documentoId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Ese documento no existe o no es visible." }, { status: 404 });
  if (doc.estado !== "aprobado") return NextResponse.json({ error: "Las respuestas solo se generan desde un documento aprobado." }, { status: 409 });
  const acceso = await accesoAlGenerador(db, doc.tenant_id);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  const reserva = await reclamarRespuestas(db, documentoId);
  if (!reserva) return NextResponse.json({ error: "Ya hay una generación de respuestas en curso para este documento." }, { status: 409 });

  after(async () => {
    const r = await completarRespuestas(db, createAdminClient(), documentoId, reserva);
    if (!r) return;
    await logEvento(db, {
      tenantId: doc.tenant_id,
      usuarioId: perfil.id,
      accion: "suplemento_respuestas",
      entidad: "documentos_generados",
      entidadId: documentoId,
      detalle: { costo_usd: r.costo, filas: r.filas.length, por_estado: r.porEstado },
    });
  });

  return NextResponse.json({ estado: "en_cola" }, { status: 202 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: documentoId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  const db = await createClient();
  const { data } = await db
    .from("documentos_generados")
    .select("respuestas_estado, respuestas_resultado, respuestas_actualizado_en")
    .eq("id", documentoId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Ese documento no existe o no es visible." }, { status: 404 });
  return NextResponse.json({ estado: data.respuestas_estado, resultado: data.respuestas_resultado, actualizado_en: data.respuestas_actualizado_en });
}
