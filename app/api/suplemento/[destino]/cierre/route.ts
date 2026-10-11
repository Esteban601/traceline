import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { completarCierre, reclamarCierre } from "@/lib/suplemento/hechos/cierre";
import { completarPasada, reclamarPasada } from "@/lib/suplemento/coherencia";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";

// =============================================================================
// /api/suplemento/{documento}/cierre
//
// Cierre de pendientes (Paso 5c): un marcador de algo que otro bloque afirma con
// un hecho del que es dueño se sustituye por una remisión a ese bloque si Sonnet
// 5.5 verifica que lo responde; la sustitución es por código. Queda en el
// historial como versión «automatica». Solo el equipo de IRStrat.
//
//   POST: reserva el cierre en el documento y lo corre en after() —cada
//         verificación puede tardar más que los 30 s del router de Heroku
//         (fix/pre-v40)—. Cuerpo opcional {coherencia: true}: al terminar el
//         cierre, el mismo after() lanza la pasada de coherencia del fin de la
//         generación, así que la coherencia nunca lee un documento a medio
//         cerrar. 202; 409 si ya hay un cierre en curso. El cierre es parte de
//         la corrida: solo exige la bandera del generador.
//   GET:  estado del último cierre: en_cola → ejecutando → listo | error.
// =============================================================================

export async function POST(req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: documentoId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil)) return NextResponse.json({ error: "Disponible para el equipo de IRStrat." }, { status: 403 });
  let coherencia = false;
  try {
    coherencia = ((await req.json()) as { coherencia?: unknown } | null)?.coherencia === true;
  } catch {
    /* sin cuerpo: solo el cierre */
  }
  const db = await createClient();
  const { data: doc } = await db.from("documentos_generados").select("tenant_id").eq("id", documentoId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Ese documento no existe o no es visible." }, { status: 404 });
  const acceso = await accesoAlGenerador(db, doc.tenant_id);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  if (!(await reclamarCierre(db, documentoId))) {
    return NextResponse.json({ error: "Ya hay un cierre de pendientes en curso para este documento." }, { status: 409 });
  }

  after(async () => {
    const r = await completarCierre(db, documentoId);
    if (r?.cierres.length) {
      await logEvento(db, {
        tenantId: doc.tenant_id,
        usuarioId: perfil.id,
        accion: "suplemento_cierre_pendientes",
        entidad: "documentos_generados",
        entidadId: documentoId,
        detalle: { costo_usd: r.costo, cierres: r.cierres.map((c) => ({ bloque: c.bloque, dueno: c.dueno, veredicto: c.veredicto })) },
      });
    }
    if (!coherencia) return;
    // Aunque el cierre falle, la coherencia revisa el documento tal como quedó
    // (antes del cierre o con los bloques que alcanzó a cerrar): lo que no se
    // cerró lo vuelve a señalar el validador cruzado.
    const p = await reclamarPasada(db, documentoId, "fin_de_generacion", perfil.id);
    if (!p.ok) return;
    await completarPasada(db, p.id, documentoId);
    await logEvento(db, {
      tenantId: doc.tenant_id,
      usuarioId: perfil.id,
      accion: "suplemento_coherencia",
      entidad: "documentos_generados",
      entidadId: documentoId,
      detalle: { pasada: p.id, origen: "fin_de_generacion" },
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
    .select("cierre_estado, cierre_resultado, cierre_actualizado_en")
    .eq("id", documentoId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Ese documento no existe o no es visible." }, { status: 404 });
  return NextResponse.json({ estado: data.cierre_estado, resultado: data.cierre_resultado, actualizado_en: data.cierre_actualizado_en });
}
