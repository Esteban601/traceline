import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { NOTA_VALIDACION_INTERNA, type OrigenSolicitud } from "@/lib/origen";

// =============================================================================
// ENSAMBLADOR DE DATOS DE UN REPORTE — la fuente única de "qué dice el reporte".
//
// Sale del route del export a Excel, donde la resolución del dato y su escritura
// en la plantilla vivían mezcladas. Aquí queda SOLO la resolución, que es lo
// reutilizable: el Excel, el Suplemento S1/S2 y (Fase B) el PDF tienen que decir
// exactamente lo mismo. Si el Excel dice 533.24, el suplemento dice 533.24.
//
// REGLA DE LA CASA: este módulo NO conoce ExcelJS ni ningún formato de salida.
// Devuelve datos planos —hoja, celda, valor, texto de nota— y quien escribe
// decide cómo pintarlos. Meter aquí una `Worksheet` volvería a atar el dato al
// Excel, que es justo lo que este archivo existe para evitar.
//
// QUÉ RESUELVE, en el orden en que importa:
//
//  1. RUBRO → SOLICITUD. `mapeo_export.rubro_clave` se busca en las solicitudes
//     DE ESTE REPORTE. La unicidad (reporte_id, rubro_taxonomia) garantiza a lo
//     sumo una, así que no hay ambigüedad que desempatar.
//  2. AÑO. Cada celda declara `anio_offset` (0 = el ejercicio del reporte,
//     1 = el comparativo). El ejercicio de la celda es ejercicio − offset.
//  3. VALOR. Solo si la solicitud está `validado`: gana la ÚLTIMA captura
//     confirmada de ese periodo (las capturas son APPEND ONLY y llegan asc, así
//     que la última pisa a las anteriores).
//  4. CAUSA DEL HUECO, cuando no hay valor. Son tres y NO son intercambiables:
//       · "Sin solicitud en el reporte" — el rubro está mapeado pero este
//         cliente no lo pidió. No falta evidencia: falta pedirla.
//       · "Pendiente de validación en plataforma (año)" — hay captura de ese
//         año, pero la solicitud no está validada.
//       · "Sin evidencia (año)" — no hay captura de ese año.
//  5. SALVEDADES. El perímetro declarado de la cifra (`solicitudes.nota_alcance`)
//     y, si la validó el propio cliente (`origen = 'cliente'`), la nota que lo
//     declara. El documento oficial se lee asumiendo la validación de la firma,
//     así que la excepción es la que hay que decir.
// =============================================================================

type Cliente = SupabaseClient<Database>;

export const NOTA_PENDIENTE = "Pendiente de validación en plataforma";
export const NOTA_SIN = "Sin evidencia";
export const NOTA_SIN_SOLICITUD = "Sin solicitud en el reporte";

// -----------------------------------------------------------------------------
// Filas crudas. Se exportan porque los escritores posicionales del Excel
// (registros, objetivos, cuestionarios) siguen viviendo en el route y las
// consumen; tenerlas declaradas dos veces es cómo se desincronizan.
// -----------------------------------------------------------------------------
export type MapeoRow = {
  hoja: string;
  celda: string;
  /** Años hacia atrás desde el ejercicio del reporte (0 = el del reporte). */
  anio_offset: number | null;
  /** Rubro canónico; se resuelve contra las solicitudes del reporte elegido. */
  rubro_clave: string | null;
  etiqueta: string | null;
  celda_nota: string | null;
};

/**
 * Solicitud del reporte, con lo que hace falta para juzgar si entregó. Se expone
 * porque el suplemento razona POR SOLICITUD (¿este datapoint tiene con qué
 * escribirse?) mientras el Excel razona por celda; los datos son los mismos.
 */
export type SolRow = {
  id: string;
  titulo: string;
  /** Lo que se le pidió al cliente, en su lenguaje. El redactor lo necesita para
   *  saber QUÉ mide una cifra; el Excel no, porque su etiqueta viene del mapeo. */
  descripcion: string | null;
  /** Unidad declarada al pedir el dato. Una cifra sin unidad no se puede redactar. */
  unidad_esperada: string | null;
  estado: string;
  origen: OrigenSolicitud;
  es_cuantitativa: boolean;
  rubro_taxonomia: string | null;
  nota_alcance: string | null;
};

