/**
 * =============================================================================
 * Import del HISTÓRICO de GCARSO — comparativo 2024 (y 2023 donde la fuente lo da)
 *
 *   node scripts/import-gcarso-historico.mjs            # contra la BD local
 *   IMPORT_TARGET_OK=1 node scripts/import-gcarso-historico.mjs   # destino no local
 *
 * Requiere que el import de 2025 ya haya corrido (`scripts/import-gcarso.mjs`):
 * este script NO crea solicitudes, solo **suma** capturas de años anteriores y
 * evidencia cualitativa a las que ya existen.
 *
 * ESPECIFICACIÓN: hoja 'Historico 2024' de `import-gcarso/Mapeo_Import_GCarso.xlsx`.
 * Ella decide, archivo por archivo, si se capturan cifras o solo se adjunta
 * evidencia, a qué destino y con qué regla. Las cifras de abajo son
 * transcripción a mano de los documentos, cada una con su cita de página/hoja en
 * `justificacion` — que es lo que la hoja 8 exige y lo que un revisor necesita
 * para volver a la fuente.
 *
 * TRES REGLAS QUE MANDAN SOBRE TODO
 * ---------------------------------
 *  1. EL AÑO ES EL AÑO. Cada cifra se captura con su periodo REAL: si el
 *     documento dice 2023, la captura es 2023. Nada se "estira" a 2024 para
 *     llenar la columna comparativa. Un archivo llamado «… 2024» puede contener
 *     2023 — y este import lo trata como 2023 (ver `Número de Empleados 2024`).
 *  2. LOS ESTADOS NO CAMBIAN. La hoja 8 lo dice explícitamente: la captura
 *     histórica se suma a la solicitud existente. Como el trigger de Fase 2
 *     reabre a 'en_revision' cualquier solicitud 'validado' que reciba una
 *     captura, el script RESTAURA el estado original al final. Nada se promueve
 *     a 'validado' por venir del histórico.
 *  3. NADA SE INVENTA. Solo cifras que los archivos contienen textualmente. No
 *     se convierten unidades, no se suman perímetros distintos y no se fabrican
 *     consolidados que el documento no declare. Donde la fuente se contradice
 *     consigo misma, se captura la cifra de su tabla y la discrepancia queda
 *     escrita en la nota.
 *
 * IDEMPOTENCIA POR DETECCIÓN, y no por borrado. `evidencias`, `capturas_valor` y
 * `bitacora` son APPEND ONLY: ni `authenticated` ni `service_role` tienen DELETE
 * sobre ellas (comprobado: `service_role` solo tiene SELECT en `comentarios` y
 * nada en las otras dos). Eso NO es un hueco de este script, es el candado de la
 * cadena de custodia. Así que todo lo que este import escribe lleva la marca
 * `[HISTÓRICO]` y, si ya está, no se vuelve a escribir: correrlo dos veces no
 * duplica nada.
 *
 * ¿Y si hay que RETRACTARLO? No hay vía de borrar filas inmutables una por una, y
 * no debería haberla. El camino es rehacer el import completo, que sí puede
 * borrar por cascada desde el reporte:
 *
 *     node scripts/import-gcarso.mjs --limpiar
 *     node scripts/import-gcarso.mjs
 *     node scripts/import-gcarso-historico.mjs
 * =============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

// -----------------------------------------------------------------------------
// Entorno
// -----------------------------------------------------------------------------
function leerEnv() {
  const out = {};
  for (const archivo of [".env.local", ".env"]) {
    if (!fs.existsSync(archivo)) continue;
    for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...out, ...process.env };
}
const env = leerEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = env.ADMIN_EMAIL || "admin@irstrat.example";
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "Demo2025!";

// `--limpiar` existe en el import de 2025, así que alguien lo va a teclear aquí.
// En vez de fallar a medias sobre tablas inmutables, dice qué hacer.
if (process.argv.includes("--limpiar")) {
  console.log(
    [
      "El histórico NO se puede retirar fila por fila: `evidencias`, `capturas_valor` y",
      "`bitacora` son APPEND ONLY y ni la aplicación ni service_role tienen DELETE sobre",
      "ellas. Es el candado de la cadena de custodia, no una omisión.",
      "",
      "Para rehacerlo desde cero (el borrado por cascada sí existe, desde el reporte):",
      "",
      "  node scripts/import-gcarso.mjs --limpiar",
      "  node scripts/import-gcarso.mjs",
      "  node scripts/import-gcarso-historico.mjs",
      "",
      "Correr este script dos veces es inofensivo: detecta lo ya escrito y no lo duplica.",
    ].join("\n")
  );
  process.exit(0);
}

if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY.");
  process.exit(2);
}
const esLocal = /(127\.0\.0\.1|localhost)/.test(SUPABASE_URL);
if (!esLocal && env.IMPORT_TARGET_OK !== "1") {
  console.error(
    `El destino NO es local (${SUPABASE_URL}).\n` +
      "Este script escribe datos reales de un cliente. Si es lo que quieres,\n" +
      "vuelve a correrlo con IMPORT_TARGET_OK=1."
  );
  process.exit(2);
}

const MARCA = "[HISTÓRICO]";
const TENANT_SLUG = "gcarso";
const DIR = path.join("import-gcarso", "historico");
const log = (...a) => console.log(...a);

// -----------------------------------------------------------------------------
// Archivos fuente (hoja 8).
// -----------------------------------------------------------------------------
const F = {
  capacitacion: path.join(DIR, "Cursos capacitación GCarso 2024.xlsx"),
  empleados: path.join(DIR, "Número de Empleados 2024.docx"),
  socialGS: path.join(DIR, "Resumen Responsabilidad Social 2024 (GS) (VFinal).xlsx"),
  ambiental: path.join(DIR, "Reporte Anual Amb 2024 (17 jun 2025).pdf"),
  sustentabilidad: path.join(DIR, "Sustentabilidad 2024 GCARSO 200525.docx"),
  salud: path.join(DIR, "Salud Integral Sostenible - Logros y Tendencias en Grupo Carso.docx"),
  condumex: path.join(DIR, "Estrategia ASG de Condumex Jun-25.docx"),
  autopartes: path.join(DIR, "ASG (Autopartes).pdf"),
};

/** Límite de subida del bucket 'evidencias'; se resuelve contra Storage al arrancar. */
let LIMITE_BUCKET = null;

// -----------------------------------------------------------------------------
// Destinos: cada solicitud se localiza por (área, patrón de título). Si un
// patrón no encuentra su solicitud, el import lo REPORTA y sigue — un destino
// que cambió de nombre no debe tirar la corrida entera ni, peor, colgar la
// captura de otra solicitud parecida.
// -----------------------------------------------------------------------------
/**
 * NOTA DE ALCANCE de la fila que llega a la plantilla oficial.
 *
 * Decisión de perímetro tomada por dirección: la cifra de Alcance 1 que alimenta
 * el Excel es de la división Materiales, no de todo Grupo Carso — es el único
 * desglose que el cliente entregó—, y en vez de mover el rubro a otra solicitud
 * (lo que CAMBIARÍA una cifra ya validada) se DECLARA el perímetro en el propio
 * entregable, junto a las brechas que ya haya en esa celda.
 *
 * Vive aquí porque es un hecho del expediente de este cliente, y no en el motor
 * del export, que sigue sin una sola rama por emisora. Se puede reescribir después
 * desde el panel (campo «Nota de alcance» del detalle de la solicitud).
 */
