import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  ensamblarReporte,
  type CausaFallo,
  type EstadoEntrega,
  type ReporteEnsamblado,
} from "@/lib/reporte/ensamblar";
import {
  BLOQUES,
  datapointsExentos,
  FUENTES_ALTERNATIVAS,
  type Bloque,
} from "@/lib/suplemento/bloques";
import {
  leerAlivios,
  regimenDe,
  type Alivios,
  type Regimen,
} from "@/lib/perfil-emisor";

// =============================================================================
// SEMÁFORO DE COMPLETITUD — qué puede escribirse hoy de cada uno de los 40
// bloques del Suplemento S1/S2, y qué saldría con [Pendiente].
//
// ESTA FUNCIÓN NO ES DE LA PANTALLA. En A5 el generador la llama para decidir
// qué marcar como pendiente y qué no pedirle al modelo; la pantalla de A3b es
// solo el primer consumidor. Por eso no devuelve JSX, ni textos de botón, ni
// nada que dependa de cómo se pinte: devuelve requisitos cumplidos, faltantes y
// su causa.
//
// NO DUPLICA LA RESOLUCIÓN DEL DATO. Quién entregó qué lo decide
// `ensamblarReporte`, que es lo mismo que llena el Excel. Si el Excel dice que
// el Alcance 1 está pendiente de validación, aquí dice lo mismo, con las mismas
// palabras. Lo único que se añade es el eslabón que el Excel no necesita:
// datapoint → solicitud, vía `mapeo_solicitud_datapoint`.
//
// TRES FUENTES, TRES REGLAS (§3 de la especificación):
//   · Datapoints — hay solicitud en el reporte y entregó para el ejercicio.
//   · Tablas     — hay al menos una fila válida de lo que el bloque necesita.
//   · Perfil     — el campo tiene contenido; si está vacío pero la sección tiene
//                  un adjunto, queda "derivable de adjunto" y se resuelve en A5.
// =============================================================================

type Cliente = SupabaseClient<Database>;

export type EstadoBloque =
  | "completo"
  | "parcial"
  | "vacio"
  | "plantilla"
  | "no_aplica"
  | "sin_regimen";

/**
 * Por qué falta algo. Las tres primeras son LAS MISMAS del Excel y significan lo
 * mismo; el resto describe huecos de tablas y de perfil, que el Excel no evalúa.
 */
export type CausaFaltante =
  | "sin_solicitud"
  | "sin_evidencia"
  | "pendiente_validacion"
  | "codigo_no_en_catalogo"
  | "sin_registros"
  | "sin_valores"
  | "sin_objetivos"
  | "objetivo_incompleto"
  | "sin_detalle_objetivo"
  | "sin_cuestionario"
  | "cuestionario_incompleto"
  | "perfil_vacio"
  | "derivable_de_adjunto";

export type Faltante = {
  causa: CausaFaltante;
  /** Qué falta, dicho para un revisor. */
  etiqueta: string;
  /** Aclaración corta cuando la etiqueta sola no basta. */
  detalle: string | null;
  /** A dónde ir a resolverlo. Null cuando no hay pantalla que lo arregle. */
  enlace: string | null;
};

export type BloqueEvaluado = Pick<
  Bloque,
  "clave" | "numero" | "seccion" | "titulo" | "tipo" | "regimen"
> & {
  estado: EstadoBloque;
  /** Referencias NIIF que el bloque cita, para mostrarlas bajo el título. */
  referencias: string[];
  /** Por qué no aplica, cuando el régimen lo excluye. */
  motivoNoAplica: string | null;
  faltantes: Faltante[];
  cumplidos: number;
  exigidos: number;
  /**
   * Requisitos que un alivio vigente deja fuera este ejercicio. No son huecos:
   * la norma no los exige ahora. Se listan para que el semáforo pueda decir
   * "no aplica por C4" en vez de callarlos.
   */
  noAplican: string[];
  /**
   * Requisitos que quedaron cubiertos por un campo del perfil en vez de por una
   * solicitud, con el bloque que los desarrolla. El generador los usa para
   * REMITIR ahí en lugar de repetir el contenido o abrir un pendiente falso.
   */
  remisiones: { codigo: string; bloque: number }[];
  /**
   * Ids de las solicitudes del reporte que cubren algún datapoint de este
   * bloque, hayan entregado o no. Es el puente datapoint → solicitud que ya se
   * resolvió aquí; el generador lo necesita para saber QUÉ cifras puede citar y
   * volver a derivarlo por su cuenta sería reimplementar este módulo mal.
   */
  solicitudes: string[];
};

