#!/usr/bin/env node
// =============================================================================
// POBLAR EL TENANT DEMO DE traceline-dev
//
// Carga el contenido de docs/suplemento-s1s2/demo/contenido.md: un grupo
// financiero mexicano ficticio que REEMPLAZA el giro industrial que traía el
// seed. Nada de lo que escribe es real y nada sale de dev.
//
// DOS PROPIEDADES QUE NO SON NEGOCIABLES:
//
// 1. Solo dev. Si la URL de Supabase no es la del proyecto de desarrollo, el
//    script aborta antes de leer nada. El tenant demo existe también en staging
//    y una corrida equivocada reescribiría el material que se enseña a clientes.
//
// 2. Idempotente. Todo se busca por su clave natural —el nombre del área, el
//    título de la solicitud, (hoja, pregunta) del cuestionario— y se actualiza
//    si ya existe. Correrlo dos veces deja la base igual que correrlo una, y no
//    duplica evidencias ni capturas.
//
// Lo que NO hace: borrar. Los registros de clima industriales se DESACTIVAN,
// porque la bitácora y los documentos ya generados los referencian.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// -----------------------------------------------------------------------------
// Barrera de ambiente
// -----------------------------------------------------------------------------
const DEV_REF = "kmjkoxecxcujxixlxwlb";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes(DEV_REF)) {
  console.error(
    `\n✗ ABORTA: la URL de Supabase no es la de traceline-dev (${DEV_REF}).\n` +
      `  Este script reescribe el tenant demo entero y solo puede correr contra dev.\n`
  );
  process.exit(1);
}
console.log(`barrera: proyecto ${DEV_REF} = traceline-dev ✓\n`);

const db = createClient(URL_SB, env.SUPABASE_SERVICE_ROLE_KEY);

const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const EJERCICIO = 2025;
const BUCKET = "evidencias";

/** Marca en el nombre del archivo para reconocer lo que sube este script. */
const MARCA = "demo-financiero";

const ok = (etq, { data, error }) => {
  if (error) throw new Error(`${etq}: ${error.message}`);
  return data;
};

const log = (s) => console.log(s);
const cuenta = { creado: 0, actualizado: 0, saltado: 0 };

// =============================================================================
// PDF de evidencia: una página, encabezado y texto ajustado.
//
// Se genera aquí y no con una librería porque un PDF de una página con una
// fuente estándar son doscientas líneas de bytes, y meter una dependencia nueva
// en el proyecto para poblar un demo sería pagar mantenimiento para siempre por
// algo que se usa una vez.
// =============================================================================
function pdfDeTexto(titulo, subtitulo, cuerpo) {
  const ANCHO = 612;
  const MARGEN = 64;
  const UTIL = ANCHO - MARGEN * 2;

  // Helvetica a 10 pt mide ~0.5 em por carácter en promedio; con 0.52 el ajuste
  // queda holgado y ninguna línea se sale del margen.
  const porLinea = Math.floor(UTIL / (10 * 0.52));
  const lineas = [];
  for (const parrafo of cuerpo.split("\n")) {
    if (!parrafo.trim()) {
      lineas.push("");
      continue;
    }
    let linea = "";
    for (const palabra of parrafo.split(/\s+/)) {
      if (linea && (linea + " " + palabra).length > porLinea) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = linea ? linea + " " + palabra : palabra;
      }
    }
    if (linea) lineas.push(linea);
  }

  // Los paréntesis y la barra invertida son sintaxis dentro de un literal de
  // cadena PDF: sin escapar, un "(a)(i)" rompe el archivo entero.
  const esc = (s) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  let y = 728;
  let flujo = `BT /F1 13 Tf ${MARGEN} ${y} Td (${esc(titulo)}) Tj ET\n`;
  y -= 20;
  flujo += `BT /F2 9 Tf ${MARGEN} ${y} Td (${esc(subtitulo)}) Tj ET\n`;
  y -= 10;
  flujo += `${MARGEN} ${y} m ${ANCHO - MARGEN} ${y} l 0.6 w S\n`;
  y -= 26;
  for (const l of lineas) {
    if (y < MARGEN) break; // una página: lo que no cabe, no cabe.
    if (l) flujo += `BT /F2 10 Tf ${MARGEN} ${y} Td (${esc(l)}) Tj ET\n`;
    y -= 14;
  }

  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const bytesFlujo = Buffer.from(flujo, "latin1");
  const partes = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [];
  let largo = partes[0].length;
  const empujar = (b) => {
    partes.push(b);
    largo += b.length;
  };
  objs.forEach((cuerpoObj, i) => {
    offsets.push(largo);
    empujar(Buffer.from(`${i + 1} 0 obj\n${cuerpoObj}\nendobj\n`, "latin1"));
  });
  offsets.push(largo);
  empujar(Buffer.from(`6 0 obj\n<< /Length ${bytesFlujo.length} >>\nstream\n`, "latin1"));
  empujar(bytesFlujo);
  empujar(Buffer.from("endstream\nendobj\n", "latin1"));
  const xref = largo;
  let tabla = `xref\n0 7\n0000000000 65535 f \n`;
  for (const o of offsets) tabla += `${String(o).padStart(10, "0")} 00000 n \n`;
  tabla += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  empujar(Buffer.from(tabla, "latin1"));
  return Buffer.concat(partes);
}

/** Sin acentos ni espacios: viaja como nombre de objeto en storage. */
const slugArchivo = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);

// =============================================================================
// Contenido — docs/suplemento-s1s2/demo/contenido.md
// =============================================================================

const PERFIL = {
  denominacion_formal: "Empresa Demo, S.A.B. de C.V.",
  nombre_corto: "Empresa Demo",
  forma_de_referencia: "la Compañía",
  entidad_que_informa:
    "Empresa Demo, S.A.B. de C.V. y sus subsidiarias consolidadas: Banco Demo, S.A., Institución de Banca Múltiple; Arrendadora Demo, S.A. de C.V., SOFOM E.R.; y Factoraje Demo, S.A. de C.V.",
  perimetro:
    "El informe cubre la totalidad de las operaciones consolidadas en México: 118 sucursales bancarias, tres centros operativos (Monterrey, Ciudad de México y Mérida) y el corporativo. Las métricas de emisiones comprenden las operaciones propias (Alcances 1 y 2). Las emisiones financiadas y las métricas de cartera se presentan como exposición cualitativa; su cuantificación se difiere conforme al alivio C4 del primer año. Las participaciones minoritarias no consolidadas se excluyen.",
  carta_firmante: "Andrés Villaseñor Ruiz",
  carta_cargo: "Director General",
  carta_texto: [
    "Presentamos el primer Informe de Sostenibilidad de Empresa Demo preparado conforme a las Normas NIIF S1 y S2. Para una institución financiera, el cambio climático no es únicamente un asunto de huella operativa: es un factor que incide en la calidad de nuestra cartera, en el valor de los colaterales que respaldan nuestros créditos y en las expectativas de los inversionistas que financian nuestro crecimiento.",
    "Durante 2025 fortalecimos la gobernanza de estos temas con la creación del Comité de Sostenibilidad y Riesgos Climáticos, integramos criterios climáticos en la evaluación de crédito para los sectores de mayor exposición y concluimos la primera evaluación de riesgos físicos sobre nuestra red de sucursales y sobre la cartera agropecuaria e inmobiliaria.",
    "Este informe es una línea base. Reconocemos que la medición de emisiones financiadas, la cuantificación de efectos financieros y la comparabilidad entre ejercicios son tareas que iremos completando en los próximos periodos, y asumimos el compromiso de reportar con transparencia tanto los avances como las limitaciones.",
  ].join("\n\n"),
  proceso_materialidad:
    "Durante 2025 la Compañía evaluó los riesgos y oportunidades relacionados con el clima considerando su efecto razonablemente previsible sobre la situación financiera, el desempeño financiero, los flujos de efectivo, el acceso a financiamiento y el costo de capital. El ejercicio combinó tres fuentes: el análisis de exposición física de la red de sucursales y de los colaterales con datos del Atlas Nacional de Riesgos (CENAPRED); el análisis de sensibilidad de la cartera por sector económico ante un precio al carbono y cambios regulatorios; y entrevistas con las direcciones de Riesgos, Crédito, Tesorería y Finanzas. La materialidad se determinó con el criterio de materialidad financiera de la NIIF S1. Los marcos COSO (2017) e ISO 31000 se utilizaron como apoyo metodológico, sin sustituir el análisis requerido por la norma.",
  modelo_negocio:
    "Empresa Demo es un grupo financiero mexicano de tamaño medio que opera a través de un banco de banca múltiple, una arrendadora y una empresa de factoraje. Atiende a personas físicas, pequeñas y medianas empresas y empresas medianas en 22 estados, con concentración en el norte y el sureste del país. Al cierre de 2025 la cartera de crédito total ascendió a 86,400 millones de pesos, distribuida en crédito empresarial (52%), hipotecario (21%), consumo (15%) y agropecuario (12%). La captación tradicional financia el 71% del balance y el resto proviene de emisiones en el mercado de deuda y líneas de banca de desarrollo. El grupo emplea a 2,860 personas.",
  gobierno_texto:
    "El Consejo de Administración es el máximo órgano de gobierno y supervisa los riesgos y oportunidades relacionados con el clima. Se apoya en el Comité de Auditoría y Prácticas Societarias, el Comité de Riesgos y, desde 2025, el Comité de Sostenibilidad y Riesgos Climáticos, integrado por tres consejeros (dos independientes) y presidido por una consejera independiente con experiencia en finanzas sostenibles. A nivel de gestión, la Dirección de Riesgos coordina la identificación y medición de riesgos climáticos, la Dirección de Sostenibilidad la estrategia y el reporte, y el Comité de Dirección la integración en la planeación y el presupuesto. El Comité de Sostenibilidad y Riesgos Climáticos se reúne trimestralmente e informa al Consejo dos veces al año.",
  horizontes: [
    {
      plazo: "Corto plazo",
      definicion: "Hasta 1 año",
      justificacion:
        "Ciclo presupuestal anual, liquidez y contingencias operativas de la red de sucursales.",
    },
    {
      plazo: "Mediano plazo",
      definicion: "Más de 1 año y hasta 5 años",
      justificacion:
        "Vida promedio de la cartera comercial y de arrendamiento; horizonte del plan estratégico.",
    },
    {
      plazo: "Largo plazo",
      definicion: "Más de 5 años",
      justificacion:
        "Vida de la cartera hipotecaria, resiliencia de infraestructura propia y trayectorias regulatorias y físicas del clima.",
    },
  ],
  hitos_corporativos: [
    { anio: "1996", texto: "Constitución de Arrendadora Demo en Monterrey, origen del grupo." },
    { anio: "2004", texto: "Obtención de la licencia de banca múltiple; inicio de operaciones de Banco Demo." },
    { anio: "2009", texto: "Listado de acciones en la Bolsa Mexicana de Valores." },
    { anio: "2014", texto: "Expansión al sureste: apertura del centro operativo de Mérida y 30 sucursales." },
    { anio: "2019", texto: "Primera emisión de certificados bursátiles de largo plazo." },
    { anio: "2023", texto: "Cartera total supera los 80,000 millones de pesos; 118 sucursales en 22 estados." },
  ],
  hitos_sostenibilidad: [
    { anio: "2017", texto: "Primer Informe Anual de Sustentabilidad bajo GRI." },
    { anio: "2019", texto: "Adhesión al Pacto Global de las Naciones Unidas." },
    { anio: "2021", texto: "Emisión del primer bono verde del grupo (2,000 millones de pesos) para financiar eficiencia energética en pymes." },
    { anio: "2022", texto: "Primer inventario de emisiones de Alcances 1 y 2 verificado por tercero." },
    { anio: "2024", texto: "Política de Financiamiento Sostenible aprobada por el Consejo; distintivo ESR." },
    { anio: "2025", texto: "Creación del Comité de Sostenibilidad y Riesgos Climáticos; primera evaluación de riesgos físicos de cartera." },
  ],
  cadena_valor: [
    { etapa: "Captación", descripcion: "Depósitos de clientes y emisión de deuda; sensible a la percepción de inversionistas sobre riesgos climáticos y a las condiciones del mercado de deuda sostenible." },
    { etapa: "Originación de crédito", descripcion: "Evaluación y otorgamiento de crédito; etapa donde se incorporan criterios climáticos por sector y ubicación del colateral." },
    { etapa: "Administración de cartera", descripcion: "Seguimiento, cobranza y valuación de garantías; donde se materializan los efectos físicos sobre colaterales y la capacidad de pago de acreditados." },
    { etapa: "Tesorería e inversiones", descripcion: "Gestión de liquidez y portafolio de inversión; exposición indirecta a emisores con riesgo de transición." },
    { etapa: "Operación y red de sucursales", descripcion: "118 sucursales, tres centros operativos y corporativo; fuente de las emisiones propias y de la exposición física directa." },
    { etapa: "Proveedores", descripcion: "Tecnología, servicios de valor, mantenimiento y energía; incidencia en continuidad operativa." },
  ],
  matriz_riesgos: {
    escala_max: 25,
    niveles: [
      { nombre: "Bajo", min: 0, max: 5 },
      { nombre: "Medio", min: 6, max: 12 },
      { nombre: "Alto", min: 13, max: 19 },
      { nombre: "Crítico", min: 20, max: 25 },
    ],
  },
};