/**
 * Veredicto de entrega de UNA solicitud para el ejercicio del reporte. Son las
 * mismas tres causas que el Excel escribe en sus notas, juzgadas con las mismas
 * reglas; lo único que cambia es la unidad: allá una celda-año, aquí la
 * solicitud entera.
 *
 *  · "entregado"             — hay dato utilizable y validado.
 *  · "pendiente_validacion"  — llegó algo, pero todavía no está validado.
 *  · "sin_evidencia"         — no llegó nada de ese ejercicio.
 *
 * Una solicitud CUANTITATIVA entrega una captura confirmada; una cualitativa
 * entrega una evidencia. Aplicarle a la cualitativa la regla de la captura la
 * dejaría siempre en "sin evidencia", que es falso y haría inútil el semáforo:
 * la mayoría de los requisitos del suplemento son cualitativos.
 */
export type EstadoEntrega = "entregado" | "pendiente_validacion" | "sin_evidencia";

export type EntregaSolicitud = {
  estado: EstadoEntrega;
  /** Valor vigente del ejercicio, solo si es cuantitativa y está entregada. */
  valor: number | null;
};

export type CapRow = {
  solicitud_id: string;
  valor: number;
  periodo: string | null;
  confirmado: boolean;
  created_at: string;
};

export type RegRow = {
  id: string;
  reporte_id: string;
  tipo: string;
  nombre: string;
  descripcion: string | null;
  horizontes: string[] | null;
  orden: number;
};

export type RegValRow = {
  registro_id: string;
  ejercicio: number;
  cantidad_activos: number | null;
  porcentaje: number | null;
  capital_gasto: number | null;
  capital_financiacion: number | null;
  capital_inversion: number | null;
  created_at: string;
};

export type ObjRow = {
  id: string;
  reporte_id: string;
  ambito: string;
  naturaleza: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  metrica: string | null;
  meta: string | null;
  parte_entidad: string | null;
  periodo_aplicacion: string | null;
  periodo_base: string | null;
  hito_intermedio: string | null;
  tipo_objetivo: string | null;
  alineacion_acuerdo_internacional: string | null;
  orden: number;
};

export type ObjDetRow = {
  objetivo_id: string;
  validacion_tercero: string | null;
  procesos_revision: string | null;
  metricas_supervision: string | null;
  revisiones: string | null;
  resultados: string | null;
  analisis_tendencias: string | null;
  gases_cubiertos: string | null;
  alcances_cubiertos: string | null;
  bruto_neto: string | null;
  enfoque_descarbonizacion: string | null;
  notas: string | null;
};

export type CuestRow = {
  reporte_id: string;
  hoja: string;
  pregunta_orden: number;
  respuesta: string | null;
  tipo_dato: string | null;
  notas: string | null;
};

export type TenantReporte = {
  nombre: string;
  slug: string | null;
  es_demo: boolean;
};

export type ReporteEnsamblado = {
  id: string;
  nombre: string;
  ejercicio: number;
  tenant: TenantReporte | null;
};

// -----------------------------------------------------------------------------
// Lo que se resuelve
// -----------------------------------------------------------------------------

/** Una celda con texto literal del mapeo (categoría verbatim, unidad). */
export type CeldaEtiqueta = {
  tipo: "etiqueta";
  hoja: string;
  celda: string;
  texto: string;
};

/** Una celda con cifra resuelta contra las solicitudes del reporte. */
export type CeldaValor = {
  tipo: "valor";
  hoja: string;
  celda: string;
  valor: number;
  /** De qué solicitud salió y de qué año: es la trazabilidad de la cifra. */
  solicitudId: string;
  ejercicio: number;
};

export type CeldaResuelta = CeldaEtiqueta | CeldaValor;

