import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { logEvento } from "@/lib/bitacora";
import sharp from "sharp";
import { construirWord, nombreArchivo, IMAGEN_DE_BLOQUE, type BloqueWord, type ImagenWord } from "@/lib/suplemento/word";

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
    .select("id, tenant_id, reporte_id, version, estado, aprobado_en, versiones_aprobadas, reportes(ejercicio)")
    .eq("id", documentoId)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const staff = esStaff(perfil);
  const admin = esAdminCliente(perfil) && perfil.tenant_id === doc.tenant_id;
  if (!staff && !admin) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });

  // Bandera de la emisora: con el generador apagado no se entrega el documento.
  const acceso = await accesoAlGenerador(db, doc.tenant_id);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  const { data: filasBloques } = await db
    .from("documentos_bloques")
    .select("numero, titulo, seccion, estado, texto")
    .eq("documento_id", documentoId)
    .order("numero");
  let bloques: BloqueWord[] | null = filasBloques;

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
    .select("denominacion_formal, nombre_corto, organigrama_path")
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

  // --- VERSIONES (Paso 4) ----------------------------------------------------
  // Un documento APROBADO se arma con las versiones que se aprobaron, no con el
  // texto que tenga hoy la fila: eso es lo que se firmó. Un borrador, con las
  // versiones vigentes. En los dos casos el Word dice cuáles en sus propiedades.
  const aprobadas = (doc.versiones_aprobadas ?? null) as Record<string, { id: string; version: number }> | null;
  const { data: versiones } = await db
    .from("documentos_bloques_versiones")
    .select("id, numero, version, texto")
    .eq("documento_id", documentoId)
    .order("version", { ascending: false });
  const vigente = new Map<number, { version: number; texto: string }>();
  for (const v of versiones ?? []) if (!vigente.has(v.numero)) vigente.set(v.numero, v);
  if (doc.estado === "aprobado" && aprobadas) {
    const porId = new Map((versiones ?? []).map((v) => [v.id, v]));
    bloques = bloques.map((b) => {
      const a = aprobadas[String(b.numero)];
      const v = a ? porId.get(a.id) : undefined;
      return v ? { ...b, texto: v.texto } : b;
    });
  }
  const versionDe = (n: number) => (doc.estado === "aprobado" && aprobadas ? aprobadas[String(n)]?.version : vigente.get(n)?.version);
  const enWord = bloques.filter((b) => b.estado !== "no_aplica" && b.estado !== "no_seleccionado" && (b.texto ?? "").trim());
  const propiedades = [
    { nombre: "TRACELINE documento", valor: doc.id },
    { nombre: "TRACELINE versión del documento", valor: String(doc.version) },
    { nombre: "TRACELINE estado", valor: doc.estado },
    ...(doc.aprobado_en ? [{ nombre: "TRACELINE aprobado en", valor: doc.aprobado_en }] : []),
    {
      nombre: doc.estado === "aprobado" && aprobadas ? "TRACELINE versiones aprobadas" : "TRACELINE versiones de bloque",
      valor: enWord.map((b) => `${b.numero}:v${versionDe(b.numero) ?? "?"}`).join(" "),
    },
  ];

  // --- FIGURAS (Paso 4): la imagen del Perfil en los bloques que la llevan ------
  // Si el archivo no está o no se puede leer, el bloque sale sin figura y se
  // anota en el log: el Word no se cae por una imagen.
  const imagenes = new Map<number, ImagenWord>();
  for (const [n, def] of Object.entries(IMAGEN_DE_BLOQUE)) {
    const ruta = perfilEmisor?.[def.campo];
    if (!ruta || !enWord.some((b) => b.numero === Number(n))) continue;
    try {
      const { data: blob, error } = await db.storage.from("documentos").download(ruta);
      if (error || !blob) throw new Error(error?.message ?? "sin datos");
      const crudo = Buffer.from(await blob.arrayBuffer());
      const meta = await sharp(crudo).metadata();
      const tipo = meta.format === "jpeg" ? "jpg" : meta.format === "png" ? "png" : null;
      // Otro formato (webp, heic…) se pasa a PNG: Word no los incrusta todos.
      const datos = tipo ? crudo : await sharp(crudo).png().toBuffer();
      imagenes.set(Number(n), { datos, tipo: tipo ?? "png", ancho: meta.width ?? 800, alto: meta.height ?? 450, pie: def.pie });
    } catch (e) {
      console.error(`[suplemento] figura del bloque ${n}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  bloques = bloques.map((b) => (imagenes.has(b.numero) ? { ...b, imagen: imagenes.get(b.numero) } : b));

  let archivo: Buffer;
  try {
    archivo = await construirWord(
      { denominacion, ejercicio },
      { version: doc.version, estado: doc.estado, bloques, propiedades }
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
      bloques: enWord.length,
      figuras: imagenes.size,
      versiones: propiedades[propiedades.length - 1].valor,
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