const AREAS = [
  "Dirección General",
  "Finanzas",
  "Riesgos",
  "Crédito y Banca",
  "Sostenibilidad",
  "Recursos Humanos",
  "Administración y Operaciones",
];

/**
 * Renombres de las áreas que ya existen. Se conservan las cuentas: el área vive
 * en `areas_tenant` y `perfiles_usuario.area` la referencia POR NOMBRE, así que
 * renombrar la fila sin arrastrar el texto del perfil dejaría usuarios apuntando
 * a un área que ya no existe.
 */
const RENOMBRES = {
  RH: "Recursos Humanos",
  Operaciones: "Administración y Operaciones",
  Finanzas: "Finanzas",
  "Gobierno Corporativo": "Riesgos",
  Dirección: "Dirección General",
};

const REGISTROS = [
  {
    nombre: "Huracanes e inundaciones en la red del sureste",
    tipo: "riesgo_fisico",
    horizontes: ["Corto plazo", "Mediano plazo"],
    probabilidad: 5,
    impacto: 4,
    severidad: 20,
    nivel: "Crítico",
    descripcion:
      "31 sucursales y el centro operativo de Mérida se ubican en Yucatán, Quintana Roo, Tabasco y Veracruz, zonas de alta incidencia de ciclones. Un evento mayor interrumpe la operación, daña activos propios y afecta la capacidad de pago de acreditados locales.",
    concentracion:
      "Operación y red de sucursales; administración de cartera (hipotecaria y pyme del sureste).",
    impactos_potenciales:
      "Cierre temporal de sucursales, daños a inmuebles y equipo, deterioro de cartera por afectación de clientes, mayores primas de seguro.",
    respuesta:
      "Plan de continuidad con respaldo operativo en Monterrey, cobertura de seguros de daños y interrupción, protocolo de reestructuras para acreditados afectados por desastres declarados.",
    valores: {
      cantidad_activos: 32,
      porcentaje: 26,
      capital_gasto: 18.5,
      capital_financiacion: null,
      capital_inversion: null,
      notas: "31 sucursales y 1 centro operativo; capital de gasto en adecuaciones y seguros (MDP).",
    },
  },
  {
    nombre: "Estrés hídrico sobre la cartera agropecuaria del norte y el Bajío",
    tipo: "riesgo_fisico",
    horizontes: ["Mediano plazo", "Largo plazo"],
    probabilidad: 4,
    impacto: 4,
    severidad: 16,
    nivel: "Alto",
    descripcion:
      "El 12% de la cartera es agropecuaria, concentrada en Nuevo León, Coahuila, Guanajuato y Querétaro, regiones con déficit hídrico creciente. La menor disponibilidad de agua reduce rendimientos y capacidad de pago.",
    concentracion: "Originación y administración de cartera agropecuaria.",
    impactos_potenciales:
      "Aumento de cartera vencida y reservas, menor valor de garantías rurales, reducción de la originación en el sector.",
    respuesta:
      "Criterios de disponibilidad hídrica en la evaluación de crédito agropecuario desde 2025, productos de financiamiento para riego tecnificado, seguimiento trimestral de la cartera expuesta.",
    valores: {
      cantidad_activos: 10370,
      porcentaje: 12.0,
      capital_gasto: null,
      capital_financiacion: 640,
      capital_inversion: null,
      notas: "Cartera expuesta 10,370 MDP; financiación: línea para riego tecnificado (MDP).",
    },
  },
  {
    nombre: "Precio al carbono y regulación sobre sectores intensivos en la cartera empresarial",
    tipo: "riesgo_transicion",
    horizontes: ["Mediano plazo", "Largo plazo"],
    probabilidad: 4,
    impacto: 3,
    severidad: 12,
    nivel: "Medio",
    descripcion:
      "El 18% de la cartera empresarial está en cemento, acero, transporte de carga y generación eléctrica convencional. Un precio al carbono o normas de emisiones más estrictas elevan sus costos y reducen su capacidad de pago.",
    concentracion: "Originación y administración de cartera empresarial.",
    impactos_potenciales:
      "Deterioro de calificación de acreditados, mayores reservas, activos varados como colateral.",
    respuesta:
      "Clasificación sectorial de la cartera por intensidad de carbono, límites de concentración en sectores intensivos aprobados por el Comité de Riesgos, acompañamiento de acreditados en planes de transición.",
    valores: {
      cantidad_activos: 8090,
      porcentaje: 9.4,
      capital_gasto: null,
      capital_financiacion: null,
      capital_inversion: null,
      notas: "Cartera expuesta 8,090 MDP, 9.4% de la cartera total.",
    },
  },
  {
    nombre: "Expectativas de inversionistas y taxonomía sostenible",
    tipo: "riesgo_transicion",
    horizontes: ["Corto plazo", "Mediano plazo"],
    probabilidad: 3,
    impacto: 3,
    severidad: 9,
    nivel: "Medio",
    descripcion:
      "Los inversionistas institucionales que adquieren la deuda del grupo exigen alineación con la Taxonomía Sostenible de México y divulgación climática; no cumplirla encarece el financiamiento.",
    concentracion: "Captación y tesorería.",
    impactos_potenciales:
      "Mayor costo de fondeo, menor demanda en emisiones, exclusión de índices sostenibles.",
    respuesta:
      "Política de Financiamiento Sostenible, marco de bonos verdes con opinión de segunda parte, reporte anual de asignación e impacto.",
    valores: {
      cantidad_activos: 14200,
      porcentaje: 16.4,
      capital_gasto: null,
      capital_financiacion: null,
      capital_inversion: null,
      notas: "Deuda de mercado 14,200 MDP, 16.4% del pasivo.",
    },
  },
  {
    nombre: "Financiamiento sostenible a pymes y vivienda eficiente",
    tipo: "oportunidad",
    horizontes: ["Corto plazo", "Mediano plazo"],
    probabilidad: null,
    impacto: null,
    severidad: null,
    nivel: null,
    descripcion:
      "Crecimiento de la cartera con etiqueta verde (eficiencia energética, vivienda con certificación, energía distribuida) y acceso a fondeo con menor costo.",
    concentracion: "Originación de crédito y captación.",
    impactos_potenciales:
      "Mayores ingresos por intereses en segmentos de crecimiento, menor costo de fondeo, diferenciación.",
    respuesta: "Meta de cartera sostenible, alianzas con banca de desarrollo.",
    valores: {
      cantidad_activos: 6910,
      porcentaje: 8.0,
      capital_gasto: null,
      capital_financiacion: 2000,
      capital_inversion: null,
      notas: "Cartera sostenible 6,910 MDP; financiación: bono verde vigente (MDP).",
    },
  },
  {
    nombre: "Eficiencia operativa de la red",
    tipo: "oportunidad",
    horizontes: ["Corto plazo"],
    probabilidad: null,
    impacto: null,
    severidad: null,
    nivel: null,
    descripcion:
      "Reducción del consumo eléctrico de sucursales mediante iluminación LED, climatización eficiente y generación solar distribuida en 40 sucursales.",
    concentracion: "Operación y red de sucursales.",
    impactos_potenciales: "Menor gasto operativo y menores emisiones de Alcance 2.",
    respuesta: "Programa 2025-2027 con inversión de 92 MDP.",
    valores: {
      cantidad_activos: 40,
      porcentaje: 34,
      capital_gasto: null,
      capital_financiacion: null,
      capital_inversion: 31,
      notas: "40 sucursales intervenidas, 34% de la red; inversión 2025 de 31 MDP.",
    },
  },
];

