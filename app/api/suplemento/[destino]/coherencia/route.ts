import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { completarPasada, reclamarPasada } from "@/lib/suplemento/coherencia";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";

// =============================================================================
// /api/suplemento/{documento}/coherencia — pasada de coherencia (encargo
// suplemento-calidad, Paso 3 (d)). El segmento se llama {destino} por la misma
// razón que en la ruta de bloque; aquí siempre es un DOCUMENTO.
//
//   POST: abre una pasada y la corre en after() —la lectura del documento entero
//         tarda más que los 30 s del router de Heroku—. Cuerpo opcional
//         {origen: "fin_de_generacion" | "manual"}. Solo staff: cuesta una
//         llamada. 202 con el id; 409 si ya hay una en curso.
//   GET:  la última pasada del documento, con sus observaciones y su costo.
//
// No edita ningún bloque.
// =============================================================================

export async function POST(req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: documentoId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil)) return NextResponse.json({ error: "Disponible para el equipo de IRStrat." }, { status: 403 });

  let origen: "fin_de_generacion" | "manual" = "manual";
  try {
    const c = (await req.json()) as { origen?: unknown } | null;
    if (c?.origen === "fin_de_generacion") origen = "fin_de_generacion";
  } catch {
    /* sin cuerpo: manual */
  }

  const db = await createClient();
  const { data: doc } = await db.from("documentos_generados").select("tenant_id").eq("id", documentoId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Ese documento no existe o no es visible." }, { status: 404 });
  const acceso = await accesoAlGenerador(db, doc.tenant_id);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  const r = await reclamarPasada(db, documentoId, origen, perfil.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  after(async () => {
    // completarPasada ya atrapa sus errores y deja la pasada en `error`.
    await completarPasada(db, r.id, documentoId);
    await logEvento(db, {
      tenantId: doc.tenant_id,
      usuarioId: perfil.id,
      accion: "suplemento_coherencia",
      entidad: "documentos_generados",
      entidadId: documentoId,
      detalle: { pasada: r.id, origen },
    });
  });

  return NextResponse.json({ id: r.id, estado: "generando" }, { status: 202 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: documentoId } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  const db = await createClient();
  const { data } = await db
    .from("observaciones_coherencia")
    .select("id, estado, origen, observaciones, descartadas, bloques_revisados, modelo, prompt_version, tokens_entrada, tokens_entrada_cache_escritura, tokens_entrada_cache_lectura, tokens_salida, costo_usd, duracion_ms, error, created_at, terminado_en")
    .eq("documento_id", documentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Este documento no tiene pasada de coherencia." }, { status: 404 });
  return NextResponse.json(data);
}
