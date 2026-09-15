import { NextResponse, after } from "next/server";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { generarBloque } from "@/lib/suplemento/generar-bloque";
import { esModeloConocido, MODELO_POR_DEFECTO } from "@/lib/suplemento/modelos";
import { regimenDe, leerAlivios } from "@/lib/perfil-emisor";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";
// El router de Heroku corta a los 30 s y esta llamada es la que se le acerca.
// Un bloque por petición es justamente la forma de no chocar con ese límite.
export const maxDuration = 60;

// =============================================================================
// POST /api/suplemento/{documento}/bloque/{n}
//
// Genera UN bloque. Un bloque por petición, no cuarenta: el router de Heroku
// corta a los 30 s y el cliente encadena las llamadas mostrando progreso. Cada
// resultado se persiste al llegar, así que cerrar el navegador no pierde lo ya
// generado (§6 de la especificación).
//
// EL SEGMENTO {documento} ACEPTA DOS COSAS. Si es el id de un
// `documentos_generados`, se usa ese. Si es el id de un REPORTE, se busca su
// documento en español versión 1 y se crea si no existe. Sin esa segunda forma
// no habría manera de empezar: la primera generación de un reporte no tiene
// todavía un documento al que apuntar.
// =============================================================================

export async function POST(
  req: Request,
  ctx: { params: Promise<{ destino: string; n: string }> }
) {
  const { destino, n } = await ctx.params;

  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const numero = Number(n);
  if (!Number.isInteger(numero) || numero < 1 || numero > 40) {
    return NextResponse.json({ error: "Número de bloque fuera de rango." }, { status: 400 });
  }

  // Modelo opcional en el cuerpo; solo se acepta uno de la tabla conocida, para
  // que nadie pueda facturar contra un modelo cuyo precio no sabemos calcular.
  let modelo = MODELO_POR_DEFECTO;
  // Regenerar a mano empieza una tanda nueva: los cortes por tiempo anteriores
  // no cuentan. El orquestador NO manda esta bandera, porque su reintento sí es
  // el segundo intento del mismo bloque.
  let reiniciarIntentos = false;
  try {
    const cuerpo = (await req.json()) as { modelo?: string; reiniciarIntentos?: boolean } | null;
    reiniciarIntentos = cuerpo?.reiniciarIntentos === true;
    if (cuerpo?.modelo) {
      if (!esModeloConocido(cuerpo.modelo)) {
        return NextResponse.json({ error: `Modelo desconocido: ${cuerpo.modelo}.` }, { status: 400 });
      }
      modelo = cuerpo.modelo;
    }
  } catch {
    // Sin cuerpo: se usa el modelo por defecto.
  }

  const db = await createClient();
  const resuelto = await resolverDocumento(db, destino, perfil.id);
  if ("error" in resuelto) {
    return NextResponse.json({ error: resuelto.error }, { status: resuelto.status });
  }

  // --- La ruta NO espera a la generación ------------------------------------
  // Un bloque tarda entre 20 y 40 segundos y el router de Heroku corta a los 30.
  // Se marca 'generando', se responde de inmediato, y la llamada al modelo corre
  // en after(), que se ejecuta después de enviar la respuesta. El cliente
  // consulta cada dos segundos hasta que el estado cambie.
  const marca = await marcarGenerando(db, resuelto.documentoId, numero, reiniciarIntentos);
  if (!marca.ok) {
    return NextResponse.json({ error: marca.error }, { status: marca.status });
  }

  after(async () => {
    // TODO lo de dentro va en try/catch. Una excepción aquí no la ve nadie: la
    // respuesta ya salió, el cliente sigue consultando, y el bloque se queda en
    // 'generando' hasta que vence a los tres minutos. El síntoma —«tiempo
    // excedido»— no se parece en nada a la causa.
    let r: Awaited<ReturnType<typeof generarBloque>>;
    try {
      r = await generarBloque(db, resuelto.documentoId, numero, { modelo });
    } catch (e) {
      const detalle = e instanceof Error ? `${e.message}` : String(e);
      console.error(`[suplemento] bloque ${numero} lanzó:`, e);
      await db
        .from("documentos_bloques")
        .update({
          estado: "error",
          pendientes: [{ campo: "generacion", motivo: detalle }],
          updated_at: new Date().toISOString(),
        })
        .eq("documento_id", resuelto.documentoId)
        .eq("numero", numero);
      return;
    }

    // SIN SALDO NO ES UN FALLO DEL BLOQUE. Vuelve A LA COLA, no a 'error': no
    // hay nada que reintentar hasta que haya crédito, y marcarlo error haría
    // que alguien fuera a buscar un problema en el prompt. El estado dice la
    // verdad —espera turno— y el motivo dice por qué.
    if (!r.ok && r.motivo === "sin_saldo") {
      await db
        .from("documentos_bloques")
        .update({
          estado: "en_cola",
          reclamado_en: null,
          pendientes: [{ campo: "generacion", motivo: "Sin saldo en la API; el bloque vuelve a la cola." }],
          updated_at: new Date().toISOString(),
        })
        .eq("documento_id", resuelto.documentoId)
        .eq("numero", numero);
      console.error(`[suplemento] saldo agotado; el bloque ${numero} vuelve a la cola.`);
    }

    // CORTE POR TIEMPO: primera vez vuelve a la cola, segunda es error. Un
    // bloque puede pasarse de los 150 s por carga del API y salir bien al
    // siguiente tiro; si se pasa dos veces seguidas ya no es mala suerte, y
    // reencolarlo indefinidamente dejaría al orquestador dando vueltas.
    if (!r.ok && r.motivo === "corte_tiempo") {
      const { data: previo } = await db
        .from("documentos_bloques")
        .select("intentos")
        .eq("documento_id", resuelto.documentoId)
        .eq("numero", numero)
        .maybeSingle();
      const intentos = (previo?.intentos ?? 0) + 1;
      const agotado = intentos >= 2;
      await db
        .from("documentos_bloques")
        .update({
          estado: agotado ? "error" : "en_cola",
          reclamado_en: null,
          intentos,
          pendientes: [
            {
              campo: "generacion",
              motivo: agotado
                ? `corte por tiempo dos veces seguidas (${r.detalle})`
                : `corte por tiempo; el bloque vuelve a la cola (${r.detalle})`,
            },
          ],
          updated_at: new Date().toISOString(),
        })
        .eq("documento_id", resuelto.documentoId)
        .eq("numero", numero);
      console.error(
        `[suplemento] bloque ${numero}: ${r.detalle}; intento ${intentos} → ${agotado ? "error" : "en_cola"}.`
      );
    }

    await logEvento(db, {
      tenantId: resuelto.tenantId,
      usuarioId: perfil.id,
      accion: "suplemento_bloque_generado",
      entidad: "documentos_generados",
      entidadId: resuelto.documentoId,
      detalle: r.ok
        ? {
            bloque: numero,
            modelo: r.modelo,
            costo_usd: r.costo,
            duracion_ms: r.duracionMs,
            intentos: r.intentos,
            pendientes: r.pendientes.length,
            notas_revision: r.notasRevision.length,
          }
        : { bloque: numero, modelo, fallo: r.motivo, detalle: r.detalle },
    });
  });

  return NextResponse.json(
    {
      documentoId: resuelto.documentoId,
      bloque: numero,
      estado: "generando",
      // El cliente consulta aquí cada 2 s hasta que `estado` deje de ser
      // 'generando'. Un bloque que lleve más de 3 minutos así lo pasa a 'error'
      // la propia consulta: si el proceso murió, nadie más lo va a hacer.
      consultarEn: `/api/suplemento/${resuelto.documentoId}/bloque/${numero}`,
    },
    { status: 202 }
  );
}

