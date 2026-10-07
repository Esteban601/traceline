import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { BLOQUES, bloqueSeleccionado, normalizarSeleccion } from "@/lib/suplemento/bloques";
import { evaluarCompletitud } from "@/lib/suplemento/completitud";
import { regimenDe } from "@/lib/perfil-emisor";
import { logEvento } from "@/lib/bitacora";
import { accesoAlGenerador } from "@/lib/suplemento/acceso";
import { opcionesLiterales } from "@/lib/suplemento/texto-del-emisor";

export const runtime = "nodejs";

// =============================================================================
// POST /api/suplemento/{reporte}/generar
//
// El segmento se llama {destino} en el árbol de rutas porque lo comparte con la
// ruta de bloque, que acepta un id de documento O de reporte; Next no admite dos
// nombres de slug distintos en el mismo nivel. Aquí siempre es un REPORTE.
//
// Abre un documento y deja sus 40 bloques listos para generarse. NO genera
// ninguno: cada bloque es su propia petición (ver la ruta de bloque), porque el
// router de Heroku corta a los 30 s y un documento entero son minutos.
//
// QUÉ HACE EXACTAMENTE:
//   1. Encuentra o crea el documento del reporte. Si el último está APROBADO,
//      abre una VERSIÓN NUEVA en vez de tocarlo: un documento aprobado es un
//      entregable firmado y regenerarlo encima borraría lo que alguien revisó.
//   2. Congela el régimen y los alivios con los que se genera.
//   3. Inserta los bloques SELECCIONADOS (normativos y editoriales elegidos) en
//      cola, salvo los que el régimen excluye, que entran en 'no_aplica'; los
//      editoriales no elegidos quedan 'no_seleccionado'. Ninguno de los dos cuesta
//      una llamada.
//
// El cliente recibe la lista y decide el orden. Dispara el 29 primero para
// calentar el caché —su capa estable es la que comparten los cuarenta— y el
// resto con concurrencia 3.
// =============================================================================

