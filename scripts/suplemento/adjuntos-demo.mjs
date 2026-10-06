#!/usr/bin/env node
// =============================================================================
// ADJUNTOS DEL PERFIL PARA EL DEMO (encargo 2026-10-06-suplemento-calidad, Paso 2).
//
//   node scripts/suplemento/adjuntos-demo.mjs [baseUrl]
//
// Arma cuatro documentos FICTICIOS de Empresa Demo, S.A.B. de C.V. y los sube a
// la sección «Gobierno corporativo» de su Perfil del emisor:
//   · organigrama-corporativo.png — copia del organigrama del Perfil (se lee por
//     visión: prueba el camino de imagen);
//   · codigo-de-etica.docx — Word con títulos, para los tramos de párrafos;
//   · acta-comite-sostenibilidad.pdf — acta de instalación del comité, con cifras
//     y fechas que el validador NO debe aceptar como respaldo;
//   · estatutos-sociales.pdf — 80 páginas, para el límite de 60: lo que va
//     después de la página 60 (el «Comité de Innovación Financiera», que solo
//     existe ahí) no debe llegar nunca al generador.
//
// Inserta las filas en perfil_emisor_adjuntos (el trigger las encola) y, si se
// da `baseUrl` de una app LOCAL, llama a su /api/evidencias/procesar para
// leerlas. Idempotente: un adjunto con el mismo nombre en la misma emisora no
// se vuelve a subir. Solo contra el proyecto dev; no imprime credenciales.
// Los archivos quedan también en referencia/suplemento-calidad/paso2/adjuntos/
// (ignorado por git).
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

const DEV_REF = "kmjkoxecxcujxixlxwlb";
const TENANT = "10000000-0000-0000-0000-000000000001";
const SECCION = "gobierno";
const CARPETA = "referencia/suplemento-calidad/paso2/adjuntos";
const BASE = process.argv[2] ?? null;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
if (!(env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(DEV_REF)) {
  console.error(`✗ ABORTA: la URL de Supabase no es la del proyecto dev (${DEV_REF}).`);
  process.exit(1);
}
if (BASE && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) {
  console.error(`✗ Solo contra una app local, no ${BASE}.`);
  process.exit(2);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const EMISORA = "Empresa Demo, S.A.B. de C.V.";

// -----------------------------------------------------------------------------
// PDF de texto: párrafos con ajuste de línea, salto de página automático.
// -----------------------------------------------------------------------------
async function pdfDeTexto(titulo, parrafos, { paginasMinimas = 0, relleno = null } = {}) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H, M, T, I] = [612, 792, 64, 10.5, 15];
  let pag = pdf.addPage([W, H]);
  let y = H - M;
  const nueva = () => { pag = pdf.addPage([W, H]); y = H - M; };
  const escribir = (texto, fuente = normal, tam = T) => {
    const palabras = texto.split(/\s+/);
    let linea = "";
    const volcar = () => {
      if (y < M) nueva();
      pag.drawText(linea, { x: M, y, size: tam, font: fuente, color: rgb(0.1, 0.1, 0.1) });
      y -= I;
      linea = "";
    };
    for (const p of palabras) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (fuente.widthOfTextAtSize(prueba, tam) > W - 2 * M) volcar();
      linea = linea ? `${linea} ${p}` : p;
    }
    if (linea) volcar();
    y -= I * 0.6;
  };
  escribir(titulo, negrita, 13);
  for (const p of parrafos) {
    if (p.startsWith("# ")) escribir(p.slice(2), negrita, 11.5);
    else escribir(p);
  }
  let n = 0;
  while (relleno && pdf.getPageCount() < paginasMinimas) {
    for (const p of relleno(n++)) {
      if (p.startsWith("# ")) escribir(p.slice(2), negrita, 11.5);
      else escribir(p);
    }
  }
  return Buffer.from(await pdf.save());
}

