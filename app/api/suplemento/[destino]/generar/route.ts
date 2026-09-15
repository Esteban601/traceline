import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { evaluarCompletitud } from "@/lib/suplemento/completitud";
import { regimenDe } from "@/lib/perfil-emisor";
import { logEvento } from "@/lib/bitacora";

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
//   3. Inserta los 40 bloques en 'generando', salvo los que el régimen excluye,
//      que entran directamente en 'no_aplica' y no cuestan una llamada.
//
// El cliente recibe la lista y decide el orden. Dispara el 29 primero para
// calentar el caché —su capa estable es la que comparten los cuarenta— y el
// resto con concurrencia 3.
// =============================================================================

export async function POST(_req: Request, ctx: { params: Promise<{ destino: string }> }) {
  const { destino: reporteId } = await ctx.params;

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

  const filas = BLOQUES.map((b) => {
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

  const porGenerar = filas.filter((f) => f.estado === "en_cola").map((f) => f.numero);

  await logEvento(db, {
    tenantId: rep.tenant_id,
    usuarioId: perfil.id,
    accion: "suplemento_documento_abierto",
    entidad: "documentos_generados",
    entidadId: documentoId,
    detalle: { version, creado, regimen, por_generar: porGenerar.length, no_aplican: 40 - porGenerar.length },
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
  });
}