export type ResumenCompletitud = {
  completos: number;
  parciales: number;
  vacios: number;
  /** Bloques que no salen de la evidencia sino de plantilla: no se cuentan como completos. */
  plantilla: number;
  noAplican: number;
  sinRegimen: number;
};

export type Completitud = {
  reporte: ReporteEnsamblado;
  regimen: Regimen;
  anioAdopcion: number | null;
  alivios: Alivios;
  bloques: BloqueEvaluado[];
  resumen: ResumenCompletitud;
};

export type ResultadoCompletitud =
  | ({ ok: true } & Completitud)
  | { ok: false; causa: CausaFallo | "reporte_sin_tenant" };

// -----------------------------------------------------------------------------
// PARÁMETROS DE LAS FUENTES DE TABLA
//
// `bloques.ts` dice QUÉ tabla alimenta cada bloque; no dice cuál subconjunto.
// "registros_clima" no basta para juzgar el bloque de oportunidades: lo que ese
// bloque necesita son los registros de tipo `oportunidad`, y un riesgo físico no
// lo completa. Lo mismo con las hojas de cuestionario.
//
// Está aquí, en una sola tabla comentada, y no repartido por el módulo, porque
// es la parte OPINABLE de la evaluación: son las equivalencias que hay que
// revisar si mañana cambia el catálogo de hojas o se añade un tipo de registro.
// -----------------------------------------------------------------------------
type TipoRegistro = "riesgo_fisico" | "riesgo_transicion" | "oportunidad";

const TODOS_LOS_TIPOS: TipoRegistro[] = ["riesgo_fisico", "riesgo_transicion", "oportunidad"];

type Exigencia = {
  /** Tipos de `registros_clima` que este bloque necesita. Sin declarar = todos. */
  tipos?: TipoRegistro[];
  /** Hojas de `cuestionarios_respuestas`. Sin declarar = la fuente no se puede comprobar. */
  hojas?: string[];
  /** Los objetivos que cuentan. NIIF S2 33-36 habla de objetivos CLIMÁTICOS. */
  ambitoObjetivos?: "climatico";
};

const EXIGENCIAS: Record<string, Exigencia> = {
  // Prioriza la cartera entera de riesgos y oportunidades: cualquier tipo sirve.
  priorizacion_riesgos: { tipos: TODOS_LOS_TIPOS },
  // NIIF S2 13(a)(b): efectos actuales de riesgos Y oportunidades en el modelo.
  efectos_modelo_cadena: { tipos: TODOS_LOS_TIPOS },
  // NIIF S2 10(a)-(d): la descripción de los riesgos priorizados. Sin oportunidades.
  riesgos_prioritarios: { tipos: ["riesgo_fisico", "riesgo_transicion"] },
  oportunidades: { tipos: ["oportunidad"] },
  // Métricas de exposición: cada bloque mira su propio tipo (NIIF S2 29 b/c/d).
  riesgos_transicion_metricas: { tipos: ["riesgo_transicion"] },
  riesgos_fisicos_metricas: { tipos: ["riesgo_fisico"] },
  oportunidades_metricas: { tipos: ["oportunidad"] },
  // Las tres hojas narrativas que la plantilla oficial trae hoy.
  resiliencia_escenarios: { hojas: ["S2 22(b)(i)", "S2 22(b)(ii)"] },
  objetivo_gei: { hojas: ["S2 36(e)"], ambitoObjetivos: "climatico" },
  objetivos_climaticos: { ambitoObjetivos: "climatico" },
  enfoque_objetivos: { ambitoObjetivos: "climatico" },
};

/** Los ocho atributos que NIIF S2 33 exige de CADA objetivo. */
const OCHO_ATRIBUTOS: { campo: string; etiqueta: string }[] = [
  { campo: "metrica", etiqueta: "métrica" },
  { campo: "meta", etiqueta: "meta cuantitativa o cualitativa" },
  { campo: "parte_entidad", etiqueta: "parte de la entidad a la que aplica" },
  { campo: "periodo_aplicacion", etiqueta: "periodo de aplicación" },
  { campo: "periodo_base", etiqueta: "periodo base" },
  { campo: "hito_intermedio", etiqueta: "hitos intermedios" },
  { campo: "tipo_objetivo", etiqueta: "tipo (absoluto o de intensidad)" },
  { campo: "alineacion_acuerdo_internacional", etiqueta: "alineación con acuerdo internacional" },
];

