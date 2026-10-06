import type { Ensamblado, SolRow } from "@/lib/reporte/ensamblar";
import { rubroExento } from "@/lib/suplemento/bloques";
import { nivelDeSeveridad, severidadEfectiva, leerHorizontes, leerMatriz } from "@/lib/perfil-emisor";
import type { Alivios } from "@/lib/perfil-emisor";
import type { BloqueEvaluado } from "@/lib/suplemento/completitud";
import type { FuenteEntregada } from "@/lib/suplemento/prompt";

// =============================================================================
// LAS TABLAS DEL SUPLEMENTO LAS ARMA EL CÓDIGO, UNA FUNCIÓN POR BLOQUE.
//
// POR QUÉ NO LAS ESCRIBE EL MODELO. Una cifra que pasa por el modelo puede salir
// redondeada, convertida de unidad o «corregida». Las tablas son la parte del
// documento donde el dato va desnudo, así que se construyen desde el ensamblador
// y el modelo las recibe ya compuestas, para redactar alrededor.
//
// POR QUÉ UNA FUNCIÓN POR BLOQUE Y NO UNA GENÉRICA. Cada tabla tiene columnas,
// orden y criterio de exclusión propios: la de objetivos lista ocho atributos por
// fila, la de exposición cruza tipo de riesgo con ejercicio, la de horizontes
// sale del Perfil y no del reporte. Una función genérica con quince banderas
// sería más difícil de leer que once funciones cortas, y cada cambio en una
// arriesgaría las demás.
//
// TODAS SON DETERMINISTAS: mismos datos, misma tabla, carácter por carácter.
// Ninguna consulta la base; reciben lo que el ensamblador ya trajo.
// =============================================================================

export type CtxTabla = {
  ens: Ensamblado;
  evaluado: BloqueEvaluado;
  perfil: Record<string, unknown> | null;
  alivios: Alivios;
  /** Las fuentes que la tabla use se empujan aquí, para que el modelo pueda citarlas. */
  fuentes: FuenteEntregada[];
};

export type ConstructorTabla = (c: CtxTabla) => string | null;

const NUM = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
const num = (v: number | null | undefined): string => (v == null ? "—" : NUM.format(v));
const txt = (v: string | null | undefined): string =>
  v == null || !String(v).trim() ? "—" : String(v).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** Arma una tabla markdown. Devuelve null si no hay una sola fila: un bloque sin
 *  datos no lleva una tabla vacía, lleva su marcador de pendiente. */
function tabla(titulo: string, cols: string[], filas: string[][], alinear?: ("izq" | "der")[]): string | null {
  if (filas.length === 0) return null;
  const sep = cols.map((_, i) => (alinear?.[i] === "der" ? "---:" : "---"));
  return [
    `**${titulo}**`,
    "",
    `| ${cols.join(" | ")} |`,
    `|${sep.join("|")}|`,
    ...filas.map((f) => `| ${f.join(" | ")} |`),
  ].join("\n");
}

const TIPO_LABEL: Record<string, string> = {
  riesgo_fisico: "Riesgo físico",
  riesgo_transicion: "Riesgo de transición",
  oportunidad: "Oportunidad",
};

const limpiar = (s: string): string => s.replace(/\[DEMO\]\s*/i, "").trim();

// -----------------------------------------------------------------------------
// Piezas compartidas
// -----------------------------------------------------------------------------

/** Registros de clima de ciertos tipos, con su valor vigente del ejercicio. */
function registrosDe(c: CtxTabla, tipos: string[]) {
  return c.ens.registros
    .filter((r) => tipos.includes(r.tipo))
    .map((r) => ({
      r,
      v: c.ens.vigentePorRegistro.get(r.id)?.get(c.ens.reporte.ejercicio) ?? null,
    }));
}

function citarRegistro(c: CtxTabla, id: string, nombre: string, tipo: string) {
  const fid = `reg:${id}`;
  if (!c.fuentes.some((f) => f.id === fid)) {
    c.fuentes.push({ id: fid, tipo: "registro", detalle: `Registro de clima: ${nombre} (${tipo})` });
  }
  return fid;
}

function citarObjetivo(c: CtxTabla, id: string, nombre: string) {
  const fid = `obj:${id}`;
  if (!c.fuentes.some((f) => f.id === fid)) {
    c.fuentes.push({ id: fid, tipo: "objetivo", detalle: `Objetivo: ${nombre}` });
  }
  return fid;
}