// -----------------------------------------------------------------------------
// Acta de instalación del comité (3 páginas aprox.)
// -----------------------------------------------------------------------------
const ACTA = [
  `Acta de la sesión de instalación del Comité de Sostenibilidad y Riesgos Climáticos de ${EMISORA}, celebrada en la Ciudad de México el 12 de marzo de 2025.`,
  "# Asistencia",
  "Asistieron los tres consejeros designados por el Consejo de Administración en su sesión del 27 de febrero de 2025: la consejera independiente que preside el Comité, un segundo consejero independiente y un consejero patrimonial. Asistieron como invitados permanentes, con voz y sin voto, el Director de Riesgos y la Directora de Sostenibilidad. Actuó como secretario no miembro el Secretario del Consejo de Administración.",
  "# Orden del día",
  "I. Instalación del Comité y aprobación de su reglamento. II. Funciones del Comité respecto de los riesgos y oportunidades relacionados con el clima. III. Calendario de sesiones y de informes al Consejo. IV. Programa de capacitación de consejeros. V. Designación de delegados para formalizar los acuerdos.",
  "# I. Instalación y reglamento",
  "La Presidenta declaró instalado el Comité. Se presentó el proyecto de reglamento, que define al Comité como órgano auxiliar del Consejo de Administración para la supervisión de los asuntos de sostenibilidad y, en particular, de los riesgos y oportunidades relacionados con el clima. El reglamento establece que el Comité no sustituye las facultades del Consejo ni las del Comité de Riesgos, con el que coordina el seguimiento de los riesgos físicos y de transición de la cartera crediticia.",
  "ACUERDO 1. Se aprueba el reglamento del Comité de Sostenibilidad y Riesgos Climáticos en los términos presentados, que se agrega al expediente de esta acta.",
  "# II. Funciones del Comité",
  "Conforme al reglamento aprobado, corresponde al Comité: (a) revisar y proponer al Consejo la estrategia de la Emisora frente al cambio climático, incluidos los objetivos de financiamiento sostenible y de reducción de emisiones; (b) dar seguimiento a la identificación, evaluación y gestión de los riesgos relacionados con el clima que realiza la Dirección de Riesgos, en coordinación con el Comité de Riesgos; (c) supervisar el avance de los objetivos climáticos aprobados por el Consejo y de los indicadores con que se miden; (d) revisar la información sobre sostenibilidad que la Emisora revela al mercado antes de que se someta al Consejo; (e) proponer al Consejo la consideración de criterios climáticos en las decisiones sobre transacciones importantes y en el presupuesto anual; y (f) evaluar la suficiencia de las competencias del Consejo en materia climática y proponer la capacitación que corresponda.",
  "Se dejó constancia de que la Dirección de Riesgos es responsable de la identificación y medición de los riesgos climáticos con la metodología corporativa, que la Dirección de Sostenibilidad coordina la estrategia, los objetivos y el reporte, y que la Dirección de Crédito aplica los criterios climáticos en la originación. Los responsables de dichas direcciones informarán al Comité en cada sesión ordinaria.",
  "ACUERDO 2. El Comité asume las funciones descritas y solicita a la Dirección de Riesgos y a la Dirección de Sostenibilidad un informe conjunto para la siguiente sesión ordinaria.",
  "# III. Sesiones e informes al Consejo",
  "El Comité sesionará de manera ordinaria cada trimestre y de forma extraordinaria cuando lo convoque su Presidenta o lo solicite el Consejo. Informará al Consejo de Administración sobre los riesgos y oportunidades relacionados con el clima dos veces al año, en las sesiones de abril y de octubre, y de inmediato sobre cualquier asunto que a su juicio lo amerite. En la sesión de octubre se presentará el seguimiento de los objetivos climáticos.",
  "ACUERDO 3. Se aprueba el calendario de cuatro sesiones ordinarias para 2025 y los dos informes semestrales al Consejo.",
  "# IV. Capacitación",
  "La Directora de Sostenibilidad presentó una propuesta de capacitación especializada sobre riesgos climáticos en el sector financiero para los miembros del Consejo y del Comité de Dirección, de 16 horas, a impartirse durante el segundo trimestre.",
  "ACUERDO 4. Se recomienda al Consejo aprobar el programa de capacitación propuesto.",
  "# V. Delegados",
  "ACUERDO 5. Se designa al Secretario del Consejo como delegado para formalizar los acuerdos de esta sesión.",
  "No habiendo otro asunto que tratar, se levantó la sesión, firmando la presente acta la Presidenta y el Secretario.",
];