const ALCANCE_GEI = {
  area: "Materiales",
  re: /^Emisiones Brutas GEI Alcance 1/i,
  nota:
    "La cifra corresponde al perímetro de la división Materiales " +
    "(Elementia Materiales y Fortaleza Materiales); no comprende las demás " +
    "divisiones de Grupo Carso.",
};

const D = {
  CAPACITACION: { area: "Corporativo", re: /^Tabla Capacitación Especializada/i },
  COLABORADORES: { area: "Corporativo", re: /^Total colaboradores/i },
  TIPO_COLAB: { area: "Corporativo", re: /^Tabla tipo de colaboradores/i },
  AGUA: { area: "Corporativo", re: /^Tabla Desempeño Ambiental\. Agua/i },
  ENERGIA: { area: "Corporativo", re: /^Tabla Desempeño Ambiental\. Energía/i },
  GEI: { area: "Corporativo", re: /^Tabla Desempeño Ambiental\. Gases Efecto Invernadero/i },
  RESIDUOS: { area: "Corporativo", re: /^Tabla Desempeño Ambiental\. Residuos/i },
  MIDO: { area: "Corporativo", re: /^ODS 3:.*MIDO/i },
  ESR: { area: "Corporativo", re: /distintivo Empresa Socialmente Responsable/i },
  COMUNIDADES: { area: "Corporativo", re: /eje de vinculación con comunidades/i },
  DDHH: { area: "Corporativo", re: /^¿se reportaron incidentes relacionados con derechos humanos/i },
  IND_ETICA: { area: "Industrial", re: /prevención de \(1\) la corrupción/i },
};

// =============================================================================
// CIFRAS TRANSCRITAS DE LAS FUENTES
//
// Formato: { destino, valor, unidad, periodo, cita }
// `cita` va a `justificacion` y es la trazabilidad: sector/concepto + archivo y
// página. El ORDEN importa: la plataforma toma la ÚLTIMA captura confirmada de
// un periodo como valor vigente, así que el consolidado (cuando el documento lo
// declara) va al final de su periodo.
// =============================================================================

const AMB = "Reporte Anual Ambiental 2024 (Grupo Carso)";

/**
 * CONSOLIDADOS. La plataforma muestra como "cifra vigente" la ÚLTIMA captura
 * confirmada, así que sin un total al cierre el dato visible de una tabla sería el
 * de un sector cualquiera — el mismo problema que el import de 2025 ya resolvió
 * poniendo su consolidado al final.
 *
 * Cuando el documento DECLARA un total (GEI: 104,289 tCO₂e, p. 4), se usa el suyo.
 * Cuando no lo declara (agua, energía, residuos), el script SUMA los sectores que
 * acaba de capturar y etiqueta la captura con sus componentes, para que se lea como
 * lo que es: una suma de las cifras del reporte, no una cifra del reporte. La suma
 * se calcula en código a partir de las mismas entradas, así que corregir una cifra
 * corrige el total —no pueden separarse—.
 *
 * `sumable` marca qué entra en la suma, `parte` cómo se nombra el componente y
 * `clase` separa las sumas que NO deben mezclarse: RSU, RME y RP son conceptos
 * distintos y un total que los junte no significa nada.
 *
 * Los totales de 2023 y 2024 NO son comparables entre sí: el propio reporte dice
 * que en 2024 amplió su alcance con 12 centros adicionales. Queda escrito en la
 * etiqueta del total y en la nota de cada tabla.
 */

/** Reporte Anual Ambiental 2024 — GEI por sector y alcance (pp. 51-56). */
const CAPTURAS_GEI = [
  // 2023 — el reporte trae comparativo propio de TRES sectores, que son
  // exactamente los mismos que componen su total declarado de 2024 (104,289):
  // por eso estas seis entradas SÍ se suman, y el par 2023/2024 queda
  // comparable perímetro contra perímetro.
  { valor: 6588, periodo: "2023", sumable: true, parte: "Autopartes A1", cita: `Autopartes · Alcance 1 · ${AMB}, p. 52.` },
  { valor: 13920, periodo: "2023", sumable: true, parte: "Autopartes A2", cita: `Autopartes · Alcance 2 · ${AMB}, p. 52.` },
  { valor: 41847, periodo: "2023", sumable: true, parte: "Cables A1", cita: `Cables · Alcance 1 · ${AMB}, p. 54.` },
  { valor: 42577, periodo: "2023", sumable: true, parte: "Cables A2", cita: `Cables · Alcance 2 · ${AMB}, p. 54.` },
  { valor: 54, periodo: "2023", sumable: true, parte: "CIDEC A1", cita: `CIDEC · Alcance 1 · ${AMB}, p. 55.` },
  { valor: 734, periodo: "2023", sumable: true, parte: "CIDEC A2", cita: `CIDEC · Alcance 2 · ${AMB}, p. 55.` },
  // 2024
  { valor: 46522, periodo: "2024", cita: `Infraestructura y Construcción · Alcance 1 · ${AMB}, p. 51.` },
  { valor: 294, periodo: "2024", cita: `Infraestructura y Construcción · Alcance 2 · ${AMB}, p. 51.` },
  { valor: 6056, periodo: "2024", cita: `Autopartes · Alcance 1 · ${AMB}, p. 52.` },
  { valor: 12339, periodo: "2024", cita: `Autopartes · Alcance 2 · ${AMB}, p. 52.` },
  { valor: 44789, periodo: "2024", cita: `Cables · Alcance 1 · ${AMB}, p. 54.` },
  { valor: 40351, periodo: "2024", cita: `Cables · Alcance 2 · ${AMB}, p. 54.` },
  { valor: 15, periodo: "2024", cita: `CIDEC · Alcance 1 · ${AMB}, p. 55.` },
  { valor: 739, periodo: "2024", cita: `CIDEC · Alcance 2 · ${AMB}, p. 55.` },
  { valor: 206.15, periodo: "2024", cita: `Oficinas corporativas · Alcance 1 · ${AMB}, p. 56.` },
  { valor: 146.06, periodo: "2024", cita: `Oficinas corporativas · Alcance 2 · ${AMB}, p. 56.` },
  // Consolidado DECLARADO por el propio reporte, al final para que sea el valor
  // vigente de 2024. No es una suma nuestra: es la cifra de su resumen, y su
  // perímetro se declara en la nota porque NO cubre a todo Grupo Carso.
  {
    valor: 104289,
    periodo: "2024",
    cita:
      `Total declarado alcances 1+2 · ${AMB}, p. 4. Cubre Autopartes + Cables + CIDEC ` +
      `(18,395 + 85,140 + 754). NO incluye Infraestructura (46,815) ni Oficinas corporativas (352.21).`,
  },
];