/** Solicitudes cuantitativas del bloque que entregaron, sin las que un alivio exime. */
function cifrasDelBloque(c: CtxTabla): { s: SolRow; valor: number }[] {
  return c.evaluado.solicitudes
    .map((id) => c.ens.solicitudes.find((x) => x.id === id))
    .filter((s): s is SolRow => !!s && s.es_cuantitativa && !rubroExento(s.rubro_taxonomia, c.alivios))
    .map((s) => ({ s, e: c.ens.entregaPorSolicitud.get(s.id) }))
    .filter((x) => x.e?.estado === "entregado" && x.e.valor != null)
    .map(({ s, e }) => {
      const fid = `sol:${s.id}`;
      if (!c.fuentes.some((f) => f.id === fid)) {
        c.fuentes.push({
          id: fid,
          tipo: "solicitud",
          detalle: `${s.titulo} — valor ${e!.valor}${s.unidad_esperada ? " " + s.unidad_esperada : ""}`,
        });
      }
      return { s, valor: e!.valor! };
    });
}

// -----------------------------------------------------------------------------
// Las once tablas
// -----------------------------------------------------------------------------

/** 6 · Juicios e incertidumbres: de qué cifras se declaró una salvedad. */
const tablaJuicios: ConstructorTabla = (c) => {
  const filas = c.ens.solicitudes
    .filter((s) => s.nota_alcance && s.nota_alcance.trim())
    .map((s) => {
      const fid = `sol:${s.id}`;
      if (!c.fuentes.some((f) => f.id === fid)) {
        c.fuentes.push({ id: fid, tipo: "solicitud", detalle: `${s.titulo} — salvedad de perímetro declarada` });
      }
      return [txt(limpiar(s.titulo)), txt(s.nota_alcance)];
    });
  return tabla("Juicios y salvedades de perímetro declaradas", ["Información", "Salvedad declarada"], filas);
};

/** 8 · Horizontes temporales: los tres plazos de NIIF S2 10, del Perfil. */
const tablaHorizontes: ConstructorTabla = (c) => {
  const hz = leerHorizontes(c.perfil?.horizontes);
  const filas = hz
    .filter((h) => h.definicion.trim() || h.justificacion.trim())
    .map((h) => [txt(h.plazo), txt(h.definicion), txt(h.justificacion)]);
  if (filas.length) c.fuentes.push({ id: "perfil:horizontes", tipo: "perfil", detalle: "Perfil del emisor, horizontes temporales" });
  return tabla("Horizontes temporales", ["Plazo", "Definición", "Por qué se eligió"], filas);
};

/** 9 · Priorización: probabilidad × impacto contra la matriz de la emisora. */
const tablaPriorizacion: ConstructorTabla = (c) => {
  const matriz = leerMatriz(c.perfil?.matriz_riesgos);
  const filas = c.ens.registros.map((r) => {
    const sev = severidadEfectiva(r.probabilidad, r.impacto, r.severidad);
    const nivel = r.nivel?.trim() || nivelDeSeveridad(sev, matriz);
    citarRegistro(c, r.id, limpiar(r.nombre), r.tipo);
    return [
      txt(limpiar(r.nombre)),
      txt(TIPO_LABEL[r.tipo] ?? r.tipo),
      num(r.probabilidad),
      num(r.impacto),
      num(sev),
      txt(nivel),
    ];
  });
  if (matriz) c.fuentes.push({ id: "perfil:matriz_riesgos", tipo: "perfil", detalle: "Perfil del emisor, matriz de riesgos" });
  return tabla(
    "Priorización de riesgos y oportunidades",
    ["Riesgo u oportunidad", "Tipo", "Probabilidad", "Impacto", "Severidad", "Nivel"],
    filas,
    ["izq", "izq", "der", "der", "der", "izq"]
  );
};

/** 21 · Riesgos climáticos prioritarios: descripción y horizontes, sin oportunidades. */
const tablaRiesgosPrioritarios: ConstructorTabla = (c) => {
  const matriz = leerMatriz(c.perfil?.matriz_riesgos);
  const filas = registrosDe(c, ["riesgo_fisico", "riesgo_transicion"]).map(({ r }) => {
    const sev = severidadEfectiva(r.probabilidad, r.impacto, r.severidad);
    const nivel = r.nivel?.trim() || nivelDeSeveridad(sev, matriz);
    citarRegistro(c, r.id, limpiar(r.nombre), r.tipo);
    return [
      txt(limpiar(r.nombre)),
      txt(TIPO_LABEL[r.tipo] ?? r.tipo),
      txt((r.horizontes ?? []).join(", ")),
      txt(r.descripcion),
      txt(nivel),
    ];
  });
  return tabla(
    "Riesgos climáticos prioritarios",
    ["Riesgo", "Tipo", "Horizontes", "Descripción", "Nivel"],
    filas
  );
};

/** 29 · Emisiones GEI: las cifras cuantitativas del bloque. */
const tablaGei: ConstructorTabla = (c) => {
  const filas = cifrasDelBloque(c).map(({ s, valor }) => [
    txt(limpiar(s.titulo)),
    num(valor),
    txt(s.unidad_esperada),
    String(c.ens.reporte.ejercicio),
  ]);
  return tabla("Emisiones brutas absolutas de gases de efecto invernadero", ["Concepto", "Valor", "Unidad", "Ejercicio"], filas, ["izq", "der", "izq", "der"]);
};

