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
//     un cuestionario a medias muestra 'Pendiente en plataforma' en las preguntas
//     sin responder.
//
// Requiere el server corriendo (pnpm dev o pnpm start) y Supabase local con el
// seed aplicado (supabase db reset). Uso:
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
    "NIIF S2 29(b)",
    "NIIF S2 30",
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
  const s29b = wb.getWorksheet("NIIF S2 29(b)");
  const s30 = wb.getWorksheet("NIIF S2 30");
  const s29d = wb.getWorksheet("NIIF S2 29(d)");

  console.log("\nGEI 29(a)(i) — nota por celda-año (año validado y lleno + año sin evidencia):");
  ok(cellText(gei1, "A3") === "Alcance 1", "A3 = 'Alcance 1'");
  // Alcance 1: 2025 VALIDADO y lleno (400,000), 2024 SIN captura → celda vacía.
  ok(Number(cellText(gei1, "C3")) === 400000, "C3 (Alcance 1, 2025 validado) = 400000");
  ok(cellText(gei1, "D3") === "", "D3 (Alcance 1, 2024 sin captura) VACÍA");
  ok(
    cellText(gei1, "E3") === "Sin evidencia (2024)",
    "E3 nota = 'Sin evidencia (2024)' (NO 'pendiente': nada está por validar)"
  );
  // Alcance 2: ambos años validados y llenos → la celda de notas queda VACÍA.
  ok(
    Number(cellText(gei1, "C4")) > 0 &&
      Number(cellText(gei1, "D4")) > 0 &&
      cellText(gei1, "E4") === "",
    "Alcance 2 completo (2024+2025) → nota de fila VACÍA"
  );

  // El origen de TODAS las solicitudes del demo es 'irstrat' (backfill de la
  // migración), así que ninguna nota lleva la salvedad de validación interna. Si
  // apareciera, el rol admin-cliente habría cambiado el entregable de referencia.
  {
    const notasDemo = [];
    wb.eachSheet((ws) =>
      ws.eachRow((row) =>
        row.eachCell((c) => {
          if (typeof c.value === "string") notasDemo.push(c.value);
        })
      )
    );
    ok(
      !notasDemo.some((t) => t.includes("validación interna del cliente")),
      "ninguna celda del demo lleva '(validación interna del cliente)': sus validaciones son todas de IRStrat"
    );
  }

  console.log("\nGEI 29(a)(vi)(1) — causas por año (pendiente vs sin evidencia):");
  ok(Number(cellText(geiVi, "B4")) > 0, "B4 (Categoría 1, 2025) tiene número");
  let hayPend = false;
  let haySin = false;
  for (let r = 4; r <= 18; r++) {
    const d = cellText(geiVi, `D${r}`);
    if (/^Pendiente de validación en plataforma \(20\d\d\)/.test(d)) hayPend = true;
    if (/Sin evidencia \(20\d\d\)/.test(d)) haySin = true;
  }
  ok(hayPend, "alguna categoría con captura sin validar → 'Pendiente de validación en plataforma (AAAA)'");
  ok(haySin, "alguna categoría sin captura → 'Sin evidencia (AAAA)'");

  console.log("\nRegistros de clima (v2: horizonte multi + capital en tres):");
  ok(cellText(s10, "A4").length > 0, "S2 10: A4 tiene un riesgo");
  ok(cellText(s10, "C4").length > 0, "S2 10: C4 tiene tipo");
  // Horizonte multi-enum: el primer riesgo cubre varios plazos (lista con '; ').
  ok(
    cellText(s10, "D4").includes("Corto plazo") && cellText(s10, "D4").includes("Mediano plazo"),
    "S2 10: D4 lista varios horizontes"
  );
  ok(cellText(s29b, "A5").length > 0, "S2 29(b): A5 tiene riesgo físico");
  ok(
    cellText(s29b, "B5").includes("Corto plazo") && cellText(s29b, "B5").includes("Mediano plazo"),
    "S2 29(b): B5 lista varios horizontes"
  );
  ok(Number(cellText(s29b, "C5")) > 0, "S2 29(b): C5 (cantidad 2025) tiene número");
  // Despliegue de capital en 3 sub-filas (etiqueta E + valor F), bloque del 1er registro.
  ok(
    cellText(s29b, "E5") === "Cantidad de gasto de capital",
    "S2 29(b): E5 = 'Cantidad de gasto de capital'"
  );
  ok(Number(cellText(s29b, "F5")) > 0, "S2 29(b): F5 (gasto de capital 2025) tiene número");
  ok(
    cellText(s29b, "E6") === "Cantidad de financiación",
    "S2 29(b): E6 = 'Cantidad de financiación' (sub-fila 2)"
  );
  ok(
    cellText(s29b, "E7") === "Cantidad de inversión",
    "S2 29(b): E7 = 'Cantidad de inversión' (sub-fila 3)"
  );
  ok(cellText(s30, "A5").length > 0, "S2 30: A5 tiene riesgo de transición");
  ok(cellText(s29d, "A5").length > 0, "S2 29(d): A5 tiene oportunidad");

  // Regla dura registros: la oportunidad sin valores muestra 'Sin datos del ejercicio'.
  // Con bloques de 3 filas, la brecha va en la fila de inicio del bloque (col C).
  let sinDatos = false;
  for (let r = 5; r <= 20; r++) {
    if (cellText(s29d, `C${r}`) === "Sin datos del ejercicio") sinDatos = true;
  }
  ok(sinDatos, "S2 29(d): al menos un registro con 'Sin datos del ejercicio'");

  // ---------------------------------------------------------------------------
  // Objetivos (Sprint 3) — 5 hojas: S1 51 + S2 33/34/35/36(a)-(d).
  // ---------------------------------------------------------------------------
  const s51 = wb.getWorksheet("NIIF S1 51");
  const s33 = wb.getWorksheet("NIIF S2 33");
  const s34 = wb.getWorksheet("NIIF S2 34");
  const s35 = wb.getWorksheet("NIIF S2 35");
  const s36 = wb.getWorksheet("NIIF S2 36(a)-(d)");
  const NOTA_SEC = "Sección pendiente en plataforma";

  console.log("\nObjetivos — S2 33 (definición climática, tipos oficiales):");
  ok(cellText(s33, "A3").length > 0, "S2 33: A3 tiene un objetivo climático");
  ok(
    cellText(s33, "B3") === "Objetivo de emisiones de gases de efecto invernadero",
    "S2 33: B3 (tipo) = 'Objetivo de emisiones de gases de efecto invernadero'"
  );
  ok(cellText(s33, "I3") === "Absoluto", "S2 33: I3 (tipo de objetivo) = 'Absoluto'");
  ok(cellText(s33, "I4") === "De intensidad", "S2 33: I4 (tipo de objetivo) = 'De intensidad'");

  console.log("\nObjetivos — trazabilidad + tipos oficiales S2 34/36:");
  const a3 = cellText(s33, "A3");
  ok(
    a3.length > 0 &&
      cellText(s34, "A3") === a3 &&
      cellText(s35, "A3") === a3 &&
      cellText(s36, "A3") === a3,
    "el objetivo de la fila 3 es el mismo en S2 33/34/35/36"
  );
  ok(cellText(s34, "B3") === "Verdadero", "S2 34: B3 (validación por tercero) = 'Verdadero' (booleano)");
  ok(cellText(s35, "B3").length > 0, "S2 35: B3 (resultados) del objetivo completo lleno");
  ok(
    cellText(s36, "B3").includes("Dióxido de carbono (CO2)"),
    "S2 36: B3 (gases) lista los gases oficiales (multi-enum)"
  );
  ok(cellText(s36, "C3") === "Alcance 1; Alcance 2", "S2 36: C3 (alcances) = 'Alcance 1; Alcance 2'");
  ok(
    cellText(s36, "D3") === "Emisiones brutas de gases de efecto invernadero",
    "S2 36: D3 (bruto/neto) usa el valor oficial completo"
  );
  ok(cellText(s36, "E3") === "Falso", "S2 36: E3 (enfoque descarbonización) = 'Falso' (booleano)");

  console.log("\nObjetivos — brecha 'Sección pendiente' (objetivo climático incompleto):");
  // El objetivo sin ficha (energía renovable, fila 5) marca la brecha en cada hoja hermana.
  ok(cellText(s34, "F5") === NOTA_SEC, "S2 34: F5 = 'Sección pendiente en plataforma'");
  ok(cellText(s35, "D5") === NOTA_SEC, "S2 35: D5 = 'Sección pendiente en plataforma'");
  ok(cellText(s36, "F5") === NOTA_SEC, "S2 36: F5 = 'Sección pendiente en plataforma'");

  console.log("\nObjetivos — S1 51 (secciones Riesgos / Oportunidades):");
  ok(cellText(s51, "A4").length > 0, "S1 51: A4 tiene un objetivo en la sección Riesgos");
  ok(cellText(s51, "H4").length > 0, "S1 51: H4 (resultados/tendencias) del primer objetivo");
  let hayOportunidad = false;
  for (let r = 14; r <= 18; r++) if (cellText(s51, `A${r}`).length > 0) hayOportunidad = true;
  ok(hayOportunidad, "S1 51: la sección Oportunidades (filas 14-18) tiene al menos un objetivo");

  // ---------------------------------------------------------------------------
  // Cuestionarios narrativos (Sprint 4) — 3 hojas: 22(b)(i)/(ii) y 36(e).
  // ---------------------------------------------------------------------------
  const c22bi = wb.getWorksheet("NIIF S2 22(b)(i)");
  const c22bii = wb.getWorksheet("NIIF S2 22(b)(ii)");
  const c36e = wb.getWorksheet("NIIF S2 36(e)(i)-(iv)");
  const PEND = "Pendiente en plataforma";

  console.log("\nCuestionarios — S2 22(b)(i) (completo 8/8; booleano + enumeración):");
  ok(
    cellText(c22bi, "A3").includes("cómo y cuándo"),
    "S2 22(b)(i): A3 = pregunta inicial 'cómo y cuándo'"
  );
  ok(cellText(c22bi, "B3").length > 0, "S2 22(b)(i): B3 tiene respuesta");
  ok(cellText(c22bi, "B5") === "Verdadero", "S2 22(b)(i): B5 (booleano) = 'Verdadero'");
  ok(cellText(c22bi, "C5") === "Booleano", "S2 22(b)(i): C5 (tipo de dato) = 'Booleano'");
  ok(
    cellText(c22bi, "B6").includes("Riesgos físicos") &&
      cellText(c22bi, "B6").includes("Riesgos de transición"),
    "S2 22(b)(i): B6 (enumeración) lista ambos tipos de riesgo"
  );
  ok(cellText(c22bi, "C6") === "Enumeración", "S2 22(b)(i): C6 (tipo de dato) = 'Enumeración'");
  ok(
    cellText(c22bi, "B9") === "Corto plazo; Mediano plazo; Largo plazo",
    "S2 22(b)(i): B9 (horizontes) = enumeración de los 3 plazos"
  );
  ok(
    cellText(c22bi, "A10").includes("(por ejemplo") && cellText(c22bi, "B10").length > 0,
    "S2 22(b)(i): A10 (alcance) incluye el ejemplo oficial y B10 tiene respuesta"
  );
  let pendBi = false;
  for (let r = 3; r <= 10; r++) if (cellText(c22bi, `D${r}`) === PEND) pendBi = true;
  ok(!pendBi, "S2 22(b)(i): sin brechas 'Pendiente en plataforma' (completo 8/8)");

  console.log("\nCuestionarios — S2 22(b)(ii) (a medias 4/6, muestra brechas):");
  ok(cellText(c22bii, "B3").length > 0, "S2 22(b)(ii): B3 tiene respuesta");
  ok(
    cellText(c22bii, "A5").includes("patrones climáticos locales"),
    "S2 22(b)(ii): A5 (variables) incluye los ejemplos oficiales"
  );
  ok(
    cellText(c22bii, "D7") === PEND && cellText(c22bii, "D8") === PEND,
    "S2 22(b)(ii): D7 y D8 (preguntas 5 y 6) = 'Pendiente en plataforma'"
  );
  ok(cellText(c22bii, "B7") === "", "S2 22(b)(ii): B7 (pregunta 5 sin responder) VACÍA");

  console.log("\nCuestionarios — S2 36(e) (2 de 5; P3/P4 enum único, P5 con ejemplo):");
  ok(cellText(c36e, "A3").length > 0, "S2 36(e): A3 conserva la pregunta impresa");
  ok(cellText(c36e, "B3").length > 0, "S2 36(e): B3 tiene respuesta");
  ok(
    cellText(c36e, "C5") === "Enumeración",
    "S2 36(e): C5 (P3 tipo de dato) = 'Enumeración'"
  );
  ok(
    cellText(c36e, "A7").includes("permanencia de la compensación de carbono"),
    "S2 36(e): A7 (P5) incluye el ejemplo oficial"
  );
  ok(
    cellText(c36e, "D5") === PEND &&
      cellText(c36e, "D6") === PEND &&
      cellText(c36e, "D7") === PEND,
    "S2 36(e): D5-D7 (preguntas 3-5 sin responder) = 'Pendiente en plataforma'"
  );

  // Pie [DEMO] en las hojas llenadas.
  const conPie = hojas.filter((h) => {
    const ws = wb.getWorksheet(h);
    for (let r = 1; r <= (ws.rowCount || 0) + 3; r++) {
      if (cellText(ws, `A${r}`).includes("[DEMO]")) return true;
    }
    return false;
  });
  ok(conPie.length === 14, `pie [DEMO] en las 14 hojas (encontrado en ${conPie.length})`);

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

      // Las etiquetas son de la PLANTILLA: no dependen del cliente.
      ok(cellText(g1, "A3") === "Alcance 1", "etiqueta A3 = 'Alcance 1' (viene del mapeo)");
      ok(
        cellText(gVi, "A8") === "Categoría 5-Residuos generados en las operaciones",
        "etiqueta de la categoría 5 escrita desde el catálogo de rubros"
      );

      // Su ÚNICA solicitud validada llena su celda del ejercicio del reporte.
      ok(
        Number(cellText(g1, "C3")) === 1234.5,
        `C3 (Alcance 1, ${fixture.ejercicio} validado) = 1234.5 — año RELATIVO resuelto`
      );
      // El año anterior no tiene captura: hueco por 'Sin evidencia', no por otra causa.
      ok(cellText(g1, "D3") === "", `D3 (Alcance 1, ${fixture.ejercicio - 1}) VACÍA`);
      ok(
        cellText(g1, "E3") === `Sin evidencia (${fixture.ejercicio - 1})`,
        `E3 = 'Sin evidencia (${fixture.ejercicio - 1})'`
      );

      // Rubros mapeados que este reporte NO pide: causa NUEVA y distinta.
      ok(
        cellText(g1, "C4") === "" && cellText(g1, "E4") === "Sin solicitud en el reporte",
        "Alcance 2 sin solicitud → celda vacía y nota 'Sin solicitud en el reporte'"
      );
      ok(
        cellText(gVi, "D4") === "Sin solicitud en el reporte" &&
          cellText(gVi, "D18") === "Sin solicitud en el reporte",
        "las 15 categorías de Alcance 3 marcan 'Sin solicitud en el reporte'"
      );

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

    // GEI Alcance 1 de Materiales: Elementia 83,189.803 + Fortaleza 2,560,257.
    ok(
      Math.abs(Number(cellText(c1, "C3")) - 2643446.803) < 0.01,
      `Alcance 1 2025 = suma real de Materiales (${cellText(c1, "C3")})`
    );
    ok(
      cellText(c1, "D3") === "" && cellText(c1, "E3") === "Sin evidencia (2024)",
      "2024 vacío con su causa: el proceso real no entregó comparativo"
    );
    // Rubros que el reporte de Carso no pide: causa propia, distinta.
    ok(
      cellText(c1, "E4") === "Sin solicitud en el reporte" &&
        cellText(c1, "E5") === "Sin solicitud en el reporte",
      "Alcances 2 y 3 marcan 'Sin solicitud en el reporte'"
    );

    // Contenido del informe: riesgos y objetivos reales de Carso.
    ok(
      /Eventos climáticos físicos/.test(cellText(c10, "A4")),
      `registro de clima real en S2 10 ("${cellText(c10, "A4").slice(0, 40)}…")`
    );
    ok(
      /Fortalecimiento de la gestión ambiental/.test(cellText(c51, "A4")),
      `objetivo real en S1 51 ("${cellText(c51, "A4").slice(0, 40)}…")`
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
