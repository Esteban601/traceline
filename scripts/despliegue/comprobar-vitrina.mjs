#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Comprueba la vitrina del suplemento (Word y PDF) de un mockup, como staff, por
// la ruta del panel (paso 6 del encargo rol auditor, comprobaciones posteriores
// al release).
//
//   node scripts/despliegue/comprobar-vitrina.mjs <carpeta> <slug> [--credenciales <archivo>]
//
// Requiere BASE_URL (app local o la de staging) y, en el entorno,
// NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY del mismo proyecto.
//
// ESCRIBE dos filas de bitácora, y a propósito: cada descarga de la vitrina
// deja «suplemento_demo_descargado» en la bitácora del mockup (lo hace la ruta).
// De esas filas se lee de dónde salió cada archivo (bucket o repositorio) y si
// quedó algo sin sustituir. No escribe nada más.
//
// Afirma: 200 con el tipo correcto; el Word abre como zip y ya no dice «Empresa
// Demo» ni en el cuerpo ni en sus propiedades; el PDF empieza por %PDF; las dos
// filas de bitácora existen, con su origen y sin nombres sin sustituir.
// -----------------------------------------------------------------------------
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL || "http://localhost:3002";
const STAGING_APP = "https://traceline-staging-70ce5b369e7c.herokuapp.com";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const argv = process.argv.slice(2);
const iCred = argv.indexOf("--credenciales");
let passwordStaff = "Demo2025!";
if (iCred !== -1) {
  const archivo = argv[iCred + 1];
  argv.splice(iCred, 2);
  passwordStaff = JSON.parse(await fs.readFile(archivo, "utf8"))["analista@irstrat.example"]?.password;
  if (!passwordStaff) {
    console.error(`✗ ${archivo} no trae la contraseña de analista@irstrat.example.`);
    process.exit(2);
  }
}
const STAFF = { email: "analista@irstrat.example", password: passwordStaff };
const [carpeta, slug] = argv;

if (!carpeta || !slug || !URL_SB || !ANON) {
  console.error("Uso: node scripts/despliegue/comprobar-vitrina.mjs <carpeta> <slug> [--credenciales <archivo>]");
  process.exit(2);
}
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE) && BASE !== STAGING_APP) {
  console.error(`✗ BASE_URL debe ser una app local o ${STAGING_APP}, no ${BASE}.`);
  process.exit(2);
}

const problemas = [];
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) problemas.push(m); return c; };

const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { error: errLogin } = await db.auth.signInWithPassword(STAFF);
if (errLogin) throw new Error(`login staff: ${errLogin.message}`);

const { data: reps, error } = await db
  .from("reportes")
  .select("id, ejercicio, tenant:tenants!inner(slug, nombre, es_demo)")
  .eq("tenants.slug", slug);
if (error) throw new Error(`reportes: ${error.message}`);
if (reps?.length !== 1) { console.error(`✗ ${slug}: ${reps?.length ?? 0} reportes (se esperaba 1)`); process.exit(1); }
const rep = reps[0];
if (!rep.tenant.es_demo) { console.error(`✗ ${slug} no es de demostración; la vitrina es solo para mockups.`); process.exit(1); }
console.log(`Mockup: ${rep.tenant.nombre} (${slug}) · reporte ${rep.ejercicio} · ${BASE}`);

const nav = await chromium.launch();
const pagina = await (await nav.newContext()).newPage();
await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await pagina.fill('input[type="email"]', STAFF.email);
await pagina.fill('input[type="password"]', STAFF.password);
await Promise.all([
  pagina.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }),
  pagina.click('button[type="submit"]'),
]);
ok(new URL(pagina.url()).pathname === "/admin", `staff entra al panel: ${new URL(pagina.url()).pathname}`);

await fs.mkdir(carpeta, { recursive: true });
const desde = new Date().toISOString();

for (const formato of ["docx", "pdf"]) {
  const resp = await pagina.request.get(
    `${BASE}/admin/cobertura/suplemento-demo?reporte=${rep.id}&formato=${formato}`,
    { timeout: 120000 }
  );
  const tipo = resp.headers()["content-type"] ?? "";
  const cuerpo = await resp.body();
  if (!ok(resp.status() === 200, `${formato}: ${resp.status()} · ${tipo} · ${cuerpo.length} bytes`)) continue;
  await fs.writeFile(path.join(carpeta, `vitrina-${slug}.${formato}`), cuerpo);

  if (formato === "docx") {
    const zip = await JSZip.loadAsync(cuerpo).catch(() => null);
    if (!ok(!!zip, "docx: abre como zip")) continue;
    for (const parte of ["word/document.xml", "docProps/core.xml"]) {
      const xml = (await zip.file(parte)?.async("string")) ?? "";
      ok(xml.length > 0 && !xml.includes("Empresa Demo"), `docx: ${parte} sin «Empresa Demo»`);
    }
  } else {
    ok(cuerpo.subarray(0, 4).toString() === "%PDF", "pdf: empieza por %PDF");
  }
}
await nav.close();

const { data: filas } = await db
  .from("bitacora")
  .select("created_at, detalle")
  .eq("entidad_id", rep.id)
  .eq("accion", "suplemento_demo_descargado")
  .gte("created_at", desde)
  .order("created_at", { ascending: true });
ok((filas?.length ?? 0) === 2, `bitácora: ${filas?.length ?? 0} filas nuevas «suplemento_demo_descargado» (se esperan 2)`);
for (const f of filas ?? []) {
  const d = f.detalle ?? {};
  console.log(`    · ${f.created_at} · ${d.formato} · origen ${d.origen} · sin sustituir: ${JSON.stringify(d.sin_sustituir)}`);
  ok(!d.sin_sustituir, `${d.formato}: nada quedó sin sustituir`);
}
await db.auth.signOut();

console.log(`\n════════ RESULTADO ════════\n  ${problemas.length === 0 ? "Todo verde." : `${problemas.length} problema(s):`}`);
for (const p of problemas) console.log(`   · ${p}`);
process.exit(problemas.length === 0 ? 0 : 1);
