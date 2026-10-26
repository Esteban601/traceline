import type { Ensamblado } from "@/lib/reporte/ensamblar";

// =============================================================================
// INSTANCIAS DE MÉTRICAS NIIF S1 46–50 (tercera lectura del Formato electrónico,
// decisiones de Esteban del 14 de octubre de 2026). UNA FUENTE para el Formato
// electrónico (filas 145–185 iteradas) y para la hoja «NIIF S1 46-50» del Excel
// de taxonomía: misma fuente, mismo contenido.
//
// Por riesgo u oportunidad de los registros de clima, sus métricas de NIIF S2
// 29: las que eligió el consultor (`registros_clima.metricas_asociadas`) o, si
// no eligió, la regla por defecto (transición → 29(b), 29(e); físico → 29(c),
// 29(e); oportunidad → 29(d), 29(e)). 29(a) GEI solo donde el riesgo lo pida.
//
// CADA INSTANCIA LLEVA SOLO LOS DATOS DE SU RIESGO (punto 1): el método y los
// datos utilizados salen de las capturas validadas de ESE registro (sus notas y
// sus valores del ejercicio). Si la métrica es de otro tipo que el registro
// (p. ej. 29(d) en un riesgo de transición), salen de los registros de ese tipo
// que comparten tema con el riesgo. La GEI usa el método de medición de GEI.
// Sin modelo: todo es dato capturado o respuesta aprobada.
//
// VERIFICACIÓN (punto 3): «No» cuando la métrica no tiene un hecho de
// verificación externa; solo la GEI lleva al verificador y el nivel.
// =============================================================================

export type ClaveMetrica = "a" | "b" | "c" | "d" | "e";

export const METRICAS_S2_29: Record<ClaveMetrica, { codigo: string; parrafo: string; nombre: string; tipoMedida: string; tipoRegistro: string | null }> = {
  a: { codigo: "NIIF S2 29 (a)(i)", parrafo: "29(a)", nombre: "Emisiones brutas de gases de efecto invernadero de Alcances 1 y 2 (tCO2e)", tipoMedida: "Medida absoluta", tipoRegistro: null },
  b: { codigo: "NIIF S2 29 (b)", parrafo: "29(b)", nombre: "Activos o actividades vulnerables a riesgos de transición (cantidad y porcentaje)", tipoMedida: "Medida absoluta; Medida expresada con relación a otra métrica", tipoRegistro: "riesgo_transicion" },
  c: { codigo: "NIIF S2 29 (c)", parrafo: "29(c)", nombre: "Activos o actividades vulnerables a riesgos físicos (cantidad y porcentaje)", tipoMedida: "Medida absoluta; Medida expresada con relación a otra métrica", tipoRegistro: "riesgo_fisico" },
  d: { codigo: "NIIF S2 29 (d)", parrafo: "29(d)", nombre: "Activos o actividades alineados con oportunidades relacionadas con el clima (cantidad y porcentaje)", tipoMedida: "Medida absoluta; Medida expresada con relación a otra métrica", tipoRegistro: "oportunidad" },
  e: { codigo: "NIIF S2 29 (e)", parrafo: "29(e)", nombre: "Despliegue de capital (CAPEX, financiación, inversión) hacia riesgos y oportunidades climáticos", tipoMedida: "Medida absoluta", tipoRegistro: null },
};

export const METRICAS_POR_DEFECTO: Record<string, ClaveMetrica[]> = { riesgo_transicion: ["b", "e"], riesgo_fisico: ["c", "e"], oportunidad: ["d", "e"] };

export type InstanciaMetrica = {
  riesgo: string;
  tipoRegistro: string;
  clave: ClaveMetrica;
  nombre: string;
  parrafo: string;
  descripcion: string;
  tipoMedida: string;
  verificacion: string;
  metodo: string;
};

type Registro = { id: string; tipo: string; nombre: string; descripcion: string | null; metricas_asociadas: string[] | null };
type Valor = { cantidad_activos: number | null; porcentaje: number | null; capital_gasto: number | null; capital_financiacion: number | null; capital_inversion: number | null; notas: string | null } | null;

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const limpio = (n: string) => n.replace(/\[DEMO\]\s*/i, "").trim();
const palabras = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 7));

export type InsumosInstancias = {
  registros: Registro[];
  valorDe: (registroId: string) => Valor;
  ejercicio: number;
  /** Emisiones del ejercicio por alcance, de capturas confirmadas («Alcance 1: 1,240 tCO2e»). */
  gei: string[];
  /** Método de medición de GEI del documento aprobado (respuesta de NIIF S2 29 (a)(iii)), si lo hay. */
  metodoGei: string | null;
  /** Cláusula del hecho de verificación externa del inventario GEI, si lo hay. */
  verificacionGei: string | null;
  /** Hay un documento aprobado: sin él no se sabe qué está verificado y la columna queda vacía. */
  hayDocumentoAprobado: boolean;
  descripciones: Record<string, string>;
};

/** Las métricas de un registro: las elegidas por el consultor o la regla por defecto. */
export function metricasDe(r: Pick<Registro, "tipo" | "metricas_asociadas">): ClaveMetrica[] {
  const elegidas = (r.metricas_asociadas ?? []).filter((k): k is ClaveMetrica => k in METRICAS_S2_29);
  return elegidas.length ? [...new Set(elegidas)].sort() : METRICAS_POR_DEFECTO[r.tipo] ?? [];
}

