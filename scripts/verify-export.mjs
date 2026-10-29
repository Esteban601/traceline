#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Verificación end-to-end del export de taxonomía por la RUTA HTTP autenticada.
//
// Forja una sesión de admin con @supabase/ssr (las mismas cookies que pondría el
// navegador), invoca /admin/cobertura/export-taxonomia y valida:
// Corre DOS exports:
//   A) Empresa Demo — la referencia: 14/14 hojas llenas y sus reglas duras.
//   B) Un segundo tenant de prueba creado al vuelo con datos mínimos (1 solicitud
//      GEI validada) y ejercicio DISTINTO (2026), que comprueba lo que el
//      rediseño del mapeo prometía: que la definición celda↔dato es reutilizable
//      y que el libro de un cliente no arrastra NADA del otro.
//
// Valida en el export del demo:
//   · HTTP 200 + content-type xlsx
//   · las 14 hojas llenadas (2 GEI + 4 de registros de clima + 5 de objetivos +
//     3 de cuestionarios narrativos)
//   · las REGLAS DURAS: una celda de dato NO validado queda vacía y su fila lleva
//     la nota de brecha correspondiente; un objetivo se puede seguir a través de
//     las 4 hojas S2 33-36 y sus secciones vacías marcan 'Sección pendiente';
//     un cuestionario a medias muestra el marcador «Pendiente: …» en las preguntas
//     sin responder.
//
// Requiere el server corriendo (pnpm dev o pnpm start) y el demo POBLADO: desde
// 9887b10 las reglas son las del grupo financiero de scripts/poblar-demo.mjs, no
// las del seed a secas. Hoy eso es el PROYECTO DEV (kmjkoxecxcujxixlxwlb):
// poblar-demo solo corre ahí y escribe con service_role en tablas en las que las
// migraciones solo le dan SELECT; funciona en el proyecto alojado por los
// privilegios por defecto de Supabase y no en el stack local. Así que el server
// va contra dev (variables de .env.local), no contra el local recién reseteado.
// Si el demo no está poblado, el script lo dice y sale con 2. Uso:
//   node scripts/verify-export.mjs [baseUrl]
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/verify-export.mjs
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import ExcelJS from "exceljs";

const BASE_URL = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@irstrat.example";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Demo2025!";