/** Campo del perfil → sección del formulario, que es donde se adjunta el respaldo. */
export const SECCION_DE_CAMPO: Record<string, string> = {
  denominacion_formal: "identidad",
  nombre_corto: "identidad",
  forma_de_referencia: "identidad",
  entidad_que_informa: "identidad",
  perimetro: "identidad",
  matriz_riesgos: "matriz",
  horizontes: "horizontes",
  carta_texto: "carta",
  carta_firmante: "carta",
  carta_cargo: "carta",
  hitos_corporativos: "historia",
  hitos_sostenibilidad: "trayectoria",
  modelo_negocio: "modelo",
  cadena_valor: "modelo",
  gobierno_texto: "gobierno",
  organigrama_path: "gobierno",
  proceso_materialidad: "materialidad",
};

export const ETIQUETA_CAMPO: Record<string, string> = {
  denominacion_formal: "Denominación formal",
  nombre_corto: "Nombre corto",
  forma_de_referencia: "Forma de referencia",
  entidad_que_informa: "Entidad que informa",
  perimetro: "Perímetro del informe",
  matriz_riesgos: "Matriz de riesgos",
  horizontes: "Horizontes temporales",
  carta_texto: "Texto de la carta",
  carta_firmante: "Firmante de la carta",
  carta_cargo: "Cargo del firmante",
  hitos_corporativos: "Hitos corporativos",
  hitos_sostenibilidad: "Hitos de sostenibilidad",
  modelo_negocio: "Modelo de negocio",
  cadena_valor: "Cadena de valor",
  gobierno_texto: "Estructura de gobierno",
  organigrama_path: "Organigrama",
  proceso_materialidad: "Proceso de materialidad",
};

/** Veredicto de entrega → causa del faltante. Son las del Excel, una a una. */
const CAUSA_DE_ENTREGA: Record<Exclude<EstadoEntrega, "entregado">, CausaFaltante> = {
  pendiente_validacion: "pendiente_validacion",
  sin_evidencia: "sin_evidencia",
};

// -----------------------------------------------------------------------------

const conTexto = (v: unknown): boolean =>
  typeof v === "string" ? v.trim().length > 0 : v != null;

/** Un jsonb de lista cuenta como lleno solo si trae al menos un elemento con algo escrito. */
const listaConContenido = (v: unknown): boolean => {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.some(
    (x) =>
      x &&
      typeof x === "object" &&
      Object.values(x as Record<string, unknown>).some((c) => conTexto(c))
  );
};

const CAMPOS_LISTA = new Set(["horizontes", "hitos_corporativos", "hitos_sostenibilidad", "cadena_valor"]);

/**
 * Evalúa los 40 bloques de un reporte.
 *
 * Devuelve un fallo en vez de lanzar, igual que el ensamblador, para que cada
 * consumidor decida su respuesta: la pantalla muestra un aviso, el generador
 * de A5 se detiene antes de gastar un token.
 */