/**
 * Estado del bloque, para la consulta cada dos segundos. Es también quien vence
 * los bloques colgados: un 'generando' de más de tres minutos significa que el
 * proceso que lo tomó ya no existe —un dyno reiniciado, un after() interrumpido—
 * y nadie más lo va a cerrar.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ destino: string; n: string }> }
) {
  const { destino: documento, n } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const db = await createClient();
  const { data: b } = await db
    .from("documentos_bloques")
    .select(
      "numero, titulo, estado, texto, fuentes, pendientes, modelo, prompt_version, tokens_entrada, tokens_entrada_cache_escritura, tokens_entrada_cache_lectura, tokens_salida, costo_usd, duracion_ms, generado_en, reclamado_en"
    )
    .eq("documento_id", documento)
    .eq("numero", Number(n))
    .maybeSingle();

  if (!b) return NextResponse.json({ error: "Ese bloque no se ha generado." }, { status: 404 });

  // Solo vence lo que está REALMENTE en curso. Un bloque 'en_cola' espera su
  // turno todo lo que haga falta: generar tarda entre 30 y 46 segundos, pero
  // esperar sitio en una cola de cuarenta con concurrencia 3 son minutos.
  if (b.estado === "generando" && vencido(b.reclamado_en)) {
    await db
      .from("documentos_bloques")
      .update({
        estado: "error",
        pendientes: [{ campo: "generacion", motivo: "tiempo excedido" }],
        updated_at: new Date().toISOString(),
      })
      .eq("documento_id", documento)
      .eq("numero", Number(n));
    return NextResponse.json({ ...b, estado: "error", motivo: "tiempo excedido", reintentable: true });
  }

  return NextResponse.json(b);
}

const LIMITE_GENERANDO_MS = 3 * 60 * 1000;

/** Un reclamo sin fecha se considera vencido: nadie lo está generando. */
const vencido = (reclamadoEn: string | null): boolean =>
  !reclamadoEn || Date.now() - new Date(reclamadoEn).getTime() > LIMITE_GENERANDO_MS;