export async function POST(req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: reporteId } = await ctx.params;
  // SELECCIÓN DE EDITORIALES (encargo suplemento-calidad): las claves de los
  // bloques editoriales que lleva el documento. Sin cuerpo, los recomendados.
  // TEXTOS LITERALES (Paso 3): {clave del editorial: adjunto} para los bloques
  // que llevan el texto del emisor sin reescribir. Se validan abajo, contra los
  // adjuntos de la emisora del reporte.
  let pedido: unknown = undefined;
  let pedidoLiterales: unknown = undefined;
  try {
    const cuerpo = (await req.json()) as { editoriales?: unknown; literales?: unknown } | null;
    pedido = cuerpo?.editoriales;
    pedidoLiterales = cuerpo?.literales;
  } catch {
    /* sin cuerpo: selección por defecto */
  }
  const editoriales = normalizarSeleccion(pedido);

  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  // En A5a el documento completo lo genera el staff. El administrador del
  // cliente lo verá en A8, con los límites por tenant ya puestos.
  if (!esStaff(perfil)) {
    return NextResponse.json(
      { error: esAdminCliente(perfil) ? "Disponible para el equipo de IRStrat." : "Sin permiso." },
      { status: 403 }
    );
  }

  const db = await createClient();

  const { data: rep } = await db
    .from("reportes")
    .select("id, tenant_id, nombre, ejercicio, anio_adopcion, alivios")
    .eq("id", reporteId)
    .maybeSingle();
  if (!rep) return NextResponse.json({ error: "Ese reporte no existe o no es visible." }, { status: 404 });

  // Bandera y tope de la emisora, en el servidor (lib/suplemento/acceso.ts).
  const acceso = await accesoAlGenerador(db, rep.tenant_id, { corridaCompleta: true });
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  // Literales: solo editoriales seleccionados, y solo un adjunto que esa emisora
  // tenga leído y apto para ese bloque. Uno que no cumpla se rechaza con su
  // motivo: generar en silencio con el modelo lo que se pidió literal sería
  // hacer otra cosa que la pedida.
  let literales: Record<string, string> | null = null;
  if (pedidoLiterales && typeof pedidoLiterales === "object" && !Array.isArray(pedidoLiterales)) {
    const entradas = Object.entries(pedidoLiterales as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0
    );
    if (entradas.length) {
      const opciones = await opcionesLiterales(db, rep.tenant_id);
      for (const [clave, adjunto] of entradas) {
        if (!editoriales.includes(clave)) {
          return NextResponse.json({ error: `El bloque «${clave}» no está seleccionado: no puede llevar texto literal.` }, { status: 422 });
        }
        if (!(opciones[clave] ?? []).some((o) => o.adjuntoId === adjunto)) {
          return NextResponse.json({ error: `El archivo elegido para «${clave}» no se puede usar literalmente (no es de su sección, no está leído o es demasiado largo).` }, { status: 422 });
        }
      }
      literales = Object.fromEntries(entradas);
    }
  }

  const regimen = regimenDe(rep.ejercicio, rep.anio_adopcion);
  if (regimen === "indeterminado") {
    // Sin año de adopción no se sabe si el documento lleva comparativos. Generar
    // cuarenta bloques para descubrirlo después sale caro y sale mal.
    return NextResponse.json(
      { error: "El reporte no tiene año de adopción declarado; sin él no se puede fijar el régimen." },
      { status: 422 }
    );
  }

  // --- 1. Documento ---------------------------------------------------------
  const { data: previos } = await db
    .from("documentos_generados")
    .select("id, version, estado")
    .eq("reporte_id", reporteId)
    .eq("tipo", "suplemento_s1s2")
    .eq("idioma", "es")
    .order("version", { ascending: false });

  const ultimo = previos?.[0];
  let documentoId: string;
  let version: number;
  let creado = false;

  if (ultimo && ultimo.estado !== "aprobado") {
    documentoId = ultimo.id;
    version = ultimo.version;
    // REFRESCAR EL RÉGIMEN CONGELADO. Congelar significa "esto es lo que regía
    // cuando se escribieron estos bloques", y aquí se van a reescribir los
    // cuarenta. Fijarlo solo al crear la fila hacía que un documento regenerado
    // después de cambiar los alivios del reporte declarara un régimen que no es
    // el que usó: el generador lee los alivios del REPORTE, así que la copia
    // congelada era la única que mentía.
    await db
      .from("documentos_generados")
      .update({ regimen, alivios: rep.alivios ?? {}, editoriales_incluidos: editoriales, textos_literales: literales })
      .eq("id", documentoId);
  } else {
    version = (ultimo?.version ?? 0) + 1;
    const { data: nuevo, error } = await db
      .from("documentos_generados")
      .insert({
        tenant_id: rep.tenant_id,
        reporte_id: rep.id,
        tipo: "suplemento_s1s2",
        idioma: "es",
        version,
        estado: "borrador",
        regimen,
        alivios: rep.alivios ?? {},
        editoriales_incluidos: editoriales,
        textos_literales: literales,
        generado_por: perfil.id,
      })
      .select("id")
      .single();
    if (error || !nuevo) {
      return NextResponse.json({ error: `No se pudo crear el documento: ${error?.message}` }, { status: 500 });
    }
    documentoId = nuevo.id;
    creado = true;
  }

  // --- 2. Los 40 bloques ----------------------------------------------------
  const comp = await evaluarCompletitud(db, reporteId);
  if (!comp.ok) {
    return NextResponse.json({ error: `No se pudo evaluar el reporte: ${comp.causa}` }, { status: 422 });
  }
  const porClave = new Map(comp.bloques.map((b) => [b.clave, b]));

  // Un editorial que el documento no lleva queda `no_seleccionado`, con su fila
  // y SIN tocar su texto: apagarlo en esta tanda no borra lo que ya se escribió.
  // Va en su propio upsert, sin `texto`, para no pisarlo.
  const noSeleccionados = BLOQUES.filter((b) => !bloqueSeleccionado(b, editoriales)).map((b) => ({
    documento_id: documentoId,
    numero: b.numero,
    clave: b.clave,
    titulo: b.titulo,
    seccion: b.seccion,
    idioma: "es",
    estado: "no_seleccionado",
    reclamado_en: null,
    pendientes: [],
    updated_at: new Date().toISOString(),
  }));

  const filas = BLOQUES.filter((b) => bloqueSeleccionado(b, editoriales)).map((b) => {
    const ev = porClave.get(b.clave);
    const noAplica = ev?.estado === "no_aplica";
    return {
      documento_id: documentoId,
      numero: b.numero,
      clave: b.clave,
      titulo: b.titulo,
      seccion: b.seccion,
      idioma: "es",
      // EN COLA, no 'generando': nadie lo ha tomado todavía. El vencimiento a
      // los tres minutos corre desde `reclamado_en`, que escribe la ruta de
      // bloque al reclamarlo. Sin esta distinción, los últimos de una cola de
      // cuarenta vencían esperando turno.
      estado: noAplica ? "no_aplica" : "en_cola",
      texto: null,
      fuentes: [],
      reclamado_en: null,
      // Encolar es empezar de cero: los cortes por tiempo de una tanda anterior
      // no cuentan contra esta.
      intentos: 0,
      pendientes: noAplica
        ? [{ campo: "regimen", motivo: ev?.motivoNoAplica ?? "El régimen excluye este bloque." }]
        : [],
      generado_en: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: errBloques } = await db
    .from("documentos_bloques")
    .upsert(filas, { onConflict: "documento_id,numero" });
  if (errBloques) {
    return NextResponse.json({ error: `No se pudieron crear los bloques: ${errBloques.message}` }, { status: 500 });
  }
  if (noSeleccionados.length) {
    const { error: errNo } = await db
      .from("documentos_bloques")
      .upsert(noSeleccionados, { onConflict: "documento_id,numero" });
    if (errNo) {
      return NextResponse.json({ error: `No se pudieron marcar los editoriales no seleccionados: ${errNo.message}` }, { status: 500 });
    }
  }

  const porGenerar = filas.filter((f) => f.estado === "en_cola").map((f) => f.numero);

  await logEvento(db, {
    tenantId: rep.tenant_id,
    usuarioId: perfil.id,
    accion: "suplemento_documento_abierto",
    entidad: "documentos_generados",
    entidadId: documentoId,
    detalle: {
      version,
      creado,
      regimen,
      por_generar: porGenerar.length,
      no_aplican: filas.length - porGenerar.length,
      editoriales,
      textos_literales: literales ? Object.keys(literales) : [],
      no_seleccionados: noSeleccionados.length,
    },
  });

  return NextResponse.json({
    documentoId,
    version,
    creado,
    regimen,
    // El 29 primero: su capa estable es la que comparten los cuarenta, así que
    // generarlo solo deja el caché caliente para los demás.
    primero: porGenerar.includes(29) ? 29 : porGenerar[0],
    porGenerar,
    noAplican: filas.filter((f) => f.estado === "no_aplica").map((f) => f.numero),
    noSeleccionados: noSeleccionados.map((f) => f.numero),
    editoriales,
    literales: literales ? Object.keys(literales) : [],
  });
}