/**
 * Nota de una FILA (no de una celda): concentra las causas de hueco de todas sus
 * celdas-año, el perímetro y quién validó. `texto` ya viene en el orden de
 * lectura de un revisor —primero lo que falta, luego qué comprende lo que sí
 * está, al final quién lo validó— y vacío si no hay nada que declarar.
 */
export type NotaFila = {
  hoja: string;
  celda: string;
  texto: string;
  /** Desglose, para quien quiera renderizarlo de otra forma (el suplemento). */
  sinSolicitud: boolean;
  causasPorAnio: { ejercicio: number; texto: string }[];
  alcances: string[];
  validacionInterna: boolean;
};

export type ConteosEnsamblado = {
  etiquetas: number;
  llenadas: number;
  huecosPendiente: number;
  huecosSin: number;
  huecosSinSolicitud: number;
  validacionesInternas: number;
  alcancesDeclarados: number;
};

export type Ensamblado = {
  reporte: ReporteEnsamblado;
  celdas: CeldaResuelta[];
  notas: NotaFila[];
  conteos: ConteosEnsamblado;
  /** Última fila tocada por hoja: quien escribe la usa para colocar su pie. */
  filaMaximaPorHoja: Map<string, number>;
  /**
   * Descripción oficial de cada datapoint, por código EXACTO. La hoja principal
   * del Excel la escribe desde aquí en vez de llevarla congelada en la plantilla:
   * cuando se corrige el catálogo, el libro sale corregido sin tocar el .xlsx.
   */
  descripcionesDatapoint: Map<string, string>;
  /** Solicitudes del reporte (sin declinadas ni desactivadas), como las vio la resolución. */
  solicitudes: SolRow[];
  /** Veredicto de entrega por solicitud para el ejercicio del reporte. */
  entregaPorSolicitud: Map<string, EntregaSolicitud>;
  /** Crudos para los bloques de escritura posicional (4 hojas de registros, 5 de objetivos, 3 de cuestionarios). */
  registros: RegRow[];
  /** Valor vigente por (registro, ejercicio): la última fila insertada gana. */
  vigentePorRegistro: Map<string, Map<number, RegValRow>>;
  objetivos: ObjRow[];
  detallePorObjetivo: Map<string, ObjDetRow>;
  cuestionarios: CuestRow[];
};

/**
 * Por qué no se pudo ensamblar. Se devuelve en vez de lanzar para que cada
 * consumidor elija su respuesta: el route HTTP mapea a 404/422/500, el
 * suplemento mostrará otra cosa.
 */
export type CausaFallo =
  | "reporte_ilegible"
  | "reporte_no_existe"
  | "mapeo_ilegible"
  | "mapeo_vacio";

export type ResultadoEnsamblado =
  | ({ ok: true } & Ensamblado)
  | { ok: false; causa: CausaFallo };

export type OpcionesEnsamblado = {
  /**
   * Hojas que el destino puede escribir. Cuando se pasa, el mapeo que apunte a
   * una hoja ausente se ignora por completo —celda, nota y conteos—, que es lo
   * que hacía el export al saltarse las hojas que la plantilla no trae. Sin
   * ella se resuelve todo el mapeo, que es lo que quiere un consumidor sin
   * plantilla (el suplemento).
   */
  hojasDisponibles?: Set<string>;
};

/**
 * Resuelve TODO lo que dice un reporte, sin escribir nada.
 *
 * Las ocho consultas van en paralelo y todas se acotan por `reporte_id`, salvo
 * `mapeo_export`, que es la definición reutilizable de la plantilla y no
 * pertenece a ningún cliente. RLS ya limita al usuario de la sesión; el filtro
 * explícito es la segunda barrera, y es la que impide que un reporte ajeno se
 * cuele si algún día este módulo corre con `service_role`.
 */