/**
 * Cifras del ejercicio. `titulo` busca una solicitud existente; si no aparece,
 * se crea con ese título. La unidad es la que ya declara la solicitud cuando la
 * hay, porque cambiarla invalidaría las capturas anteriores.
 */
const CIFRAS = [
  { titulo: "Inventario GEI Alcance 1 con memoria de cálculo", valor: 1240, unidad: "tCO2e" },
  { titulo: "Inventario GEI Alcance 2 (ubicación y mercado)", valor: 3860, unidad: "tCO2e" },
  { titulo: "Consumo de energía eléctrica 2025 por instalación (kWh)", valor: 9120000, unidad: "kWh" },
  { titulo: "Consumo de agua 2025 por fuente (m3)", valor: 71500, unidad: "m3" },
  { titulo: "Generación y disposición de residuos 2025 (ton)", valor: 412, unidad: "ton" },
  { titulo: "Plantilla y rotación de personal 2025", valor: 2860, unidad: "personas" },
  { titulo: "Horas de capacitación 2025", valor: 68640, unidad: "horas" },
  { titulo: "Índice de rotación voluntaria 2025 (%)", valor: 11.8, unidad: "%" },
  { titulo: "Ingresos asociados a productos/servicios sostenibles 2025", valor: 8.0, unidad: "%" },
];

// Cifras que no tenían solicitud y se crean como cuantitativas nuevas.
const CIFRAS_NUEVAS = [
  {
    // El título es EXACTAMENTE el del seed. `solicitudCompleta` empareja por
    // título, así que uno más descriptivo —por correcto que fuera— creaba una
    // solicitud nueva y dejaba la vieja abierta pidiendo un dato ya entregado.
    // Lo detectó el generador en una nota del bloque 30.
    titulo: "Consumo de combustibles fósiles 2025",
    // Ligada a 29 (a)(iii): el dato de entrada del cálculo ES parte del enfoque
    // de medición. Sin este mapeo el bloque 30 pedía un volumen de combustible
    // que ya estaba capturado y confirmado, y abría un pendiente falso.
    codigos: ["NIIF S2 29 (a)(iii)"],
    area: "Administración y Operaciones",
    valor: 488000,
    unidad: "litros",
    texto:
      "Consumo de gasolina y diésel de la flota vehicular y de las plantas de emergencia de sucursales y centros operativos durante el ejercicio 2025: 488,000 litros. Es el dato de entrada del cálculo de emisiones de Alcance 1.",
  },
  {
    titulo: "Inversión y gastos ambientales 2025",
    codigos: ["NIIF S2 29 (e)"],
    area: "Finanzas",
    valor: 31.4,
    unidad: "MDP",
    texto:
      "La Compañía destinó 31.4 millones de pesos a inversión y gasto ambiental durante 2025, concentrados en el programa de eficiencia energética de la red de sucursales: iluminación LED, climatización eficiente y generación solar distribuida.",
  },
  {
    titulo: "Mujeres en plantilla y en el Consejo 2025",
    codigos: [],
    area: "Recursos Humanos",
    valor: 54,
    unidad: "%",
    texto:
      "Al cierre de 2025 las mujeres representaron el 54% de la plantilla total de 2,860 personas y el 27% del Consejo de Administración (3 de 11 consejeros). Los consejeros independientes son el 45% del Consejo (5 de 11).",
  },
  {
    titulo: "Cartera de crédito total 2025",
    codigos: [],
    area: "Crédito y Banca",
    valor: 86400,
    unidad: "MDP",
    texto:
      "La cartera de crédito total al cierre de 2025 ascendió a 86,400 millones de pesos: crédito empresarial 52%, hipotecario 21%, consumo 15% y agropecuario 12%.",
  },
  {
    titulo: "Cartera sostenible 2025",
    codigos: [],
    area: "Crédito y Banca",
    valor: 6910,
    unidad: "MDP",
    texto:
      "La cartera con etiqueta sostenible conforme a la Taxonomía Sostenible de México ascendió a 6,910 millones de pesos al cierre de 2025, equivalente al 8.0% de la cartera total.",
  },
];

/**
 * Solicitudes narrativas. Cada una nace ligada a sus códigos de datapoint, con
 * una evidencia PDF de una página generada del texto que le corresponde en la
 * sección 5 del documento, validada y con visto bueno del área.
 *
 * Un título = una solicitud = una evidencia, aunque cubra varios códigos: el
 * texto de la norma reparte un mismo hecho en varios incisos y abrir una
 * solicitud por inciso le pediría al cliente el mismo documento cuatro veces.
 */