/**
 * RESERVA EL BLOQUE DE FORMA ATÓMICA.
 *
 * Un solo `UPDATE ... WHERE` con `RETURNING`: o la fila cambia de 'en_cola' a
 * 'generando' y esta petición la tiene, o no cambia y esta petición no genera.
 * No hay lectura previa que otra petición pueda adelantar entre el SELECT y el
 * UPDATE, que es donde se colaban dos generaciones del mismo bloque —y se
 * pagaban las dos—.
 *
 * QUÉ SE PUEDE RECLAMAR: lo que está en cola, lo que ya terminó (regenerar), lo
 * que falló, y lo que lleva más de tres minutos 'generando' porque quien lo tomó
 * ya no existe. Lo único que NO se puede reclamar es un 'generando' reciente.
 */
async function marcarGenerando(
  db: Awaited<ReturnType<typeof createClient>>,
  documentoId: string,
  numero: number,
  reiniciarIntentos: boolean
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const bloque = BLOQUES.find((x) => x.numero === numero);
  if (!bloque) return { ok: false, error: "Bloque fuera de rango.", status: 400 };

  const ahora = new Date().toISOString();
  const limite = new Date(Date.now() - LIMITE_GENERANDO_MS).toISOString();

  const { data: tomado, error } = await db
    .from("documentos_bloques")
    .update({
      estado: "generando",
      reclamado_en: ahora,
      updated_at: ahora,
      ...(reiniciarIntentos ? { intentos: 0 } : {}),
    })
    .eq("documento_id", documentoId)
    .eq("numero", numero)
    // Cualquier estado menos un 'generando' fresco. `reclamado_en` nulo cuenta
    // como vencido: una fila en 'generando' sin fecha de reclamo es de antes de
    // que existiera la columna, y nadie la está generando.
    .or(`estado.neq.generando,reclamado_en.is.null,reclamado_en.lt.${limite}`)
    .select("numero");

  if (error) return { ok: false, error: `No se pudo reservar el bloque: ${error.message}`, status: 500 };
  if (tomado && tomado.length > 0) return { ok: true };

  // Cero filas: o la tiene otra petición, o no existe. Se distingue mirando.
  const { data: existe } = await db
    .from("documentos_bloques")
    .select("numero")
    .eq("documento_id", documentoId)
    .eq("numero", numero)
    .maybeSingle();

  if (existe) return { ok: false, error: "Ese bloque ya se está generando.", status: 409 };

  // No existía: se crea ya reclamado. Si dos peticiones llegan aquí a la vez, la
  // clave única (documento_id, numero) deja pasar una sola; la otra recibe 409.
  const { error: errIns } = await db.from("documentos_bloques").insert({
    documento_id: documentoId,
    numero,
    clave: bloque.clave,
    titulo: bloque.titulo,
    seccion: bloque.seccion,
    estado: "generando",
    texto: null,
    pendientes: [],
    fuentes: [],
    reclamado_en: ahora,
    generado_en: ahora,
    updated_at: ahora,
  });
  if (errIns) return { ok: false, error: "Ese bloque ya se está generando.", status: 409 };
  return { ok: true };
}

type Resuelto = { documentoId: string; tenantId: string } | { error: string; status: number };

async function resolverDocumento(
  db: Awaited<ReturnType<typeof createClient>>,
  destino: string,
  usuarioId: string
): Promise<Resuelto> {
  const { data: doc } = await db
    .from("documentos_generados")
    .select("id, tenant_id")
    .eq("id", destino)
    .maybeSingle();
  if (doc) return { documentoId: doc.id, tenantId: doc.tenant_id };

  // No es un documento: ¿es un reporte? RLS ya acota lo que este usuario ve, así
  // que un reporte de otra emisora simplemente no aparece.
  const { data: rep } = await db
    .from("reportes")
    .select("id, tenant_id, ejercicio, anio_adopcion, alivios")
    .eq("id", destino)
    .maybeSingle();
  if (!rep) return { error: "No existe ese documento ni ese reporte.", status: 404 };

  const { data: existente } = await db
    .from("documentos_generados")
    .select("id, tenant_id")
    .eq("reporte_id", rep.id)
    .eq("tipo", "suplemento_s1s2")
    .eq("idioma", "es")
    .eq("version", 1)
    .maybeSingle();
  if (existente) return { documentoId: existente.id, tenantId: existente.tenant_id };

  // El régimen se CONGELA al crear el documento: si mañana cambian los alivios
  // del reporte, este documento sigue explicándose con los que tenía.
  const { data: creado, error } = await db
    .from("documentos_generados")
    .insert({
      tenant_id: rep.tenant_id,
      reporte_id: rep.id,
      tipo: "suplemento_s1s2",
      idioma: "es",
      version: 1,
      estado: "borrador",
      regimen: regimenDe(rep.ejercicio, rep.anio_adopcion),
      alivios: rep.alivios ?? {},
      generado_por: usuarioId,
    })
    .select("id, tenant_id")
    .single();

  if (error || !creado) {
    return { error: "No se pudo crear el documento.", status: 500 };
  }
  void leerAlivios(rep.alivios);
  return { documentoId: creado.id, tenantId: creado.tenant_id };
}