// -----------------------------------------------------------------------------
// Estatutos sociales (80 páginas). Las cláusulas de gobierno van en las
// primeras páginas; el relleno numera artículos genéricos hasta pasar de 80, y
// el Comité de Innovación Financiera aparece SOLO después de la página 60.
// -----------------------------------------------------------------------------
const ESTATUTOS_INICIO = [
  `Estatutos sociales de ${EMISORA}. Texto compulsado que incorpora las reformas aprobadas por la asamblea general extraordinaria de accionistas.`,
  "# Capítulo primero. Denominación, domicilio, objeto y duración",
  `Artículo 1. La sociedad se denomina ${EMISORA}; esta denominación irá seguida de las palabras «Sociedad Anónima Bursátil de Capital Variable» o de su abreviatura.`,
  "Artículo 2. El domicilio social es la Ciudad de México, sin perjuicio de establecer oficinas, sucursales o agencias en cualquier otro lugar de la República o del extranjero.",
  "Artículo 3. La sociedad tiene por objeto adquirir y administrar acciones o partes sociales de entidades financieras y de servicios complementarios, así como realizar las actividades que la legislación aplicable permita a las sociedades controladoras de entidades financieras.",
  "Artículo 4. La duración de la sociedad es indefinida.",
  "# Capítulo segundo. Administración",
  "Artículo 30. La administración de la sociedad está encomendada a un Consejo de Administración y a un Director General, en sus respectivas esferas de competencia.",
  "Artículo 31. El Consejo de Administración tendrá a su cargo establecer las estrategias generales para la conducción del negocio de la sociedad y de las personas morales que controle, y vigilar la gestión y conducción de la sociedad. En el ejercicio de esa vigilancia, el Consejo supervisará los principales riesgos a los que está expuesta la sociedad, incluidos los riesgos ambientales y los relacionados con el clima, identificados con base en la información presentada por los comités, el Director General y el auditor externo, así como los sistemas de control interno y de gestión de riesgos.",
  "Artículo 32. El Consejo aprobará, con la previa opinión del comité que corresponda, las políticas de la sociedad en materia de riesgos, de financiamiento sostenible y de revelación de información al mercado, así como los objetivos que la sociedad se fije en materia de sostenibilidad.",
  "Artículo 33. Para el desempeño de sus funciones, el Consejo de Administración se auxiliará de un Comité de Auditoría y Prácticas Societarias y podrá constituir los demás comités que estime convenientes, determinando su integración, funciones y reglas de operación. Los comités informarán al Consejo de sus actividades en la forma y con la periodicidad que este determine.",
  "Artículo 34. Los miembros del Consejo de Administración deberán contar con la experiencia, capacidad y prestigio profesional necesarios para el desempeño de sus funciones. El Consejo evaluará anualmente la suficiencia de las competencias de sus miembros respecto de los riesgos a que está expuesta la sociedad y podrá acordar los programas de capacitación que considere necesarios.",
  "Artículo 35. El Director General será responsable de la gestión, conducción y ejecución de los negocios de la sociedad, sujetándose a las estrategias, políticas y lineamientos aprobados por el Consejo de Administración, y le presentará la información relevante sobre los riesgos de la sociedad, incluidos los relacionados con el clima.",
];

const TEMAS = [
  ["de las acciones", "Las acciones representativas del capital social serán nominativas, sin expresión de valor nominal, y conferirán iguales derechos dentro de cada serie. La sociedad llevará un registro de acciones en los términos de la legislación aplicable."],
  ["de las asambleas", "Las asambleas generales de accionistas serán ordinarias o extraordinarias y se celebrarán en el domicilio social. La convocatoria se publicará en el sistema electrónico que corresponda con la anticipación que establezca la ley, y contendrá el orden del día."],
  ["del quórum", "Para que una asamblea se considere legalmente instalada en virtud de primera convocatoria deberá estar representada la proporción del capital que determine la ley; sus resoluciones serán válidas cuando se tomen por la mayoría de votos de las acciones presentes."],
  ["de la vigilancia", "La vigilancia de la sociedad estará a cargo del Consejo de Administración, a través del comité que desempeñe las funciones de auditoría, y de la persona moral que realice la auditoría externa, en los términos de la legislación del mercado de valores."],
  ["del ejercicio social", "El ejercicio social coincidirá con el año calendario. Dentro de los plazos legales se formularán los estados financieros del ejercicio, que se someterán a la aprobación de la asamblea con los informes que procedan."],
  ["de las utilidades", "De las utilidades netas de cada ejercicio se separará la cantidad que corresponda para formar o reconstituir el fondo de reserva legal; el remanente se aplicará en la forma que determine la asamblea general ordinaria de accionistas."],
  ["de la información", "La sociedad revelará al público inversionista la información periódica y los eventos relevantes que exija la legislación aplicable, conforme a las políticas aprobadas por el Consejo de Administración."],
  ["de la disolución", "La sociedad se disolverá en los casos previstos por la ley. Disuelta la sociedad, se pondrá en liquidación, que estará a cargo de uno o más liquidadores designados por la asamblea."],
];