export function instanciasDeMetricas(x: InsumosInstancias): { riesgos: InstanciaMetrica[]; oportunidades: InstanciaMetrica[] } {
  const datosDe = (r: Registro, capital: boolean): string => {
    const v = x.valorDe(r.id);
    if (!v) return "";
    const cifras = capital
      ? ([["gasto de capital", v.capital_gasto], ["financiación", v.capital_financiacion], ["inversión", v.capital_inversion]] as const).filter(([, n]) => n != null).map(([k, n]) => `${k} ${NUM.format(n as number)}`)
      : [v.cantidad_activos != null ? `cantidad ${NUM.format(v.cantidad_activos)}` : null, v.porcentaje != null ? `${NUM.format(v.porcentaje)} %` : null].filter((s): s is string => !!s);
    // Captura del ejercicio sin capital: la emisora no asignó capital (decisión de Esteban, cuarta lectura): se
    // declara en negativo. Sin la cifra que pide otra métrica, no hay datos que publicar (regla 8): vacía.
    if (!cifras.length) return capital ? `«${limpio(r.nombre)}»: Sin despliegue de capital asignado en ${x.ejercicio}.` : "";
    return `«${limpio(r.nombre)}»: ${[cifras.join(", "), v.notas?.trim() || null].filter(Boolean).join(". ")}`;
  };
  const fuentes = (r: Registro, tipo: string): Registro[] => {
    if (r.tipo === tipo) return [r];
    const candidatos = x.registros.filter((y) => y.tipo === tipo);
    const temaR = palabras(`${r.nombre} ${r.descripcion ?? ""}`);
    const conTema = candidatos.filter((y) => [...palabras(`${y.nombre} ${y.descripcion ?? ""}`)].some((w) => temaR.has(w)));
    return conTema.length ? conTema : candidatos;
  };
  const metodo = (r: Registro, k: ClaveMetrica): string => {
    if (k === "a") {
      // Voz de la emisora (encargo formato-afirmaciones-y-voz): sin «capturas validadas» ni «registros de clima».
      const datos = x.gei.length ? `Emisiones del ejercicio ${x.ejercicio}: ${x.gei.join("; ")}.` : "";
      return [x.metodoGei, datos].filter(Boolean).join(" ");
    }
    const m = METRICAS_S2_29[k];
    const de = k === "e" ? [r] : fuentes(r, m.tipoRegistro!);
    const lineas = de.map((y) => datosDe(y, k === "e")).filter(Boolean);
    return lineas.length ? `Cifras del ejercicio ${x.ejercicio}. ${lineas.join(" ")}` : "";
  };
  const de = (tipos: string[]) =>
    x.registros
      .filter((r) => tipos.includes(r.tipo))
      .flatMap((r) =>
        metricasDe(r).map((k) => ({
          riesgo: limpio(r.nombre),
          tipoRegistro: r.tipo,
          clave: k,
          nombre: METRICAS_S2_29[k].nombre,
          parrafo: METRICAS_S2_29[k].parrafo,
          descripcion: x.descripciones[METRICAS_S2_29[k].codigo] ?? METRICAS_S2_29[k].nombre,
          tipoMedida: METRICAS_S2_29[k].tipoMedida,
          verificacion: !x.hayDocumentoAprobado ? "" : k === "a" && x.verificacionGei ? `Sí, ${x.verificacionGei}` : "No",
          metodo: metodo(r, k),
        }))
      );
  return { riesgos: de(["riesgo_transicion", "riesgo_fisico"]), oportunidades: de(["oportunidad"]) };
}

/** Insumos de las instancias desde el ensamblado (capturas y registros) y lo aprobado (método GEI y verificación). */
export function insumosDeInstancias(ens: Ensamblado, extra: { metodoGei: string | null; verificacionGei: string | null; hayDocumentoAprobado: boolean }): InsumosInstancias {
  const ejercicio = ens.reporte.ejercicio;
  const gei = (["1", "2"] as const).flatMap((a) => {
    const s = ens.solicitudes.find((y) => y.rubro_taxonomia === `gei_alcance_${a}`);
    const e = s ? ens.entregaPorSolicitud.get(s.id) : null;
    return s && e?.estado === "entregado" && e.valor != null ? [`Alcance ${a}: ${NUM.format(e.valor)}${s.unidad_esperada ? ` ${s.unidad_esperada}` : ""}`] : [];
  });
  return {
    registros: ens.registros.map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, descripcion: r.descripcion, metricas_asociadas: r.metricas_asociadas })),
    valorDe: (id) => ens.vigentePorRegistro.get(id)?.get(ejercicio) ?? null,
    ejercicio,
    gei,
    metodoGei: extra.metodoGei,
    verificacionGei: extra.verificacionGei,
    hayDocumentoAprobado: extra.hayDocumentoAprobado,
    descripciones: Object.fromEntries([...ens.descripcionesDatapoint].filter(([c]) => Object.values(METRICAS_S2_29).some((m) => m.codigo === c))),
  };
}

/** La cláusula de verificación de un hecho («inventario verificado por …, con aseguramiento limitado»), sin el resto de la oración. */
export function clausulaDeVerificacion(enunciado: string | null): string | null {
  if (!enunciado) return null;
  // Hasta el nivel de aseguramiento, si lo dice (el nombre del verificador puede llevar puntos: «S.C.»).
  const conNivel = enunciado.match(/(inventario[^;]*?verificad[oa] por[^;]*?aseguramiento (?:limitado|razonable))/i);
  if (conNivel) return `${conNivel[1].replace(/\s+/g, " ").trim()}.`;
  const sinNivel = enunciado.match(/(inventario[^;]*?verificad[oa] por [^;]*?)(?:\.\s|\.$|$)/i);
  return sinNivel ? `${sinNivel[1].replace(/\s+/g, " ").trim()}.` : null;
}