const NARRATIVAS = [
  // --- Solicitudes que YA EXISTÍAN del giro industrial -------------------------
  // Se reconocen por su título y solo se les cambia el contenido: el documento
  // cubre su tema, pero el seed las dejó sin evidencia o sin validar y eran los
  // únicos huecos que quedaban en el semáforo. Crear una solicitud paralela
  // habría dejado dos pidiendo lo mismo.
  {
    titulo: "Competencias del Consejo en temas ESG y clima",
    codigos: ["NIIF S1 27(a)(ii)", "NIIF S2 6 (a)(ii)"],
    area: "Dirección General",
    texto:
      "El Consejo evalúa anualmente la suficiencia de competencias en materia climática. En 2025 incorporó a una consejera independiente con experiencia en finanzas sostenibles y contrató capacitación especializada para el Consejo y el Comité de Dirección (16 horas) sobre riesgos climáticos en instituciones financieras, impartida por una firma externa.",
  },
  {
    titulo: "Riesgos físicos climáticos en instalaciones",
    codigos: ["NIIF S2 10(a), (b)y(c)"],
    area: "Administración y Operaciones",
    texto:
      "La Compañía identificó dos riesgos físicos relacionados con el clima que podrían afectar razonablemente sus perspectivas. El primero, agudo: 31 sucursales y el centro operativo de Mérida se ubican en Yucatán, Quintana Roo, Tabasco y Veracruz, zonas de alta incidencia de ciclones; un evento mayor interrumpe la operación, daña activos propios y afecta la capacidad de pago de acreditados locales. Se espera en el corto y el mediano plazo. El segundo, crónico: el 12% de la cartera es agropecuaria y está concentrada en Nuevo León, Coahuila, Guanajuato y Querétaro, regiones con déficit hídrico creciente; la menor disponibilidad de agua reduce rendimientos y capacidad de pago. Se espera en el mediano y el largo plazo.",
  },
  {
    titulo: "Efectos financieros de riesgos climáticos en estados financieros",
    codigos: ["NIIF S2 16(a)", "NIIF S2 16(b)"],
    area: "Finanzas",
    texto:
      "Con la información disponible al cierre de 2025, la Compañía no identificó efectos de los riesgos y oportunidades climáticos que requirieran reconocer ajustes en los importes de los estados financieros del ejercicio, ni partidas afectadas de forma material. El gasto de capital asociado a adecuaciones y seguros de la red del sureste ascendió a 18.5 millones de pesos y la inversión ambiental del ejercicio a 31.4 millones de pesos; ambos se registraron en los rubros ordinarios de gasto e inversión. Los riesgos físicos sobre colaterales del sureste y de la cartera agropecuaria son la principal fuente de riesgo de ajuste material en el ejercicio siguiente.",
  },
  {
    titulo: "Análisis de escenarios climáticos y resiliencia",
    codigos: ["NIIF S2 22(a)(i)", "NIIF S2 22(b)(i)"],
    area: "Riesgos",
    texto:
      "El análisis de escenarios se llevó a cabo en el segundo semestre de 2025, con actualización anual prevista. Consideró dos escenarios de fase IV: transición ordenada (NGFS Net Zero 2050) y altas emisiones (IPCC SSP5-8.5 / NGFS Current Policies), tomados de NGFS fase IV e IPCC AR6. El rango es diverso, incluye un escenario alineado con el último acuerdo internacional sobre cambio climático, y se aplicó a los horizontes de corto (2026), mediano (2030) y largo plazo (2040) sobre la red de sucursales y la cartera empresarial, agropecuaria e hipotecaria, con un método cualitativo apoyado en sensibilidad de cartera por sector y exposición física por código postal. Bajo el escenario de transición ordenada, el modelo de negocio se beneficia del crecimiento de la cartera sostenible y del menor costo de fondeo; el principal ajuste es la reducción gradual de la exposición a sectores intensivos. Bajo el escenario de altas emisiones, los riesgos físicos sobre la red del sureste y la cartera agropecuaria exigen mayores reservas, seguros y reestructuras, con un efecto acotado sobre el capital regulatorio.",
  },
  {
    titulo: "Plan de transición climática y objetivos de reducción",
    codigos: ["NIIF S2 14(a)(iv)", "NIIF S2 36 (a)a(d)", "NIIF S2 33"],
    area: "Sostenibilidad",
    texto:
      "El plan de transición 2025-2030 establece: reducción de 30% de las emisiones de Alcances 1 y 2 respecto de 2025; cartera sostenible de al menos 20% de la cartera total en 2028; medición de emisiones financiadas con PCAF para el 80% de la cartera empresarial en 2027; y revisión anual de límites sectoriales. Sus supuestos son la continuidad de la Taxonomía Sostenible de México, la disponibilidad de fondeo verde de banca de desarrollo y la trayectoria regulatoria de la CNBV. Los objetivos son de ámbito climático y alcanzan a toda la Compañía salvo el de emisiones financiadas, acotado a la cartera empresarial. El de emisiones es absoluto, cubre CO2, CH4 y N2O en Alcances 1 y 2 en términos brutos, con periodo base 2025, periodo de aplicación 2026-2030 e hito intermedio de 12% al 2027; es consistente con la trayectoria del Acuerdo de París y no está validado por SBTi. El de cartera sostenible es relativo, con periodo base 2025 (8.0%), aplicación 2026-2028 e hito de 12% en 2026, alineado con la Taxonomía Sostenible de México.",
  },
  {
    titulo: "Precio interno del carbono aplicado en decisiones de inversión",
    codigos: ["NIIF S2 29 (f) (i) y (ii)"],
    area: "Riesgos",
    texto:
      "La Compañía no aplica un precio interno del carbono en 2025, por lo que no hay un precio por tonelada ni una explicación de cómo se aplica a las decisiones del ejercicio. El Comité de Riesgos evalúa incorporar un precio sombra de 500 pesos por tonelada en el análisis de crédito a sectores intensivos a partir de 2026.",
  },

  {
    titulo: "Órgano responsable del clima y términos de referencia",
    codigos: ["NIIF S2 6 (a)(i)"],
    area: "Dirección General",
    texto:
      "La supervisión de los riesgos y oportunidades relacionados con el clima recae en el Consejo de Administración, que delegó el seguimiento en el Comité de Sostenibilidad y Riesgos Climáticos, creado en febrero de 2025. Sus términos de referencia establecen la revisión trimestral del mapa de riesgos climáticos, la aprobación de la estrategia climática y la supervisión de los objetivos, y la validación del informe anual de sostenibilidad antes de su presentación al Consejo.",
  },
  {
    titulo: "Frecuencia de información al Consejo sobre riesgos climáticos",
    codigos: ["NIIF S2 6 (a)(iii)"],
    area: "Dirección General",
    texto:
      "El Comité de Sostenibilidad y Riesgos Climáticos se reúne cada trimestre; el Consejo recibe un informe integral sobre riesgos y oportunidades climáticos dos veces al año, en abril y octubre, y de inmediato ante eventos climáticos con impacto material en la operación o la cartera.",
  },
  {
    titulo: "Consideración del clima en la estrategia y en transacciones importantes",
    codigos: ["NIIF S2 6 (a)(iv)"],
    area: "Dirección General",
    texto:
      "El Consejo considera los riesgos climáticos en la aprobación del plan estratégico, del presupuesto anual, de los límites de concentración sectorial de la cartera y de las emisiones de deuda. Desde 2025, toda propuesta de crédito superior a 150 millones de pesos en sectores intensivos en carbono incluye una evaluación de riesgo de transición. Al aprobar los límites de concentración en sectores intensivos y la línea de financiamiento para riego tecnificado, el Consejo consideró explícitamente las compensaciones entre el menor crecimiento de corto plazo en esos sectores y la reducción del riesgo de crédito y de transición en el mediano plazo; en ambos casos privilegió la resiliencia de la cartera sobre el volumen inmediato, con seguimiento semestral del efecto en margen.",
  },
  {
    titulo: "Supervisión de objetivos climáticos y su vínculo con la remuneración",
    codigos: ["NIIF S2 6 (a)(v)"],
    area: "Dirección General",
    texto:
      "El Consejo aprueba los objetivos climáticos y da seguimiento a su avance en la sesión de octubre. Las métricas climáticas no forman parte de la remuneración variable en 2025; el Comité de Prácticas Societarias evalúa su incorporación a partir de 2027.",
  },
  {
    titulo: "Papel de la gerencia: responsabilidades, controles y procedimientos",
    codigos: ["NIIF S2 6(b)", "NIIF S2 6(b)(i)", "NIIF S2 6(b)(ii)"],
    area: "Dirección General",
    texto:
      "La Dirección de Riesgos es responsable de identificar y medir los riesgos climáticos con la metodología corporativa de riesgos; la Dirección de Sostenibilidad coordina la estrategia, los objetivos y el reporte; la Dirección de Crédito aplica los criterios climáticos en la originación. Los controles incluyen la clasificación sectorial de la cartera, los límites de concentración, la evaluación de exposición física de colaterales y la revisión trimestral del Comité de Riesgos.",
  },
  {
    titulo: "Efectos actuales y previstos sobre el modelo de negocio y la cadena de valor",
    codigos: ["NIIF S2 13(a)", "NIIF S2 13(b)"],
    area: "Riesgos",
    texto:
      "Los efectos actuales se concentran en la originación de crédito (criterios climáticos por sector y ubicación), en la administración de la cartera agropecuaria y del sureste (seguimiento reforzado) y en la operación de la red (seguros y continuidad). Los efectos previstos incluyen la reconfiguración gradual de la cartera hacia sectores y activos con menor exposición, el crecimiento de la cartera sostenible y un mayor peso de los criterios climáticos en la captación de mercado.",
  },
  {
    titulo: "Cambios en el modelo de negocio y asignación de recursos 2025",
    codigos: ["NIIF S2 14(a)(i)", "NIIF S2 14(a)(ii)", "NIIF S2 14(b)"],
    area: "Sostenibilidad",
    texto:
      "En 2025 la Compañía aprobó límites de concentración para sectores intensivos en carbono, creó una unidad de financiamiento sostenible dentro de la Dirección de Crédito (seis personas) y destinó 31 millones de pesos a eficiencia energética en la red. Los esfuerzos directos de reducción y adaptación comprenden el programa de eficiencia energética 2025-2027, la generación solar distribuida en 40 sucursales y la renovación gradual de la flota. Para periodos subsecuentes, el plan 2026-2027 asigna 61 millones de pesos adicionales al programa de eficiencia de la red, con los que se completan los 92 millones del programa; 12 millones a la medición PCAF y a sistemas de datos climáticos; y cuatro plazas nuevas en la unidad de financiamiento sostenible. Los recursos se aprueban en el presupuesto anual y su ejecución la revisa el Comité de Sostenibilidad y Riesgos Climáticos cada trimestre.",
  },
  {
    titulo: "Esfuerzos indirectos de reducción y adaptación a través de la cartera",
    codigos: ["NIIF S2 14(a)(iii)"],
    area: "Sostenibilidad",
    texto:
      "Los esfuerzos indirectos se ejercen a través de la cartera: productos de crédito para eficiencia energética y riego tecnificado, y acompañamiento a acreditados de sectores intensivos en la formulación de sus planes de transición. Los esfuerzos indirectos previstos para 2026 y 2027 son ampliar la línea de riego tecnificado a 1,200 millones de pesos, lanzar un producto de crédito para vivienda con certificación de eficiencia energética, extender el acompañamiento en planes de transición al 100% de los acreditados con exposición superior a 150 millones de pesos en sectores intensivos, e incorporar criterios climáticos en la evaluación de los veinte principales proveedores.",
  },
  {
    titulo: "Progreso de los planes climáticos 2025",
    codigos: ["NIIF S2 14(a)(v)", "NIIF S2 14(c)"],
    area: "Sostenibilidad",
    texto:
      "En 2025 se cumplió la creación del Comité de Sostenibilidad y Riesgos Climáticos, la constitución de la unidad de financiamiento sostenible y la primera evaluación de riesgos físicos de cartera. La medición de emisiones financiadas bajo PCAF alcanzó el 42% de la cartera empresarial con calidad de datos 4-5. La Compañía prevé alcanzar sus objetivos climáticos mediante el plan de transición 2025-2030, que fija una reducción de 30% de las emisiones de Alcances 1 y 2 respecto de 2025, una cartera sostenible de al menos 20% de la cartera total en 2028 y la medición PCAF del 80% de la cartera empresarial en 2027.",
  },
  {
    titulo: "Áreas de incertidumbre de la evaluación de resiliencia climática",
    codigos: ["NIIF S2 22(a)(ii)"],
    area: "Riesgos",
    texto:
      "Las áreas significativas de incertidumbre son la calidad de datos de emisiones financiadas, la evolución de la Taxonomía Sostenible de México y de la regulación de la CNBV, la frecuencia e intensidad de ciclones en el Golfo y el Caribe, y el comportamiento de los precios agrícolas ante sequías prolongadas.",
  },
  {
    titulo: "Capacidad de ajustar la estrategia y el modelo de negocio al cambio climático",
    codigos: ["NIIF S2 22(a)(iii)"],
    area: "Riesgos",
    texto:
      "La Compañía cuenta con capital por encima de los mínimos regulatorios, liquidez suficiente y una cartera de vida promedio corta en el segmento empresarial (2.8 años), lo que permite reorientar la originación en horizontes de mediano plazo. Las inversiones planeadas en eficiencia y en productos sostenibles refuerzan esa capacidad.",
  },
  {
    titulo: "Supuestos y periodo del análisis de escenarios climáticos",
    codigos: ["NIIF S2 22(b)(ii)", "NIIF S2 22(b)(iii)"],
    area: "Riesgos",
    texto:
      "El análisis de escenarios se llevó a cabo en el segundo semestre de 2025, con actualización anual prevista. Sus supuestos clave son: precio al carbono con introducción gradual desde 2027 y 500 pesos por tonelada en 2030 en el escenario ordenado; crecimiento del PIB de 2% anual con inflación convergiendo a 3%; incremento de 15% en la frecuencia de ciclones categoría 3 o mayor en el Golfo y el Caribe al 2040 y reducción de 10% en la disponibilidad hídrica en el Bajío al 2035; y 40% de generación limpia en la matriz nacional al 2030 en el escenario ordenado.",
  },
  {
    titulo: "Procesos de identificación, evaluación y priorización de riesgos climáticos",
    codigos: [
      "NIIF S2 25 (a)(i)a(v)",
      "NIIF S2 25 (a)(vi)",
      "NIIF S2 25 (b)",
      "NIIF S2 25 (c)",
    ],
    area: "Riesgos",
    texto:
      "Los riesgos climáticos se identifican con el análisis de exposición física (CENAPRED) y sectorial (intensidad de carbono), se evalúan con la matriz corporativa de probabilidad e impacto (escala 1-5, severidad 0-25), se priorizan en el Comité de Riesgos y se integran al mapa corporativo de riesgos con los mismos criterios que los riesgos de crédito, mercado y operacional. El monitoreo es trimestral. No hubo cambios en los procesos respecto del periodo anterior salvo la incorporación del análisis de exposición física de colaterales. Los mismos procesos se aplican a la identificación y supervisión de las oportunidades relacionadas con el clima. El análisis de escenarios se utiliza también para identificar oportunidades: el escenario de transición ordenada fundamentó la meta de cartera sostenible y el producto de vivienda eficiente, al mostrar crecimiento de la demanda de financiamiento verde y menor costo de fondeo; el de altas emisiones fundamentó la línea de riego tecnificado como producto de adaptación para acreditados agropecuarios.",
  },
  {
    titulo: "Enfoque de medición de emisiones y datos de entrada",
    codigos: ["NIIF S2 29 (a)(iii)"],
    area: "Administración y Operaciones",
    texto:
      "Las emisiones de Alcances 1 y 2 se calculan conforme al Protocolo GEI, con factores de emisión de la SEMARNAT para combustibles y el factor de emisión del Sistema Eléctrico Nacional publicado por la Comisión Reguladora de Energía (CRE) para electricidad, con enfoque de control operacional. Los datos de entrada son los litros de combustible de la flota y de las plantas de emergencia —488,000 litros de gasolina y diésel en 2025— y los kWh facturados por sucursal. El método, los factores de emisión y los datos de entrada no cambiaron respecto del periodo anterior: la Compañía mide conforme al Protocolo GEI desde 2022, con inventario verificado por tercero. Por adoptar el alivio C3, no se presenta información comparativa.",
  },
  {
    titulo: "Enfoque de consolidación y desagregación de Alcances 1 y 2",
    codigos: ["NIIF S2 29 (a)(iv) EI5"],
    area: "Administración y Operaciones",
    texto:
      "El grupo consolida las emisiones de sus tres subsidiarias —Banco Demo, Arrendadora Demo y Factoraje Demo— bajo el enfoque de control operacional. Se eligió ese enfoque porque la Compañía controla las decisiones operativas de sus subsidiarias y de la totalidad de las sucursales, propias y arrendadas; el enfoque de participación en el capital habría excluido las sucursales arrendadas, donde ocurre la mayor parte del consumo eléctrico, y el de control financiero coincide en este caso con el operacional. No existen participadas fuera de la consolidación con emisiones relevantes, por lo que la desagregación por entidad no revela diferencias materiales.",
  },
  {
    titulo: "Alcance 2 por ubicación e instrumentos contractuales",
    codigos: ["NIIF S2 29 (a)(v)"],
    area: "Administración y Operaciones",
    texto:
      "Las emisiones de Alcance 2 se reportan con el método basado en la ubicación. La electricidad se adquiere a la CFE bajo contratos estándar; la Compañía no cuenta con contratos de energía renovable ni certificados de energía limpia, por lo que el método basado en el mercado arroja el mismo valor.",
  },
  {
    titulo: "Remuneración vinculada a métricas climáticas 2025",
    codigos: ["NIIF S2 29 (g) (i) y (ii)"],
    area: "Recursos Humanos",
    texto:
      "Ninguna proporción de la remuneración variable de la Dirección está vinculada a métricas climáticas en 2025. El Comité de Prácticas Societarias evalúa su incorporación a partir de 2027.",
  },
  {
    titulo: "Enfoque para establecer y revisar los objetivos climáticos",
    codigos: ["NIIF S2 34"],
    area: "Sostenibilidad",
    texto:
      "Los objetivos climáticos se establecen con el periodo base 2025 y se revisan por el Comité de Sostenibilidad y Riesgos Climáticos: anualmente el objetivo de reducción de emisiones y el de medición de emisiones financiadas, y semestralmente el de cartera sostenible. El objetivo de reducción de Alcances 1 y 2 es consistente con la trayectoria del Acuerdo de París y no está validado por SBTi; el de cartera sostenible se alinea con la Taxonomía Sostenible de México y su etiqueta cuenta con opinión de segunda parte del marco de bonos verdes. Las métricas de supervisión son tCO2e por sucursal y por colaborador, y el saldo y porcentaje de cartera sostenible.",
  },
  {
    titulo: "Resultados frente a los objetivos climáticos 2025",
    codigos: ["NIIF S2 35"],
    area: "Sostenibilidad",
    texto:
      "En 2025, primer ejercicio de referencia, los resultados son: objetivo de reducción de Alcances 1 y 2, línea base establecida en 1,240 y 3,860 tCO2e respectivamente; objetivo de cartera sostenible, 8.0% de la cartera total; objetivo de medición de emisiones financiadas, 42% de la cartera empresarial cubierta con calidad de datos PCAF 4-5. No hay ejercicio anterior con el que comparar la tendencia.",
  },
  {
    titulo: "Uso de créditos de carbono en los objetivos climáticos",
    codigos: ["NIIF S2 36 (e)(i)a(iv)"],
    area: "Sostenibilidad",
    texto:
      "La Compañía no prevé el uso de créditos de carbono para compensar emisiones en el cumplimiento de sus objetivos. El objetivo de reducción de Alcances 1 y 2 se cumplirá con eficiencia energética y generación distribuida, sin compensaciones.",
  },
  {
    titulo: "Juicios significativos y fuentes de incertidumbre de estimación",
    codigos: ["NIIF S1 74"],
    area: "Sostenibilidad",
    texto:
      "Los principales juicios fueron la delimitación del perímetro (operaciones propias para emisiones; cartera como exposición cualitativa), la clasificación sectorial por intensidad de carbono y la elección de escenarios. Las incertidumbres de medición se concentran en la calidad de datos de acreditados, en la estimación de emisiones de Alcance 2 a partir de facturación —no hay medición directa en 14 sucursales arrendadas con servicio incluido— y en la estimación de exposición de colaterales por código postal.",
  },
  {
    titulo: "Cambios previstos en la situación financiera por el clima",
    codigos: ["NIIF S2 16(c)(i)(ii)"],
    area: "Finanzas",
    texto:
      "La Compañía prevé que la reconfiguración gradual de la cartera hacia sectores y activos de menor exposición climática, junto con el crecimiento de la cartera sostenible, modifique la composición de sus activos en el mediano plazo sin efectos materiales sobre el capital regulatorio. En el largo plazo, la materialización de riesgos físicos sobre colaterales del sureste y de la cartera agropecuaria podría requerir reservas adicionales; con la información disponible al cierre de 2025 no se identificó la necesidad de reconocer ajustes.",
  },
  {
    titulo: "Cambios previstos en el rendimiento financiero y los flujos de efectivo",
    codigos: ["NIIF S2 16(d)"],
    area: "Finanzas",
    texto:
      "Se espera un efecto positivo gradual sobre el margen financiero por el menor costo de fondeo asociado al financiamiento sostenible y por la reducción del gasto operativo de la red derivada del programa de eficiencia energética, con un ahorro estimado de 9 millones de pesos anuales a partir de 2027. En el escenario de altas emisiones, los eventos climáticos extremos podrían incrementar el gasto por reservas, seguros y reestructuras en los años en que ocurran, sin un patrón cuantificable en 2025.",
  },
  {
    titulo: "Costo o esfuerzo desproporcionado en las métricas de exposición",
    codigos: ["NIIF S2 30"],
    area: "Riesgos",
    texto:
      "La Compañía no se acoge a la exención por costo o esfuerzo desproporcionado para las métricas de los párrafos 29(b) a (d): la cantidad y el porcentaje de activos vulnerables se revelan a partir de la clasificación de cartera por sector y ubicación. Las emisiones financiadas se difieren por el alivio C4, no por esta exención.",
  },
  {
    titulo: "Métricas basadas en la industria: sector de bancos comerciales",
    codigos: ["NIIF S2 32"],
    area: "Sostenibilidad",
    texto:
      "La Compañía pertenece al sector de bancos comerciales conforme a la clasificación SASB (Commercial Banks) y considera para su revelación las métricas de ese sector relativas a la incorporación de factores ambientales en el análisis de crédito y a la exposición de cartera por sector. En 2025 revela la composición de la cartera por sector económico y la proporción de cartera sostenible; la revelación completa de las métricas industriales se incorporará en ejercicios subsecuentes.",
  },
  {
    titulo: "Concentración de los riesgos de transición en el modelo de negocio",
    codigos: ["NIIF S2 29 (b) · B65 (b)"],
    area: "Crédito y Banca",
    texto:
      "Los riesgos de transición se concentran en la originación y administración de la cartera empresarial —cemento, acero, transporte de carga y generación eléctrica convencional, el 18% de ese segmento— y en la captación y la tesorería, por las expectativas de los inversionistas institucionales que adquieren la deuda del grupo.",
  },
  {
    titulo: "Efecto de los riesgos de transición en la situación financiera",
    codigos: ["NIIF S2 29 (b) · B65 (c)"],
    area: "Crédito y Banca",
    texto:
      "Los efectos previstos son el deterioro de la calificación de acreditados en sectores intensivos, mayores reservas crediticias y la posibilidad de activos varados como colateral. Por el lado del pasivo, un mayor costo de fondeo, menor demanda en las emisiones y la exclusión de índices sostenibles. En 2025 no se registraron efectos cuantificables en los estados financieros atribuibles a estos riesgos.",
  },
  {
    titulo: "Concentración de los riesgos físicos en el modelo de negocio",
    codigos: ["NIIF S2 29 (c) · B65 (b)"],
    area: "Administración y Operaciones",
    texto:
      "Los riesgos físicos se concentran en la operación y la red de sucursales del sureste —31 sucursales y el centro operativo de Mérida en Yucatán, Quintana Roo, Tabasco y Veracruz— y en la administración de la cartera hipotecaria y pyme de esa región, así como en la originación y administración de la cartera agropecuaria del norte y el Bajío.",
  },
  {
    titulo: "Efecto de los riesgos físicos en la situación financiera",
    codigos: ["NIIF S2 29 (c) · B65 (c)"],
    area: "Administración y Operaciones",
    texto:
      "Los efectos previstos son el cierre temporal de sucursales, daños a inmuebles y equipo, deterioro de cartera por afectación de clientes y mayores primas de seguro en el sureste; y el aumento de cartera vencida y reservas, el menor valor de las garantías rurales y la reducción de la originación agropecuaria por estrés hídrico. En 2025 el gasto de capital asociado a adecuaciones y seguros de la red del sureste fue de 18.5 millones de pesos.",
  },
  {
    titulo: "Concentración de las oportunidades climáticas en el modelo de negocio",
    codigos: ["NIIF S2 29 (d) · B65 (b)"],
    area: "Crédito y Banca",
    texto:
      "Las oportunidades se concentran en la originación de crédito y la captación —cartera con etiqueta verde en eficiencia energética, vivienda certificada y energía distribuida— y en la operación de la red, por la eficiencia energética de sucursales.",
  },
  {
    titulo: "Efecto de las oportunidades climáticas en la situación financiera",
    codigos: ["NIIF S2 29 (d) · B65 (c)"],
    area: "Crédito y Banca",
    texto:
      "Las oportunidades se traducen en mayores ingresos por intereses en segmentos de crecimiento, menor costo de fondeo y diferenciación de marca, y en menor gasto operativo y menores emisiones de Alcance 2 por la eficiencia de la red. En 2025 la cartera sostenible alcanzó 6,910 millones de pesos, el 8.0% de la cartera total, con un bono verde vigente de 2,000 millones de pesos, y se invirtieron 31 millones de pesos en la eficiencia de 40 sucursales.",
  },
];