/** Reporte Anual Ambiental 2024 — consumo de agua por sector (pp. 7-11). */
const CAPTURAS_AGUA = [
  { valor: 21398, periodo: "2023", sumable: true, parte: "Ductos", cita: `Sector Ductos · consumo · ${AMB}, p. 7.` },
  { valor: 492010, periodo: "2023", sumable: true, parte: "Infraestructura", cita: `Sector Infraestructura · consumo · ${AMB}, p. 8.` },
  {
    valor: 115121,
    periodo: "2023",
    sumable: true,
    parte: "Autopartes",
    cita:
      `Sector Autopartes · consumo · ${AMB}, p. 9 (total de la tabla por centro de trabajo). ` +
      `La narrativa de la misma página declara 117,505; se captura el total de la tabla.`,
  },
  { valor: 297374, periodo: "2023", sumable: true, parte: "Cables", cita: `Sector Cables · consumo · ${AMB}, p. 10.` },
  { valor: 3967, periodo: "2023", sumable: true, parte: "CIDEC", cita: `CIDEC · consumo · ${AMB}, p. 11.` },
  { valor: 22923, periodo: "2024", sumable: true, parte: "Ductos", cita: `Sector Ductos · consumo · ${AMB}, p. 7.` },
  { valor: 1907, periodo: "2024", sumable: true, parte: "Edificación", cita: `Sector Edificación (IASA) · consumo · ${AMB}, p. 7.` },
  { valor: 9997, periodo: "2024", sumable: true, parte: "Infraestructura", cita: `Sector Infraestructura · consumo · ${AMB}, p. 8.` },
  { valor: 135844, periodo: "2024", sumable: true, parte: "Autopartes", cita: `Sector Autopartes · consumo · ${AMB}, p. 9.` },
  { valor: 295680, periodo: "2024", sumable: true, parte: "Cables", cita: `Sector Cables · consumo · ${AMB}, p. 10.` },
  { valor: 216582, periodo: "2024", sumable: true, parte: "Nacobre y Logtec", cita: `Nacobre y Logtec · consumo (primer año reportado) · ${AMB}, p. 11.` },
  { valor: 4527, periodo: "2024", sumable: true, parte: "CIDEC", cita: `CIDEC · consumo · ${AMB}, p. 11.` },
];

/** Reporte Anual Ambiental 2024 — consumo eléctrico por sector (pp. 45-49). */
const CAPTURAS_ENERGIA = [
  { valor: 33095, periodo: "2023", sumable: true, parte: "Autopartes", cita: `Sector Autopartes · ${AMB}, p. 46.` },
  { valor: 109388, periodo: "2023", sumable: true, parte: "Cables", cita: `Sector Cables · ${AMB}, p. 48.` },
  { valor: 2010, periodo: "2023", sumable: true, parte: "CIDEC", cita: `CIDEC · ${AMB}, p. 49.` },
  { valor: 301.85, periodo: "2023", sumable: true, parte: "Oficinas corporativas", cita: `Oficinas corporativas · ${AMB}, p. 49.` },
  { valor: 670415, periodo: "2024", sumable: true, parte: "Infraestructura", cita: `Sector Infraestructura · ${AMB}, p. 46.` },
  {
    valor: 31581,
    periodo: "2024",
    sumable: true,
    parte: "Autopartes",
    cita:
      `Sector Autopartes · ${AMB}, pp. 45 y 46. La tabla de la p. 47 imprime 31,585 ` +
      `y sus columnas suman 31,580; se captura la cifra que el texto declara dos veces.`,
  },
  {
    valor: 106102,
    periodo: "2024",
    sumable: true,
    parte: "Cables",
    cita:
      `Sector Cables · ${AMB}, p. 48 (total de la tabla: 44,840 + 47,832 + 3,148 + 10,282). ` +
      `La p. 45 declara 105,102; se captura el total que la tabla suma.`,
  },
  { valor: 2005, periodo: "2024", sumable: true, parte: "CIDEC", cita: `CIDEC · ${AMB}, p. 49.` },
  { valor: 333, periodo: "2024", sumable: true, parte: "Oficinas corporativas", cita: `Oficinas corporativas · ${AMB}, p. 49.` },
];

/** Reporte Anual Ambiental 2024 — residuos por clase y sector (pp. 58-110). */
const CAPTURAS_RESIDUOS = [
  // 2023: el reporte solo trae comparativo de algunos sectores y clases, así que
  // ninguna clase queda completa y NO se consolida (ver la nota de la tabla).
  { valor: 721108, periodo: "2023", cita: `Sector Autopartes · RSU · ${AMB}, p. 60.` },
  { valor: 1069681, periodo: "2023", cita: `Sector Ductos · RME · ${AMB}, p. 63.` },
  { valor: 108540, periodo: "2023", cita: `Sector Infraestructura · RME · ${AMB}, p. 64.` },
  { valor: 244713, periodo: "2023", cita: `Sector Ductos · RP · ${AMB}, p. 87.` },
  // RSU 2024
  { valor: 10218, periodo: "2024", sumable: true, clase: "RSU", parte: "Ductos", cita: `Sector Ductos (Precitubo) · RSU · ${AMB}, p. 58.` },
  { valor: 28425, periodo: "2024", sumable: true, clase: "RSU", parte: "Infraestructura", cita: `Sector Infraestructura (Tren Maya T2) · RSU · ${AMB}, p. 58.` },
  { valor: 5368, periodo: "2024", sumable: true, clase: "RSU", parte: "Edificación", cita: `Sector Edificación (IASA) · RSU · ${AMB}, p. 58.` },
  { valor: 805991.35, periodo: "2024", sumable: true, clase: "RSU", parte: "Autopartes", cita: `Sector Autopartes · RSU · ${AMB}, p. 60.` },
  {
    valor: 2626489.06,
    periodo: "2024",
    sumable: true,
    clase: "RSU",
    parte: "Cables",
    cita:
      `Sector Cables · RSU (primer año reportado) · ${AMB}, p. 61. Los datos de Nacobre ` +
      `Vallejo comprenden solo enero-mayo, según la misma página.`,
  },
  // RME 2024
  { valor: 1213123.05, periodo: "2024", sumable: true, clase: "RME", parte: "Ductos", cita: `Sector Ductos · RME · ${AMB}, p. 63.` },
  { valor: 94658, periodo: "2024", sumable: true, clase: "RME", parte: "Infraestructura", cita: `Sector Infraestructura · RME · ${AMB}, p. 64.` },
  { valor: 95306, periodo: "2024", sumable: true, clase: "RME", parte: "Edificación", cita: `Sector Edificación (IASA) · RME · ${AMB}, p. 65.` },
  { valor: 2296077.43, periodo: "2024", sumable: true, clase: "RME", parte: "Autopartes", cita: `Sector Autopartes · RME · ${AMB}, p. 67.` },
  { valor: 11831579.02, periodo: "2024", sumable: true, clase: "RME", parte: "Cables", cita: `Sector Cables · RME · ${AMB}, p. 76.` },
  // RP 2024 — la clase más material, y por eso su total va al cierre de 2024.
  { valor: 218926, periodo: "2024", sumable: true, clase: "RP", parte: "Ductos", cita: `Sector Ductos · RP · ${AMB}, p. 88.` },
  { valor: 14578.4, periodo: "2024", sumable: true, clase: "RP", parte: "Edificación", cita: `Sector Edificación (IASA) · RP · ${AMB}, p. 89.` },
  { valor: 70640, periodo: "2024", sumable: true, clase: "RP", parte: "Infraestructura", cita: `Sector Infraestructura · RP · ${AMB}, pp. 90-91.` },
  { valor: 69134.06, periodo: "2024", sumable: true, clase: "RP", parte: "Autopartes", cita: `Sector Autopartes · RP · ${AMB}, p. 93.` },
  { valor: 1855577.39, periodo: "2024", sumable: true, clase: "RP", parte: "Cables", cita: `Sector Cables · RP · ${AMB}, pp. 102-103.` },
  { valor: 807.8, periodo: "2024", sumable: true, clase: "RP", parte: "CIDEC", cita: `CIDEC · RP · ${AMB}, p. 110.` },
];

const CAP24 = "Cursos capacitación GCarso 2024.xlsx, hoja 1";
const GS24 = "Resumen Responsabilidad Social 2024 (GS) (VFinal).xlsx, hoja 1";
const EMP = "Número de Empleados 2024.docx";

