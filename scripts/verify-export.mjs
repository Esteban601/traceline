#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Verificación end-to-end del export de taxonomía por la RUTA HTTP autenticada.
//
// Forja una sesión de admin con @supabase/ssr (las mismas cookies que pondría el
// navegador), invoca /admin/cobertura/export-taxonomia y valida:
//   · HTTP 200 + content-type xlsx
//   · las 11 hojas llenadas (2 GEI + 4 de registros de clima + 5 de objetivos)
//   · las REGLAS DURAS: una celda de dato NO validado queda vacía y su fila lleva
//     la nota de brecha correspondiente; un objetivo se puede seguir a través de
//     las 4 hojas S2 33-36 y sus secciones vacías marcan 'Sección pendiente'.
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
  ];
  console.log("\nHojas presentes:");
  for (const h of hojas) ok(!!wb.getWorksheet(h), `hoja "${h}" existe`);

  const gei1 = wb.getWorksheet("NIIF S2 29(a)(i)");
  const geiVi = wb.getWorksheet("NIIF S2 29(a)(vi)(1)");
  const s10 = wb.getWorksheet("NIIF S2 10");
  const s29b = wb.getWorksheet("NIIF S2 29(b)");
  const s30 = wb.getWorksheet("NIIF S2 30");
  const s29d = wb.getWorksheet("NIIF S2 29(d)");

  console.log("\nGEI 29(a)(i) — llenado y regla dura:");
  ok(cellText(gei1, "A3") === "Alcance 1", "A3 = 'Alcance 1'");
  ok(Number(cellText(gei1, "C4")) > 0, "C4 (Alcance 2, 2025) tiene número");
  ok(cellText(gei1, "C3") === "", "C3 (Alcance 1, no validado) VACÍA (regla dura)");
  ok(
    cellText(gei1, "E3") === "Pendiente de validación en plataforma",
    "E3 nota 'Pendiente de validación en plataforma'"
  );

  console.log("\nGEI 29(a)(vi)(1) — llenado y brechas:");
  ok(Number(cellText(geiVi, "B4")) > 0, "B4 (Categoría 1, 2025) tiene número");
  ok(
    cellText(geiVi, "D12") === "Sin evidencia" ||
      cellText(geiVi, "D12") === "Pendiente de validación en plataforma",
    "D12 (categoría sin validar) tiene nota de brecha"
  );

  console.log("\nRegistros de clima:");
  ok(cellText(s10, "A4").length > 0, "S2 10: A4 tiene un riesgo");
  ok(cellText(s10, "C4").length > 0, "S2 10: C4 tiene tipo");
  ok(cellText(s29b, "A5").length > 0, "S2 29(b): A5 tiene riesgo físico");
  ok(Number(cellText(s29b, "C5")) > 0, "S2 29(b): C5 (cantidad 2025) tiene número");
  ok(cellText(s30, "A5").length > 0, "S2 30: A5 tiene riesgo de transición");
  ok(cellText(s29d, "A5").length > 0, "S2 29(d): A5 tiene oportunidad");

  // Regla dura registros: la oportunidad sin valores muestra 'Sin datos del ejercicio'.
  let sinDatos = false;
  for (let r = 5; r <= 20; r++) {
    if (cellText(s29d, `C${r}`) === "Sin datos del ejercicio") sinDatos = true;
  }
  ok(sinDatos, "S2 29(d): al menos una fila con 'Sin datos del ejercicio'");

  // ---------------------------------------------------------------------------
  // Objetivos (Sprint 3) — 5 hojas: S1 51 + S2 33/34/35/36(a)-(d).
  // ---------------------------------------------------------------------------
  const s51 = wb.getWorksheet("NIIF S1 51");
  const s33 = wb.getWorksheet("NIIF S2 33");
  const s34 = wb.getWorksheet("NIIF S2 34");
  const s35 = wb.getWorksheet("NIIF S2 35");
  const s36 = wb.getWorksheet("NIIF S2 36(a)-(d)");
  const NOTA_SEC = "Sección pendiente en plataforma";

  console.log("\nObjetivos — S2 33 (definición climática):");
  ok(cellText(s33, "A3").length > 0, "S2 33: A3 tiene un objetivo climático");
  ok(cellText(s33, "I3") === "Absoluto", "S2 33: I3 (tipo de objetivo) = 'Absoluto'");
  ok(cellText(s33, "I4") === "De intensidad", "S2 33: I4 (tipo de objetivo) = 'De intensidad'");

  console.log("\nObjetivos — trazabilidad de un objetivo a través de S2 33-36:");
  const a3 = cellText(s33, "A3");
  ok(
    a3.length > 0 &&
      cellText(s34, "A3") === a3 &&
      cellText(s35, "A3") === a3 &&
      cellText(s36, "A3") === a3,
    "el objetivo de la fila 3 es el mismo en S2 33/34/35/36"
  );
  ok(cellText(s34, "B3").length > 0, "S2 34: B3 (validación) del objetivo completo lleno");
  ok(cellText(s35, "B3").length > 0, "S2 35: B3 (resultados) del objetivo completo lleno");
  ok(cellText(s36, "B3").length > 0, "S2 36: B3 (gases cubiertos) del objetivo completo lleno");

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

  // Pie [DEMO] en las hojas llenadas.
  const conPie = hojas.filter((h) => {
    const ws = wb.getWorksheet(h);
    for (let r = 1; r <= (ws.rowCount || 0) + 3; r++) {
      if (cellText(ws, `A${r}`).includes("[DEMO]")) return true;
    }
    return false;
  });
  ok(conPie.length === 11, `pie [DEMO] en las 11 hojas (encontrado en ${conPie.length})`);

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