export async function evaluarCompletitud(
  supabase: Cliente,
  reporteId: string
): Promise<ResultadoCompletitud> {
  const ens = await ensamblarReporte(supabase, reporteId);
  if (!ens.ok) return { ok: false, causa: ens.causa };

  const tenantId = await tenantDelReporte(supabase, reporteId);
  if (!tenantId) return { ok: false, causa: "reporte_sin_tenant" };

  const [{ data: filaReporte }, { data: catalogo }, { data: enlaces }, { data: perfil }, { data: adjuntos }] =
    await Promise.all([
      supabase.from("reportes").select("anio_adopcion, alivios").eq("id", reporteId).maybeSingle(),
      supabase.from("datapoints_taxonomia").select("id, codigo").eq("activo", true),
      // Datapoint ↔ solicitud, acotado a las solicitudes de ESTE reporte. Es el
      // eslabón que el Excel no necesita: allá el puente es el rubro canónico.
      supabase
        .from("mapeo_solicitud_datapoint")
        .select("solicitud_id, datapoint_id, solicitud:solicitudes!inner(reporte_id)")
        .eq("solicitud.reporte_id", reporteId),
      supabase.from("perfil_emisor").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("perfil_emisor_adjuntos").select("seccion").eq("tenant_id", tenantId),
    ]);

  const anioAdopcion = filaReporte?.anio_adopcion ?? null;
  const alivios = leerAlivios(filaReporte?.alivios);
  const regimen = regimenDe(ens.reporte.ejercicio, anioAdopcion);

  // Los alivios son TRANSITORIOS: solo rigen el primer ejercicio de adopción.
  // Aplicarlos en un año subsecuente dejaría fuera del documento un requisito
  // que ya es exigible.
  const aliviosVigentes: Alivios = regimen === "primer_anio" ? alivios : {};

  // Requisitos que un alivio vigente deja fuera. No son huecos: el bloque no
  // tiene que cubrirlos este ejercicio, así que ni se cuentan como exigidos ni
  // se le entregan al generador.
  const exentos = datapointsExentos(aliviosVigentes);

  const idPorCodigo = new Map<string, string>();
  for (const d of catalogo ?? []) idPorCodigo.set(d.codigo, d.id);

  const solsPorDatapoint = new Map<string, string[]>();
  for (const e of (enlaces ?? []) as { solicitud_id: string; datapoint_id: string }[]) {
    const arr = solsPorDatapoint.get(e.datapoint_id) ?? [];
    arr.push(e.solicitud_id);
    solsPorDatapoint.set(e.datapoint_id, arr);
  }

  const seccionesConAdjunto = new Set((adjuntos ?? []).map((a) => a.seccion));
  const tituloSol = new Map(ens.solicitudes.map((s) => [s.id, s.titulo]));

  // Registros activos por tipo, y cuáles tienen valor del ejercicio.
  const registrosPorTipo = new Map<string, typeof ens.registros>();
  for (const r of ens.registros) {
    const arr = registrosPorTipo.get(r.tipo) ?? [];
    arr.push(r);
    registrosPorTipo.set(r.tipo, arr);
  }
  const tieneValorDelEjercicio = (registroId: string): boolean =>
    ens.vigentePorRegistro.get(registroId)?.has(ens.reporte.ejercicio) ?? false;

  const objetivosClimaticos = ens.objetivos.filter((o) => o.ambito === "climatico");

  const respuestasPorHoja = new Map<string, number>();
  for (const c of ens.cuestionarios) {
    if (!conTexto(c.respuesta)) continue;
    respuestasPorHoja.set(c.hoja, (respuestasPorHoja.get(c.hoja) ?? 0) + 1);
  }
  const preguntasPorHoja = new Map<string, number>();
  for (const c of ens.cuestionarios) {
    preguntasPorHoja.set(c.hoja, (preguntasPorHoja.get(c.hoja) ?? 0) + 1);
  }

  const enlacePerfil = (seccion: string) =>
    `/admin/perfil?tenant=${encodeURIComponent(tenantId)}&seccion=${encodeURIComponent(seccion)}`;

  const bloques: BloqueEvaluado[] = BLOQUES.map((b) => {
    const faltantes: Faltante[] = [];
    const solicitudesDelBloque = new Set<string>();
    const noAplican: string[] = [];
    const remisiones: { codigo: string; bloque: number }[] = [];
    let exigidos = 0;
    let cumplidos = 0;

    // -- Régimen -------------------------------------------------------------
    const excluido = excluidoPorRegimen(b, regimen, aliviosVigentes);
    if (regimen === "indeterminado" || excluido) {
      return {
        clave: b.clave,
        numero: b.numero,
        seccion: b.seccion,
        titulo: b.titulo,
        tipo: b.tipo,
        regimen: b.regimen,
        estado: regimen === "indeterminado" ? "sin_regimen" : "no_aplica",
        referencias: b.datapoints,
        motivoNoAplica: excluido,
        faltantes: [],
        cumplidos: 0,
        exigidos: 0,
        noAplican: [],
        remisiones: [],
        solicitudes: [],
      };
    }

    // -- Datapoints ----------------------------------------------------------
    for (const codigo of b.datapoints) {
      // E5 NO EXCLUYE REQUISITOS DE S1. Antes esta línea los saltaba, y estaba
      // mal: el alivio acota el ALCANCE del informe a clima, no deroga la NIIF
      // S1, que sigue aplicando en lo pertinente a ese alcance. Saltarlos dejaba
      // el semáforo en verde sobre requisitos que nadie había cubierto, y a los
      // bloques de gobernanza y juicios sin fuente. E5 viaja al prompt como
      // bandera de alcance —ver `banderaAlcanceE5()`—, no como exención.
      // Ídem para lo que otro alivio exime —el Alcance 3 bajo C4—.
      if (exentos.has(codigo)) {
        noAplican.push(codigo);
        continue;
      }
      exigidos++;

      // Fuente alternativa: el requisito lo contesta un campo del perfil, no una
      // solicitud. Si ese campo tiene contenido, está cubierto y el bloque remite
      // al que lo desarrolla; si está vacío, sigue el camino normal y el hueco
      // aparece donde corresponde.
      const alterna = FUENTES_ALTERNATIVAS[codigo];
      if (alterna) {
        const lleno = alterna.campos.some((campo) => {
          const valor = (perfil as Record<string, unknown> | null)?.[campo];
          return CAMPOS_LISTA.has(campo) ? listaConContenido(valor) : conTexto(valor);
        });
        if (lleno) {
          cumplidos++;
          remisiones.push({ codigo, bloque: alterna.remitirA });
          continue;
        }
      }

      const dpId = idPorCodigo.get(codigo);
      if (!dpId) {
        faltantes.push({
          causa: "codigo_no_en_catalogo",
          etiqueta: codigo,
          detalle: "El código no existe en el catálogo de datapoints.",
          enlace: null,
        });
        continue;
      }

      const sols = solsPorDatapoint.get(dpId) ?? [];
      for (const s of sols) solicitudesDelBloque.add(s);
      if (sols.length === 0) {
        faltantes.push({
          causa: "sin_solicitud",
          etiqueta: codigo,
          detalle: "Ninguna solicitud del reporte cubre este requisito.",
          enlace: null,
        });
        continue;
      }

      // Gana la mejor entrega: basta una solicitud que sí entregó para que el
      // requisito tenga con qué escribirse.
      let mejor: EstadoEntrega = "sin_evidencia";
      let solDeLaMejor = sols[0];
      for (const s of sols) {
        const e = ens.entregaPorSolicitud.get(s)?.estado ?? "sin_evidencia";
        if (e === "entregado") {
          mejor = "entregado";
          solDeLaMejor = s;
          break;
        }
        if (e === "pendiente_validacion" && mejor === "sin_evidencia") {
          mejor = e;
          solDeLaMejor = s;
        }
      }

      if (mejor === "entregado") {
        cumplidos++;
      } else {
        faltantes.push({
          causa: CAUSA_DE_ENTREGA[mejor],
          etiqueta: codigo,
          detalle: tituloSol.get(solDeLaMejor) ?? null,
          enlace: `/admin/solicitudes/${solDeLaMejor}`,
        });
      }
    }

    // -- Tablas --------------------------------------------------------------
    const ex = EXIGENCIAS[b.clave] ?? {};
    const tipos = ex.tipos ?? TODOS_LOS_TIPOS;

    for (const tabla of b.tablas) {
      if (tabla === "registros_clima") {
        exigidos++;
        const hay = tipos.some((t) => (registrosPorTipo.get(t) ?? []).length > 0);
        if (hay) cumplidos++;
        else
          faltantes.push({
            causa: "sin_registros",
            etiqueta: `Registro de clima (${tipos.map(nombreTipo).join(", ")})`,
            detalle: "El reporte no tiene ningún registro de esos tipos.",
            enlace: "/admin/registros",
          });
        continue;
      }

      if (tabla === "registros_clima_valores") {
        exigidos++;
        const deLosTipos = tipos.flatMap((t) => registrosPorTipo.get(t) ?? []);
        const conValor = deLosTipos.filter((r) => tieneValorDelEjercicio(r.id));
        if (deLosTipos.length > 0 && conValor.length > 0) cumplidos++;
        else
          faltantes.push({
            causa: deLosTipos.length === 0 ? "sin_registros" : "sin_valores",
            etiqueta: `Métricas ${ens.reporte.ejercicio} de ${tipos.map(nombreTipo).join(", ")}`,
            detalle:
              deLosTipos.length === 0
                ? "No hay registros de esos tipos a los que ponerles cifras."
                : `Ninguno de los ${deLosTipos.length} registros tiene cifras del ejercicio.`,
            enlace: "/admin/registros",
          });
        continue;
      }

      if (tabla === "objetivos") {
        exigidos++;
        const lista = ex.ambitoObjetivos === "climatico" ? objetivosClimaticos : ens.objetivos;
        if (lista.length === 0) {
          faltantes.push({
            causa: "sin_objetivos",
            etiqueta:
              ex.ambitoObjetivos === "climatico" ? "Objetivos climáticos" : "Objetivos",
            detalle: "El reporte no tiene objetivos capturados.",
            enlace: "/admin/objetivos",
          });
          continue;
        }
        // NIIF S2 33 pide los ocho atributos de CADA objetivo: uno incompleto
        // deja el bloque incompleto, no se compensa con otro que sí los tenga.
        const incompletos = lista
          .map((o) => ({
            nombre: o.nombre,
            faltan: OCHO_ATRIBUTOS.filter(
              (a) => !conTexto((o as unknown as Record<string, unknown>)[a.campo])
            ),
          }))
          .filter((x) => x.faltan.length > 0);

        if (incompletos.length === 0) cumplidos++;
        else
          for (const inc of incompletos)
            faltantes.push({
              causa: "objetivo_incompleto",
              etiqueta: inc.nombre,
              detalle: `Faltan ${inc.faltan.length} de 8: ${inc.faltan.map((f) => f.etiqueta).join(", ")}.`,
              enlace: "/admin/objetivos",
            });
        continue;
      }

      if (tabla === "objetivos_detalle") {
        exigidos++;
        const lista = ex.ambitoObjetivos === "climatico" ? objetivosClimaticos : ens.objetivos;
        const sinDetalle = lista.filter((o) => !ens.detallePorObjetivo.has(o.id));
        if (lista.length > 0 && sinDetalle.length === 0) cumplidos++;
        else if (lista.length === 0)
          faltantes.push({
            causa: "sin_objetivos",
            etiqueta: "Objetivos",
            detalle: "No hay objetivos a los que documentarles el enfoque.",
            enlace: "/admin/objetivos",
          });
        else
          for (const o of sinDetalle)
            faltantes.push({
              causa: "sin_detalle_objetivo",
              etiqueta: o.nombre,
              detalle: "Sin la sección de enfoque, revisión y resultados.",
              enlace: "/admin/objetivos",
            });
        continue;
      }

      if (tabla === "cuestionarios_respuestas") {
        // Invariante: un bloque solo cita esta tabla si EXIGENCIAS declara SUS
        // hojas. Si algún día se cita sin declararlas, es un error de mapeo y se
        // dice en la pantalla; saltárselo en silencio daría por buena una fuente
        // que nadie comprobó.
        if (!ex.hojas) {
          exigidos++;
          faltantes.push({
            causa: "sin_cuestionario",
            etiqueta: "Cuestionario narrativo",
            detalle:
              "El bloque declara la tabla de cuestionarios pero no qué hoja le corresponde: falta declararla en EXIGENCIAS.",
            enlace: null,
          });
          continue;
        }
        for (const hoja of ex.hojas) {
          exigidos++;
          const total = preguntasPorHoja.get(hoja) ?? 0;
          const conRespuesta = respuestasPorHoja.get(hoja) ?? 0;
          if (total > 0 && conRespuesta === total) cumplidos++;
          else
            faltantes.push({
              causa: total === 0 ? "sin_cuestionario" : "cuestionario_incompleto",
              etiqueta: `Cuestionario ${hoja}`,
              detalle:
                total === 0
                  ? "La hoja no tiene preguntas cargadas en este reporte."
                  : `${conRespuesta} de ${total} preguntas respondidas.`,
              enlace: "/admin/cuestionarios",
            });
        }
        continue;
      }

      // `reportes`, `solicitudes` y `capturas_valor` son metadatos o ya quedaron
      // cubiertos por los datapoints: no se cuentan dos veces.
    }

    // -- Perfil del emisor ---------------------------------------------------
    for (const campo of b.perfil) {
      exigidos++;
      const valor = (perfil as Record<string, unknown> | null)?.[campo];
      const lleno = CAMPOS_LISTA.has(campo) ? listaConContenido(valor) : conTexto(valor);
      if (lleno) {
        cumplidos++;
        continue;
      }
      const seccion = SECCION_DE_CAMPO[campo] ?? "identidad";
      const etiqueta = ETIQUETA_CAMPO[campo] ?? campo;
      if (seccionesConAdjunto.has(seccion)) {
        faltantes.push({
          causa: "derivable_de_adjunto",
          etiqueta,
          detalle: "Vacío, pero la sección tiene un archivo del que podrá derivarse (A5).",
          enlace: enlacePerfil(seccion),
        });
      } else {
        faltantes.push({
          causa: "perfil_vacio",
          etiqueta,
          detalle: "Sin capturar y sin archivo de respaldo.",
          enlace: enlacePerfil(seccion),
        });
      }
    }

    // -- Estado --------------------------------------------------------------
    // SOLO C4 APAGA BLOQUES. E5 ya no deja ningún bloque en 'no_aplica': acotar
    // el informe a clima no convierte los requisitos de S1 en inaplicables, los
    // acota. Un bloque de gobernanza o de juicios sigue siendo exigible y su
    // hueco sigue siendo un hueco.


    // Un bloque sin un solo requisito es de PLANTILLA: su texto no sale de la
    // evidencia sino de una redacción fija (la presentación del informe, las
    // conexiones, la introducción de una sección). Tiene estado propio y no
    // engorda el conteo de completos: decir "13 completos" cuando tres de ellos
    // no dependían de que el cliente entregara nada infla el avance.
    const estado: EstadoBloque =
      exigidos === 0
        ? "plantilla"
        : cumplidos === exigidos
          ? "completo"
          : cumplidos === 0
            ? "vacio"
            : "parcial";

    return {
      clave: b.clave,
      numero: b.numero,
      seccion: b.seccion,
      titulo: b.titulo,
      tipo: b.tipo,
      regimen: b.regimen,
      estado,
      referencias: b.datapoints,
      motivoNoAplica: null,
      faltantes,
      cumplidos,
      exigidos,
      noAplican,
      remisiones,
      solicitudes: [...solicitudesDelBloque],
    };
  });

  const cuantos = (e: EstadoBloque) => bloques.filter((b) => b.estado === e).length;
  const resumen: ResumenCompletitud = {
    completos: cuantos("completo"),
    parciales: cuantos("parcial"),
    vacios: cuantos("vacio"),
    plantilla: cuantos("plantilla"),
    noAplican: cuantos("no_aplica"),
    sinRegimen: cuantos("sin_regimen"),
  };

  return { ok: true, reporte: ens.reporte, regimen, anioAdopcion, alivios, bloques, resumen };
}