/** Capacitación: brigadistas primero, el total de participantes AL FINAL. */
const CAPTURAS_CAPACITACION = [
  {
    valor: 8708,
    unidad: "brigadistas",
    periodo: "2024",
    cita: `Protección Civil · brigadistas capacitados · ${CAP24} (Grupo Sanborns; Grupo Carso no reporta).`,
  },
  {
    valor: 11809,
    unidad: "cursos",
    periodo: "2024",
    cita: `Grupo Sanborns · número de cursos · ${GS24}.`,
  },
  {
    valor: 779453,
    unidad: "participantes",
    periodo: "2024",
    cita:
      `Total Grupo Carso · participantes en cursos · ${CAP24} ` +
      `(Grupo Sanborns 405,317 + Grupo Carso 374,136).`,
  },
];

/**
 * Plantilla. El archivo se llama «Número de Empleados 2024» pero NO contiene
 * 2024: sus tablas son 2022 y 2023, más una serie 2019-2023. Se captura con el
 * año real de cada cifra y el hueco de 2024 se declara en la nota — estirar 2023
 * a 2024 sería exactamente lo que la regla del import prohíbe.
 */
const CAPTURAS_PLANTILLA = [
  { valor: 94827, unidad: "personas", periodo: "2022", cita: `Plantilla total Grupo Carso · ${EMP} (tabla 2022).` },
  {
    valor: 94458,
    unidad: "personas",
    periodo: "2023",
    cita:
      `Plantilla total Grupo Carso · ${EMP} (tabla 2023: 1,351 funcionarios + 54,099 empleados + ` +
      `39,008 obreros). La serie histórica del mismo documento imprime 39,009 obreros.`,
  },
];

// =============================================================================
// Notas (comentarios) — lo que la hoja 8 pide dejar "como nota" y no como cifra
// =============================================================================
const NOTAS = [
  {
    destino: "CAPACITACION",
    texto:
      `${MARCA} Programas 2024 del archivo «Cursos capacitación GCarso 2024.xlsx» que no se ` +
      `capturaron como cifra (la especificación los admite como nota): ASUME 3,889 participantes ` +
      `en 151 grupos (216 facilitadores según el resumen de Grupo Sanborns); Bienestar Social ` +
      `303,630 colaboradores y 11,275 familiares; MIDO Integral 17,142 personas valoradas ` +
      `(Grupo Sanborns); Becas Telmex 156 (Grupo Carso). Desglose por empresa de Grupo Sanborns ` +
      `en «Resumen Responsabilidad Social 2024 (GS) (VFinal).xlsx»: Sanborns 240,169 participantes, ` +
      `Sears 144,575, Dax 6,591, Mix Up 13,872, Claro Shop 110.`,
  },
  {
    destino: "COLABORADORES",
    texto:
      `${MARCA} El archivo «Número de Empleados 2024.docx» NO contiene cifras de 2024: sus tablas ` +
      `son 2022 y 2023, más una serie 2019-2023. Se capturó cada cifra con su año real (2022 y 2023) ` +
      `y el comparativo 2024 de plantilla queda PENDIENTE de que el cliente lo entregue. ` +
      `Serie del documento: 2021 80,685 · 2020 76,251 · 2019 77,655 personas. ` +
      `Único dato 2024 de plantilla en el histórico: Grupo Sanborns 42,912 empleados al 31-dic-2024 ` +
      `(«Resumen Responsabilidad Social 2024 (GS) (VFinal).xlsx») — es solo Grupo Sanborns, no el ` +
      `Grupo, por lo que NO se capturó como plantilla total.`,
  },
  {
    destino: "TIPO_COLAB",
    texto:
      `${MARCA} Desglose por tipo de contratación de «Número de Empleados 2024.docx» (el documento ` +
      `no trae 2024): 2023 — De Confianza 31,488 y Sindicalizados 62,970 (Funcionarios 1,351/0; ` +
      `Empleados 23,792/30,307; Obreros 6,345/32,663). 2022 — De Confianza 32,918 y Sindicalizados ` +
      `61,909. El documento señala que la plantilla de Condumex y CICSA es 38% mujeres y 62% hombres.`,
  },
  {
    destino: "AGUA",
    texto:
      `${MARCA} Capturas de agua 2023 y 2024 tomadas del ${AMB} (pp. 7-11). El reporte cubre ` +
      `DOS subsidiarias (Carso Infraestructura y Construcción, y Grupo Condumex —incluidos Nacobre ` +
      `y Logtec—) más CIDEC y oficinas corporativas; NO cubre Comercial, Energía, Materiales ni ` +
      `Hidrocarburos. El reporte no declara un total de agua: los totales de 2023 (929,870 m³) y ` +
      `2024 (687,460 m³) los SUMA este import de los sectores de arriba, y no son comparables entre ` +
      `sí porque en 2024 el alcance del reporte creció con 12 centros adicionales. ` +
      `Descargas 2024, primer año reportado (pp. 12-13): Ductos/Precitubo 150,011 m³, Autopartes ` +
      `12,477 m³, Cables 18,365 m³.`,
  },
  {
    destino: "ENERGIA",
    texto:
      `${MARCA} Consumo eléctrico 2023 y 2024 del ${AMB} (pp. 45-49), en MWh como los declara la ` +
      `fuente: no se convirtieron a GJ. El reporte no declara un total: los de 2023 (144,794.85 MWh) ` +
      `y 2024 (810,436 MWh) los suma este import, y no son comparables entre sí (el alcance de 2024 ` +
      `incluye Infraestructura, que en 2023 no se reportó). ` +
      `Energía limpia 2024: Autopartes 788 MWh de autoabasto solar y 2,432 MWh de mercado ` +
      `eléctrico (emisión cero); Cables 3,148 MWh solar y 10,282 MWh de mercado; CIDEC 303 MWh solar.`,
  },
  {
    destino: "GEI",
    texto:
      `${MARCA} GEI 2023 y 2024 por sector y alcance, del ${AMB} (pp. 51-56). El total declarado de ` +
      `104,289 tCO₂e (p. 4) corresponde a Autopartes + Cables + CIDEC y NO incluye Infraestructura ` +
      `(46,815 tCO₂e) ni oficinas corporativas (352.21 tCO₂e); la suma de todo lo que el reporte ` +
      `cuantifica es 151,456.21 tCO₂e. El total de 2023 (105,720 tCO₂e) lo suma este import de esos ` +
      `MISMOS tres sectores, así que el par 2023/2024 sí es comparable perímetro contra perímetro; ` +
      `los totales por sector que el reporte imprime para 2023 suman 105,721 por su propio redondeo ` +
      `del sector Autopartes (20,509 vs. 20,508 que dan sus alcances). Ese perímetro NO es ` +
      `comparable con el Alcance 1 de 2025 que alimenta la plantilla oficial, que es de Materiales ` +
      `(Elementia + Fortaleza) y no aparece en este reporte.`,
  },
  {
    destino: "RESIDUOS",
    texto:
      `${MARCA} Residuos 2023 y 2024 por clase (RSU, RME, RP) y sector, del ${AMB} (pp. 58-110), en kg. ` +
      `Totales 2024 que suma este import, por clase y NUNCA entre clases —RSU, RME y RP son conceptos ` +
      `distintos—: RSU 3,476,491.41 · RME 15,530,743.50 · RP 2,229,663.65. De 2023 no hay total de ` +
      `ninguna clase porque el reporte solo trae comparativo de algunos sectores: RSU de Autopartes, ` +
      `RME de Ductos e Infraestructura y RP de Ductos. RSU y RME del Sector Cables y RSU de Ductos, ` +
      `Infraestructura y Edificación son primer año de reporte. CONALUM reporta además 186 m³ de RSU ` +
      `en volumen (p. 61), que no se capturó por venir en otra unidad.`,
  },
  {
    destino: "MIDO",
    texto:
      `${MARCA} «Salud Integral Sostenible — Logros y Tendencias en Grupo Carso» (periodo 2023-2024, ` +
      `Servicio Médico Corporativo). MIDO 2024: 17,731 colaboradores muestreados de CONDUMEX y CICSA ` +
      `(39.70% mujeres, 60.30% hombres); más de 800 Expertos MIDO activos y 7 centros regionales de ` +
      `capacitación que cubren al 65% de los trabajadores. Tendencias 2023 → 2024: tabaquismo ` +
      `23.22% → 17.95%; sedentarismo 51.95% → 44.24%; baja calidad de sueño 28.21% → 21.96%; ` +
      `prediabetes 4.35% → 4.69%; prehipertensión 11.38% → 10.28%. La especificación pide este ` +
      `archivo como evidencia y nota, no como captura: por eso las cifras van aquí.`,
  },
  {
    destino: "ESR",
    texto:
      `${MARCA} «Sustentabilidad 2024 GCARSO 200525.docx»: el CEMEFI otorgó el distintivo Empresa ` +
      `Socialmente Responsable a Grupo Condumex y a Carso Infraestructura y Construcción por ` +
      `decimotercer y decimocuarto año consecutivo, respectivamente.`,
  },
  {
    destino: "COMUNIDADES",
    texto:
      `${MARCA} «Sustentabilidad 2024 GCARSO 200525.docx», apoyo a las comunidades en torno a las ` +
      `operaciones: programas de apoyo a comunidad vulnerable, casas hogar, personas de la tercera ` +
      `edad, campañas de reciclaje de tapas y PET para niños con cáncer y trabajo con FUCAM. ` +
      `Reforestación de manglares en Ciudad del Carmen con 70 empleados y contratistas.`,
  },
  {
    destino: "IND_ETICA",
    texto:
      `${MARCA} «Estrategia ASG de Condumex Jun-25.docx», Pilar 3 «Gobernanza Transparente y ` +
      `Responsable» — Ética y Transparencia. La estrategia se basa en la materialidad de 2022 ` +
      `(insumo para proponer su actualización). El documento NO cubre la gestión de riesgos de ` +
      `materiales críticos, así que no se adjuntó a esa solicitud. ` +
      `«ASG (Autopartes).pdf» acompaña con los programas sociales de la división (Becas ` +
      `Telmex-Telcel, ASUME, Bienestar Social) y su aporte declarado al componente de gobernanza.`,
  },
];

