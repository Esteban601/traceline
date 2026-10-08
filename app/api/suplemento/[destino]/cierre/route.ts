import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { cerrarPendientes } from "@/lib/suplemento/hechos/cierre";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";

// =============================================================================
// POST /api/suplemento/{documento}/cierre
//
// Cierre de pendientes por código (Paso 5c): un marcador de algo que otro bloque
// afirma con un hecho del que es dueño se sustituye por una remisión a ese
// bloque, sin modelo. Lo llama el orquestador antes de la pasada de coherencia;
// queda en el historial como versión «automatica». Solo el equipo de IRStrat.
// =============================================================================

export async function POST(_req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: documentoId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil)) return NextResponse.json({ error: "Disponible para el equipo de IRStrat." }, { status: 403 });
  const db = await createClient();
  const { data: doc } = await db.from("documentos_generados").select("tenant_id").eq("id", documentoId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Ese documento no existe o no es visible." }, { status: 404 });
  const acceso = await accesoAlGenerador(db, doc.tenant_id);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  const cierres = await cerrarPendientes(db, documentoId);
  if (cierres.length) {
    await logEvento(db, {
      tenantId: doc.tenant_id,
      usuarioId: perfil.id,
      accion: "suplemento_cierre_pendientes",
      entidad: "documentos_generados",
      entidadId: documentoId,
      detalle: { cierres: cierres.map((c) => ({ bloque: c.bloque, dueno: c.dueno })) },
    });
  }
  return NextResponse.json({ cierres });
}