/** 34/35/36 · Exposición y despliegue de capital, por tipo de riesgo. */
function tablaExposicion(tipos: string[], titulo: string): ConstructorTabla {
  return (c) => {
    const filas = registrosDe(c, tipos)
      .filter((x) => x.v)
      .map(({ r, v }) => {
        citarRegistro(c, r.id, limpiar(r.nombre), r.tipo);
        return [
          txt(limpiar(r.nombre)),
          num(v!.cantidad_activos),
          v!.porcentaje == null ? "—" : `${NUM.format(v!.porcentaje)} %`,
          num(v!.capital_gasto),
          num(v!.capital_financiacion),
          num(v!.capital_inversion),
        ];
      });
    return tabla(
      titulo,
      ["Concepto", "Cantidad de activos", "Porcentaje", "Gasto de capital", "Financiación", "Inversión"],
      filas,
      ["izq", "der", "der", "der", "der", "der"]
    );
  };
}

/** 38 · Objetivos climáticos con los ocho atributos que exige NIIF S2 33. */
const tablaObjetivos: ConstructorTabla = (c) => {
  const filas = c.ens.objetivos
    .filter((o) => o.ambito === "climatico")
    .map((o) => {
      citarObjetivo(c, o.id, limpiar(o.nombre));
      return [
        txt(limpiar(o.nombre)),
        txt(o.metrica),
        txt(o.meta),
        txt(o.parte_entidad),
        txt(o.periodo_aplicacion),
        txt(o.periodo_base),
        txt(o.hito_intermedio),
        txt(o.tipo_objetivo),
        txt(o.alineacion_acuerdo_internacional),
      ];
    });
  return tabla(
    "Objetivos climáticos y sus atributos",
    ["Objetivo", "Métrica", "Meta", "Parte de la entidad", "Periodo", "Periodo base", "Hitos", "Absoluto o intensidad", "Acuerdo internacional"],
    filas
  );
};

/** 39 · Enfoque, revisión y resultados por objetivo. */
const tablaEnfoqueObjetivos: ConstructorTabla = (c) => {
  const filas = c.ens.objetivos
    .filter((o) => o.ambito === "climatico")
    .map((o) => {
      const d = c.ens.detallePorObjetivo.get(o.id);
      citarObjetivo(c, o.id, limpiar(o.nombre));
      return [
        txt(limpiar(o.nombre)),
        txt(d?.validacion_tercero),
        txt(d?.procesos_revision),
        txt(d?.metricas_supervision),
        txt(d?.revisiones),
        txt(d?.resultados),
      ];
    });
  return tabla(
    "Enfoque, revisión y resultados de los objetivos",
    ["Objetivo", "Validación por tercero", "Proceso de revisión", "Métricas de seguimiento", "Revisiones", "Resultados"],
    filas
  );
};

/** 40 · Lo específico de un objetivo de emisiones: gases, alcances, bruto o neto. */
const tablaObjetivoGei: ConstructorTabla = (c) => {
  const filas = c.ens.objetivos
    .filter((o) => o.ambito === "climatico")
    .map((o) => {
      const d = c.ens.detallePorObjetivo.get(o.id);
      citarObjetivo(c, o.id, limpiar(o.nombre));
      return [
        txt(limpiar(o.nombre)),
        txt(d?.gases_cubiertos),
        txt(d?.alcances_cubiertos),
        txt(d?.bruto_neto),
        txt(d?.enfoque_descarbonizacion),
      ];
    })
    .filter((f) => f.slice(1).some((v) => v !== "—"));
  return tabla(
    "Objetivos de emisiones de gases de efecto invernadero",
    ["Objetivo", "Gases cubiertos", "Alcances cubiertos", "Bruto o neto", "Enfoque de descarbonización"],
    filas
  );
};

export const TABLAS: Record<number, ConstructorTabla> = {
  6: tablaJuicios,
  8: tablaHorizontes,
  9: tablaPriorizacion,
  21: tablaRiesgosPrioritarios,
  29: tablaGei,
  34: tablaExposicion(["riesgo_transicion"], "Exposición a riesgos de transición y despliegue de capital"),
  35: tablaExposicion(["riesgo_fisico"], "Exposición a riesgos físicos y despliegue de capital"),
  36: tablaExposicion(["oportunidad"], "Oportunidades climáticas: alineación y despliegue de capital"),
  38: tablaObjetivos,
  39: tablaEnfoqueObjetivos,
  40: tablaObjetivoGei,
};

export const llevaTabla = (numero: number): boolean => Object.hasOwn(TABLAS, numero);