/**
 * Qué alivio deja fuera a este bloque, o null si aplica. Solo los alivios
 * vigentes llegan aquí; en años subsecuentes el objeto viene vacío.
 *
 * C3 (sin comparativos) NO excluye ningún bloque: suprime la columna del
 * ejercicio anterior, y esta evaluación mira el ejercicio del reporte. C5
 * tampoco: el bloque del método de medición hay que escribirlo igual, solo que
 * declarando el método previo en lugar del Protocolo GEI.
 */
function excluidoPorRegimen(b: Bloque, regimen: Regimen, alivios: Alivios): string | null {
  if (regimen !== "primer_anio") return null;

  // C4 — sin Alcance 3 el primer ejercicio. Las emisiones financiadas son la
  // Categoría 15 de Alcance 3: el bloque entero se cae.
  if (alivios.C4 && b.clave === "emisiones_financiadas") {
    return "Alivio C4: las emisiones de Alcance 3 no se revelan en el primer ejercicio.";
  }

  // E5 NO APAGA NINGÚN BLOQUE. Acota el ALCANCE del informe a clima; la NIIF S1
  // sigue aplicando en lo pertinente a ese alcance, así que sus requisitos se
  // siguen exigiendo y sus huecos se siguen viendo. Lo que E5 sí hace es viajar
  // al prompt como instrucción de alcance: ver `banderaAlcanceE5()`.
  return null;
}

async function tenantDelReporte(supabase: Cliente, reporteId: string): Promise<string | null> {
  const { data } = await supabase
    .from("reportes")
    .select("tenant_id")
    .eq("id", reporteId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

function nombreTipo(t: TipoRegistro): string {
  if (t === "riesgo_fisico") return "riesgo físico";
  if (t === "riesgo_transicion") return "riesgo de transición";
  return "oportunidad";
}