function rellenoEstatutos(n) {
  const art = 36 + n;
  const [tema, texto] = TEMAS[n % TEMAS.length];
  const bloque = [
    `Artículo ${art}. Disposiciones complementarias ${tema}. ${texto} Lo previsto en este artículo se aplicará sin perjuicio de las disposiciones de carácter general que emitan las autoridades competentes y de los acuerdos que adopte la asamblea dentro de su competencia, y se interpretará de conformidad con los demás artículos de estos estatutos y con la legislación mercantil, financiera y del mercado de valores vigente en cada momento.`,
  ];
  return bloque;
}

const ESTATUTOS_FINAL = [
  "# Capítulo décimo. Comités especiales",
  "Artículo final. El Consejo de Administración constituirá un Comité de Innovación Financiera, integrado por cinco consejeros, encargado de evaluar productos de financiamiento basados en activos digitales y de proponer al Consejo su lanzamiento.",
];

async function estatutos() {
  // El relleno se corta en 78 páginas para que el capítulo final caiga en la 79–80.
  const cuerpo = await pdfDeTexto("Estatutos sociales", ESTATUTOS_INICIO, { paginasMinimas: 78, relleno: rellenoEstatutos });
  const doc = await PDFDocument.load(cuerpo);
  const extra = await pdfDeTexto("Estatutos sociales (continuación)", ESTATUTOS_FINAL);
  const ext = await PDFDocument.load(extra);
  for (const p of await doc.copyPages(ext, ext.getPageIndices())) doc.addPage(p);
  while (doc.getPageCount() < 80) {
    const blanca = await pdfDeTexto("Estatutos sociales (anexo)", ["Página intencionalmente en blanco salvo por este aviso."]);
    const b = await PDFDocument.load(blanca);
    const [pg] = await doc.copyPages(b, [0]);
    doc.addPage(pg);
  }
  return { buffer: Buffer.from(await doc.save()), paginas: doc.getPageCount() };
}