// =============================================================================
// Evidencias: qué archivo (o recorte) va a qué solicitudes
// =============================================================================
/** Secciones del Reporte Anual Ambiental que se recortan con pdf-lib. */
const SECCIONES_AMB = {
  agua: { desde: 6, hasta: 14, nombre: "ReporteAmbiental2024-Agua-p6-14.pdf" },
  energia: { desde: 45, hasta: 49, nombre: "ReporteAmbiental2024-Energia-p45-49.pdf" },
  gei: { desde: 50, hasta: 56, nombre: "ReporteAmbiental2024-GEI-p50-56.pdf" },
  residuos: { desde: 57, hasta: 114, nombre: "ReporteAmbiental2024-Residuos-p57-114.pdf" },
};

// -----------------------------------------------------------------------------
// Conexión
// -----------------------------------------------------------------------------
async function conectar() {
  const db = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) {
    console.error(`Login de staff falló (${ADMIN_EMAIL}): ${error.message}`);
    process.exit(2);
  }
  const { data: yo, error: yoErr } = await db.auth.getUser();
  if (yoErr || !yo?.user) {
    console.error(`No se pudo resolver la sesión de staff: ${yoErr?.message ?? "sin usuario"}.`);
    process.exit(2);
  }
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, admin, staffId: yo.user.id };
}

async function resolverReporte({ db }) {
  const { data: tenant } = await db
    .from("tenants")
    .select("id, nombre, staff_puede_cargar")
    .eq("slug", TENANT_SLUG)
    .maybeSingle();
  if (!tenant) {
    console.error(
      "No existe el cliente GCARSO. Corre primero `node scripts/import-gcarso.mjs`:\n" +
        "este script solo AGREGA histórico a las solicitudes del proceso 2025."
    );
    process.exit(2);
  }
  const { data: reporte } = await db
    .from("reportes")
    .select("id, nombre, ejercicio, estado")
    .eq("tenant_id", tenant.id)
    .order("ejercicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!reporte) {
    console.error("GCARSO no tiene reporte. Corre primero `node scripts/import-gcarso.mjs`.");
    process.exit(2);
  }
  if (reporte.estado === "congelado") {
    console.error(
      `El reporte «${reporte.nombre}» está CONGELADO: quedó cerrado para aseguramiento y no ` +
        "admite capturas ni evidencia nuevas. El histórico tendría que entrar en un reporte abierto."
    );
    process.exit(2);
  }
  return { tenant, reporte };
}

// -----------------------------------------------------------------------------
// Recorte de un PDF por rango de páginas (mismo patrón que el IAS del import 2025)
// -----------------------------------------------------------------------------
async function recortar(rutaPdf, desde, hasta) {
  const original = await PDFDocument.load(fs.readFileSync(rutaPdf), { ignoreEncryption: true });
  const salida = await PDFDocument.create();
  const total = original.getPageCount();
  const indices = [];
  for (let p = desde; p <= Math.min(hasta, total); p++) indices.push(p - 1);
  const paginas = await salida.copyPages(original, indices);
  for (const pg of paginas) salida.addPage(pg);
  return Buffer.from(await salida.save());
}

