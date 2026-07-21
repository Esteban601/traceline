#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Verificación end-to-end del export de taxonomía por la RUTA HTTP autenticada.
//
// Forja una sesión de admin con @supabase/ssr (las mismas cookies que pondría el
// navegador), invoca /admin/cobertura/export-taxonomia y valida:
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

  // 2. Invocar la ruta del export.
  console.log(`\nGET ${BASE_URL}/admin/cobertura/export-taxonomia`);
  const res = await fetch(`${BASE_URL}/admin/cobertura/export-taxonomia`, {
    headers: { cookie },
    redirect: "manual",
  });
  ok(res.status === 200, `HTTP 200 (recibido ${res.status})`);
  const ct = res.headers.get("content-type") || "";
  ok(ct.includes("spreadsheetml"), `content-type xlsx (${ct.slice(0, 40)})`);
  if (res.status !== 200) {
    console.error("Cuerpo:", (await res.text()).slice(0, 300));
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
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

  console.log(
    problemas.length === 0
      ? "\n✅ VERIFICACIÓN OK — export íntegro por la ruta HTTP autenticada."
      : `\n❌ ${problemas.length} problema(s):\n - ${problemas.join("\n - ")}`
  );
  process.exit(problemas.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