// -----------------------------------------------------------------------------
// Código de ética (Word)
// -----------------------------------------------------------------------------
async function codigoDeEtica() {
  const t = (texto) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(texto)] });
  const p = (texto) => new Paragraph({ children: [new TextRun(texto)] });
  const doc = new Document({
    sections: [
      {
        children: [
          t(`Código de Ética y Conducta de ${EMISORA}`),
          p("Este Código establece los principios que guían la conducta de consejeros, directivos y colaboradores de la Emisora y de sus subsidiarias. Lo aprobó el Consejo de Administración y su cumplimiento es obligatorio."),
          t("Capítulo 1. Integridad y cumplimiento"),
          p("Los colaboradores actúan con honestidad, cumplen la legislación aplicable y las políticas internas, y evitan cualquier conflicto entre sus intereses personales y los de la Emisora."),
          p("Ningún colaborador ofrece ni acepta regalos, pagos o beneficios que puedan influir en una decisión de negocio."),
          t("Capítulo 2. Gestión responsable del riesgo"),
          p("Las decisiones de crédito, inversión y operación consideran los riesgos financieros y no financieros, incluidos los riesgos ambientales y los relacionados con el clima, conforme a las políticas de riesgos aprobadas por el Consejo."),
          p("Los colaboradores que identifiquen un riesgo relevante no previsto en las políticas lo informan a la Dirección de Riesgos."),
          t("Capítulo 3. Medio ambiente y clima"),
          p("La Emisora reconoce que el cambio climático puede afectar a sus clientes, a su cartera y a su operación. Por ello promueve el financiamiento de actividades que contribuyen a la transición hacia una economía baja en carbono, aplica criterios ambientales y climáticos en la originación de créditos y procura reducir el consumo de energía de sus instalaciones."),
          p("La Dirección de Sostenibilidad coordina los compromisos ambientales de la Emisora y reporta su avance al Comité de Sostenibilidad y Riesgos Climáticos."),
          t("Capítulo 4. Información veraz"),
          p("La información financiera y de sostenibilidad que la Emisora revela al mercado es completa, veraz y oportuna. Nadie altera registros ni oculta información a los auditores o a las autoridades."),
          t("Capítulo 5. Línea de denuncia"),
          p("Cualquier persona puede reportar de manera confidencial y anónima una posible violación a este Código por medio de la línea de denuncia, operada por un tercero independiente. Los reportes se turnan al Comité de Ética, que informa trimestralmente al Comité de Auditoría y Prácticas Societarias. Está prohibida cualquier represalia contra quien denuncie de buena fe."),
          t("Capítulo 6. Vigilancia del Código"),
          p("El Comité de Ética vigila la aplicación de este Código, resuelve las dudas sobre su interpretación y propone al Consejo sus actualizaciones. La Dirección de Recursos Humanos imparte la capacitación anual obligatoria sobre su contenido."),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

// -----------------------------------------------------------------------------
// Subida
// -----------------------------------------------------------------------------
const { data: perfil } = await db.from("perfil_emisor").select("organigrama_path").eq("tenant_id", TENANT).maybeSingle();
const { data: existentes } = await db.from("perfil_emisor_adjuntos").select("nombre_original").eq("tenant_id", TENANT);
const ya = new Set((existentes ?? []).map((a) => a.nombre_original));

const archivos = [];
if (perfil?.organigrama_path) {
  const { data: blob, error } = await db.storage.from("documentos").download(perfil.organigrama_path);
  if (error) throw new Error(`organigrama: ${error.message}`);
  archivos.push({ nombre: "organigrama-corporativo.png", mime: "image/png", buffer: Buffer.from(await blob.arrayBuffer()) });
} else {
  console.log("  (el Perfil del demo no tiene organigrama: se omite ese adjunto)");
}
archivos.push({
  nombre: "codigo-de-etica.docx",
  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer: await codigoDeEtica(),
});
archivos.push({ nombre: "acta-comite-sostenibilidad.pdf", mime: "application/pdf", buffer: await pdfDeTexto("Acta de sesión", ACTA) });
const est = await estatutos();
archivos.push({ nombre: "estatutos-sociales.pdf", mime: "application/pdf", buffer: est.buffer });
console.log(`estatutos: ${est.paginas} páginas`);

mkdirSync(CARPETA, { recursive: true });
for (const a of archivos) {
  writeFileSync(path.join(CARPETA, a.nombre), a.buffer);
  if (ya.has(a.nombre)) {
    console.log(`= ${a.nombre}: ya estaba`);
    continue;
  }
  const ruta = `${TENANT}/perfil/${SECCION}/${Date.now()}-${a.nombre}`;
  const { error: eUp } = await db.storage.from("documentos").upload(ruta, a.buffer, { contentType: a.mime, upsert: false });
  if (eUp) throw new Error(`${a.nombre}: ${eUp.message}`);
  const { error } = await db.from("perfil_emisor_adjuntos").insert({
    tenant_id: TENANT, seccion: SECCION, archivo_path: ruta, nombre_original: a.nombre, mime: a.mime, tamano: a.buffer.length,
  });
  if (error) {
    await db.storage.from("documentos").remove([ruta]);
    throw new Error(`${a.nombre}: ${error.message}`);
  }
  console.log(`+ ${a.nombre} (${(a.buffer.length / 1024).toFixed(0)} KB)`);
}

if (BASE) {
  const r = await fetch(`${BASE}/api/evidencias/procesar?maximo=20`, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET ?? "" } });
  const j = await r.json().catch(() => ({}));
  console.log(`procesar → ${r.status} · ${JSON.stringify(j.porEstado ?? {})}`);
}

const { data: estado } = await db
  .from("perfil_emisor_adjuntos_contenido")
  .select("nombre_original, estado, tipo, paginas, truncado, costo_usd, mensaje")
  .eq("tenant_id", TENANT);
for (const e of estado ?? []) {
  console.log(`  ${e.nombre_original}: ${e.estado}${e.tipo ? ` · ${e.tipo}` : ""}${e.paginas ? ` · ${e.paginas} págs.` : ""}${e.truncado ? " · truncado" : ""} · $${e.costo_usd}${e.mensaje ? ` · ${e.mensaje}` : ""}`);
}