// =============================================================================
// Escritura
// =============================================================================
async function correr() {
  const ctx = await conectar();
  const { db, admin, staffId } = ctx;
  const { tenant, reporte } = await resolverReporte(ctx);

  log(`Cliente: ${tenant.nombre} · Reporte: ${reporte.nombre} (${reporte.ejercicio})`);

  // Límite real de subida: es lo que decide si un archivo entra entero o hay que
  // recortarlo. Se pregunta al propio Storage (`storage.buckets` no está expuesto
  // por PostgREST, así que una consulta a la tabla no serviría). Si el bucket no
  // declara límite propio, hereda el global del proyecto y aquí queda `null`: en
  // ese caso el guardia no puede comparar y lo dice, en vez de dar por bueno un
  // límite inventado.
  const { data: bucket, error: bucketErr } = await admin.storage.getBucket("evidencias");
  // snake_case: el tipo `Bucket` que devuelve getBucket() usa `file_size_limit`
  // (solo las OPCIONES de create/update usan `fileSizeLimit`). Con la clave mal
  // escrita el guardia de tamaño quedaba muerto y el script decía siempre que el
  // bucket no declara límite.
  LIMITE_BUCKET = bucket?.file_size_limit ?? null;
  log(
    `Límite de subida del bucket 'evidencias': ` +
      (LIMITE_BUCKET != null
        ? `${(LIMITE_BUCKET / 1048576).toFixed(0)} MB (propio del bucket)`
        : `sin límite propio — hereda el global del proyecto` +
          (bucketErr ? ` (no se pudo leer: ${bucketErr.message})` : ""))
  );

  // --- Destinos --------------------------------------------------------------
  const { data: solicitudes, error: solErr } = await db
    .from("solicitudes")
    .select("id, titulo, area_asignada, estado")
    .eq("reporte_id", reporte.id);
  // Sin esta comprobación, un fallo aquí dejaba `solicitudes` en null, ningún
  // destino resuelto y un "✅ Histórico importado" con cero escrituras —
  // indistinguible de "ya estaba todo".
  if (solErr || !solicitudes) {
    console.error(`No se pudieron leer las solicitudes del reporte: ${solErr?.message ?? "sin datos"}.`);
    process.exit(1);
  }

  const faltantes = [];
  const destino = {};
  for (const [clave, def] of Object.entries(D)) {
    const encontradas = solicitudes.filter(
      (s) => s.area_asignada === def.area && def.re.test(s.titulo)
    );
    if (encontradas.length === 0) {
      faltantes.push(`${clave} (${def.area} · ${def.re})`);
      continue;
    }
    if (encontradas.length > 1) {
      faltantes.push(
        `${clave}: ${encontradas.length} solicitudes coinciden — se omite para no colgar el ` +
          `histórico de la equivocada (${encontradas.map((s) => s.titulo).join(" / ")})`
      );
      continue;
    }
    destino[clave] = encontradas[0];
  }

  // Estados ANTES de tocar nada: el trigger de Fase 2 reabre las validadas al
  // recibir una captura, y la hoja 8 dice que los estados no cambian.
  const estadoOriginal = new Map(solicitudes.map((s) => [s.id, s.estado]));

  const stats = {
    capturasPorPeriodo: {},
    evidenciasPorArchivo: {},
    notas: 0,
    alcance: 0,
    omitidasPorDuplicado: 0,
  };
  const hallazgos = [];
  /** Archivos > 8 MB: se reportan al final con su peso medido, entren o no. */
  const pesados = new Map();

  // --- Helpers ---------------------------------------------------------------
  const yaTieneEvidencia = async (solicitudId, nombre) => {
    const { data } = await db
      .from("evidencias")
      .select("id")
      .eq("solicitud_id", solicitudId)
      .eq("nombre_original", nombre)
      .like("notas", `${MARCA}%`)
      .limit(1);
    return (data ?? []).length > 0;
  };

  /**
   * Sube un archivo como evidencia del histórico. `area` es obligatoria: GCARSO
   * tiene la carga por IRStrat habilitada y la base exige el área en cuyo nombre
   * se carga (fn_evidencia_marca_carga). Devuelve el id de la evidencia.
   */
  const adjuntar = async ({ sol, nombre, cuerpo, notas, etiquetaArchivo }) => {
    if (await yaTieneEvidencia(sol.id, nombre)) {
      stats.omitidasPorDuplicado++;
      // MISMO filtro que la detección, marca incluida: sin ella, una evidencia
      // ajena con el mismo nombre de archivo se llevaría las capturas del histórico.
      const { data } = await db
        .from("evidencias")
        .select("id")
        .eq("solicitud_id", sol.id)
        .eq("nombre_original", nombre)
        .like("notas", `${MARCA}%`)
        .order("version", { ascending: false })
        .limit(1);
      return data?.[0]?.id ?? null;
    }
    if (LIMITE_BUCKET != null && cuerpo.length > LIMITE_BUCKET) {
      hallazgos.push(
        `«${nombre}» pesa ${(cuerpo.length / 1048576).toFixed(1)} MB y excede el límite del ` +
          `bucket (${(LIMITE_BUCKET / 1048576).toFixed(0)} MB): NO se adjuntó. ` +
          `Recórtalo por secciones (como el Reporte Ambiental) o súbelo comprimido.`
      );
      return null;
    }
    if (cuerpo.length > 8 * 1048576) {
      pesados.set(nombre, cuerpo.length);
    }
    const ruta = `${tenant.id}/${sol.id}/${nombre}`;
    const tipo = nombre.endsWith(".pdf")
      ? "application/pdf"
      : nombre.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const { error: upErr } = await admin.storage
      .from("evidencias")
      .upload(ruta, cuerpo, { contentType: tipo, upsert: true });
    if (upErr) throw new Error(`storage ${nombre}: ${upErr.message}`);

    const { data: ev, error } = await db
      .from("evidencias")
      .insert({
        solicitud_id: sol.id,
        version: 0,
        archivo_path: ruta,
        nombre_original: nombre,
        // El periodo del histórico NO es el ejercicio del reporte: la evidencia
        // cubre 2024 (y 2023 donde la fuente lo trae).
        periodo_cubierto: "2023-2024",
        area_origen: sol.area_asignada,
        subido_por: staffId,
        notas: `${MARCA} ${notas}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(`evidencia ${nombre}: ${error.message}`);

    const clave = etiquetaArchivo ?? nombre;
    stats.evidenciasPorArchivo[clave] = (stats.evidenciasPorArchivo[clave] ?? 0) + 1;
    return ev.id;
  };

  const capturar = async ({ sol, evidenciaId, valor, unidad, periodo, cita }) => {
    const justificacion = `${MARCA} ${cita}`;
    const { data: previa } = await db
      .from("capturas_valor")
      .select("id")
      .eq("solicitud_id", sol.id)
      .eq("periodo", periodo)
      .eq("justificacion", justificacion)
      .limit(1);
    if ((previa ?? []).length > 0) {
      stats.omitidasPorDuplicado++;
      return;
    }
    const { error } = await db.from("capturas_valor").insert({
      solicitud_id: sol.id,
      evidencia_id: evidenciaId,
      valor,
      unidad,
      periodo,
      capturado_por: staffId,
      confirmado: true,
      justificacion,
    });
    if (error) throw new Error(`captura ${sol.titulo} ${periodo}: ${error.message}`);
    stats.capturasPorPeriodo[periodo] = (stats.capturasPorPeriodo[periodo] ?? 0) + 1;
  };

  const anotar = async (sol, texto) => {
    const { data: previa } = await db
      .from("comentarios")
      .select("id")
      .eq("solicitud_id", sol.id)
      .eq("contenido", texto)
      .limit(1);
    if ((previa ?? []).length > 0) {
      stats.omitidasPorDuplicado++;
      return;
    }
    const { error } = await db.from("comentarios").insert({
      solicitud_id: sol.id,
      autor_id: staffId,
      es_observacion: false,
      contenido: texto,
    });
    if (error) throw new Error(`nota ${sol.titulo}: ${error.message}`);
    stats.notas++;
  };

  /**
   * REGLA 2 de la especificación: «los estados de las solicitudes NO cambian».
   * El trigger de Fase 2 reabre a 'en_revision' toda solicitud 'validado' que
   * reciba captura o evidencia, así que hay que devolverla a su estado previo.
   *
   * Corre en un `finally`, y no al final del camino feliz, por una razón concreta:
   * si el import aborta a mitad —una subida que devuelve 4xx, una sesión que
   * caduca— las solicitudes que ya recibieron captura quedarían reabiertas para
   * siempre, que es justo lo que la regla promete que no pasa. Una restauración
   * que solo ocurre cuando todo sale bien no restaura nada.
   *
   * Lo que sí se deja pasar es el avance automático 'solicitado' → 'recibido' de
   * las que recibieron evidencia: es la regla de la plataforma para «llegó
   * evidencia», y nada se promueve a 'validado'.
   */
  const restaurarEstados = async () => {
    log("\nRestaurando estados…");
    const { data: despues, error } = await db
      .from("solicitudes")
      .select("id, titulo, estado")
      .eq("reporte_id", reporte.id);
    if (error || !despues) {
      // Callar esto sería lo peor: dejaría solicitudes reabiertas con un ✅ al final.
      log(
        `  ⚠️  NO SE PUDO LEER EL ESTADO DE LAS SOLICITUDES (${error?.message ?? "sin datos"}). ` +
          `Revisa a mano si alguna quedó en 'en_revision' y vuelve a correr el script: ` +
          `es idempotente y la restauración se reintenta.`
      );
      return false;
    }
    let restauradas = 0;
    const avanzadas = [];
    const fallidas = [];
    for (const s of despues) {
      const antes = estadoOriginal.get(s.id);
      if (!antes || antes === s.estado) continue;
      if (antes === "validado") {
        const { error: upErr } = await db
          .from("solicitudes")
          .update({ estado: "validado" })
          .eq("id", s.id);
        if (upErr) fallidas.push(`${s.titulo}: ${upErr.message}`);
        else restauradas++;
      } else {
        avanzadas.push(`${s.titulo}: ${antes} → ${s.estado}`);
      }
    }
    log(`  ${restauradas} solicitudes devueltas a 'validado'`);
    for (const a of avanzadas) log(`  avance automático por evidencia — ${a}`);
    for (const f of fallidas) log(`  ⚠️  no se pudo restaurar — ${f}`);
    return fallidas.length === 0;
  };

  try {
    // --- 1. Reporte Anual Ambiental 2024, recortado por sección ---------------
    log("\nReporte Anual Ambiental 2024 (recortado por sección)…");
    const planAmbiental = [
      { seccion: "gei", destino: "GEI", capturas: CAPTURAS_GEI, unidad: "tCO2e" },
      { seccion: "agua", destino: "AGUA", capturas: CAPTURAS_AGUA, unidad: "m³" },
      { seccion: "energia", destino: "ENERGIA", capturas: CAPTURAS_ENERGIA, unidad: "MWh" },
      { seccion: "residuos", destino: "RESIDUOS", capturas: CAPTURAS_RESIDUOS, unidad: "kg" },
    ];
    for (const plan of planAmbiental) {
      const sol = destino[plan.destino];
      if (!sol) continue;
      const sec = SECCIONES_AMB[plan.seccion];
      const cuerpo = await recortar(F.ambiental, sec.desde, sec.hasta);
      const evidenciaId = await adjuntar({
        sol,
        nombre: sec.nombre,
        cuerpo,
        notas:
          `Sección de ${plan.seccion} del ${AMB} (págs. ${sec.desde}-${sec.hasta}), recortada del ` +
          `PDF original entregado por el cliente. Respalda las capturas 2023-2024 de esta tabla.`,
        etiquetaArchivo: "Reporte Anual Amb 2024 (17 jun 2025).pdf [recortes]",
      });
      if (!evidenciaId) continue;

      // POR PERIODO ASCENDENTE, y dentro de cada uno: primero los sectores, después
      // su consolidado. El orden no es cosmético: la plataforma toma la última
      // captura confirmada como valor vigente —del periodo y de la solicitud—, así
      // que un consolidado insertado fuera de su bloque dejaría como cifra visible
      // el total de un año viejo o el dato de un sector cualquiera.
      const periodos = [...new Set(plan.capturas.map((c) => c.periodo))].sort();
      let consolidados = 0;
      for (const periodo of periodos) {
        const delPeriodo = plan.capturas.filter((c) => c.periodo === periodo);
        for (const c of delPeriodo) {
          await capturar({
            sol,
            evidenciaId,
            valor: c.valor,
            unidad: c.unidad ?? plan.unidad,
            periodo,
            cita: c.cita,
          });
        }

        // Consolidados de ESTE periodo, uno por clase donde la haya. Se calculan de
        // las mismas entradas para que no puedan separarse de ellas.
        const porClase = new Map();
        for (const c of delPeriodo) {
          if (!c.sumable) continue;
          const clave = c.clase ?? "";
          const g = porClase.get(clave) ?? { clase: c.clase, partes: [], suma: 0 };
          g.partes.push(c.parte);
          g.suma += c.valor;
          porClase.set(clave, g);
        }
        for (const g of porClase.values()) {
          if (g.partes.length < 2) continue; // con un solo componente no hay total que hacer
          // El redondeo evita el arrastre binario de sumar decimales (p. ej. 14,578.4).
          const suma = Math.round(g.suma * 1e6) / 1e6;
          await capturar({
            sol,
            evidenciaId,
            valor: suma,
            unidad: plan.unidad,
            periodo,
            cita:
              `TOTAL${g.clase ? ` ${g.clase}` : ""} ${periodo} — suma de ${g.partes.join(", ")}. ` +
              `El ${AMB} NO declara este total: lo suma el import a partir de las cifras de arriba.`,
          });
          consolidados++;
        }
      }
      log(
        `  ${plan.destino}: ${plan.capturas.length} capturas + ${consolidados} consolidados · ${sec.nombre}`
      );
    }

    // --- 2. Cursos capacitación 2024 + Resumen Responsabilidad Social (GS) ----
    log("\nCapacitación 2024…");
    if (destino.CAPACITACION) {
      const sol = destino.CAPACITACION;
      const evCap = await adjuntar({
        sol,
        nombre: "Cursos-capacitacion-GCarso-2024.xlsx",
        cuerpo: fs.readFileSync(F.capacitacion),
        notas:
          "Cursos de capacitación 2024 por grupo y programa (Grupo Sanborns y Grupo Carso). " +
          "Fuente de la captura de 779,453 participantes y de los brigadistas de Protección Civil.",
        etiquetaArchivo: "Cursos capacitación GCarso 2024.xlsx",
      });
      const evGS = await adjuntar({
        sol,
        nombre: "Resumen-Responsabilidad-Social-2024-GS.xlsx",
        cuerpo: fs.readFileSync(F.socialGS),
        notas:
          "Resumen de responsabilidad social 2024 de Grupo Sanborns por empresa: empleados al " +
          "31-dic-2024, cursos y participantes, brigadistas, ASUME y Bienestar Social.",
        etiquetaArchivo: "Resumen Responsabilidad Social 2024 (GS) (VFinal).xlsx",
      });
      for (const c of CAPTURAS_CAPACITACION) {
        // `capturas_valor.evidencia_id` es NOT NULL: sin evidencia no hay captura
        // que colgar. Si ninguno de los dos archivos entró (p. ej. bloqueado por
        // tamaño), se reporta y se sigue en vez de reventar la corrida.
        const evidenciaId = c.unidad === "cursos" ? (evGS ?? evCap) : (evCap ?? evGS);
        if (!evidenciaId) {
          hallazgos.push(
            `Capacitación: sin evidencia adjuntada, la captura de ${c.valor} ${c.unidad} (${c.periodo}) no se registró.`
          );
          continue;
        }
        await capturar({
          sol,
          evidenciaId,
          valor: c.valor,
          unidad: c.unidad,
          periodo: c.periodo,
          cita: c.cita,
        });
      }
      log(`  CAPACITACION: ${CAPTURAS_CAPACITACION.length} capturas · 2 archivos`);
    }

    // --- 3. Plantilla (Número de Empleados) ----------------------------------
    log("\nPlantilla histórica…");
    if (destino.COLABORADORES) {
      const sol = destino.COLABORADORES;
      const ev = await adjuntar({
        sol,
        nombre: "Numero-de-Empleados-2024.docx",
        cuerpo: fs.readFileSync(F.empleados),
        notas:
          "Plantilla de Grupo Carso por tipo de colaborador. ATENCIÓN: el archivo se llama «2024» " +
          "pero sus tablas son 2022 y 2023, más una serie 2019-2023. No contiene cifras de 2024.",
        etiquetaArchivo: "Número de Empleados 2024.docx",
      });
      if (ev) {
        for (const c of CAPTURAS_PLANTILLA) {
          await capturar({ sol, evidenciaId: ev, ...c });
        }
        log(`  COLABORADORES: ${CAPTURAS_PLANTILLA.length} capturas (2022 y 2023)`);
      }
    }
    if (destino.TIPO_COLAB) {
      await adjuntar({
        sol: destino.TIPO_COLAB,
        nombre: "Numero-de-Empleados-2024.docx",
        cuerpo: fs.readFileSync(F.empleados),
        notas:
          "Desglose De Confianza / Sindicalizados por categoría (Funcionarios, Empleados, Obreros) " +
          "de 2022 y 2023. El archivo no contiene 2024.",
        etiquetaArchivo: "Número de Empleados 2024.docx",
      });
    }

    // --- 4. Evidencia narrativa ---------------------------------------------
    log("\nEvidencia narrativa…");
    const narrativas = [
      {
        archivo: F.sustentabilidad,
        nombre: "Sustentabilidad-2024-GCARSO.docx",
        etiqueta: "Sustentabilidad 2024 GCARSO 200525.docx",
        destinos: ["ESR", "COMUNIDADES", "DDHH"],
        notas:
          "Informe de sustentabilidad 2024 de Grupo Carso: distintivo ESR del CEMEFI, apoyo a " +
          "comunidades, política de derechos humanos y capacitación ambiental.",
      },
      {
        archivo: F.salud,
        nombre: "Salud-Integral-Sostenible-Carso.docx",
        etiqueta: "Salud Integral Sostenible … Grupo Carso.docx",
        destinos: ["MIDO"],
        notas:
          "Programa de Salud Integral Carso y estrategia MIDO, periodo 2023-2024 (Servicio Médico " +
          "Corporativo): población muestreada y tendencias de tabaquismo, sedentarismo, sueño, " +
          "prediabetes y prehipertensión.",
      },
      {
        archivo: F.condumex,
        nombre: "Estrategia-ASG-Condumex-Jun25.docx",
        etiqueta: "Estrategia ASG de Condumex Jun-25.docx",
        destinos: ["IND_ETICA"],
        notas:
          "Estrategia ASG de Grupo Condumex hacia 2030: materialidad 2022, Pilar 1 gestión " +
          "ambiental, Pilar 2 desarrollo social y Pilar 3 gobernanza transparente (ética y " +
          "transparencia).",
      },
      {
        archivo: F.autopartes,
        nombre: "ASG-Autopartes.pdf",
        etiqueta: "ASG (Autopartes).pdf",
        destinos: ["IND_ETICA"],
        notas:
          "Criterios de sostenibilidad aplicados en Autopartes: programas Becas Telmex-Telcel, " +
          "ASUME y Bienestar Social, con su aporte declarado al componente de gobernanza.",
      },
    ];
    for (const n of narrativas) {
      const cuerpo = fs.readFileSync(n.archivo);
      const mb = (cuerpo.length / 1048576).toFixed(1);
      for (const clave of n.destinos) {
        const sol = destino[clave];
        if (!sol) continue;
        const ev = await adjuntar({
          sol,
          nombre: n.nombre,
          cuerpo,
          notas: n.notas,
          etiquetaArchivo: n.etiqueta,
        });
        if (ev) log(`  ${clave} ← ${n.etiqueta} (${mb} MB)`);
      }
    }

    // --- 4.5 Nota de alcance de la fila que llega a la plantilla oficial ------
  log("\nNota de alcance…");
  {
    const candidatas = solicitudes.filter(
      (x) => x.area_asignada === ALCANCE_GEI.area && ALCANCE_GEI.re.test(x.titulo)
    );
    if (candidatas.length !== 1) {
      hallazgos.push(
        `Nota de alcance NO declarada: ${candidatas.length} solicitudes coinciden con ` +
          `${ALCANCE_GEI.area} · ${ALCANCE_GEI.re}. Declárala a mano desde el detalle.`
      );
    } else {
      const objetivo = candidatas[0];
      const { data: actual } = await db
        .from("solicitudes")
        .select("nota_alcance")
        .eq("id", objetivo.id)
        .single();
      if (actual?.nota_alcance === ALCANCE_GEI.nota) {
        stats.omitidasPorDuplicado++;
        log("  ya estaba declarada");
      } else if (actual?.nota_alcance) {
        // Alguien la editó desde el panel: esa versión gana. Sobrescribirla sería
        // deshacer una decisión editorial con un script.
        hallazgos.push(
          `La solicitud «${objetivo.titulo}» ya tiene otra nota de alcance y NO se ` +
            `sobrescribió: "${actual.nota_alcance}".`
        );
      } else {
        const { error } = await db
          .from("solicitudes")
          .update({ nota_alcance: ALCANCE_GEI.nota })
          .eq("id", objetivo.id);
        if (error) throw new Error(`nota de alcance: ${error.message}`);
        stats.alcance = 1;
        log(`  declarada en «${objetivo.titulo}»`);
      }
    }
  }

  // --- 5. Notas ------------------------------------------------------------
    log("\nNotas de trazabilidad…");
    for (const n of NOTAS) {
      const sol = destino[n.destino];
      if (!sol) continue;
      await anotar(sol, n.texto);
    }
    log(`  ${stats.notas} notas escritas`);

  } finally {
    await restaurarEstados();
  }

  // --- Entrega -------------------------------------------------------------
  log("\n" + "─".repeat(74));
  log("CAPTURAS NUEVAS POR PERIODO");
  const periodos = Object.keys(stats.capturasPorPeriodo).sort();
  if (periodos.length === 0) log("  (ninguna: ya estaban todas)");
  for (const p of periodos) log(`  ${p}  ${String(stats.capturasPorPeriodo[p]).padStart(4)}`);
  log(
    `  TOTAL ${String(Object.values(stats.capturasPorPeriodo).reduce((a, b) => a + b, 0)).padStart(3)}`
  );

  log("\nEVIDENCIAS ADJUNTADAS POR ARCHIVO");
  const archivos = Object.keys(stats.evidenciasPorArchivo).sort();
  if (archivos.length === 0) log("  (ninguna: ya estaban todas)");
  for (const a of archivos) {
    log(`  ${String(stats.evidenciasPorArchivo[a]).padStart(2)}  ${a}`);
  }

  log(
    `\nNotas: ${stats.notas} · notas de alcance declaradas: ${stats.alcance} · ` +
      `omitidos por ya existir: ${stats.omitidasPorDuplicado}`
  );
  if (faltantes.length) {
    log("\n⚠️  DESTINOS NO RESUELTOS (no se escribió nada en ellos)");
    for (const f of faltantes) log(`  - ${f}`);
  }
  if (pesados.size) {
    log("\nARCHIVOS PESADOS (medidos al subir)");
    for (const [nombre, bytes] of pesados) {
      log(
        `  ${(bytes / 1048576).toFixed(1)} MB  ${nombre}` +
          (LIMITE_BUCKET != null
            ? ` — cabe en el límite de ${(LIMITE_BUCKET / 1048576).toFixed(0)} MB`
            : " — el bucket no declara límite propio; verifica el global antes de desplegar")
      );
    }
  }
  if (hallazgos.length) {
    log("\n⚠️  HALLAZGOS");
    for (const h of hallazgos) log(`  - ${h}`);
  }
  log("─".repeat(74));
  log("✅ Histórico importado.");
}

correr().catch((e) => {
  console.error("\n❌ Error:", e.message);
  process.exit(1);
});