function readEnvLocal() {
  const out = {};
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = readEnvLocal();
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const problemas = [];
const ok = (cond, msg) => {
  if (!cond) problemas.push(msg);
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
};
const cellText = (ws, addr) => {
  let v = ws.getCell(addr).value;
  if (v && typeof v === "object") {
    if (v.richText) v = v.richText.map((t) => t.text).join("");
    else if (v.result !== undefined) v = v.result;
    else v = "";
  }
  return v == null ? "" : String(v);
};

const cellTextC = (c) => {
  let v = c.value;
  if (v && typeof v === "object") v = v.richText ? v.richText.map((t) => t.text).join("") : v.result !== undefined ? v.result : "";
  return v == null ? "" : String(v);
};
/** Primera fila cuya columna `col` dice `texto` (0 si no la hay). */
const filaDe = (ws, texto, col = "A") => {
  for (let f = 1; f <= ws.rowCount; f++) if (cellText(ws, `${col}${f}`).trim() === texto) return f;
  return 0;
};

/** Pide el export de un reporte concreto y devuelve la respuesta + su cuerpo. */
async function pedirExport(cookie, reporteId) {
  const url = `${BASE_URL}/admin/cobertura/export-taxonomia?reporte=${reporteId}`;
  console.log(`\nGET ${url}`);
  const res = await fetch(url, { headers: { cookie }, redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL / ANON_KEY (.env.local).");
    process.exit(2);
  }

  // 1. Forjar sesión de admin (capturar cookies como el navegador).
  const jar = new Map();
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (arr) => arr.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: loginErr } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (loginErr) {
    console.error("Login falló:", loginErr.message);
    process.exit(2);
  }
  const cookie = [...jar.entries()]
    .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
    .join("; ");

  // 2. El export es POR REPORTE: se resuelve el del demo.
  const { data: repDemo } = await client
    .from("reportes")
    // !inner: sin él, el embed es un LEFT JOIN y `.eq("tenant.slug")` solo
    // anula el embebido — devolvería el reporte más reciente de CUALQUIER tenant.
    .select("id, ejercicio, tenant:tenants!reportes_tenant_id_fkey!inner(slug)")
    .eq("tenant.slug", "empresa-demo-sab")
    .order("ejercicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!repDemo) {
    console.error("No se encontró el reporte de Empresa Demo (¿corriste supabase db reset?).");
    process.exit(2);
  }

  // 2b. Las reglas de abajo son las del demo POBLADO (grupo financiero, desde
  // 9887b10), no las del seed a secas (el giro industrial). Sin poblar, fallaban
  // dieciocho comprobaciones que parecían un export roto y eran un demo viejo.
  // Se detecta por un registro de clima que solo crea poblar-demo.mjs.
  const { count: poblado } = await client
    .from("registros_clima")
    .select("id", { count: "exact", head: true })
    .eq("reporte_id", repDemo.id)
    .eq("nombre", "Huracanes e inundaciones en la red del sureste");
  if (!poblado) {
    console.error(
      "\n✗ El demo NO está poblado: las reglas de este script son las del grupo financiero de\n" +
        "  scripts/poblar-demo.mjs, no las del seed a secas. Corre primero:\n" +
        "    node scripts/poblar-demo.mjs        (solo corre contra el proyecto dev; ver el encabezado)\n"
    );
    process.exit(2);
  }

  console.log("\n════════ A) EMPRESA DEMO — la referencia ════════");
  const { res, buf } = await pedirExport(cookie, repDemo.id);
  ok(res.status === 200, `HTTP 200 (recibido ${res.status})`);
  const ct = res.headers.get("content-type") || "";
  ok(ct.includes("spreadsheetml"), `content-type xlsx (${ct.slice(0, 40)})`);
  if (res.status !== 200) {
    console.error("Cuerpo:", buf.toString("utf8").slice(0, 300));
    process.exit(1);
  }
  ok(buf.slice(0, 2).toString("latin1") === "PK", "cuerpo es un .xlsx (magic PK)");

  // 3. Reabrir y validar contenido.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const hojas = [
    "NIIF S2 29(a)(i)",
    "NIIF S2 29(a)(vi)(1)",
    "NIIF S2 10",
    // 29(c) son los riesgos FÍSICOS y 29(b) los de TRANSICIÓN. Las dos pestañas
    // llevaban el código cruzado y se corrigieron: ya no existe una hoja «NIIF S2 30»,
    // porque el párrafo 30 no es una revelación sino la exención por costo
    // desproporcionado al preparar 29(b) a (d).
    "NIIF S2 29(c)",
    "NIIF S2 29(b)",
    "NIIF S2 29(d)",
    "NIIF S1 51",
    "NIIF S2 33",
    "NIIF S2 34",
    "NIIF S2 35",
    "NIIF S2 36(a)-(d)",
    "NIIF S2 22(b)(i)",
    "NIIF S2 22(b)(ii)",
    "NIIF S2 36(e)(i)-(iv)",
  ];
  console.log("\nHojas presentes:");
  for (const h of hojas) ok(!!wb.getWorksheet(h), `hoja "${h}" existe`);

  const gei1 = wb.getWorksheet("NIIF S2 29(a)(i)");
  const geiVi = wb.getWorksheet("NIIF S2 29(a)(vi)(1)");
  const s10 = wb.getWorksheet("NIIF S2 10");
  // Se nombran por lo que CONTIENEN, que es lo que no cambió: la hoja de riesgos
  // físicos pasó a llamarse «NIIF S2 29(c)» y la de transición, «NIIF S2 29(b)».
  const sFisicos = wb.getWorksheet("NIIF S2 29(c)");
  const sTransicion = wb.getWorksheet("NIIF S2 29(b)");
  const s29d = wb.getWorksheet("NIIF S2 29(d)");

  // SOLO PREGUNTAS Y RESPUESTAS (regla de Esteban del 26/10, encargo formato-afirmaciones-y-voz): sin hoja
  // «Leyenda», sin filas de título, sin pies, sin columnas «Notas / Brechas» ni «Tipo de dato». Las filas cambian
  // con los datos (se quitan separadoras y filas vacías), así que se busca por etiqueta, no por dirección.
  console.log("\nSolo preguntas y respuestas:");
  ok(!wb.getWorksheet("Leyenda"), "sin hoja «Leyenda»");
  {
    const textos = [];
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => textos.push(cellTextC(c)))));
    ok(!textos.some((t) => /Generado por|\[DEMO\]/.test(t)), "sin pie «Generado por … [DEMO]» en ninguna hoja");
    ok(!textos.some((t) => /^(Notas \/ Brechas|Notas|Tipo de dato|Sección|UN SDG)$/.test(t)), "sin columnas auxiliares («Notas / Brechas», «Tipo de dato», «Sección», «UN SDG»)");
    ok(!textos.some((t) => /^(RIESGOS|OPORTUNIDADES|Riesgos|Oportunidades)$/.test(t)), "sin filas separadoras");
    ok(!textos.some((t) => /^Sin datos del ejercicio$|en plataforma/.test(t)), "sin notas «Sin datos del ejercicio» ni «… en plataforma»");
    ok(hojas.every((h) => !/ — /.test(cellText(wb.getWorksheet(h), "A1"))), "sin fila de título: la fila 1 de cada hoja es su encabezado");
  }
  const tax = wb.getWorksheet("Taxonomía NIIF S1 S2");
  ok(cellText(tax, "A1") === "Contenido" && cellText(tax, "B1") === "Requerimientos" && cellText(tax, "C1") === "Respuesta" && tax.columnCount === 3, "Taxonomía: tres columnas, código, requisito y respuesta");
  {
    const E5 = "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo E5 de la NIIF S1";
    // La oración completa (lib/suplemento/alivios.ts; este script no importa TypeScript).
    const E5_COMPLETA = `${E5} y revela únicamente información sobre los riesgos y oportunidades relacionados con el clima.`;
    const pilares = [];
    let conE5 = 0;
    tax.eachRow((row, f) => {
      if (f === 1) return;
      const c = cellText(tax, `C${f}`);
      // La forma «requisito» del E5 sin par de NIIF S2 sería la oración sola; desde la revisión externa v5.1 todas las
      // filas de NIIF S1 con E5 del demo tienen par (S1 33(c) remite a NIIF S2 6(a)(iv)).
      if (c.startsWith(E5) && c !== E5_COMPLETA) conE5++;
      if (!cellText(tax, `A${f}`) && c.startsWith(E5)) { pilares.push(cellText(tax, `B${f}`)); if (c === E5_COMPLETA) conE5++; }
    });
    ok(conE5 === pilares.length && ["Gobernanza (S1)", "Estrategia", "Gestión del riesgo", "Métricas y Objetivos", "Declaración de cumplimiento"].every((p) => pilares.includes(p)), `E5 solo en los encabezados de pilar de NIIF S1 (${pilares.join(", ")})`);
    const f72 = filaDe(tax, "NIIF S1 72");
    ok(!!f72 && /párrafo E4 de la NIIF S1/.test(cellText(tax, `C${f72}`)), "E4 enunciado en la respuesta de la declaración de cumplimiento (NIIF S1 72)");
  }

  console.log("\nGEI 29(a)(i) — la cifra y su alivio en la misma celda:");
  ok(cellText(gei1, "A1") === "Categoría" && cellText(gei1, "C1") === "2025" && gei1.columnCount === 4, "29(a)(i): encabezado Categoría · Unidad · 2025 · 2024, sin notas");
  const fA1 = filaDe(gei1, "Alcance 1"), fA2 = filaDe(gei1, "Alcance 2"), fA3 = filaDe(gei1, "Alcance 3");
  // La cifra cambió de 400,000 a 1,240 al pasar el demo de industrial a grupo financiero (scripts/poblar-demo.mjs).
  ok(Number(cellText(gei1, `C${fA1}`)) === 1240, "Alcance 1, 2025 validado = 1240");
  // ALIVIOS: primer año con C3, C4 y E5. C3: la columna 2024 dice «No revelado · alivio C3»; C4: sin Alcance 3.
  ok(cellText(gei1, `D${fA1}`) === "No revelado · alivio C3" && Number(cellText(gei1, `C${fA2}`)) > 0 && cellText(gei1, `D${fA2}`) === "No revelado · alivio C3", "Alcances 1 y 2: 2024 «No revelado · alivio C3»");
  // El comparativo lo deja fuera C3 antes que C4 (revisión externa v5, Fase 5).
  ok(cellText(gei1, `C${fA3}`) === "No revelado · alivio C4" && cellText(gei1, `D${fA3}`) === "No revelado · alivio C3", "Alcance 3 total: 2025 «No revelado · alivio C4», 2024 «No revelado · alivio C3»");
  {
    const textos = [];
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => textos.push(cellTextC(c)))));
    ok(!textos.some((t) => t.includes("validación interna del cliente")), "ninguna celda lleva '(validación interna del cliente)'");
  }

  console.log("\nGEI 29(a)(vi)(1) — categorías de Alcance 3:");
  {
    let n = 0, todas = true;
    geiVi.eachRow((row, f) => {
      if (!/^Categoría \d/.test(cellText(geiVi, `A${f}`))) return;
      n++;
      if (cellText(geiVi, `B${f}`) !== "No revelado · alivio C4" || cellText(geiVi, `C${f}`) !== "No revelado · alivio C3") todas = false;
    });
    ok(n === 15 && todas && geiVi.columnCount === 3, `las 15 categorías: 2025 «No revelado · alivio C4», 2024 por C3, sin columna de notas (${n})`);
  }

  console.log("\nRegistros de clima (horizonte multi + capital en tres):");
  ok(cellText(s10, "A2").length > 0 && cellText(s10, "C2").length > 0, "S2 10: el primer riesgo con su tipo, justo bajo el encabezado");
  ok(cellText(s10, "D2").includes("Corto plazo") && cellText(s10, "D2").includes("Mediano plazo"), "S2 10: D2 lista varios horizontes");
  const fFis = filaDe(sFisicos, "Huracanes e inundaciones en la red del sureste");
  ok(!!fFis && cellText(sFisicos, `B${fFis}`).includes("Corto plazo") && Number(cellText(sFisicos, `C${fFis}`)) > 0, "S2 29(c) [físicos]: el riesgo con horizontes y cantidad 2025");
  ok(cellText(sFisicos, `E${fFis}`) === "Cantidad de gasto de capital" && Number(cellText(sFisicos, `F${fFis}`)) > 0, "S2 29(c): gasto de capital 2025 (etiqueta E + valor F)");
  ok(cellText(sFisicos, `E${fFis + 1}`) === "Cantidad de financiación" && cellText(sFisicos, `E${fFis + 2}`) === "Cantidad de inversión", "S2 29(c): sub-filas de financiación e inversión");
  ok(cellText(sTransicion, "A4").length > 0 && cellText(s29d, "A4").length > 0, "S2 29(b) y 29(d): el primer registro bajo el encabezado de tres filas");
  {
    let sinDatos = false;
    s29d.eachRow((row, f) => { if (/^Pendiente: cifras/.test(cellText(s29d, `C${f}`))) sinDatos = true; });
    ok(!sinDatos, "S2 29(d): ningún registro con «Pendiente: cifras …» (las dos oportunidades tienen 2025)");
  }

  // ---------------------------------------------------------------------------
  // Objetivos — 5 hojas: S1 51 + S2 33/34/35/36(a)-(d). Fila 2 = primer objetivo.
  // ---------------------------------------------------------------------------
  const s51 = wb.getWorksheet("NIIF S1 51");
  const s33 = wb.getWorksheet("NIIF S2 33");
  const s34 = wb.getWorksheet("NIIF S2 34");
  const s35 = wb.getWorksheet("NIIF S2 35");
  const s36 = wb.getWorksheet("NIIF S2 36(a)-(d)");

  console.log("\nObjetivos — S2 33 (definición climática, tipos oficiales):");
  ok(cellText(s33, "A2").length > 0 && cellText(s33, "B2") === "Objetivo de emisiones de gases de efecto invernadero", "S2 33: el primer objetivo y su tipo oficial");
  ok(cellText(s33, "I2") === "Absoluto" && cellText(s33, "I3") === "Relativo", "S2 33: tipos de objetivo Absoluto y Relativo");
  ok(s33.columnCount === 10, "S2 33: diez columnas, sin «Notas / Brechas»");

  console.log("\nObjetivos — trazabilidad + tipos oficiales S2 34/36:");
  const a2 = cellText(s33, "A2");
  ok(a2.length > 0 && cellText(s34, "A2") === a2 && cellText(s35, "A2") === a2 && cellText(s36, "A2") === a2, "el objetivo de la fila 2 es el mismo en S2 33/34/35/36");
  // Ningún objetivo tiene validación por tercero; «Verdadero» se prueba en S2 22(b)(i).
  ok(cellText(s34, "B2") === "Falso" && cellText(s34, "B3") === "Falso", "S2 34: validación por tercero «Falso» (booleano)");
  ok(cellText(s35, "B2").length > 0, "S2 35: resultados del objetivo completo");
  ok(cellText(s36, "B2").includes("Dióxido de carbono (CO2)") && cellText(s36, "C2") === "Alcance 1; Alcance 2" && cellText(s36, "D2") === "Emisiones brutas de gases de efecto invernadero" && cellText(s36, "E2") === "No", "S2 36: gases, alcances, bruto/neto y enfoque con valores oficiales");
  ok(cellText(s34, "A5") === "" && cellText(s35, "A5") === "" && cellText(s36, "A5") === "", "sin cuarto objetivo: nada inventado después del tercero");

  console.log("\nObjetivos — S1 51 y métricas S1 46-50:");
  // E5: las hojas de S1 llevan la información sobre clima, la misma del Formato electrónico.
  ok(cellText(s51, "A2") === "Reducción de emisiones de Alcances 1 y 2" && cellText(s51, "H2").length > 0, "S1 51: el primer objetivo climático, con resultados");
  ok(filaDe(s51, "Cartera sostenible") > 0, "S1 51: el objetivo climático de cartera sostenible");
  const s4650 = wb.getWorksheet("NIIF S1 46-50");
  ok(cellText(s4650, "A3").length > 0 && /NIIF S2 párrafo 29/.test(cellText(s4650, "E3")) && !/párrafo E5/.test(cellText(s4650, "A1")), "S1 46-50: instancias de métricas de NIIF S2 29 bajo el encabezado de dos filas, sin la oración del E5 suelta");
  {
    // Columna B «Tipo» (decisión de Esteban del 26/10): Riesgo / Oportunidad en cada instancia.
    const tipos = new Set();
    s4650.eachRow((row, f) => { if (f > 2 && cellText(s4650, `A${f}`)) tipos.add(cellText(s4650, `B${f}`)); });
    ok(cellText(s4650, "B2") === "Tipo" && [...tipos].every((t) => t === "Riesgo" || t === "Oportunidad") && tipos.has("Riesgo") && tipos.has("Oportunidad"), `S1 46-50: columna «Tipo» con Riesgo y Oportunidad (${[...tipos].join(", ")})`);
  }

  // ---------------------------------------------------------------------------
  // Cuestionarios — 3 hojas: 22(b)(i)/(ii) y 36(e). Dos columnas: pregunta y respuesta.
  // ---------------------------------------------------------------------------
  const c22bi = wb.getWorksheet("NIIF S2 22(b)(i)");
  const c22bii = wb.getWorksheet("NIIF S2 22(b)(ii)");
  const c36e = wb.getWorksheet("NIIF S2 36(e)(i)-(iv)");
  // Marcador de pendiente en texto plano (CLAUDE.md §5), en la celda de la respuesta.
  const PEND = (hoja) => `Pendiente: respuesta de la emisora a esta pregunta — cuestionario ${hoja}`;
  const NO_APLICA_36E = "No aplica. La Compañía no prevé usar créditos de carbono para alcanzar sus objetivos de emisiones.";
  for (const ws of [c22bi, c22bii, c36e]) ok(ws.columnCount === 2 && cellText(ws, "B1") === "Respuesta", `${ws.name}: dos columnas, pregunta y respuesta`);

  console.log("\nCuestionarios — S2 22(b)(i) (completo 8/8):");
  ok(cellText(c22bi, "A2").includes("cómo y cuándo") && cellText(c22bi, "B2").length > 0, "S2 22(b)(i): la pregunta inicial y su respuesta");
  ok(cellText(c22bi, "B4") === "Verdadero", "S2 22(b)(i): el booleano = «Verdadero»");
  ok(cellText(c22bi, "B5").includes("Riesgos físicos") && cellText(c22bi, "B5").includes("Riesgos de transición"), "S2 22(b)(i): la enumeración lista ambos tipos de riesgo");
  ok(cellText(c22bi, "B8") === "Corto plazo; Mediano plazo; Largo plazo", "S2 22(b)(i): horizontes = los 3 plazos");
  ok(cellText(c22bi, "A9").includes("(por ejemplo") && cellText(c22bi, "B9").length > 0, "S2 22(b)(i): alcance con el ejemplo oficial y respuesta");
  {
    let pend = false;
    c22bi.eachRow((row, f) => { if (/^Pendiente/.test(cellText(c22bi, `B${f}`))) pend = true; });
    ok(!pend, "S2 22(b)(i): sin «Pendiente: …» (completo 8/8)");
  }

  // Completo 6/6 desde el encargo formato-afirmaciones-y-voz (5 y 6 con el supuesto de 40% de generación limpia).
  // El marcador de un cuestionario sin respuesta se comprueba en el segundo tenant, que no tiene ninguna.
  console.log("\nCuestionarios — S2 22(b)(ii) (completo 6/6):");
  ok(cellText(c22bii, "B2").length > 0 && cellText(c22bii, "A4").includes("patrones climáticos locales"), "S2 22(b)(ii): respuesta y pregunta con los ejemplos oficiales");
  ok(["B6", "B7"].every((c) => /generación limpia/.test(cellText(c22bii, c)) && /40%/.test(cellText(c22bii, c))), "S2 22(b)(ii): preguntas 5 y 6 con el supuesto de generación limpia");
  {
    let pend = false;
    c22bii.eachRow((row, f) => { if (/^Pendiente/.test(cellText(c22bii, `B${f}`))) pend = true; });
    ok(!pend, "S2 22(b)(ii): sin «Pendiente: …» (completo 6/6)");
  }

  // NIIF S2 36(a)–(d): solo objetivos de emisiones de GEI (Fase 5): «Cartera sostenible» y la medición PCAF no van.
  ok(!cellText(s36, "A3"), "S2 36(a)–(d): solo el objetivo de emisiones de GEI");

  console.log("\nCuestionarios — S2 36(e) (un solo estado):");
  ok(cellText(c36e, "A2").length > 0 && cellText(c36e, "B2").length > 0, "S2 36(e): la pregunta impresa y su respuesta capturada");
  ok(cellText(c36e, "A6").includes("permanencia de la compensación de carbono"), "S2 36(e): P5 con el ejemplo oficial");
  ok(["B4", "B5", "B6"].every((c) => cellText(c36e, c) === NO_APLICA_36E), "S2 36(e): P3-P5 sin captura = el «no aplica» del documento aprobado");

  // ===========================================================================
  // B) SEGUNDO TENANT — un cliente real con datos mínimos.
  //
  // Se crea al vuelo (no vive en el seed: el ambiente de demo no debe cambiar) y
  // se borra al final. Su ejercicio es 2026 a propósito: el mapeo guarda años
  // RELATIVOS, así que si estuviera atado a 2025 este export saldría vacío.
  // ===========================================================================
  console.log("\n════════ B) SEGUNDO TENANT — cliente nuevo, datos mínimos ════════");
  // `tenantIdFixture` se captura por separado: si crearFixture falla DESPUÉS de
  // insertar el tenant, `fixture` nunca se asigna y el finally no limpiaría —
  // dejando una emisora fantasma en el selector de clientes.
  let fixture = null;
  const rastro = {};
  try {
    fixture = await crearFixture(client, rastro);
    console.log(`  (tenant ${fixture.slug}, reporte ${fixture.ejercicio})`);

    const { res: res2, buf: buf2 } = await pedirExport(cookie, fixture.reporteId);
    ok(res2.status === 200, `HTTP 200 para el segundo tenant (recibido ${res2.status})`);
    if (res2.status !== 200) {
      console.error("Cuerpo:", buf2.toString("utf8").slice(0, 300));
    } else {
      const cd = res2.headers.get("content-disposition") || "";
      ok(
        cd.includes(fixture.slug) && cd.includes(String(fixture.ejercicio)),
        `el archivo se nombra con el slug del tenant real y su ejercicio (${cd.slice(0, 80)})`
      );

      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.load(buf2);

      const g1 = wb2.getWorksheet("NIIF S2 29(a)(i)");
      const gVi = wb2.getWorksheet("NIIF S2 29(a)(vi)(1)");
      ok(!!g1 && !!gVi, "las dos hojas GEI existen en el libro del segundo tenant");

      // Las etiquetas son de la PLANTILLA: no dependen del cliente. Sin fila de título: la 2 es el Alcance 1.
      const sinSol = (anio) => `Pendiente: cifra de ${anio} — sin solicitud en el reporte`;
      ok(cellText(g1, "A2") === "Alcance 1", "etiqueta A2 = 'Alcance 1' (viene del mapeo)");
      ok(filaDe(gVi, "Categoría 5-Residuos generados en las operaciones") > 0, "etiqueta de la categoría 5 escrita desde el catálogo de rubros");
      // Su ÚNICA solicitud validada llena su celda del ejercicio del reporte, y la comparativa con su captura.
      ok(Number(cellText(g1, "C2")) === 1234.5, `C2 (Alcance 1, ${fixture.ejercicio} validado) = 1234.5 — año RELATIVO resuelto`);
      ok(Number(cellText(g1, "D2")) === fixture.valorComparativo, `D2 (Alcance 1, ${fixture.ejercicio - 1} validado) = ${fixture.valorComparativo} — la columna comparativa se llena`);
      // Rubros que este reporte NO pide: el marcador de pendiente EN la celda de la cifra (no una nota).
      ok(cellText(g1, "C3") === sinSol(fixture.ejercicio) && cellText(g1, "D3") === sinSol(fixture.ejercicio - 1), "Alcance 2 sin solicitud → «Pendiente: cifra de AAAA — sin solicitud en el reporte» en cada año");
      {
        let n = 0;
        gVi.eachRow((row, f) => { if (/^Categoría \d/.test(cellText(gVi, `A${f}`)) && cellText(gVi, `B${f}`) === sinSol(fixture.ejercicio)) n++; });
        ok(n === 15, `las 15 categorías de Alcance 3 con el marcador «sin solicitud en el reporte» (${n})`);
      }

      // Cuestionario sin ninguna respuesta: el marcador de pendiente en texto plano en cada respuesta (CLAUDE.md §5).
      {
        const q = wb2.getWorksheet("NIIF S2 22(b)(ii)");
        let n = 0;
        q?.eachRow((row, f) => { if (f > 1 && cellText(q, `B${f}`) === PEND("NIIF S2 22(b)(ii)")) n++; });
        ok(n === 6, `S2 22(b)(ii) sin respuestas: las 6 preguntas con el marcador de pendiente (${n})`);
      }

      // AISLAMIENTO: ni un dato del demo se cuela en el libro del otro cliente.
      const textoLibro = [];
      wb2.eachSheet((ws) => {
        ws.eachRow((row) => {
          row.eachCell((cell) => {
            const v = cell.value;
            if (typeof v === "string") textoLibro.push(v);
            else if (v && typeof v === "object" && v.richText)
              textoLibro.push(v.richText.map((t) => t.text).join(""));
          });
        });
      });
      const todo = textoLibro.join(" | ");
      ok(!/\[DEMO\]/.test(todo), "el libro NO lleva la marca [DEMO] (no es el tenant demo)");
      ok(
        !/Estrés hídrico en planta norte/.test(todo),
        "no aparecen los registros de clima de Empresa Demo"
      );
      ok(
        !/Reducción absoluta de emisiones GEI/.test(todo),
        "no aparecen los objetivos de Empresa Demo"
      );
      ok(
        !/15750|9820|3120\.4/.test(todo),
        "no aparece ninguna cifra GEI de Empresa Demo (fuga del Sprint 1 cerrada)"
      );
    }
  } catch (e) {
    ok(false, `el segundo tenant falló: ${e.message}`);
  } finally {
    const idFixture = fixture?.tenantId ?? rastro.tenantId;
    if (idFixture) {
      await limpiarFixture(client, { tenantId: idFixture });
      console.log("  (fixture del segundo tenant eliminado)");
    }
  }

  // ===========================================================================
  // C) GCARSO — cliente real importado con scripts/import-gcarso.mjs.
  //
  // No forma parte del seed: el bloque solo corre si el import ya se ejecutó.
  // Comprueba que su Excel sale con SUS cifras, sin nada del demo y sin la marca
  // [DEMO] que solo corresponde al tenant de demostración.
  // ===========================================================================
  const { data: repCarso } = await client
    .from("reportes")
    .select("id, ejercicio, tenant:tenants!reportes_tenant_id_fkey!inner(slug)")
    .eq("tenant.slug", "gcarso")
    .order("ejercicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!repCarso) {
    console.log("\n════════ C) GCARSO — omitido (no está importado) ════════");
    console.log("  (corre `node scripts/import-gcarso.mjs` para incluirlo)");
  } else {
    console.log("\n════════ C) GCARSO — cliente real ════════");
    const { res: res3, buf: buf3 } = await pedirExport(cookie, repCarso.id);
    ok(res3.status === 200, `HTTP 200 para GCARSO (recibido ${res3.status})`);
    const cd3 = res3.headers.get("content-disposition") || "";
    ok(cd3.includes("taxonomia-gcarso-2025"), `archivo con el slug real (${cd3.slice(0, 70)})`);

    if (res3.status !== 200) {
      // Sin esta guarda, cargar un cuerpo de error como .xlsx lanzaría y el
      // catch de main() escondería la lista de problemas acumulados.
      console.error("Cuerpo:", buf3.toString("utf8").slice(0, 300));
    } else {
    const wb3 = new ExcelJS.Workbook();
    await wb3.xlsx.load(buf3);
    const c1 = wb3.getWorksheet("NIIF S2 29(a)(i)");
    const c10 = wb3.getWorksheet("NIIF S2 10");
    const c51 = wb3.getWorksheet("NIIF S1 51");

    // GEI Alcance 1 de Materiales: Elementia 83,189.803 + Fortaleza 2,560,257. Sin fila de título: la 2.
    // Con perímetro declarado, la cifra lleva su perímetro DENTRO de la celda (decisión de Esteban del 26/10):
    // «2,643,446.803; perímetro: La cifra corresponde al perímetro de la división Materiales (…)».
    const celdaA1 = cellText(c1, "C2");
    ok(
      Math.abs(Number(celdaA1.split(";")[0].replace(/,/g, "")) - 2643446.803) < 0.01,
      `Alcance 1 2025 = suma real de Materiales (${celdaA1.split(";")[0]})`
    );
    ok(/; perímetro: .*división Materiales.*Elementia.*Fortaleza/i.test(celdaA1), `y su perímetro dentro de la respuesta («${celdaA1.slice(0, 90)}…»)`);
    // COMPARATIVO 2024: sigue sin cifra después del import del histórico, porque ninguno de los documentos
    // históricos cubre a Materiales (ver abajo). Desde el 26/10 la causa va como marcador EN la celda. La nota de
    // perímetro va dentro de la celda de la cifra (comprobado arriba), no en una nota.
    ok(/^Pendiente: cifra de 2024 — solicitud «/.test(cellText(c1, "D2")), "2024 con su marcador de pendiente en la celda: el histórico no cubre a Materiales");

    // Y se comprueba que la causa es esa y no que el histórico no corrió: el
    // reporte SÍ tiene capturas 2024, solo no en la solicitud del rubro.
    const { data: capsHist } = await client
      .from("capturas_valor")
      .select("periodo, solicitud:solicitudes!inner(reporte_id, rubro_taxonomia)")
      .eq("solicitud.reporte_id", repCarso.id)
      .in("periodo", ["2023", "2024"]);
    const hist = capsHist ?? [];
    if (hist.length === 0) {
      console.log(
        "  (histórico no importado: corre `node scripts/import-gcarso-historico.mjs` " +
          "para verificar también el comparativo)"
      );
    } else {
      ok(
        hist.filter((c) => c.periodo === "2024").length > 0,
        `el histórico dejó capturas 2024 en el reporte (${hist.filter((c) => c.periodo === "2024").length})`
      );
      ok(
        hist.filter((c) => c.periodo === "2023").length > 0,
        `y capturas 2023 con su año real, sin estirarlas a 2024 (${hist.filter((c) => c.periodo === "2023").length})`
      );
      ok(
        hist.every((c) => c.solicitud?.rubro_taxonomia == null),
        "ninguna de esas capturas se colgó de la solicitud que alimenta la plantilla oficial"
      );
    }
    // Rubros que el reporte de Carso no pide: causa propia, distinta.
    ok(
      cellText(c1, "C3") === "Pendiente: cifra de 2025 — sin solicitud en el reporte" &&
        cellText(c1, "C4") === "Pendiente: cifra de 2025 — sin solicitud en el reporte",
      "Alcances 2 y 3 con el marcador «sin solicitud en el reporte»"
    );

    // Contenido del informe: riesgos y objetivos reales de Carso.
    ok(
      /Eventos climáticos físicos/.test(cellText(c10, "A2")),
      `registro de clima real en S2 10 ("${cellText(c10, "A2").slice(0, 40)}…")`
    );
    ok(
      filaDe(c51, "Fortalecimiento de la gestión ambiental") > 0 || /Fortalecimiento de la gestión ambiental/.test(cellText(c51, "A2")),
      `objetivo real en S1 51 ("${cellText(c51, "A2").slice(0, 40)}…")`
    );

    const todoCarso = [];
    wb3.eachSheet((ws) =>
      ws.eachRow((row) =>
        row.eachCell((c) => {
          if (typeof c.value === "string") todoCarso.push(c.value);
        })
      )
    );
    const libroCarso = todoCarso.join(" | ");
    ok(!/\[DEMO\]/.test(libroCarso), "el libro de GCARSO NO lleva la marca [DEMO]");
    ok(
      !/Estrés hídrico en planta norte|Reducción absoluta de emisiones|15750/.test(libroCarso),
      "no se cuela ningún dato de Empresa Demo"
    );
    }
  }

  console.log(
    problemas.length === 0
      ? "\n✅ VERIFICACIÓN OK — export íntegro para Empresa Demo, un cliente nuevo y GCARSO."
      : `\n❌ ${problemas.length} problema(s):\n - ${problemas.join("\n - ")}`
  );
  process.exit(problemas.length === 0 ? 0 : 1);
}

