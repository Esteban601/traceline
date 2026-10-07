import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ensamblarReporte, type EntregaSolicitud, type SolRow } from "@/lib/reporte/ensamblar";
import { evaluarCompletitud, type BloqueEvaluado } from "@/lib/suplemento/completitud";
import {
  BLOQUES,
  bloqueSeleccionado,
  datapointsExentos,
  rubroExento,
  type Bloque,
} from "@/lib/suplemento/bloques";
import { leerAlivios, regimenDe, ALIVIOS, type Alivios, type Regimen } from "@/lib/perfil-emisor";
import {
  MODELOS,
  MODELO_POR_DEFECTO,
  costoUsd,
  esfuerzoDeTipo,
  modeloDeTipo,
  type ClaveModelo,
  type Esfuerzo,
  type Uso,
} from "@/lib/suplemento/modelos";
import {
  ESQUEMA_SALIDA,
  ESQUEMA_SALIDA_HECHOS_V3,
  PROMPT_VERSION,
  PROMPT_VERSION_HECHOS,
  capaEstable,
  capaVolatil,
  marcadoresMalFormados,
  normalizarDenominacion,
  vocabularioProhibidoEn,
  type FuenteEntregada,
  type RequisitoNiif,
} from "@/lib/suplemento/prompt";
import { fronteraDe } from "@/lib/suplemento/fronteras";
import { TABLAS } from "@/lib/suplemento/tablas";
import { cargarEvidenciasDelBloque, respaldoDeCifras, type EvidenciaDelBloque, type RespaldoDeCifra } from "@/lib/suplemento/evidencias-bloque";
import { cargarAdjuntosDelBloque, documentosParaPrompt, type AdjuntosDelBloque } from "@/lib/suplemento/adjuntos-bloque";
import { cargarLiteral } from "@/lib/suplemento/texto-del-emisor";
import { libroVigente } from "@/lib/suplemento/hechos/libro";
import { insumoDelBloque, validarCobertura, type Cobertura } from "@/lib/suplemento/hechos/bloque";
import { cambiosNegados, incisosInexactos, rangosIncoherentes, referenciasReescritas, type Matriz } from "@/lib/suplemento/hechos/validadores";
import { separarAnclas, type Ancla } from "@/lib/suplemento/hechos/anclas";
import { aplicarGlosario, leerGlosario } from "@/lib/suplemento/glosario";
import { defectosDeInsumo } from "@/lib/suplemento/prevuelo";
import { cifrasSinRespaldo, corpusPermitido } from "@/lib/suplemento/cifras";
import { extensionDe as extensionDeBloque, viaDe, type Via } from "@/lib/suplemento/vias";
import { PLANTILLAS } from "@/lib/suplemento/plantillas";
import { ETIQUETA_CAMPO, SECCION_DE_CAMPO } from "@/lib/suplemento/completitud";

// =============================================================================
// GENERACIÓN DE UN BLOQUE DEL SUPLEMENTO.
//
// Recibe un documento y un bloque, arma el prompt con los datos REALES de ese
// reporte y persiste lo que el modelo devuelve, con su costo y su procedencia.
//
// TRES COSAS QUE ESTE ARCHIVO HACE Y NO SE PUEDEN QUITAR:
//
//  1. COMPRUEBA EL AISLAMIENTO ANTES DE ARMAR NADA. El reporte tiene que
//     pertenecer al tenant del documento. Es una consulta de dos columnas y va
//     primero: armar un prompt con datos de otra emisora y luego descubrirlo ya
//     habría mandado esos datos al modelo.
//
//  2. VERIFICA LAS FUENTES CITADAS. El modelo devuelve `fuentes_usadas`; si
//     contiene un id que no se le entregó, la respuesta se rechaza. Un id
//     inventado es la señal más barata de que el texto también lo es. Se
//     reintenta UNA vez explicándole el error concreto.
//
//  3. GUARDA EL COSTO CON SU DESGLOSE. Entrada sin cachear, escritura al caché y
//     lectura del caché se cobran a precios distintos; un solo total no permite
//     reconstruir ni auditar la factura.
//
// NO DECIDE si el bloque "está completo": eso lo dice `evaluarCompletitud`, que
// es la misma función que pinta el semáforo. Aquí solo se consume.
// =============================================================================

type Cliente = SupabaseClient<Database>;

export type MotivoFallo =
  | "sin_api_key"
  | "documento_no_existe"
  | "bloque_no_existe"
  | "reporte_ajeno"
  | "reporte_ilegible"
  | "fuentes_invalidas"
  | "voz_incorrecta"
  | "cifras_sin_respaldo"
  | "pendiente_adjunto"
  | "no_aplica"
  | "no_seleccionado"
  | "literal_invalido"
  | "cobertura_invalida"
  | "respuesta_ilegible"
  | "api_error"
  | "corte_tiempo"
  | "sin_saldo";

export type ResultadoGeneracion =
  | {
      ok: true;
      texto: string;
      fuentesUsadas: string[];
      pendientes: string[];
      /** Juicios para el revisor. NO se publican. */
      notasRevision: string[];
      /** La tabla que arma el código y va delante del texto, si el bloque lleva. */
      tabla: string | null;
      modelo: ClaveModelo;
      uso: Uso;
      costo: number;
      duracionMs: number;
      /** Cuántos intentos hicieron falta. 2 = el primero fue rechazado. */
      intentos: number;
      correccionesGrafia: number;
      /** Por dónde se produjo: plantilla, perfil o datos. */
      via: Via;
      /** false cuando el bloque se resolvió sin llamar al modelo. */
      conModelo: boolean;
      bloque: BloqueEvaluado;
    }
  | { ok: false; motivo: MotivoFallo; detalle: string };

export type OpcionesGeneracion = {
  modelo?: ClaveModelo;
  /** Sobrescribe el esfuerzo del tipo de bloque. Para barridos de medición. */
  esfuerzo?: Esfuerzo;
  /** Instrucción de extensión. Por bloque, porque no todos piden lo mismo. */
  extension?: string;
  /** Solo para pruebas: no escribe en documentos_bloques. */
  sinPersistir?: boolean;
  /**
   * Solo para pruebas (exige sinPersistir): sustituye la respuesta del modelo
   * por este texto y corre los MISMOS validadores contra los datos reales del
   * bloque. No llama a la API ni cuesta. Es lo que prueba que el validador de
   * cifras rechaza una cifra que solo está en el documento de respaldo.
   */
  salidaDePrueba?: { texto: string; fuentes_usadas: string[] };
  /**
   * Modo libro (Paso 5b): veredicto del validador cruzado sobre la versión
   * anterior del bloque —p. ej. «el bloque 18 afirma la fecha de creación que
   * aquí quedó pendiente»—. Va al final de la capa volátil.
   */
  correccion?: string;
  /**
   * Medición (Paso 5b, punto 9): recibe el tamaño en caracteres de cada bloque
   * estable y de cada sección («# …») de la capa volátil, antes de la llamada.
   */
  medir?: (m: { estable: number[]; volatil: Record<string, number>; datos: Record<string, number> }) => void;
};


/** Corte de la llamada al modelo. Por debajo del vencimiento de 3 minutos del
 *  bloque, para que el error llegue antes que el síntoma. */
const LIMITE_LLAMADA_MS = 150_000;