export async function ensamblarReporte(
  supabase: Cliente,
  reporteId: string,
  opciones: OpcionesEnsamblado = {}
): Promise<ResultadoEnsamblado> {
  const { data: reporteRaw, error: repErr } = await supabase
    .from("reportes")
    .select(
      "id, nombre, ejercicio, tenant:tenants!reportes_tenant_id_fkey(nombre, slug, es_demo)"
    )
    .eq("id", reporteId)
    .maybeSingle();

  if (repErr) return { ok: false, causa: "reporte_ilegible" };
  if (!reporteRaw) return { ok: false, causa: "reporte_no_existe" };

  const reporte: ReporteEnsamblado = {
    id: reporteRaw.id,
    nombre: reporteRaw.nombre,
    ejercicio: reporteRaw.ejercicio,
    tenant: (reporteRaw.tenant as unknown as TenantReporte | null) ?? null,
  };

  const [
    { data: mapeo, error: mapErr },
    { data: sols },
    { data: caps },
    { data: registros },
    { data: regValores },
    { data: objetivos },
    { data: objDetalle },
    { data: cuestionarios },
    { data: evidencias },
    { data: catalogo },
  ] = await Promise.all([
    supabase
      .from("mapeo_export")
      .select("hoja, celda, anio_offset, rubro_clave, etiqueta, celda_nota")
      .eq("activo", true),
    supabase
      // `origen` decide QUIÉN validó (regla dura de lib/origen.ts) y por tanto si
      // la celda lleva la nota de validación interna del cliente. `nota_alcance`
      // es la salvedad de perímetro de la cifra, redactada para el entregable.
      .from("solicitudes")
      .select(
        "id, titulo, descripcion, unidad_esperada, estado, origen, es_cuantitativa, rubro_taxonomia, nota_alcance"
      )
      .eq("reporte_id", reporteId)
      // Las copias de difusión declinadas o retiradas quedan fuera del entregable
      // oficial: no son una brecha de evidencia ("falta el dato") sino un "no
      // aplica a esa área", y de todas formas una difusión nunca lleva rubro.
      .eq("declinada", false)
      .eq("desactivada", false),
    // Capturas del reporte: se filtran por la solicitud embebida (!inner) en vez
    // de traer las de todas las emisoras y descartarlas en memoria.
    supabase
      .from("capturas_valor")
      .select(
        "solicitud_id, valor, periodo, confirmado, created_at, solicitud:solicitudes!inner(reporte_id)"
      )
      .eq("solicitud.reporte_id", reporteId)
      .order("created_at", { ascending: true }),
    supabase
      .from("registros_clima")
      .select("id, reporte_id, tipo, nombre, descripcion, horizontes, orden")
      .eq("reporte_id", reporteId)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("registros_clima_valores")
      .select(
        "registro_id, ejercicio, cantidad_activos, porcentaje, capital_gasto, capital_financiacion, capital_inversion, created_at, registro:registros_clima!inner(reporte_id)"
      )
      .eq("registro.reporte_id", reporteId)
      .order("created_at", { ascending: true }),
    supabase
      .from("objetivos")
      .select(
        "id, reporte_id, ambito, naturaleza, nombre, descripcion, tipo, metrica, meta, parte_entidad, periodo_aplicacion, periodo_base, hito_intermedio, tipo_objetivo, alineacion_acuerdo_internacional, orden"
      )
      .eq("reporte_id", reporteId)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("objetivos_detalle")
      .select(
        "objetivo_id, validacion_tercero, procesos_revision, metricas_supervision, revisiones, resultados, analisis_tendencias, gases_cubiertos, alcances_cubiertos, bruto_neto, enfoque_descarbonizacion, notas, objetivo:objetivos!inner(reporte_id)"
      )
      .eq("objetivo.reporte_id", reporteId),
    supabase
      .from("cuestionarios_respuestas")
      .select("reporte_id, hoja, pregunta_orden, respuesta, tipo_dato, notas")
      .eq("reporte_id", reporteId),
    // Qué solicitudes tienen al menos un archivo. Es lo que hace que una
    // solicitud CUALITATIVA pueda considerarse entregada: no tiene capturas, así
    // que su entrega es la evidencia. El Excel no lo usa; el suplemento sí.
    supabase
      .from("evidencias")
      .select("solicitud_id, solicitud:solicitudes!inner(reporte_id)")
      .eq("solicitud.reporte_id", reporteId),
    // El catálogo entero: es global, no del reporte, y son 98 filas cortas.
    supabase.from("datapoints_taxonomia").select("codigo, descripcion").eq("activo", true),
  ]);

  if (mapErr || !mapeo) return { ok: false, causa: "mapeo_ilegible" };
  if (mapeo.length === 0) return { ok: false, causa: "mapeo_vacio" };

  // ---------------------------------------------------------------------------
  // Índices auxiliares. `sols` ya viene acotado al reporte, así que estos índices
  // no pueden alcanzar datos de otro cliente.
  // ---------------------------------------------------------------------------
  const estadoSol = new Map<string, string>();
  const origenSol = new Map<string, OrigenSolicitud>();
  const alcanceSol = new Map<string, string>();
  // Rubro canónico → solicitud DE ESTE REPORTE que lo alimenta.
  const solPorRubro = new Map<string, string>();
  const solicitudes = (sols ?? []) as SolRow[];
  for (const s of solicitudes) {
    estadoSol.set(s.id, s.estado);
    origenSol.set(s.id, s.origen);
    if (s.nota_alcance) alcanceSol.set(s.id, s.nota_alcance.trim());
    if (s.rubro_taxonomia) solPorRubro.set(s.rubro_taxonomia, s.id);
  }

  // Capturas por solicitud (llegan asc → la última confirmada por periodo gana).
  const capsPorSol = new Map<string, CapRow[]>();
  for (const c of (caps ?? []) as CapRow[]) {
    const arr = capsPorSol.get(c.solicitud_id) ?? [];
    arr.push(c);
    capsPorSol.set(c.solicitud_id, arr);
  }
  const ultimaConfirmada = (solId: string, ejercicio: number): number | null => {
    const arr = capsPorSol.get(solId);
    if (!arr) return null;
    let v: number | null = null;
    for (const c of arr) {
      if (c.confirmado && c.periodo === String(ejercicio)) v = c.valor; // asc → última gana
    }
    return v;
  };
  // ¿Existe alguna captura para ese periodo (confirmada o no)? Distingue la causa
  // real del hueco de una celda-año: hay captura del año pero sin validar (→
  // pendiente) vs. no hay captura de ese año (→ sin evidencia).
  const hayCapturaDe = (solId: string, ejercicio: number): boolean =>
    (capsPorSol.get(solId) ?? []).some((c) => c.periodo === String(ejercicio));

  // ---------------------------------------------------------------------------
  // Veredicto de entrega POR SOLICITUD, para el ejercicio del reporte. Mismas
  // reglas que las celdas, distinta unidad. Se calcula aquí, y no en quien
  // consume, para que el Excel y el suplemento no puedan discrepar sobre si una
  // solicitud entregó.
  // ---------------------------------------------------------------------------
  const conEvidencia = new Set<string>();
  for (const e of (evidencias ?? []) as { solicitud_id: string }[]) {
    conEvidencia.add(e.solicitud_id);
  }

  const entregaPorSolicitud = new Map<string, EntregaSolicitud>();
  for (const sol of solicitudes) {
    const validada = sol.estado === "validado";
    if (sol.es_cuantitativa) {
      const valor = validada ? ultimaConfirmada(sol.id, reporte.ejercicio) : null;
      if (valor != null) {
        entregaPorSolicitud.set(sol.id, { estado: "entregado", valor });
      } else {
        entregaPorSolicitud.set(sol.id, {
          estado: hayCapturaDe(sol.id, reporte.ejercicio) ? "pendiente_validacion" : "sin_evidencia",
          valor: null,
        });
      }
      continue;
    }
    // Cualitativa: entrega un archivo, no una cifra.
    const tiene = conEvidencia.has(sol.id);
    entregaPorSolicitud.set(sol.id, {
      estado: !tiene ? "sin_evidencia" : validada ? "entregado" : "pendiente_validacion",
      valor: null,
    });
  }

  // Valor vigente por (registro, ejercicio): la última fila insertada gana
  // (valores llegan asc por created_at → APPEND ONLY, corrección = fila nueva).
  const vigentePorRegistro = new Map<string, Map<number, RegValRow>>();
  for (const v of (regValores ?? []) as RegValRow[]) {
    const porAnio = vigentePorRegistro.get(v.registro_id) ?? new Map<number, RegValRow>();
    porAnio.set(v.ejercicio, v);
    vigentePorRegistro.set(v.registro_id, porAnio);
  }

  const detallePorObjetivo = new Map<string, ObjDetRow>();
  for (const d of (objDetalle ?? []) as ObjDetRow[]) detallePorObjetivo.set(d.objetivo_id, d);

  // ---------------------------------------------------------------------------
  // Resolución del mapeo
  // ---------------------------------------------------------------------------
  const { hojasDisponibles } = opciones;
  const celdas: CeldaResuelta[] = [];
  const filaMaximaPorHoja = new Map<string, number>();
  const conteos: ConteosEnsamblado = {
    etiquetas: 0,
    llenadas: 0,
    huecosPendiente: 0,
    huecosSin: 0,
    huecosSinSolicitud: 0,
    validacionesInternas: 0,
    alcancesDeclarados: 0,
  };

  // Causa del hueco POR CELDA-AÑO, acumulada por celda de nota (una fila puede
  // tener varias celdas-año vacías con causas distintas).
  type NotaAcum = {
    hoja: string;
    celda: string;
    causas: Map<number, string>;
    /** La fila entera no tiene solicitud en el reporte: una nota, sin años. */
    sinSolicitud: boolean;
    /** Al menos un valor de la fila lo validó el propio cliente. */
    validacionInterna: boolean;
    /**
     * Salvedades de PERÍMETRO de las solicitudes que alimentan la fila. Es un
     * Set porque una fila puede resolverse con más de una solicitud y no tiene
     * sentido repetir la misma aclaración.
     */
    alcances: Set<string>;
  };
  const acum = new Map<string, NotaAcum>();

  const filaDe = (celda: string): number => parseInt(celda.replace(/[^0-9]/g, ""), 10);

  for (const m of mapeo as MapeoRow[]) {
    // Hoja ausente en el destino: se ignora con seguridad, igual que hacía el
    // export cuando la plantilla no traía la hoja.
    if (hojasDisponibles && !hojasDisponibles.has(m.hoja)) continue;

    filaMaximaPorHoja.set(
      m.hoja,
      Math.max(filaMaximaPorHoja.get(m.hoja) ?? 0, filaDe(m.celda))
    );

    // Celda de etiqueta: texto literal (categoría verbatim / unidad).
    if (m.etiqueta != null) {
      celdas.push({ tipo: "etiqueta", hoja: m.hoja, celda: m.celda, texto: m.etiqueta });
      conteos.etiquetas++;
      continue;
    }

    // Celda de valor: el rubro se resuelve contra las solicitudes del reporte y
    // el año relativo contra su ejercicio.
    if (!m.rubro_clave || m.anio_offset == null) continue;
    const ejercicioCelda = reporte.ejercicio - m.anio_offset;
    const solicitudId = solPorRubro.get(m.rubro_clave);

    const clave = m.celda_nota ? `${m.hoja}!${m.celda_nota}` : null;
    const entradaNota = (): NotaAcum => {
      const entry = acum.get(clave!) ?? {
        hoja: m.hoja,
        celda: m.celda_nota!,
        causas: new Map<number, string>(),
        sinSolicitud: false,
        validacionInterna: false,
        alcances: new Set<string>(),
      };
      acum.set(clave!, entry);
      return entry;
    };

    // El reporte de este cliente no pide este rubro: la celda queda vacía con su
    // propia causa, distinta de "falta evidencia" (aquí falta la solicitud).
    if (!solicitudId) {
      if (clave) entradaNota().sinSolicitud = true;
      continue;
    }

    // La salvedad de perímetro acompaña a la FILA en cuanto la resuelve esta
    // solicitud, tenga o no valor ese año: describe qué comprende la cifra de la
    // fila, no el resultado de una celda concreta.
    const alcance = alcanceSol.get(solicitudId);
    if (clave && alcance) entradaNota().alcances.add(alcance);

    const estado = estadoSol.get(solicitudId);
    const valor = estado === "validado" ? ultimaConfirmada(solicitudId, ejercicioCelda) : null;

    if (valor != null) {
      celdas.push({
        tipo: "valor",
        hoja: m.hoja,
        celda: m.celda,
        valor,
        solicitudId,
        ejercicio: ejercicioCelda,
      });
      conteos.llenadas++;
      // Trazabilidad de la FUENTE de la validación. Se marca la NOTA una vez,
      // aunque la fila tenga varias celdas-año validadas por el mismo lado.
      if (clave && origenSol.get(solicitudId) === "cliente") {
        const nota = entradaNota();
        if (!nota.validacionInterna) {
          nota.validacionInterna = true;
          conteos.validacionesInternas++;
        }
      }
    } else if (clave) {
      // Regla dura: valor no validado/ausente NO entra. La causa se decide POR
      // CELDA-AÑO: hay captura de ese periodo pero sin validar (→ pendiente) vs.
      // no hay captura de ese periodo (→ sin evidencia). Cada causa lleva su año.
      const causa = hayCapturaDe(solicitudId, ejercicioCelda)
        ? `${NOTA_PENDIENTE} (${ejercicioCelda})`
        : `${NOTA_SIN} (${ejercicioCelda})`;
      entradaNota().causas.set(ejercicioCelda, causa);
    }
  }

  // ---------------------------------------------------------------------------
  // Texto de las notas. Orden de lectura para un revisor: primero lo que FALTA
  // (las brechas), luego qué COMPRENDE lo que sí está (el perímetro) y al final
  // quién lo validó.
  // ---------------------------------------------------------------------------
  const notas: NotaFila[] = [];
  for (const n of acum.values()) {
    const partes: string[] = [];
    if (n.sinSolicitud) {
      // Se ANTEPONE en vez de sustituir: hoy una celda de nota corresponde a un
      // solo rubro, pero si mañana el mapeo apuntara dos rubros a la misma nota,
      // no se pueden perder las causas por año del rubro que sí está.
      partes.push(NOTA_SIN_SOLICITUD);
      conteos.huecosSinSolicitud++;
    }

    const anios = [...n.causas.keys()].sort((a, b) => a - b);
    const causasPorAnio: { ejercicio: number; texto: string }[] = [];
    for (const a of anios) {
      const texto = n.causas.get(a)!;
      partes.push(texto);
      causasPorAnio.push({ ejercicio: a, texto });
      if (texto.startsWith(NOTA_PENDIENTE)) conteos.huecosPendiente++;
      else conteos.huecosSin++;
    }

    const alcances = [...n.alcances];
    for (const a of alcances) {
      partes.push(a);
      conteos.alcancesDeclarados++;
    }
    if (n.validacionInterna) partes.push(NOTA_VALIDACION_INTERNA);

    notas.push({
      hoja: n.hoja,
      celda: n.celda,
      // Vacío cuando no hay nada que declarar: quien escribe NO debe tocar la
      // celda entonces, porque sobreescribir con "" borraría lo que la plantilla
      // oficial ya trae ahí.
      texto: partes.join("; "),
      sinSolicitud: n.sinSolicitud,
      causasPorAnio,
      alcances,
      validacionInterna: n.validacionInterna,
    });
  }

  return {
    ok: true,
    reporte,
    celdas,
    notas,
    conteos,
    filaMaximaPorHoja,
    descripcionesDatapoint: new Map(
      ((catalogo ?? []) as { codigo: string; descripcion: string }[]).map((d) => [
        d.codigo.trim(),
        d.descripcion,
      ])
    ),
    solicitudes,
    entregaPorSolicitud,
    registros: (registros ?? []) as RegRow[],
    vigentePorRegistro,
    objetivos: (objetivos ?? []) as ObjRow[],
    detallePorObjetivo,
    cuestionarios: (cuestionarios ?? []) as CuestRow[],
  };
}