/** Cuantitativas de exposición: la cifra que pide el propio párrafo 29. */
const CUANTITATIVAS_EXPOSICION = [
  {
    titulo: "Porcentaje de la cartera expuesta a riesgos de transición 2025",
    codigos: ["NIIF S2 29 (b)"],
    area: "Crédito y Banca",
    valor: 9.4,
    unidad: "%",
    texto:
      "La cartera expuesta a riesgos de transición relacionados con el clima —cemento, acero, transporte de carga y generación eléctrica convencional dentro del crédito empresarial— ascendió a 8,090 millones de pesos al cierre de 2025, equivalente al 9.4% de la cartera de crédito total de 86,400 millones de pesos.",
  },
  {
    titulo: "Porcentaje de activos expuestos a riesgos físicos 2025",
    codigos: ["NIIF S2 29 (c)"],
    area: "Administración y Operaciones",
    valor: 26,
    unidad: "%",
    texto:
      "De las 118 sucursales y los tres centros operativos de la Compañía, 31 sucursales y el centro operativo de Mérida se ubican en zonas de alta incidencia de ciclones en Yucatán, Quintana Roo, Tabasco y Veracruz: 32 activos, el 26% de la red.",
  },
];

// Las respuestas van EN EL ORDEN DEL CATÁLOGO (`lib/cuestionarios.ts`), no en el
// del documento, que numera distinto y da 8/4/2 donde el catálogo pide 8/6/5.
// Las preguntas de enumeración llevan las opciones oficiales verbatim: el Excel
// las lee como lista y una respuesta en prosa ahí rompe la celda —lo detectó
// `verify:export`, no la vista—. Lo que el documento no contesta no se toca.
const CUESTIONARIOS = {
  "S2 22(b)(i)": [
    // 1 · cómo y cuándo
    "El análisis se llevó a cabo en el segundo semestre de 2025, con actualización anual prevista. El método fue un análisis cualitativo apoyado en la sensibilidad de la cartera por sector y en la exposición física por código postal.",
    // 2 · escenarios y fuentes
    "Transición ordenada (NGFS Net Zero 2050) y altas emisiones (IPCC SSP5-8.5 / NGFS Current Policies), fase IV. Fuentes: NGFS fase IV e IPCC AR6.",
    // 3 · booleano: gama diversa
    "Verdadero",
    // 4 · enum_multi: riesgos asociados (opciones oficiales)
    "Riesgos físicos relacionados con el clima; Riesgos de transición relacionados con el clima",
    // 5 · booleano: escenario alineado con el último acuerdo internacional
    "Verdadero",
    // 6 · por qué son pertinentes
    "Los dos escenarios representan el rango plausible de trayectorias regulatorias y físicas para los mercados en los que opera la Compañía: uno alineado con el último acuerdo internacional sobre cambio climático y otro de políticas actuales con altas emisiones.",
    // 7 · enum_multi: horizontes (opciones oficiales)
    "Corto plazo; Mediano plazo; Largo plazo",
    // 8 · alcance de las operaciones cubierto
    "Red de sucursales, cartera empresarial, agropecuaria e hipotecaria. Los horizontes se anclaron en 2026 (corto), 2030 (mediano) y 2040 (largo).",
  ],
  "S2 22(b)(ii)": [
    // 1 · políticas climáticas
    "Precio al carbono con introducción gradual desde 2027 y 500 pesos por tonelada en 2030 en el escenario de transición ordenada.",
    // 2 · tendencias macroeconómicas
    "Crecimiento del PIB de 2% anual; inflación convergiendo a 3%.",
    // 3 · variables nacionales o regionales
    "Incremento de 15% en la frecuencia de ciclones categoría 3 o mayor en el Golfo y el Caribe al 2040; reducción de 10% en la disponibilidad hídrica en el Bajío al 2035.",
    // 4 · uso y combinación de fuentes de energía
    "40% de generación limpia en la matriz nacional al 2030 en el escenario de transición ordenada.",
    // 5 y 6 —desarrollos tecnológicos y otros supuestos— no los contesta el
    // documento y se dejan como estaban: inventarlos sería peor que el hueco.
  ],
  "S2 36(e)": [
    // 1 · en qué medida el objetivo se basa en créditos de carbono
    "No se basa en créditos de carbono. El objetivo de reducción de Alcances 1 y 2 se cumplirá con eficiencia energética y generación distribuida, sin compensaciones.",
    // 2 · régimen de terceros que los verificaría
    "No aplica: la Compañía no prevé el uso de créditos de carbono en el cumplimiento de sus objetivos.",
    // 3 a 5 son enumeraciones y texto sobre créditos que no se usarán; se dejan
    // como estaban porque el documento no las contesta.
  ],
};

