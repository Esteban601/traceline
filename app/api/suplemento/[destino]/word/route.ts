import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import { construirWord, nombreArchivo } from "@/lib/suplemento/word";

export const runtime = "nodejs";

// =============================================================================
// GET /api/suplemento/{documento}/word — el Suplemento como .docx.
//
// Disponible DESDE BORRADOR a propósito: el Word es la forma en que el revisor
// lee el documento entero de corrido, y esperar a la aprobación para poder verlo
// obligaría a aprobar antes de revisar. Mientras no esté aprobado sale con marca
// de agua, que es lo que impide que un borrador circule como definitivo.
//
// El archivo se guarda en el bucket privado `documentos` bajo
// {tenant_id}/{documento_id}/ y se registra en la bitácora, porque un entregable
// que sale de la plataforma tiene que dejar constancia de quién lo sacó y de qué
// versión del documento salió.
// =============================================================================

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ destino: string }> }
) {
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { destino: documentoId } = await ctx.params;
  const db = await createClient();

  // RLS acota lo visible; el filtro por documento es el que impide que un id
  // ajeno tecleado a mano devuelva un archivo.
  const { data: doc } = await db
    .from("documentos_generados")
    .select("id, tenant_id, reporte_id, version, estado, reportes(ejercicio)")
    .eq("id", documentoId)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const staff = esStaff(perfil);
  const admin = esAdminCliente(perfil) && perfil.tenant_id === doc.tenant_id;
  if (!staff && !admin) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });

  const { data: bloques } = await db
    .from("documentos_bloques")
    .select("numero, titulo, seccion, estado, texto")
    .eq("documento_id", documentoId)
    .order("numero");

  if (!bloques || bloques.length === 0) {
    return NextResponse.json(
      { error: "El documento no tiene bloques generados todavía." },
      { status: 422 }
    );
  }

  // La denominación formal es la del Perfil, no el nombre del tenant: el nombre
  // interno lleva prefijos («[DEMO] …») y abreviaturas que no van en portada.
  const { data: perfilEmisor } = await db
    .from("perfil_emisor")
    .select("denominacion_formal, nombre_corto")
    .eq("tenant_id", doc.tenant_id)
    .maybeSingle();

  const { data: tenant } = await db
    .from("tenants")
    .select("nombre")
    .eq("id", doc.tenant_id)
    .maybeSingle();

  const denominacion =
    perfilEmisor?.denominacion_formal?.trim() ||
    perfilEmisor?.nombre_corto?.trim() ||
    tenant?.nombre ||
    "La emisora";

  const ejercicio =
    (doc.reportes as unknown as { ejercicio: number } | null)?.ejercicio ?? new Date().getFullYear();

  let archivo: Buffer;
  try {
    archivo = await construirWord(
      { denominacion, ejercicio },
      { version: doc.version, estado: doc.estado, bloques }
    );
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    console.error("[suplemento] el Word falló:", e);
    return NextResponse.json({ error: `No se pudo armar el Word: ${detalle}` }, { status: 500 });
  }

  const nombre = nombreArchivo(denominacion, ejercicio, doc.version);
  const ruta = `${doc.tenant_id}/${doc.id}/${Date.now()}-${nombre}`;

  // Que el guardado falle no debe dejar sin archivo a quien lo pidió: se avisa
  // en el log y la descarga sigue. La constancia importa, pero menos que el
  // entregable que el revisor está esperando.
  const { error: errSub } = await db.storage
    .from("documentos")
    .upload(ruta, archivo, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
  if (errSub) console.error("[suplemento] no se guardó el Word en storage:", errSub.message);

  await logEvento(db, {
    tenantId: doc.tenant_id,
    usuarioId: perfil.id,
    accion: "suplemento_word_descargado",
    entidad: "documentos_generados",
    entidadId: doc.id,
    detalle: {
      version: doc.version,
      estado_documento: doc.estado,
      bloques: bloques.filter((b) => b.estado !== "no_aplica" && (b.texto ?? "").trim()).length,
      bytes: archivo.byteLength,
      archivo: nombre,
      ruta: errSub ? null : ruta,
    },
  });

  return new NextResponse(new Uint8Array(archivo), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Content-Length": String(archivo.byteLength),
      // Un borrador cambia con cada regeneración: nadie debe servir uno viejo.
      "Cache-Control": "no-store",
    },
  });
}