// -----------------------------------------------------------------------------
// Fixture del segundo tenant. Se construye con la MISMA sesión de staff que usa
// la app (RLS incluido), no con service_role: si un staff no pudiera crearlo por
// la UI, la prueba no debería poder crearlo por atajo.
// -----------------------------------------------------------------------------
const FIXTURE = {
  slug: "verify-export-emisora",
  nombre: "Emisora de verificación (verify-export)",
  prefijo: "VXP",
  ejercicio: 2026,
  valor: 1234.5,
  /**
   * Valor del AÑO COMPARATIVO (ejercicio - 1). Existe para probar la columna que
   * el import del histórico viene a llenar: sin una captura validada del año
   * anterior, la celda del comparativo queda en blanco con su nota de brecha, y
   * el único modo de saber que se llena cuando SÍ la hay es probarlo.
   */
  valorComparativo: 987.65,
};

async function crearFixture(client, rastro = {}) {
  // Idempotencia: si quedó de una corrida interrumpida, se retira primero.
  const { data: previo } = await client
    .from("tenants")
    .select("id")
    .eq("slug", FIXTURE.slug)
    .maybeSingle();
  if (previo) await limpiarFixture(client, { tenantId: previo.id });

  const { data: tenant, error: tErr } = await client
    .from("tenants")
    .insert({
      nombre: FIXTURE.nombre,
      slug: FIXTURE.slug,
      prefijo_folio: FIXTURE.prefijo,
      activo: true,
      // El fixture lo construye una sesión de STAFF, y la evidencia que inserta
      // más abajo pasa por el gate de `staff_puede_cargar` (trigger
      // fn_evidencia_marca_carga). Encenderlo aquí es honesto: en este fixture la
      // carga la hace efectivamente IRStrat, y queda marcada como tal.
      staff_puede_cargar: true,
    })
    .select("id")
    .single();
  if (tErr) throw new Error(`no se pudo crear el tenant: ${tErr.message}`);
  rastro.tenantId = tenant.id;   // desde aquí, el finally ya puede limpiarlo

  const { data: reporte, error: rErr } = await client
    .from("reportes")
    .insert({
      tenant_id: tenant.id,
      nombre: "Informe Anual Sustentable (verificación)",
      ejercicio: FIXTURE.ejercicio,
      estado: "activo",
    })
    .select("id")
    .single();
  if (rErr) throw new Error(`no se pudo crear el reporte: ${rErr.message}`);

  // UNA solicitud GEI, con su rubro canónico: es lo único que este cliente pidió.
  const { data: solicitud, error: sErr } = await client
    .from("solicitudes")
    .insert({
      reporte_id: reporte.id,
      titulo: "Inventario GEI Alcance 1",
      area_asignada: "Operaciones",
      es_cuantitativa: true,
      unidad_esperada: "tCO2e",
      rubro_taxonomia: "gei_alcance_1",
      orden: 10,
    })
    .select("id")
    .single();
  if (sErr) throw new Error(`no se pudo crear la solicitud: ${sErr.message}`);

  const { data: perfil } = await client.auth.getUser();
  const staffId = perfil?.user?.id;

  const { data: evidencia, error: eErr } = await client
    .from("evidencias")
    .insert({
      solicitud_id: solicitud.id,
      archivo_path: `${tenant.id}/${solicitud.id}/inventario-gei.xlsx`,
      nombre_original: "inventario-gei.xlsx",
      periodo_cubierto: String(FIXTURE.ejercicio),
      area_origen: "Operaciones",
      subido_por: staffId,
    })
    .select("id")
    .single();
  if (eErr) throw new Error(`no se pudo crear la evidencia: ${eErr.message}`);

  const { error: cErr } = await client.from("capturas_valor").insert({
    solicitud_id: solicitud.id,
    evidencia_id: evidencia.id,
    valor: FIXTURE.valor,
    unidad: "tCO2e",
    periodo: String(FIXTURE.ejercicio),
    capturado_por: staffId,
    confirmado: true,
  });
  if (cErr) throw new Error(`no se pudo crear la captura: ${cErr.message}`);

  // Captura del AÑO COMPARATIVO, sobre la MISMA solicitud: es exactamente la
  // forma que tiene un histórico (mismo concepto, mismo perímetro, otro año), y
  // es lo que debe llenar la columna del año anterior en la plantilla oficial.
  const { error: cCompErr } = await client.from("capturas_valor").insert({
    solicitud_id: solicitud.id,
    evidencia_id: evidencia.id,
    valor: FIXTURE.valorComparativo,
    unidad: "tCO2e",
    periodo: String(FIXTURE.ejercicio - 1),
    capturado_por: staffId,
    confirmado: true,
    justificacion: "Comparativo del ejercicio anterior (histórico).",
  });
  if (cCompErr) throw new Error(`no se pudo crear la captura comparativa: ${cCompErr.message}`);

  // 'validado' AL FINAL: los triggers de Fase 2 reabren la solicitud en cada
  // inserción de evidencia/captura (mismo orden que usa el seed).
  const { error: vErr } = await client
    .from("solicitudes")
    .update({ estado: "validado" })
    .eq("id", solicitud.id);
  if (vErr) throw new Error(`no se pudo validar la solicitud: ${vErr.message}`);

  return { ...FIXTURE, tenantId: tenant.id, reporteId: reporte.id };
}

/** Borra el fixture. El reporte cascadea solicitudes, evidencias y capturas. */
async function limpiarFixture(client, fixture) {
  await client.from("reportes").delete().eq("tenant_id", fixture.tenantId);
  await client.from("areas_tenant").delete().eq("tenant_id", fixture.tenantId);
  await client.from("tenants").delete().eq("id", fixture.tenantId);
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