const OBJETIVOS = [
  {
    nombre: "Reducción de emisiones de Alcances 1 y 2",
    ambito: "climatico",
    naturaleza: "riesgo",
    tipo: "Objetivo de emisiones de gases de efecto invernadero",
    tipo_objetivo: "Absoluto",
    metrica: "tCO2e",
    meta: "Reducción de 30% al 2030",
    parte_entidad: "Toda la Compañía",
    periodo_aplicacion: "2026-2030",
    periodo_base: "2025",
    hito_intermedio: "12% al 2027",
    alineacion_acuerdo_internacional:
      "Consistente con la trayectoria del Acuerdo de París; no validado por SBTi.",
    descripcion:
      "Reducir en 30% las emisiones brutas de Alcances 1 y 2 respecto del periodo base 2025, mediante eficiencia energética, generación solar distribuida y renovación de flota.",
    detalle: {
      validacion_tercero: "Falso",
      revisiones: "Revisión anual por el Comité de Sostenibilidad y Riesgos Climáticos.",
      procesos_revision: "Seguimiento trimestral de consumo y emisiones por sucursal.",
      metricas_supervision: "tCO2e por sucursal y tCO2e por colaborador.",
      resultados: "2025: línea base establecida (Alcance 1: 1,240 tCO2e; Alcance 2: 3,860 tCO2e).",
      gases_cubiertos: "Dióxido de carbono (CO2); Metano (CH4); Óxido nitroso (N2O)",
      alcances_cubiertos: "Alcance 1; Alcance 2",
      bruto_neto: "Emisiones brutas de gases de efecto invernadero",
      enfoque_descarbonizacion: "Falso",
      analisis_tendencias: "No aplicable: primer ejercicio, sin comparativo.",
    },
  },
  {
    nombre: "Cartera sostenible",
    ambito: "climatico",
    naturaleza: "oportunidad",
    tipo: "Objetivo de cartera",
    tipo_objetivo: "Relativo",
    metrica:
      "Porcentaje de la cartera total con etiqueta sostenible conforme a la Taxonomía Sostenible de México",
    meta: "20% al 2028",
    parte_entidad: "Toda la Compañía",
    periodo_aplicacion: "2026-2028",
    periodo_base: "2025 (8.0%)",
    hito_intermedio: "12% en 2026",
    alineacion_acuerdo_internacional: "Taxonomía Sostenible de México.",
    descripcion:
      "Llevar la cartera con etiqueta sostenible al 20% de la cartera total en 2028, desde el 8.0% del periodo base 2025.",
    detalle: {
      validacion_tercero: "Verdadero",
      revisiones: "Revisión semestral por el Comité de Sostenibilidad y Riesgos Climáticos.",
      procesos_revision: "Conciliación semestral del saldo etiquetado con la Dirección de Crédito.",
      metricas_supervision: "Saldo y porcentaje de cartera sostenible.",
      resultados: "2025: 8.0% de la cartera total (6,910 MDP).",
      gases_cubiertos: "",
      alcances_cubiertos: "",
      bruto_neto: "",
      enfoque_descarbonizacion: "Falso",
      analisis_tendencias: "No aplicable: primer ejercicio, sin comparativo.",
    },
  },
  {
    nombre: "Medición de emisiones financiadas",
    ambito: "climatico",
    naturaleza: "riesgo",
    tipo: "Objetivo de cobertura de medición",
    tipo_objetivo: "Relativo",
    metrica: "Porcentaje de la cartera empresarial con emisiones financiadas medidas bajo PCAF",
    meta: "80% en 2027",
    parte_entidad: "Cartera empresarial",
    periodo_aplicacion: "2026-2027",
    periodo_base: "2025 (42%)",
    hito_intermedio: "60% en 2026",
    alineacion_acuerdo_internacional: "Metodología PCAF.",
    descripcion:
      "Medir las emisiones financiadas del 80% de la cartera empresarial bajo PCAF en 2027, desde el 42% del periodo base 2025.",
    detalle: {
      validacion_tercero: "Falso",
      revisiones: "Revisión anual por el Comité de Sostenibilidad y Riesgos Climáticos.",
      procesos_revision: "Depuración de datos de acreditados por la Dirección de Riesgos.",
      metricas_supervision: "Porcentaje de cartera empresarial cubierta y calidad de datos PCAF.",
      resultados: "2025: 42% de la cartera empresarial, calidad de datos 4-5.",
      gases_cubiertos: "",
      alcances_cubiertos: "Alcance 3",
      bruto_neto: "",
      enfoque_descarbonizacion: "Falso",
      analisis_tendencias: "No aplicable: primer ejercicio, sin comparativo.",
    },
  },
];