export async function generarBloque(
  supabase: Cliente,
  documentoId: string,
  bloqueId: number | string,
  opciones: OpcionesGeneracion = {}
): Promise<ResultadoGeneracion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Sin modo de respaldo a propósito: un suplemento a medias que parece
    // completo es peor que uno que no se generó.
    return {
      ok: false,
      motivo: "sin_api_key",
      detalle: "Falta ANTHROPIC_API_KEY. El generador no tiene modo de respaldo.",
    };
  }

  const bloque = resolverBloque(bloqueId);
  if (!bloque) {
    return { ok: false, motivo: "bloque_no_existe", detalle: `No hay bloque ${bloqueId}.` };
  }

  // --- 1. Documento, y el aislamiento ANTES de cualquier otra consulta --------
  const { data: doc } = await supabase
    .from("documentos_generados")
    .select("id, tenant_id, reporte_id, idioma, editoriales_incluidos, textos_literales")
    .eq("id", documentoId)
    .maybeSingle();

  if (!doc) {
    return { ok: false, motivo: "documento_no_existe", detalle: "El documento no existe o no es visible." };
  }

  // Un editorial que el documento no lleva no se genera (encargo
  // suplemento-calidad): no cuesta una llamada ni toca su fila.
  if (!bloqueSeleccionado(bloque, doc.editoriales_incluidos ?? null)) {
    return { ok: false, motivo: "no_seleccionado", detalle: "Este bloque editorial no está seleccionado en el documento." };
  }

  const { data: rep } = await supabase
    .from("reportes")
    .select("id, tenant_id, anio_adopcion, alivios")
    .eq("id", doc.reporte_id)
    .maybeSingle();

  if (!rep) {
    return { ok: false, motivo: "reporte_ilegible", detalle: "No se pudo leer el reporte del documento." };
  }
  if (rep.tenant_id !== doc.tenant_id) {
    // No debería poder pasar —la FK y la RLS lo impiden— pero es la barrera que
    // decide si los datos de una emisora salen hacia el modelo. Se comprueba.
    return {
      ok: false,
      motivo: "reporte_ajeno",
      detalle: "El reporte no pertenece al tenant del documento.",
    };
  }

  // --- 2. Datos -------------------------------------------------------------
  const ens = await ensamblarReporte(supabase, doc.reporte_id);
  if (!ens.ok) {
    return { ok: false, motivo: "reporte_ilegible", detalle: `Ensamblado: ${ens.causa}.` };
  }

  const comp = await evaluarCompletitud(supabase, doc.reporte_id);
  if (!comp.ok) {
    return { ok: false, motivo: "reporte_ilegible", detalle: `Completitud: ${comp.causa}.` };
  }
  const evaluado = comp.bloques.find((b) => b.clave === bloque.clave)!;

  const { data: perfil } = await supabase
    .from("perfil_emisor")
    .select("*")
    .eq("tenant_id", doc.tenant_id)
    .maybeSingle();

  const regimen = regimenDe(ens.reporte.ejercicio, rep.anio_adopcion);
  const alivios = leerAlivios(rep.alivios);
  const vigentes = regimen === "primer_anio" ? alivios : {};
  const aliviosActivos = ALIVIOS.filter((a) => alivios[a.clave]).map((a) => a.titulo);

  // Lo que un alivio exime no llega al prompt. Dárselo y pedirle que lo ignore
  // es invitarlo a explicar por qué lo ignora, que es lo que hacía antes.
  const exentos = datapointsExentos(vigentes);
  const requisitos = await leerRequisitos(
    supabase,
    bloque.datapoints.filter((d) => !exentos.has(d))
  );

  // LIBRO DE HECHOS (suplemento-calidad, Paso 5.3). Si el reporte tiene libro,
  // el bloque redacta SOLO desde sus hechos y referencias: ni evidencias crudas
  // ni adjuntos completos. Sin libro, el camino de antes.
  const libro = await libroVigente(supabase, doc.reporte_id);
  const insumo = libro ? await insumoDelBloque(supabase, libro.id, bloque, doc.editoriales_incluidos ?? null) : null;
  // Glosario del emisor, matriz y defectos de insumo de nivel documento (Paso 5.4).
  const glosario = leerGlosario(perfil?.glosario);
  const matriz = (perfil?.matriz_riesgos ?? null) as Matriz;
  const defectosDocumento = libro
    ? defectosDeInsumo(((await supabase.from("libros_hechos").select("resumen").eq("id", libro.id).single()).data?.resumen ?? null) as never, matriz)
    : [];

  // Evidencias de las solicitudes del bloque: contenido ya extraído y extractos
  // confirmados (captura sugerida, Paso 5). Contexto y citas, no cifras.
  // Documentos del Perfil del emisor (suplemento-calidad, Paso 2): las partes
  // más pertinentes a lo que este bloque cubre. Contexto y citas, no cifras.
  const consulta = [
    bloque.titulo,
    fronteraDe(bloque.numero).cubre,
    ...requisitos.map((r) => r.descripcion),
    ...bloque.perfil.map((c) => ETIQUETA_CAMPO[c] ?? c),
  ].join("\n");
  const [evid, respaldos, adjuntos] = await Promise.all([
    cargarEvidenciasDelBloque(supabase, [...evaluado.solicitudes]),
    respaldoDeCifras(supabase, [...evaluado.solicitudes], ens.reporte.ejercicio),
    cargarAdjuntosDelBloque(supabase, doc.tenant_id, bloque, consulta),
  ]);
  const { fuentes, datos } = armarDatos(bloque, ens, evaluado, perfil, requisitos, evid.porSolicitud, respaldos.porSolicitud);
  if (!insumo) for (const f of [...evid.fuentes, ...respaldos.fuentes, ...adjuntos.fuentes]) if (!fuentes.some((x) => x.id === f.id)) fuentes.push(f);

  // --- 3. ¿Hace falta el modelo? --------------------------------------------
  const via = viaDe(bloque.numero);
  const prefs = {
    denominacionFormal: (perfil?.denominacion_formal as string | null) ?? null,
    nombreCorto: (perfil?.nombre_corto as string | null) ?? null,
    formaDeReferencia: (perfil?.forma_de_referencia as string | null) ?? null,
  };

  // Un bloque que el régimen excluye no se genera: se marca y ya. Gastar una
  // llamada en redactar algo que no va al documento es tirar el dinero.
  if (evaluado.estado === "no_aplica") {
    if (!opciones.sinPersistir) {
      await persistirEstado(supabase, documentoId, bloque, doc.idioma, "no_aplica", [
        { campo: "regimen", motivo: evaluado.motivoNoAplica ?? "El régimen excluye este bloque." },
      ]);
    }
    return { ok: false, motivo: "no_aplica", detalle: evaluado.motivoNoAplica ?? "El régimen excluye este bloque." };
  }

  // TEXTO DEL EMISOR SIN REESCRIBIR (Paso 3): el editorial lleva el texto
  // literal del adjunto elegido, con su cita. Sin modelo, sin validador de
  // cifras ni de voz —es el texto del emisor, no uno nuestro— y costo cero. Una
  // regeneración lo vuelve a copiar; nunca lo reescribe.
  const adjuntoLiteral = (doc.textos_literales as Record<string, string> | null)?.[bloque.clave];
  if (adjuntoLiteral) {
    const lit = await cargarLiteral(supabase, doc.tenant_id, bloque, adjuntoLiteral);
    const uso: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
    if (!lit.ok) {
      if (!opciones.sinPersistir) {
        await persistirFallo(supabase, documentoId, bloque, doc.idioma, {
          modelo: MODELO_POR_DEFECTO, uso, costo: 0, duracionMs: 0, motivo: `Texto literal: ${lit.error}`,
        });
      }
      return { ok: false, motivo: "literal_invalido", detalle: lit.error };
    }
    if (!opciones.sinPersistir) {
      await persistirBloque(supabase, documentoId, bloque, doc.idioma, {
        texto: lit.texto,
        fuentes: lit.fuentes,
        pendientes: [],
        notasRevision: [`Texto del emisor copiado sin reescribir de ${lit.archivo}. No pasó por el modelo ni por el validador de cifras: revisar que sea el texto que la emisora quiere publicar.`],
        tabla: null,
        modelo: MODELO_POR_DEFECTO,
        uso,
        costo: 0,
        duracionMs: 0,
        textoDelEmisor: true,
      });
    }
    return {
      ok: true, texto: lit.texto, fuentesUsadas: lit.fuentes.map((f) => f.id), pendientes: [], notasRevision: [], tabla: null,
      modelo: MODELO_POR_DEFECTO, uso, costo: 0, duracionMs: 0, intentos: 0, correccionesGrafia: 0, via, conModelo: false, bloque: evaluado,
    };
  }

  if (via === "plantilla") {
    return await resolverPlantilla(supabase, documentoId, bloque, doc.idioma, {
      prefs,
      ejercicio: ens.reporte.ejercicio,
      regimen,
      anioAdopcion: rep.anio_adopcion,
      alivios,
      nombreReporte: ens.reporte.nombre,
      sinPersistir: !!opciones.sinPersistir,
      evaluado,
    });
  }

  // Con libro, el adjunto ya entró como hechos: no hay nada que esperar.
  if (via === "perfil" && !insumo) {
    const { data: adj } = await supabase
      .from("perfil_emisor_adjuntos")
      .select("seccion")
      .eq("tenant_id", doc.tenant_id);
    const espera = esperaAdjunto(bloque, perfil, new Set((adj ?? []).map((a) => a.seccion)), adjuntos);
    if (espera) {
      if (!opciones.sinPersistir) {
        await persistirEstado(supabase, documentoId, bloque, doc.idioma, "pendiente_adjunto", espera);
      }
      return { ok: false, motivo: "pendiente_adjunto", detalle: espera.map((e) => e.motivo).join(" ") };
    }
  }

  // --- 4. Prompt ------------------------------------------------------------
  const modelo = opciones.modelo ?? modeloDeTipo(bloque.tipo);
  const constructor = TABLAS[bloque.numero];
  const tabla = constructor ? constructor({ ens, evaluado, perfil, alivios: vigentes, fuentes }) : null;
  // MODO LIBRO: las fuentes citables son los hechos del bloque (h1, h2…), lo que
  // la tabla cite y el reporte; los datos, sus hechos y referencias de una línea.
  const fuentesModelo = insumo
    ? [
        // Sin extracto: ya va en `hechos` (Paso 5b, punto 9: no pagar dos veces lo mismo).
        ...insumo.hechos.map((h) => ({ id: h.id, tipo: "hecho" as const, detalle: h.fuente })),
        ...fuentes.filter((f) => f.id.startsWith("reporte:") || (tabla ?? "").includes(f.id)),
      ]
    : fuentes;
  const datosModelo = insumo
    ? {
        bloque: (datos as { bloque: unknown }).bloque,
        estado_de_completitud: (datos as { estado_de_completitud: unknown }).estado_de_completitud,
        remitir_a_otro_bloque: (datos as { remitir_a_otro_bloque: unknown }).remitir_a_otro_bloque,
        hechos: insumo.hechos.map((h) => ({
          id: h.id,
          rango: h.rango,
          enunciado: h.enunciado,
          extracto: h.extracto,
          fuente: h.fuente,
          ...(h.valor != null ? { valor: h.valor, unidad: h.unidad } : {}),
          ...(h.contradiccion ? { contradiccion: h.contradiccion.grupo } : {}),
        })),
        // Una vez por grupo, no una por hecho (Paso 5b, punto 9).
        contradicciones: Object.fromEntries(
          insumo.hechos
            .filter((h) => h.contradiccion)
            .map((h) => [
              h.contradiccion!.grupo,
              {
                veredicto: h.contradiccion!.veredicto,
                ...(h.contradiccion!.veredicto === "excluyente" ? { explicacion: h.contradiccion!.explicacion } : { conciliacion: h.contradiccion!.conciliacion }),
              },
            ])
        ),
        // De una línea: `completo` es para el validador, no para el modelo.
        referencias: insumo.referencias.map((r) => ({ texto: r.texto, bloque: r.bloque, titulo: r.titulo })),
      }
    : datos;
  // Después de la tabla: lo que ella cite también es fuente válida.
  const idsValidos = new Set(fuentesModelo.map((f) => f.id));
  const estables = capaEstable(bloque, prefs, requisitos, doc.editoriales_incluidos ?? null, insumo ? "hechos" : "datos", glosario);
  // Lo que respalda una cifra: los datos entregados SIN el contenido crudo de
  // las evidencias, más la tabla, los requisitos y los nombres de la emisora.
  // En modo libro, solo los hechos validados o del Perfil (regla 10).
  const corpus = corpusPermitido(
    insumo
      ? insumo.hechos.filter((h) => h.rango !== "adjunto").map((h) => ({ e: h.enunciado, x: h.extracto, v: h.valor }))
      : datos,
    tabla,
    JSON.stringify(requisitos),
    bloque.titulo,
    prefs.denominacionFormal,
    prefs.nombreCorto
  );
  const aniosPermitidos = [ens.reporte.ejercicio, ens.reporte.ejercicio - 1];

  const volatil = capaVolatil({
    bloque,
    regimen,
    anioAdopcion: rep.anio_adopcion,
    aliviosActivos,
    ejercicio: ens.reporte.ejercicio,
    fuentes: fuentesModelo,
    datos: datosModelo,
    tabla,
    fronteras: fronteraDe(bloque.numero),
    extension: opciones.extension ?? extensionDeBloque(bloque.numero),
    documentos: insumo ? null : documentosParaPrompt(adjuntos),
    requisitos: insumo ? requisitos : null,
    defectosDocumento,
  });

  if (opciones.medir) {
    const secciones: Record<string, number> = {};
    let actual = "(inicio)";
    for (const linea of volatil.split("\n")) {
      if (/^# /.test(linea)) actual = linea.slice(2, 60);
      secciones[actual] = (secciones[actual] ?? 0) + linea.length + 1;
    }
    const datosPorClave = Object.fromEntries(
      Object.entries(datosModelo as Record<string, unknown>).map(([k, v]) => [`${k}${Array.isArray(v) ? ` (${v.length})` : ""}`, JSON.stringify(v ?? null).length])
    );
    opciones.medir({ estable: estables.map((b) => b.texto.length), volatil: secciones, datos: datosPorClave });
  }

  // La marca de caché va en el ÚLTIMO bloque estable: el caché cubre todo el
  // prefijo hasta ese punto, así que marcar el último marca los tres.
  const system = estables.map((b, i) => ({
    type: "text" as const,
    text: b.texto,
    ...(i === estables.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  if (opciones.salidaDePrueba && opciones.sinPersistir) {
    const p = opciones.salidaDePrueba;
    const inventadas = p.fuentes_usadas.filter((f) => !idsValidos.has(f));
    const sinRespaldo = cifrasSinRespaldo(p.texto, corpus, aniosPermitidos);
    const prohibidas = vocabularioProhibidoEn(p.texto);
    if (inventadas.length) return { ok: false, motivo: "fuentes_invalidas", detalle: `Citó fuentes que no se le entregaron: ${inventadas.join(", ")}.` };
    if (sinRespaldo.length) return { ok: false, motivo: "cifras_sin_respaldo", detalle: `Cifras sin respaldo en los datos confirmados: ${sinRespaldo.join(", ")}.` };
    if (prohibidas.length) return { ok: false, motivo: "voz_incorrecta", detalle: `El texto usa vocabulario de proceso interno: ${prohibidas.join(", ")}.` };
    return {
      ok: true, texto: p.texto, fuentesUsadas: p.fuentes_usadas, pendientes: [], notasRevision: [], tabla,
      modelo, uso: { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 }, costo: 0, duracionMs: 0,
      intentos: 0, correccionesGrafia: 0, via, conModelo: false, bloque: evaluado,
    };
  }

  // --- 4. Llamada, con un reintento si cita una fuente inexistente -----------
  const client = new Anthropic({ apiKey });
  const mensajes: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: opciones.correccion && insumo
        ? `${volatil}\n\n# Veredicto del validador cruzado sobre tu versión anterior\n\n${opciones.correccion}\n\nCorrígelo en esta versión.`
        : volatil,
    },
  ];
  // Anclas por oración (modo libro): se separan del texto antes de validar.
  let anclasFinales: Ancla[] | null = null;
  const inicio = Date.now();
  let uso: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  let salida: SalidaModelo | null = null;
  let ultimoError = "";

  for (let intento = 1; intento <= 2; intento++) {
    let respuesta: Anthropic.Message;
    // RELOJ PROPIO. El `timeout` del SDK cubre el establecimiento de la
    // respuesta, no la duración del stream: el bloque 21 tardó 305 s con un
    // `timeout` de 150 s y no abortó nunca. El AbortController mide tiempo de
    // pared sobre el consumo completo del stream, que es lo que realmente se
    // nos va de las manos. Va FUERA del try porque el catch tiene que poder
    // preguntarle si el fallo fue suyo.
    const reloj = new AbortController();
    const alarma = setTimeout(() => reloj.abort(), LIMITE_LLAMADA_MS);
    try {
      const stream = client.messages.stream(
        {
        model: modelo,
        max_tokens: 16000,
        system,
        messages: mensajes,
        output_config: {
          // `high` es el valor por defecto del API; pasarlo explícito es idéntico
          // a omitirlo, y deja el barrido de esfuerzo a un cambio de una línea
          // en ESFUERZO_POR_TIPO.
          effort: opciones.esfuerzo ?? esfuerzoDeTipo(bloque.tipo),
          format: { type: "json_schema", schema: insumo ? ESQUEMA_SALIDA_HECHOS_V3 : ESQUEMA_SALIDA },
        },
        },
        // LÍMITE DURO. Sin él, un stream que se atasca deja la petición colgada
        // para siempre: el bloque se queda en 'generando', el cliente consulta
        // hasta que el vencimiento de tres minutos lo marca «tiempo excedido», y
        // la tarea sigue viva en el servidor consumiendo una conexión. Se corta
        // por debajo de ese vencimiento para que el fallo llegue con su motivo
        // en vez de con el síntoma.
        // maxRetries en 0: el SDK reintenta ANTES de rendirse, así que con 1 el
        // corte efectivo eran 300 s, por encima del vencimiento del bloque. El
        // reintento que sí queremos es el nuestro, que además explica el error.
        { timeout: LIMITE_LLAMADA_MS, maxRetries: 0, signal: reloj.signal }
      );
      // finalMessage() consume el stream entero, así que el aborto lo alcanza a
      // mitad de camino y no solo en la cabecera.
      respuesta = await stream.finalMessage();
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      // CORTE POR TIEMPO. No es un fallo del prompt ni del API: el bloque
      // sencillamente no cupo en la ventana. Vuelve a la cola y cuenta un
      // intento; al segundo corte sí es error, porque entonces ya no es mala
      // suerte.
      if (reloj.signal.aborted) {
        return {
          ok: false,
          motivo: "corte_tiempo",
          detalle: `corte por tiempo (${LIMITE_LLAMADA_MS / 1000} s)`,
        };
      }
      // SALDO AGOTADO ES DEFINITIVO. No es un fallo del bloque ni del prompt: no
      // hay reintento que lo arregle, y seguir con los otros treinta y nueve
      // produce treinta y nueve errores idénticos que tapan la causa. Se
      // distingue para que quien orquesta pueda parar y dejar el resto EN COLA,
      // que es donde debe esperar a que haya saldo.
      if (/credit balance is too low/i.test(detalle)) {
        return { ok: false, motivo: "sin_saldo", detalle };
      }
      return { ok: false, motivo: "api_error", detalle };
    } finally {
      clearTimeout(alarma);
    }

    // El uso se ACUMULA entre intentos: el reintento también se paga.
    uso = sumarUso(uso, leerUso(respuesta.usage));

    const parseada = leerSalida(respuesta);
    if (!parseada) {
      ultimoError = "La respuesta no vino en el esquema pedido.";
      if (intento === 2) break;
      mensajes.push(
        { role: "assistant", content: textoDe(respuesta) },
        { role: "user", content: `La respuesta anterior no se pudo leer con el esquema pedido. Devuélvela exactamente con las cuatro claves: texto, fuentes_usadas, pendientes, notas_revision.` }
      );
      continue;
    }

    // Modo libro: las anclas [hN] salen del texto antes de validarlo; sus ids
    // cuentan como fuentes usadas.
    let anclasDesconocidas: string[] = [];
    let soloNarrativas: string[] = [];
    let anclas: Ancla[] = [];
    if (insumo) {
      const sep = separarAnclas(parseada.texto);
      parseada.texto = sep.texto;
      anclas = sep.anclas;
      anclasDesconocidas = sep.ids.filter((id) => !idsValidos.has(id));
      for (const id of sep.ids) if (idsValidos.has(id) && !parseada.fuentes_usadas.includes(id)) parseada.fuentes_usadas.push(id);
      const rango = new Map(insumo.hechos.map((h) => [h.id, h.rango]));
      if (bloque.clase === "normativo") {
        soloNarrativas = anclas.filter((a) => a.ids.length && a.ids.every((id) => rango.get(id) === "narrativo")).map((a) => a.oracion.slice(0, 120));
      }
    }

    // Dos rechazos, en orden de gravedad. El primero dice que el texto puede
    // estar inventado; el segundo, que no es publicable.
    const inventadas = [...parseada.fuentes_usadas.filter((f) => !idsValidos.has(f)), ...anclasDesconocidas.filter((id) => !parseada.fuentes_usadas.includes(id))];
    const prohibidas = vocabularioProhibidoEn(parseada.texto);
    const marcadores = marcadoresMalFormados(parseada.texto);
    const sinRespaldo = cifrasSinRespaldo(parseada.texto, corpus, aniosPermitidos);
    // Cobertura por subrequisito, validada por código (modo libro).
    const cobertura = insumo
      ? validarCobertura(
          parseada.cobertura ?? [],
          requisitos.map((r) => r.codigo),
          bloque.numero,
          new Set(insumo.hechos.map((h) => h.id)),
          doc.editoriales_incluidos ?? null,
          parseada.texto,
          new Map(insumo.hechos.map((h) => [h.id, h.rango]))
        )
      : [];
    // Validadores deterministas del modo libro (Paso 5.4): rangos contra la
    // matriz del Perfil y hechos de otros bloques reescritos en vez de remitidos.
    const rangos = insumo ? rangosIncoherentes(parseada.texto, matriz) : [];
    const reescritas = insumo
      ? referenciasReescritas(
          parseada.texto,
          insumo.referencias,
          [...insumo.hechos.map((h) => `${h.enunciado} ${h.extracto}`), ...requisitos.map((r) => r.descripcion), prefs.denominacionFormal ?? "", prefs.formaDeReferencia ?? ""],
          [...glosario.flatMap((e) => [e.canonico, ...e.variantes]), prefs.denominacionFormal ?? "", prefs.nombreCorto ?? "", prefs.formaDeReferencia ?? ""]
        )
      : [];
    // Paso 5b: cambios de proceso negados, incisos mal numerados y oraciones
    // sostenidas solo por la Carta de la Dirección.
    const negados = insumo ? cambiosNegados(parseada.texto, insumo.hechos, ens.reporte.ejercicio) : [];
    const incisos = insumo
      ? incisosInexactos(
          [parseada.texto, ...parseada.notas_revision, ...(parseada.cobertura ?? []).map((c) => c.comentario)],
          requisitos.map((r) => r.codigo)
        )
      : [];
    const deterministas = [
      ...negados.map((h) => `El texto dice que no hubo cambios respecto del periodo anterior, pero este hecho del bloque describe un cambio en el ejercicio: ${h}. Revela el cambio.`),
      ...incisos.map((i) => `«${i}» no es el código de ningún requisito de este bloque: nombra el inciso con el código exacto de «Requisitos de tu bloque».`),
      ...soloNarrativas.map((o) => `«${o}…» se sostiene solo con un hecho narrativo (Carta de la Dirección): acompáñalo de un hecho de otro rango que diga lo mismo o quítalo.`),
      ...rangos.map((r) => `Rango incoherente con la matriz de riesgos del Perfil: ${r}.`),
      ...reescritas.map((r) => `El texto reescribe un hecho que desarrolla el bloque ${r.bloque} («${r.frase}…»): remite a él en una línea, sin repetir su contenido.`),
    ];

    if (inventadas.length === 0 && prohibidas.length === 0 && marcadores.length === 0 && sinRespaldo.length === 0 && cobertura.length === 0 && deterministas.length === 0) {
      salida = parseada;
      anclasFinales = insumo ? anclas : null;
      break;
    }

    const reproches: string[] = [];
    if (inventadas.length) {
      // Un id que no se entregó es la señal más barata de que el texto también
      // se inventó. Se le dice CUÁL, no "hubo un error": un reintento sin el
      // detalle concreto repite el mismo fallo.
      reproches.push(
        `Estos ids de \`fuentes_usadas\` no existen en la lista entregada: ${inventadas.join(", ")}.\n` +
          `Los únicos válidos son:\n${[...idsValidos].map((i) => `- ${i}`).join("\n")}\n` +
          `Cita solo esos. Si una afirmación no tiene fuente que la respalde, quítala o conviértela en un marcador de pendiente.`
      );
    }
    if (sinRespaldo.length) {
      // Cero dato inventado, hecho cumplir: una cifra que no está en lo
      // confirmado no se publica, aunque venga del documento de respaldo.
      reproches.push(
        `Estas cifras del texto no están en los datos confirmados: ${sinRespaldo.join(", ")}.\n` +
          `Las cifras solo pueden salir de \`valor\` de las solicitudes, de la tabla ya armada, de \`texto_confirmado\` o de los demás datos entregados. ` +
          `El contenido de \`documento_de_respaldo\` y el de los documentos de la emisora es contexto: una cifra que solo aparece ahí no la ha confirmado nadie. ` +
          `Tampoco calcules diferencias, porcentajes ni totales. Quita la cifra o, si hace falta, pon en su lugar un marcador [Pendiente: … — …].`
      );
    }
    if (prohibidas.length) {
      reproches.push(
        `El texto usa vocabulario de proceso interno, que no puede aparecer en un informe publicado: ${prohibidas.join(", ")}.\n` +
          `Reescríbelo en voz de la emisora. En vez de "según el inventario entregado y validado, las emisiones fueron X", escribe "las emisiones fueron X". ` +
          `Lo que falte va en el marcador [Pendiente: … — …], que es el único sitio donde puedes nombrar una solicitud o un campo.`
      );
    }
    if (marcadores.length) {
      reproches.push(
        `Estos marcadores no llevan el formato pedido \`[Pendiente: <qué falta> — <de qué solicitud o campo>]\`: ${marcadores.join(" | ")}.\n` +
          `El formato es exacto: corchetes al principio y al final, la palabra Pendiente seguida de dos puntos, y raya larga (—) entre qué falta y de dónde sale. ` +
          `Un "Pendiente:" sin corchetes NO es un marcador: el revisor lo retira buscando los corchetes, y sin ellos la frase se publica tal cual.`
      );
    }

    if (deterministas.length) {
      reproches.push(
        `${deterministas.join("\n")}\nCorrígelo: un rango que la fuente da mal no se publica (va un marcador de pendiente y una nota en «defecto_insumo»); lo que es de otro bloque se remite en una frase; los demás, como dice cada línea.`
      );
    }
    if (cobertura.length) {
      reproches.push(
        `La cobertura por subrequisito no pasa la verificación:\n${cobertura.map((e) => `- ${e}`).join("\n")}\n` +
          `Debe haber exactamente una fila por cada requisito de «Los requisitos que este bloque satisface», con su código exacto; «cubierto» y «parcial» citan ids de hechos entregados; «asignado» solo a un bloque del documento que responde ese requisito (ver \`remitir_a_otro_bloque\`); «pendiente» exige su marcador en el texto.`
      );
    }

    ultimoError = inventadas.length
      ? `Citó fuentes que no se le entregaron: ${inventadas.join(", ")}.`
      : sinRespaldo.length
        ? `Cifras sin respaldo en los datos confirmados: ${sinRespaldo.join(", ")}.`
      : prohibidas.length
        ? `El texto usa vocabulario de proceso interno: ${prohibidas.join(", ")}.`
        : marcadores.length
          ? `Marcadores mal formados: ${marcadores.join(" ")}.`
          : cobertura.length
            ? `Cobertura inválida: ${cobertura.join("; ")}.`
            : `Validadores: ${deterministas.join(" ")}`;

    // El reintento se paga: queda en el log con su motivo para poder medirlo.
    console.info(`[suplemento] bloque ${bloque.numero} rechazado en el intento ${intento}: ${ultimoError.slice(0, 300)}`);
    if (intento === 2) break;
    mensajes.push(
      { role: "assistant", content: JSON.stringify(parseada) },
      { role: "user", content: reproches.join("\n\n") }
    );
  }

  const duracionMs = Date.now() - inicio;
  const costo = costoUsd(modelo, uso);

  if (!salida) {
    if (!opciones.sinPersistir) {
      await persistirFallo(supabase, documentoId, bloque, doc.idioma, {
        modelo,
        uso,
        costo,
        duracionMs,
        motivo: ultimoError,
      });
    }
    return {
      ok: false,
      motivo: ultimoError.startsWith("Citó")
        ? "fuentes_invalidas"
        : ultimoError.startsWith("Cifras sin respaldo")
          ? "cifras_sin_respaldo"
        : ultimoError.startsWith("El texto usa") || ultimoError.startsWith("Marcadores")
          ? "voz_incorrecta"
        : ultimoError.startsWith("Cobertura")
          ? "cobertura_invalida"
          : "respuesta_ilegible",
      detalle: ultimoError,
    };
  }

  // El respaldo de cada cifra citada: si el texto cita una solicitud cuya cifra
  // confirmada sabe de qué archivo y lugar salió, ese lugar se cita también. Lo
  // agrega el código para que no dependa de que el modelo se acuerde.
  for (const id of [...salida.fuentes_usadas]) {
    if (!id.startsWith("sol:")) continue;
    const r = respaldos.porSolicitud.get(id.slice(4));
    if (r && ens.entregaPorSolicitud.get(id.slice(4))?.valor != null && !salida.fuentes_usadas.includes(r.id)) {
      salida.fuentes_usadas.push(r.id);
    }
  }

  // Grafía de la denominación: se corrige aquí, sin reintento. Es un carácter y
  // no justifica pagar otra llamada.
  const normalizado = normalizarDenominacion(salida.texto, prefs);
  salida.texto = normalizado.texto;
  // Glosario (Paso 5.4): cada variante pasa a su canónico y la discrepancia va a
  // las notas, en «defecto_insumo». Sin reintento: es una sustitución exacta.
  // La tabla armada por código también: trae nombres tal como están en los datos
  // (en el demo, «Dirección de Crédito» en el detalle de un objetivo, bloque 39).
  let tablaFinal = tabla;
  if (insumo) {
    const g = aplicarGlosario(salida.texto, glosario);
    salida.texto = g.texto;
    if (tabla) {
      const gt = aplicarGlosario(tabla, glosario);
      tablaFinal = gt.texto;
      for (const c of gt.cambios) {
        const previo = g.cambios.find((x) => x.variante === c.variante);
        if (previo) previo.veces += c.veces;
        else g.cambios.push(c);
      }
    }
    for (const c of g.cambios) {
      (salida.notas_clasificadas ??= []).push({
        cubeta: "defecto_insumo",
        etiqueta: null,
        texto: `Nombre unificado al del glosario: «${c.variante}» → «${c.canonico}» (${c.veces} ${c.veces === 1 ? "vez" : "veces"}). Las fuentes usan los dos nombres.`,
      });
    }
  }

  if (!opciones.sinPersistir) {
    await persistirBloque(supabase, documentoId, bloque, doc.idioma, {
      texto: salida.texto,
      // En modo libro, cada hecho citado se guarda con su FUENTE ORIGINAL (sol:,
      // adj:…:p1, perfil:…) y su extracto: lo que el revisor puede abrir y comprobar.
      fuentes: [
        ...new Map(
          salida.fuentes_usadas.map((id) => {
            const h = insumo?.hechos.find((x) => x.id === id);
            if (h) return [h.fuenteId + h.extracto, { tipo: "hecho", id: h.fuenteId, detalle: `${h.fuente} — «${h.extracto}»` }] as const;
            const f = fuentesModelo.find((x) => x.id === id) ?? fuentes.find((x) => x.id === id)!;
            return [f.id, { tipo: f.tipo, id: f.id, detalle: f.detalle }] as const;
          })
        ).values(),
      ],
      cobertura: insumo
        ? (salida.cobertura ?? []).map((c) => ({ ...c, hechos: c.hechos.map((id) => insumo.hechos.find((h) => h.id === id)?.hechoId ?? id) }))
        : null,
      libroId: insumo?.libroId ?? null,
      anclas: anclasFinales
        ? anclasFinales.map((a) => ({
            oracion: a.oracion,
            hechos: a.ids.map((id) => {
              const h = insumo?.hechos.find((x) => x.id === id);
              return { id, hecho: h?.hechoId ?? null, fuente: h ? `${h.fuente} — «${h.extracto.slice(0, 160)}»` : id };
            }),
          }))
        : null,
      promptVersion: insumo ? PROMPT_VERSION_HECHOS : PROMPT_VERSION,
      pendientes: salida.pendientes.map((p) => ({ campo: "bloque", motivo: p })),
      notasRevision: salida.notas_revision,
      notasClasificadas: salida.notas_clasificadas ?? null,
      tabla: tablaFinal,
      modelo,
      uso,
      costo,
      duracionMs,
    });
  }

  return {
    ok: true,
    texto: salida.texto,
    fuentesUsadas: salida.fuentes_usadas,
    pendientes: salida.pendientes,
    notasRevision: salida.notas_revision,
    tabla,
    modelo,
    uso,
    costo,
    duracionMs,
    intentos: mensajes.length > 1 ? 2 : 1,
    /** Cuántas grafías de la denominación hubo que corregir tras recibir el texto. */
    correccionesGrafia: normalizado.cambios,
    via,
    conModelo: true,
    bloque: evaluado,
  };
}

// -----------------------------------------------------------------------------
// Piezas
// -----------------------------------------------------------------------------

type SalidaModelo = {
  texto: string;
  fuentes_usadas: string[];
  pendientes: string[];
  notas_revision: string[];
  /** Solo en modo libro. */
  cobertura?: Cobertura[];
  /** Modo libro v2: notas con su cubeta (regla 14). */
  notas_clasificadas?: NotaClasificada[];
};

type NotaClasificada = { cubeta: "decision_emisor" | "revelacion_voluntaria" | "defecto_insumo"; etiqueta: "contradiccion" | "por_conciliar" | null; texto: string };

function resolverBloque(id: number | string): Bloque | null {
  const n = typeof id === "number" ? id : Number(id);
  if (Number.isFinite(n)) return BLOQUES.find((b) => b.numero === n) ?? null;
  return BLOQUES.find((b) => b.clave === id) ?? null;
}

function textoDe(m: Anthropic.Message): string {
  return m.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function leerSalida(m: Anthropic.Message): SalidaModelo | null {
  const crudo = textoDe(m).trim();
  if (!crudo) return null;
  try {
    const o = JSON.parse(crudo) as Record<string, unknown>;
    if (typeof o.texto !== "string") return null;
    const lista = (v: unknown) =>
      Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
    // Notas en modo libro v2: objetos con su cubeta. Se conserva también la
    // lista de textos, que es lo que usa el resto del flujo.
    const clasificadas = Array.isArray(o.notas_revision)
      ? (o.notas_revision.filter((x) => x && typeof x === "object" && typeof (x as NotaClasificada).texto === "string") as NotaClasificada[])
      : [];
    return {
      texto: o.texto,
      fuentes_usadas: lista(o.fuentes_usadas),
      pendientes: lista(o.pendientes),
      notas_revision: clasificadas.length ? clasificadas.map((n) => n.texto) : lista(o.notas_revision),
      ...(clasificadas.length ? { notas_clasificadas: clasificadas } : {}),
      ...(Array.isArray(o.cobertura) ? { cobertura: o.cobertura as Cobertura[] } : {}),
    };
  } catch {
    return null;
  }
}

function leerUso(u: Anthropic.Usage): Uso {
  return {
    entrada: u.input_tokens ?? 0,
    cacheEscritura: u.cache_creation_input_tokens ?? 0,
    cacheLectura: u.cache_read_input_tokens ?? 0,
    salida: u.output_tokens ?? 0,
  };
}

const sumarUso = (a: Uso, b: Uso): Uso => ({
  entrada: a.entrada + b.entrada,
  cacheEscritura: a.cacheEscritura + b.cacheEscritura,
  cacheLectura: a.cacheLectura + b.cacheLectura,
  salida: a.salida + b.salida,
});

async function leerRequisitos(supabase: Cliente, codigos: string[]): Promise<RequisitoNiif[]> {
  if (codigos.length === 0) return [];
  const { data } = await supabase
    .from("datapoints_taxonomia")
    .select("codigo, descripcion")
    .in("codigo", codigos);
  // Se respeta el orden de bloques.ts, no el que devuelva la base.
  const porCodigo = new Map((data ?? []).map((d) => [d.codigo, d.descripcion]));
  return codigos
    .filter((c) => porCodigo.has(c))
    .map((c) => ({ codigo: c, descripcion: porCodigo.get(c)! }));
}

// -----------------------------------------------------------------------------
// Los datos del bloque, con un id por fuente.
//
// El id es lo que el modelo puede citar y lo que después se verifica. Lleva
// prefijo por tipo (`sol:`, `reg:`, `obj:`, `cue:`, `perfil:`) para que un id
// citado se pueda rastrear sin consultar la base.
// -----------------------------------------------------------------------------
type Ensamblado = Extract<Awaited<ReturnType<typeof ensamblarReporte>>, { ok: true }>;

function armarDatos(
  bloque: Bloque,
  ens: Ensamblado,
  evaluado: BloqueEvaluado,
  perfil: Record<string, unknown> | null,
  requisitos: RequisitoNiif[],
  evidencias: Map<string, EvidenciaDelBloque> = new Map(),
  respaldos: Map<string, RespaldoDeCifra> = new Map()
): { fuentes: FuenteEntregada[]; datos: unknown } {
  const fuentes: FuenteEntregada[] = [];
  const porId = new Map(ens.solicitudes.map((s) => [s.id, s]));

  // --- Datapoints: requisito → solicitud que lo cubre → qué entregó ----------
  // El puente datapoint → solicitud lo resolvió `evaluarCompletitud` contra
  // `mapeo_solicitud_datapoint`, y de ahí viene esta lista. Incluye tanto las
  // que entregaron como las que no: las primeras son las cifras que el bloque
  // puede citar, las segundas son sus [Pendiente].
  const solicitudesDelBloque = new Set<string>(evaluado.solicitudes);

  const datapoints = requisitos.map((r) => ({
    codigo: r.codigo,
    requisito: r.descripcion,
    estado: estadoDeRequisito(evaluado, r.codigo),
  }));

  const solicitudes = [...solicitudesDelBloque]
    .map((id) => porId.get(id))
    .filter((s): s is SolRow => !!s)
    .map((s) => {
      const e: EntregaSolicitud = ens.entregaPorSolicitud.get(s.id) ?? {
        estado: "sin_evidencia",
        valor: null,
      };
      const fid = `sol:${s.id}`;
      fuentes.push({
        id: fid,
        tipo: "solicitud",
        detalle: `${s.titulo} — ${etiquetaEntrega(e.estado)}${e.valor != null ? `, valor ${e.valor}${s.unidad_esperada ? " " + s.unidad_esperada : ""}` : ""}`,
      });
      return {
        id: fid,
        titulo: s.titulo,
        descripcion: s.descripcion,
        unidad: s.unidad_esperada,
        ejercicio: ens.reporte.ejercicio,
        estado_entrega: e.estado,
        valor: e.valor,
        validada_por: s.origen === "cliente" ? "el propio cliente" : "IRStrat",
        nota_de_alcance: s.nota_alcance,
        // De qué archivo y lugar salió la cifra confirmada (si nació de una sugerencia).
        respaldo_de_la_cifra: e.valor != null ? respaldos.get(s.id) ?? null : null,
        // El archivo más reciente de la solicitud, ya leído. Contexto y citas:
        // las cifras NO salen de aquí (lo revisa cifras.ts).
        documento_de_respaldo: (() => {
          const ev = evidencias.get(s.id);
          if (!ev) return null;
          return {
            archivo: ev.archivo,
            version: ev.version,
            contenido: ev.contenido,
            recortado: ev.recortado,
            texto_confirmado: ev.extractoConfirmado
              ? {
                  texto: ev.extractoConfirmado.texto,
                  corregido_por_la_emisora: ev.extractoConfirmado.corregido,
                  citar_con: ev.extractoConfirmado.citarCon,
                }
              : null,
          };
        })(),
      };
    });

  // --- Tablas ---------------------------------------------------------------
  const registros = bloque.tablas.includes("registros_clima")
    ? ens.registros.map((r) => {
        const fid = `reg:${r.id}`;
        fuentes.push({ id: fid, tipo: "registro", detalle: `Registro de clima: ${r.nombre} (${r.tipo})` });
        const v = ens.vigentePorRegistro.get(r.id)?.get(ens.reporte.ejercicio) ?? null;
        return {
          id: fid,
          nombre: r.nombre,
          tipo: r.tipo,
          descripcion: r.descripcion,
          horizontes: r.horizontes,
          // Los tres campos del párrafo por riesgo. Sin ellos el bloque 21 solo
          // podía producir la fila de la tabla y repetir la descripción con
          // otras palabras; con ellos contesta dónde pega, qué provoca y qué se
          // hace, que es lo que CADU escribe en pp. 23-24.
          se_concentra_en: r.concentracion,
          impactos_potenciales: r.impactos_potenciales,
          respuesta_de_la_emisora: r.respuesta,
          metricas_del_ejercicio: v
            ? {
                cantidad_activos: v.cantidad_activos,
                porcentaje: v.porcentaje,
                capital_gasto: v.capital_gasto,
                capital_financiacion: v.capital_financiacion,
                capital_inversion: v.capital_inversion,
              }
            : null,
        };
      })
    : [];

  const objetivos = bloque.tablas.includes("objetivos") || bloque.tablas.includes("objetivos_detalle")
    ? ens.objetivos.map((o) => {
        const fid = `obj:${o.id}`;
        fuentes.push({ id: fid, tipo: "objetivo", detalle: `Objetivo: ${o.nombre}` });
        return { id: fid, ...sinIds(o), detalle: ens.detallePorObjetivo.get(o.id) ?? null };
      })
    : [];

  const cuestionarios = bloque.tablas.includes("cuestionarios_respuestas")
    ? ens.cuestionarios.map((c) => {
        const fid = `cue:${c.hoja}:${c.pregunta_orden}`;
        fuentes.push({ id: fid, tipo: "cuestionario", detalle: `Cuestionario ${c.hoja}, pregunta ${c.pregunta_orden}` });
        return { id: fid, hoja: c.hoja, orden: c.pregunta_orden, respuesta: c.respuesta, notas: c.notas };
      })
    : [];

  // --- Perfil del emisor ----------------------------------------------------
  const campos: Record<string, unknown> = {};
  for (const campo of bloque.perfil) {
    const valor = perfil?.[campo] ?? null;
    const fid = `perfil:${campo}`;
    fuentes.push({ id: fid, tipo: "perfil", detalle: `Perfil del emisor, campo ${campo}` });
    campos[fid] = valor;
  }

  // --- Reporte --------------------------------------------------------------
  fuentes.push({
    id: `reporte:${ens.reporte.id}`,
    tipo: "reporte",
    detalle: `Reporte ${ens.reporte.nombre}, ejercicio ${ens.reporte.ejercicio}`,
  });

  return {
    fuentes,
    datos: {
      bloque: { numero: bloque.numero, titulo: bloque.titulo, tipo: bloque.tipo },
      estado_de_completitud: {
        estado: evaluado.estado,
        cumplidos: evaluado.cumplidos,
        exigidos: evaluado.exigidos,
        faltantes: evaluado.faltantes.map((f) => ({
          que: f.etiqueta,
          causa: f.causa,
          detalle: f.detalle,
        })),
      },
      // Requisitos que ya contesta otro bloque del documento. No se repiten: se
      // remite. Un suplemento que define los horizontes dos veces con palabras
      // distintas es un suplemento que se contradice a sí mismo.
      remitir_a_otro_bloque: evaluado.remisiones.map((r) => ({
        requisito: r.codigo,
        bloque: r.bloque,
        instruccion: `Este requisito se desarrolla en el bloque ${r.bloque}. NO lo repitas: remite ahí en una frase.`,
      })),
      datapoints,
      solicitudes,
      registros_clima: registros,
      objetivos,
      cuestionarios,
      perfil_emisor: campos,
      reporte: {
        id: `reporte:${ens.reporte.id}`,
        nombre: ens.reporte.nombre,
        ejercicio: ens.reporte.ejercicio,
      },
    },
  };
}

function estadoDeRequisito(ev: BloqueEvaluado, codigo: string): string {
  const f = ev.faltantes.find((x) => x.etiqueta === codigo);
  return f ? f.causa : "cubierto";
}

const etiquetaEntrega = (e: string) =>
  e === "entregado" ? "entregada y validada" : e === "pendiente_validacion" ? "entregada, sin validar" : "sin evidencia";

/** Quita los ids crudos: el modelo cita por el id con prefijo, no por el uuid. */
function sinIds<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const resto: Record<string, unknown> = { ...o };
  delete resto.id;
  delete resto.reporte_id;
  return resto;
}

// -----------------------------------------------------------------------------
// Las dos vías que NO llaman al modelo
// -----------------------------------------------------------------------------

/**
 * Bloque de plantilla: texto fijo con variables del reporte y del emisor.
 *
 * No pasa por el modelo. Su contenido no depende de la evidencia del cliente, y
 * una llamada para rellenar tres huecos es gasto y riesgo —un modelo puede
 * reescribir la frase que la firma acordó— sin ganancia. Cuesta cero.
 */
async function resolverPlantilla(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  c: {
    prefs: { denominacionFormal: string | null; nombreCorto: string | null; formaDeReferencia: string | null };
    ejercicio: number;
    regimen: Regimen;
    anioAdopcion: number | null;
    alivios: Alivios;
    nombreReporte: string;
    sinPersistir: boolean;
    evaluado: BloqueEvaluado;
  }
): Promise<ResultadoGeneracion> {
  const armar = PLANTILLAS[bloque.numero];
  if (!armar) {
    return { ok: false, motivo: "bloque_no_existe", detalle: `El bloque ${bloque.numero} no tiene plantilla.` };
  }
  const r = armar({
    denominacionFormal: c.prefs.denominacionFormal ?? "",
    formaDeReferencia: c.prefs.formaDeReferencia ?? "la Entidad",
    ejercicio: c.ejercicio,
    regimen: c.regimen,
    anioAdopcion: c.anioAdopcion,
    alivios: c.alivios,
    nombreReporte: c.nombreReporte,
  });

  const uso: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  if (!c.sinPersistir) {
    await persistirBloque(supabase, documentoId, bloque, idioma, {
      texto: r.texto,
      fuentes: [
        { tipo: "reporte", id: "plantilla", detalle: "Texto de plantilla con variables del reporte y del emisor" },
      ],
      pendientes: r.pendientes.map((x) => ({ campo: "bloque", motivo: x })),
      notasRevision: [],
      tabla: null,
      modelo: MODELO_POR_DEFECTO,
      uso,
      costo: 0,
      duracionMs: 0,
    });
  }
  return {
    ok: true,
    texto: r.texto,
    fuentesUsadas: ["plantilla"],
    pendientes: r.pendientes,
    notasRevision: [],
    tabla: null,
    modelo: MODELO_POR_DEFECTO,
    uso,
    costo: 0,
    duracionMs: 0,
    intentos: 0,
    correccionesGrafia: 0,
    via: "plantilla",
    conModelo: false,
    bloque: c.evaluado,
  };
}

/**
 * ¿Este bloque del Perfil tiene que esperar a sus documentos?
 *
 * Solo si TODOS sus campos están vacíos, alguno tiene archivo en su sección y
 * NINGUNO de esos archivos está leído. Con un documento leído, el bloque se
 * redacta desde él (suplemento-calidad, Paso 2). Si hay al menos un campo con
 * texto, el bloque se redacta con lo que hay y el resto va como pendiente:
 * media revelación es mejor que ninguna, y el revisor ve qué falta.
 *
 * Esperar no cuesta una llamada: un bloque cuyo único contenido es un archivo
 * que aún está en la cola —o que no se puede leer— solo produciría marcadores.
 */
function esperaAdjunto(
  bloque: Bloque,
  perfil: Record<string, unknown> | null,
  seccionesConAdjunto: Set<string>,
  adjuntos: AdjuntosDelBloque
): { campo: string; motivo: string }[] | null {
  if (bloque.perfil.length === 0) return null;
  const conTexto = (v: unknown) =>
    typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : v != null;

  const vacios = bloque.perfil.filter((campo) => !conTexto(perfil?.[campo]));
  if (vacios.length < bloque.perfil.length) return null;

  const conArchivo = vacios.filter((campo) => seccionesConAdjunto.has(SECCION_DE_CAMPO[campo] ?? ""));
  if (conArchivo.length === 0) return null;
  if (conArchivo.some((campo) => adjuntos.seccionesLeidas.has(SECCION_DE_CAMPO[campo] ?? ""))) return null;

  return conArchivo.map((campo) => {
    const seccion = SECCION_DE_CAMPO[campo] ?? "";
    const sinLeer = adjuntos.sinLeer.find((s) => s.seccion === seccion);
    const porque = adjuntos.seccionesEnCola.has(seccion)
      ? "su documento está en lectura; el bloque se podrá generar en cuanto termine"
      : sinLeer
        ? `su documento no se pudo leer (${sinLeer.archivo}: ${sinLeer.mensaje ?? sinLeer.estado})`
        : "su documento no se ha leído";
    return { campo, motivo: `${ETIQUETA_CAMPO[campo] ?? campo}: vacío en el Perfil; ${porque}.` };
  });
}

/** Guarda un bloque que no produce texto: no aplica, o espera un adjunto. */
async function persistirEstado(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  estado: "no_aplica" | "pendiente_adjunto",
  pendientes: { campo: string; motivo: string }[]
): Promise<void> {
  await supabase.from("documentos_bloques").upsert(
    {
      documento_id: documentoId,
      numero: bloque.numero,
      clave: bloque.clave,
      titulo: bloque.titulo,
      seccion: bloque.seccion,
      idioma,
      estado,
      texto: null,
      texto_del_emisor: false,
      fuentes: [],
      pendientes,
      modelo: null,
      // Nulo a propósito: aquí no corrió ningún prompt. `prompt_version` dice
      // con qué versión se escribió el texto guardado, y no hay texto.
      prompt_version: null,
      tokens_entrada: 0,
      tokens_entrada_cache_escritura: 0,
      tokens_entrada_cache_lectura: 0,
      tokens_salida: 0,
      costo_usd: 0,
      duracion_ms: 0,
      generado_en: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "documento_id,numero" }
  );
}

// -----------------------------------------------------------------------------
// Persistencia. Un bloque por documento (UNIQUE documento_id, numero):
// regenerar REEMPLAZA, no acumula, que es lo que dice el esquema.
// -----------------------------------------------------------------------------
type Metricas = { modelo: ClaveModelo; uso: Uso; costo: number; duracionMs: number };

async function persistirBloque(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  d: Metricas & {
    texto: string;
    fuentes: { tipo: string; id: string; detalle: string }[];
    pendientes: { campo: string; motivo: string }[];
    notasRevision: string[];
    tabla: string | null;
    /** El texto es el del emisor, copiado literal de un adjunto (Paso 3). */
    textoDelEmisor?: boolean;
    /** Modo libro (Paso 5.3): cobertura por subrequisito y libro de origen. */
    cobertura?: unknown[] | null;
    /** Modo libro v2: notas con cubeta y etiqueta; si vienen, sustituyen a `notasRevision`. */
    notasClasificadas?: { cubeta: string; etiqueta: string | null; texto: string }[] | null;
    libroId?: string | null;
    /** Modo libro v3 (Paso 5b): anclas por oración, solo para la revisión. */
    anclas?: unknown[] | null;
    promptVersion?: string;
  }
): Promise<void> {
  await supabase.from("documentos_bloques").upsert(
    {
      documento_id: documentoId,
      numero: bloque.numero,
      clave: bloque.clave,
      titulo: bloque.titulo,
      seccion: bloque.seccion,
      idioma,
      estado: "borrador",
      // Salió bien: la racha de cortes se acaba aquí. Si el bloque vuelve a
      // generarse mañana, empieza con sus dos intentos enteros.
      intentos: 0,
      // La tabla la armó el código y va DELANTE del texto en el documento: se
      // guarda junto, para que el bloque persistido sea lo que se va a publicar
      // y no una mitad que hay que recomponer al exportar.
      texto: d.tabla ? `${d.tabla}\n\n${d.texto}` : d.texto,
      texto_del_emisor: !!d.textoDelEmisor,
      // Historial (Paso 4): el trigger registra esta versión con este origen. El
      // texto ya no es el de una edición ni una restauración, así que se limpian.
      origen_texto: d.textoDelEmisor ? "literal" : "generacion",
      editado_por: null,
      editado_en: null,
      restaurada_de: null,
      fuentes: d.fuentes,
      // Los huecos y las notas al revisor viven en el mismo arreglo, separados
      // por `campo`: el esquema tiene una sola columna jsonb para esto y
      // distinguirlos por clave es más barato que una columna nueva.
      pendientes: [
        ...d.pendientes,
        ...(d.notasClasificadas?.length
          ? d.notasClasificadas.map((n) => ({ campo: "nota_revision", motivo: n.texto, cubeta: n.cubeta, etiqueta: n.etiqueta }))
          : d.notasRevision.map((n) => ({ campo: "nota_revision", motivo: n }))),
      ],
      modelo: d.modelo,
      prompt_version: d.promptVersion ?? PROMPT_VERSION,
      cobertura: (d.cobertura ?? null) as never,
      anclas: (d.anclas ?? null) as never,
      libro_id: d.libroId ?? null,
      tokens_entrada: d.uso.entrada,
      tokens_entrada_cache_escritura: d.uso.cacheEscritura,
      tokens_entrada_cache_lectura: d.uso.cacheLectura,
      tokens_salida: d.uso.salida,
      costo_usd: d.costo,
      duracion_ms: d.duracionMs,
      generado_en: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "documento_id,numero" }
  );

  await recalcularDocumento(supabase, documentoId);
}

/**
 * Un intento fallido también se guarda: el texto queda nulo y el motivo en
 * `pendientes`. Y también se paga —el reintento consumió tokens— así que el
 * costo entra igual. Un fallo que no cuesta nada en los registros es un fallo
 * que nadie va a ir a mirar.
 */
async function persistirFallo(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  d: Metricas & { motivo: string }
): Promise<void> {
  const fila = {
    documento_id: documentoId,
    numero: bloque.numero,
    clave: bloque.clave,
    titulo: bloque.titulo,
    seccion: bloque.seccion,
    idioma,
    texto: null,
    texto_del_emisor: false,
    fuentes: [],
    pendientes: [{ campo: "generacion", motivo: d.motivo }],
    modelo: d.modelo,
    prompt_version: PROMPT_VERSION,
    tokens_entrada: d.uso.entrada,
    tokens_entrada_cache_escritura: d.uso.cacheEscritura,
    tokens_entrada_cache_lectura: d.uso.cacheLectura,
    tokens_salida: d.uso.salida,
    costo_usd: d.costo,
    duracion_ms: d.duracionMs,
    generado_en: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // `estado` tiene un CHECK con tres valores y 'error' no está entre ellos. Se
  // intenta igual —es lo que el bloque ES— y si la base lo rechaza se guarda
  // como borrador sin texto, con el motivo en `pendientes`, que es donde un
  // revisor lo va a buscar. En cuanto la migración añada 'error' al CHECK, el
  // primer intento pasa y este respaldo deja de usarse.
  const conError = await supabase
    .from("documentos_bloques")
    .upsert({ ...fila, estado: "error" } as never, { onConflict: "documento_id,numero" });

  if (conError.error) {
    await supabase
      .from("documentos_bloques")
      .upsert({ ...fila, estado: "borrador" }, { onConflict: "documento_id,numero" });
  }

  await recalcularDocumento(supabase, documentoId);
}

/** Los acumulados del documento se recalculan desde sus bloques, no se suman a mano. */
async function recalcularDocumento(supabase: Cliente, documentoId: string): Promise<void> {
  const { data } = await supabase
    .from("documentos_bloques")
    .select("tokens_entrada, tokens_entrada_cache_escritura, tokens_entrada_cache_lectura, tokens_salida, costo_usd")
    .eq("documento_id", documentoId);

  if (!data) return;
  const tot = data.reduce(
    (a, b) => ({
      entrada:
        a.entrada + b.tokens_entrada + b.tokens_entrada_cache_escritura + b.tokens_entrada_cache_lectura,
      salida: a.salida + b.tokens_salida,
      costo: a.costo + Number(b.costo_usd),
    }),
    { entrada: 0, salida: 0, costo: 0 }
  );

  await supabase
    .from("documentos_generados")
    .update({
      tokens_entrada: tot.entrada,
      tokens_salida: tot.salida,
      costo_usd: Math.round(tot.costo * 10_000) / 10_000,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentoId);
}

export { MODELOS, MODELO_POR_DEFECTO };
export type { Regimen };