// =============================================================================
// Ejecución
// =============================================================================

/** Perfiles que firman: el cliente sube y da visto bueno, IRStrat valida. */
let USUARIO_CLIENTE = null;
let USUARIO_STAFF = null;

async function cargarUsuarios() {
  const p = ok(
    "perfiles",
    await db.from("perfiles_usuario").select("id, email, rol, tenant_id").eq("activo", true)
  );
  USUARIO_CLIENTE =
    p.find((x) => x.email === "admin.cliente@empresademo.example")?.id ??
    p.find((x) => x.tenant_id === TENANT)?.id;
  USUARIO_STAFF =
    p.find((x) => x.email === "admin@irstrat.example")?.id ??
    p.find((x) => x.tenant_id === null)?.id;
  if (!USUARIO_CLIENTE || !USUARIO_STAFF) throw new Error("faltan perfiles del seed");
}

// --- 1. Perfil del emisor ----------------------------------------------------
async function perfilEmisor() {
  const existente = ok(
    "perfil?",
    await db.from("perfil_emisor").select("id").eq("tenant_id", TENANT).maybeSingle()
  );
  const fila = {
    ...PERFIL,
    tenant_id: TENANT,
    actualizado_por: USUARIO_STAFF,
    actualizado_en: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (existente) {
    ok("perfil update", await db.from("perfil_emisor").update(fila).eq("id", existente.id));
    log("  perfil del emisor · actualizado");
  } else {
    ok("perfil insert", await db.from("perfil_emisor").insert(fila));
    log("  perfil del emisor · creado");
  }
}

// --- 2. Régimen del reporte --------------------------------------------------
async function regimen() {
  ok(
    "reporte",
    await db
      .from("reportes")
      .update({
        anio_adopcion: 2025,
        // C5 NO. Es la medida transitoria para quien mide con un método distinto
        // del Protocolo GEI, y la Compañía mide con el Protocolo desde 2022: no
        // hay nada que eximir. Declararlo igual habría hecho que el bloque 30
        // explicara un alivio que no usa.
        alivios: { C3: true, C4: true, E4: true, E5: true },
      })
      .eq("id", REPORTE)
  );
  log("  régimen · anio_adopcion 2025 · alivios C3 C4 E4 E5 (C5 no aplica: mide con Protocolo GEI)");
}

// --- 3. Áreas ----------------------------------------------------------------
async function areas() {
  const actuales = ok(
    "áreas",
    await db.from("areas_tenant").select("id, nombre, activo, orden").eq("tenant_id", TENANT)
  );
  const porNombre = new Map(actuales.map((a) => [a.nombre, a]));

  // Renombrar primero, arrastrando el texto del área en los perfiles: la
  // columna `perfiles_usuario.area` guarda el NOMBRE, no una llave foránea, así
  // que renombrar sin arrastrarla deja usuarios huérfanos de área.
  for (const [viejo, nuevo] of Object.entries(RENOMBRES)) {
    const fila = porNombre.get(viejo);
    if (!fila || viejo === nuevo) continue;
    if (porNombre.has(nuevo)) continue; // ya renombrada en una corrida previa
    ok("área rename", await db.from("areas_tenant").update({ nombre: nuevo }).eq("id", fila.id));
    ok(
      "perfiles área",
      await db.from("perfiles_usuario").update({ area: nuevo }).eq("tenant_id", TENANT).eq("area", viejo)
    );
    ok(
      "solicitudes área",
      await db.from("solicitudes").update({ area_asignada: nuevo }).eq("reporte_id", REPORTE).eq("area_asignada", viejo)
    );
    porNombre.set(nuevo, { ...fila, nombre: nuevo });
    porNombre.delete(viejo);
    log(`  área · "${viejo}" → "${nuevo}" (cuentas conservadas)`);
  }

  for (let i = 0; i < AREAS.length; i++) {
    const nombre = AREAS[i];
    const fila = porNombre.get(nombre);
    if (fila) {
      ok("área orden", await db.from("areas_tenant").update({ orden: i, activo: true }).eq("id", fila.id));
    } else {
      ok("área insert", await db.from("areas_tenant").insert({ tenant_id: TENANT, nombre, orden: i, activo: true }));
      log(`  área · "${nombre}" creada`);
    }
  }
  log(`  áreas · ${AREAS.length} activas`);
}

// --- 4. Registros de clima ---------------------------------------------------
async function registros() {
  const actuales = ok(
    "registros",
    await db.from("registros_clima").select("id, nombre, activo").eq("reporte_id", REPORTE)
  );
  const nuevos = new Set(REGISTROS.map((r) => r.nombre));
  for (const r of actuales) {
    if (!nuevos.has(r.nombre) && r.activo) {
      ok("desactivar", await db.from("registros_clima").update({ activo: false }).eq("id", r.id));
      log(`  registro · "${r.nombre}" desactivado (giro industrial)`);
    }
  }

  const porNombre = new Map(actuales.map((r) => [r.nombre, r]));
  for (let i = 0; i < REGISTROS.length; i++) {
    const r = REGISTROS[i];
    const { valores, ...campos } = r;
    const fila = { ...campos, reporte_id: REPORTE, orden: i, activo: true };
    let id = porNombre.get(r.nombre)?.id;
    if (id) {
      ok("registro update", await db.from("registros_clima").update(fila).eq("id", id));
    } else {
      const ins = ok("registro insert", await db.from("registros_clima").insert(fila).select("id").single());
      id = ins.id;
    }
    // Los valores son APPEND ONLY por diseño (una corrección es una fila nueva),
    // así que aquí se comprueba si el vigente ya coincide antes de insertar otro.
    const previos = ok(
      "valores",
      await db.from("registros_clima_valores").select("*").eq("registro_id", id).eq("ejercicio", EJERCICIO).order("created_at")
    );
    const vigente = previos[previos.length - 1];
    const igual =
      vigente &&
      vigente.cantidad_activos === valores.cantidad_activos &&
      Number(vigente.porcentaje) === valores.porcentaje &&
      Number(vigente.capital_gasto ?? 0) === Number(valores.capital_gasto ?? 0) &&
      Number(vigente.capital_financiacion ?? 0) === Number(valores.capital_financiacion ?? 0) &&
      Number(vigente.capital_inversion ?? 0) === Number(valores.capital_inversion ?? 0);
    if (!igual) {
      ok(
        "valores insert",
        await db.from("registros_clima_valores").insert({
          registro_id: id,
          ejercicio: EJERCICIO,
          ...valores,
          capturado_por: USUARIO_CLIENTE,
        })
      );
    }
  }
  log(`  registros · ${REGISTROS.length} activos con valores ${EJERCICIO}`);
}

// --- 5. Solicitudes, evidencias y capturas -----------------------------------
let CATALOGO = new Map();
const SIN_CODIGO = [];

async function cargarCatalogo() {
  const dp = ok("catálogo", await db.from("datapoints_taxonomia").select("id, codigo"));
  CATALOGO = new Map(dp.map((d) => [d.codigo, d.id]));
}

/** Liga la solicitud a sus datapoints; anota los códigos que el catálogo no tiene. */
async function ligar(solicitudId, codigos) {
  for (const c of codigos) {
    const id = CATALOGO.get(c);
    if (!id) {
      SIN_CODIGO.push(c);
      continue;
    }
    ok(
      "mapeo",
      await db
        .from("mapeo_solicitud_datapoint")
        .upsert({ solicitud_id: solicitudId, datapoint_id: id }, { onConflict: "solicitud_id,datapoint_id", ignoreDuplicates: true })
    );
  }
}

/**
 * Sube el PDF de evidencia si esta solicitud no tiene ya uno con ESTE texto.
 *
 * El nombre lleva un hash corto del contenido. Cuando el texto del documento
 * cambia —el factor eléctrico pasó del RENE a la CRE—, el hash cambia y entra
 * una VERSIÓN NUEVA, que es como el esquema entiende una corrección: las
 * evidencias son append only y el trigger asigna la versión. Antes bastaba con
 * que existiera cualquier evidencia de este script para no volver a subir, y el
 * PDF se quedaba contradiciendo a la descripción que sí se actualizaba.
 */
async function evidenciaDe(solicitudId, titulo, codigos, texto) {
  const huella = createHash("sha256").update(texto).digest("hex").slice(0, 8);
  const previas = ok(
    "evidencias",
    await db.from("evidencias").select("id, nombre_original").eq("solicitud_id", solicitudId)
  );
  if (previas.some((e) => e.nombre_original.includes(`${MARCA}-${huella}`))) return false;

  const encabezado = `Empresa Demo · Evidencia de demostración${codigos.length ? ` · ${codigos.join(" · ")}` : ""}`;
  const pdf = pdfDeTexto(titulo, encabezado, texto);
  const nombre = `${slugArchivo(titulo)}-${MARCA}-${huella}.pdf`;
  const ruta = `${TENANT}/${solicitudId}/${nombre}`;

  const { error: errSub } = await db.storage
    .from(BUCKET)
    .upload(ruta, pdf, { contentType: "application/pdf", upsert: true });
  if (errSub) throw new Error(`storage ${ruta}: ${errSub.message}`);

  ok(
    "evidencia",
    await db.from("evidencias").insert({
      solicitud_id: solicitudId,
      archivo_path: ruta,
      nombre_original: nombre,
      periodo_cubierto: `${EJERCICIO} (ene-dic)`,
      subido_por: USUARIO_CLIENTE,
      cargado_por_staff: false,
      justificacion: "Documento de respaldo del requisito NIIF correspondiente.",
      version: 0, // el trigger la reasigna
    })
  );
  return true;
}

/**
 * Crea o actualiza una solicitud completa: ligada a sus códigos, con evidencia,
 * validada y con visto bueno. El orden importa — el trigger de evidencias mueve
 * el estado a 'recibido', así que 'validado' se escribe DESPUÉS de subirla.
 */
async function solicitudCompleta({ titulo, codigos, area, texto, cuantitativa, valor, unidad, descripcion }) {
  const previa = ok(
    "solicitud?",
    await db.from("solicitudes").select("id, estado").eq("reporte_id", REPORTE).eq("titulo", titulo).maybeSingle()
  );

  let id = previa?.id;
  let nueva = false;
  if (!id) {
    const { data: max } = await db
      .from("solicitudes")
      .select("orden")
      .eq("reporte_id", REPORTE)
      .order("orden", { ascending: false })
      .limit(1);
    const orden = (max?.[0]?.orden ?? 0) + 1;
    const ins = ok(
      "solicitud insert",
      await db
        .from("solicitudes")
        .insert({
          reporte_id: REPORTE,
          titulo,
          // LA DESCRIPCIÓN ES EL TEXTO, ENTERO. El PDF de evidencia es un archivo:
          // el generador no lo lee. Para una solicitud cualitativa, `descripcion`
          // es LO ÚNICO que llega al modelo, y truncarla a 280 caracteres le
          // entregaba frases cortadas a media palabra —el bloque 26 lo acusó
          // cinco veces en sus notas de revisión—.
          descripcion: descripcion ?? texto,
          area_asignada: area,
          es_cuantitativa: !!cuantitativa,
          unidad_esperada: cuantitativa ? unidad : null,
          origen: "irstrat",
          estado: "pendiente",
          orden,
        })
        .select("id")
        .single()
    );
    id = ins.id;
    nueva = true;
  } else {
    // También la descripción: las solicitudes que ya existían del giro industrial
    // conservaban su texto viejo, y era ese —no el del documento— el que llegaba
    // al modelo.
    // También la naturaleza y la unidad. El script declara `cuantitativa` y una
    // unidad, pero eso solo se aplicaba AL INSERTAR: una solicitud del seed dada
    // de alta como cualitativa se quedaba así aunque después recibiera una
    // captura numérica confirmada, y el valor existía sin que nada lo tratara
    // como valor. Es el caso de los combustibles: 488,000 litros capturados en
    // una solicitud que el esquema seguía considerando narrativa.
    ok(
      "solicitud update",
      await db
        .from("solicitudes")
        .update({
          area_asignada: area,
          desactivada: false,
          descripcion: descripcion ?? texto,
          es_cuantitativa: !!cuantitativa,
          unidad_esperada: cuantitativa ? unidad : null,
        })
        .eq("id", id)
    );
  }

  await ligar(id, codigos);
  const subida = await evidenciaDe(id, titulo, codigos, texto);

  if (cuantitativa) {
    const ev = ok(
      "evidencia id",
      await db.from("evidencias").select("id, nombre_original").eq("solicitud_id", id).order("version", { ascending: false })
    );
    const mia = ev.find((e) => e.nombre_original.includes(MARCA)) ?? ev[0];
    if (!mia) throw new Error(`${titulo}: no hay evidencia a la que colgar la captura.`);
    const caps = ok(
      "capturas",
      await db.from("capturas_valor").select("valor, confirmado, periodo").eq("solicitud_id", id).order("created_at")
    );
    const vigente = caps.filter((c) => c.periodo === String(EJERCICIO)).pop();
    if (!vigente || !vigente.confirmado || Number(vigente.valor) !== valor) {
      ok(
        "captura",
        await db.from("capturas_valor").insert({
          solicitud_id: id,
          evidencia_id: mia.id,
          valor,
          unidad,
          periodo: String(EJERCICIO),
          capturado_por: USUARIO_CLIENTE,
          confirmado: true,
        })
      );
    }
  }

  ok(
    "validar",
    await db
      .from("solicitudes")
      .update({
        estado: "validado",
        vb_area_por: USUARIO_CLIENTE,
        vb_area_fecha: new Date().toISOString(),
        responsable_irstrat_id: USUARIO_STAFF,
      })
      .eq("id", id)
  );

  cuenta[nueva ? "creado" : "actualizado"]++;
  return { id, nueva, subida };
}

// --- 6. Cuestionarios --------------------------------------------------------
async function cuestionarios() {
  let n = 0;
  for (const [hoja, respuestas] of Object.entries(CUESTIONARIOS)) {
    for (let i = 0; i < respuestas.length; i++) {
      const orden = i + 1;
      const previa = ok(
        "cuestionario?",
        await db
          .from("cuestionarios_respuestas")
          .select("id")
          .eq("reporte_id", REPORTE)
          .eq("hoja", hoja)
          .eq("pregunta_orden", orden)
          .maybeSingle()
      );
      if (previa) {
        ok(
          "cuestionario update",
          await db
            .from("cuestionarios_respuestas")
            .update({ respuesta: respuestas[i], notas: null, updated_at: new Date().toISOString() })
            .eq("id", previa.id)
        );
      } else {
        ok(
          "cuestionario insert",
          await db.from("cuestionarios_respuestas").insert({
            reporte_id: REPORTE,
            hoja,
            pregunta_orden: orden,
            respuesta: respuestas[i],
            tipo_dato: "Bloque de texto",
          })
        );
      }
      n++;
    }
  }
  log(`  cuestionarios · ${n} respuestas`);
}

// --- 7. Objetivos ------------------------------------------------------------
async function objetivos() {
  const actuales = ok("objetivos", await db.from("objetivos").select("id, nombre, activo").eq("reporte_id", REPORTE));
  const nuevos = new Set(OBJETIVOS.map((o) => o.nombre));
  for (const o of actuales) {
    if (!nuevos.has(o.nombre) && o.activo) {
      ok("obj desactivar", await db.from("objetivos").update({ activo: false }).eq("id", o.id));
      log(`  objetivo · "${o.nombre}" desactivado`);
    }
  }
  const porNombre = new Map(actuales.map((o) => [o.nombre, o]));
  for (let i = 0; i < OBJETIVOS.length; i++) {
    const { detalle, ...campos } = OBJETIVOS[i];
    const fila = { ...campos, reporte_id: REPORTE, orden: i, activo: true };
    let id = porNombre.get(campos.nombre)?.id;
    if (id) {
      ok("obj update", await db.from("objetivos").update(fila).eq("id", id));
    } else {
      const ins = ok("obj insert", await db.from("objetivos").insert(fila).select("id").single());
      id = ins.id;
    }
    const prev = ok("det?", await db.from("objetivos_detalle").select("id").eq("objetivo_id", id).maybeSingle());
    if (prev) {
      ok("det update", await db.from("objetivos_detalle").update({ ...detalle, updated_at: new Date().toISOString() }).eq("id", prev.id));
    } else {
      ok("det insert", await db.from("objetivos_detalle").insert({ objetivo_id: id, ...detalle }));
    }
  }
  log(`  objetivos · ${OBJETIVOS.length} activos con detalle`);
}

// --- Orquestación ------------------------------------------------------------
async function main() {
  await cargarUsuarios();
  await cargarCatalogo();

  log("1. Perfil del emisor");
  await perfilEmisor();

  log("\n2. Régimen del reporte");
  await regimen();

  log("\n3. Áreas del tenant");
  await areas();

  log("\n4. Registros de clima");
  await registros();

  log("\n5. Solicitudes narrativas");
  for (const s of NARRATIVAS) {
    const r = await solicitudCompleta(s);
    log(`  ${r.nueva ? "creada  " : "vigente "} ${s.titulo.slice(0, 62).padEnd(64)} ${s.codigos.join(", ")}`);
  }

  log("\n6. Solicitudes cuantitativas nuevas");
  for (const s of [...CUANTITATIVAS_EXPOSICION, ...CIFRAS_NUEVAS]) {
    const r = await solicitudCompleta({ ...s, cuantitativa: true });
    log(`  ${r.nueva ? "creada  " : "vigente "} ${s.titulo.slice(0, 62).padEnd(64)} ${s.valor} ${s.unidad}`);
  }

  log("\n7. Cifras del ejercicio sobre solicitudes existentes");
  for (const c of CIFRAS) {
    const sol = ok(
      "cifra?",
      await db.from("solicitudes").select("id, unidad_esperada").eq("reporte_id", REPORTE).eq("titulo", c.titulo).maybeSingle()
    );
    if (!sol) {
      log(`  ✗ no existe la solicitud "${c.titulo}" — se omite`);
      continue;
    }
    await solicitudCompleta({
      titulo: c.titulo,
      codigos: [],
      area: null,
      texto: `Valor confirmado del ejercicio ${EJERCICIO}: ${c.valor.toLocaleString("es-MX")} ${c.unidad}.`,
      cuantitativa: true,
      valor: c.valor,
      unidad: sol.unidad_esperada ?? c.unidad,
    });
    log(`  ${c.titulo.slice(0, 62).padEnd(64)} ${c.valor.toLocaleString("es-MX")} ${sol.unidad_esperada ?? c.unidad}`);
  }

  log("\n8. Cuestionarios");
  await cuestionarios();

  log("\n9. Objetivos");
  await objetivos();

  log("\n=== resumen ===");
  log(`solicitudes creadas: ${cuenta.creado} · actualizadas: ${cuenta.actualizado}`);
  if (SIN_CODIGO.length) {
    log(`\n✗ CÓDIGOS QUE EL CATÁLOGO NO TIENE (${[...new Set(SIN_CODIGO)].length}):`);
    for (const c of [...new Set(SIN_CODIGO)]) log(`   ${c}`);
  } else {
    log("todos los códigos citados existen en el catálogo ✓");
  }
}

await main();
