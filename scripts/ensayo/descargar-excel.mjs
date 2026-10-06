#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Descarga el Excel de taxonomía de varias emisoras por la ruta del panel, con
// una sesión de staff (pasos 4b y 4e del encargo rol auditor).
//
//   node scripts/ensayo/descargar-excel.mjs <carpeta> <slug> [<slug> ...]
//
// Requiere la app corriendo (BASE_URL, por omisión http://localhost:3002) y,
// en el entorno, NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY del
// mismo proyecto al que apunta la app. Entra como el analista del seed, resuelve
// el reporte de cada slug con esa misma sesión y guarda <carpeta>/<slug>.xlsx.
// Solo lee: la ruta de exportación no escribe nada para el staff.
// -----------------------------------------------------------------------------
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL || "http://localhost:3002";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// La app de staging es el único destino no local admitido: el paso 5 descarga
// ahí la línea base y la comprobación después del release.
const STAGING_APP = "https://traceline-staging-70ce5b369e7c.herokuapp.com";
// Y la app de ensayo, con el código de `dev` contra la base de ensayo (Paso 4 del
// encargo generador a producción).
const ENSAYO_APP = "https://traceline-dev-d4fd7a3cda04.herokuapp.com";

// --credenciales <archivo>: la contraseña del analista sale del archivo que deja
// scripts/despliegue/rotar-cuentas-seed.mjs (después de rotar ya no es la del
// seed). No se imprime.
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

const [carpeta, ...slugs] = argv;
if (!carpeta || slugs.length === 0 || !URL_SB || !ANON) {
  console.error("Uso: node scripts/ensayo/descargar-excel.mjs <carpeta> <slug> [<slug> ...]");
  console.error("     con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");
  process.exit(2);
}
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE) && BASE !== STAGING_APP && BASE !== ENSAYO_APP) {
  console.error(`✗ BASE_URL debe ser una app local, ${STAGING_APP} o ${ENSAYO_APP}, no ${BASE}.`);
  process.exit(2);
}

const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { error: errLogin } = await db.auth.signInWithPassword(STAFF);
if (errLogin) throw new Error(`login staff: ${errLogin.message}`);

const { data: filas, error } = await db
  .from("reportes")
  .select("id, ejercicio, tenant:tenants!inner(slug)")
  .in("tenants.slug", slugs);
if (error) throw new Error(`reportes: ${error.message}`);

const nav = await chromium.launch();
const pagina = await (await nav.newContext()).newPage();
await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await pagina.fill('input[type="email"]', STAFF.email);
await pagina.fill('input[type="password"]', STAFF.password);
await Promise.all([
  pagina.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }),
  pagina.click('button[type="submit"]'),
]);

await fs.mkdir(carpeta, { recursive: true });
let fallas = 0;
for (const slug of slugs) {
  const reportes = (filas ?? []).filter((f) => f.tenant.slug === slug);
  if (reportes.length !== 1) {
    console.log(`✗ ${slug}: ${reportes.length} reportes (se esperaba 1)`);
    fallas++;
    continue;
  }
  const resp = await pagina.request.get(
    `${BASE}/admin/cobertura/export-taxonomia?reporte=${reportes[0].id}`,
    { timeout: 180000 }
  );
  const tipo = resp.headers()["content-type"] ?? "";
  if (resp.status() !== 200 || !tipo.includes("spreadsheet")) {
    console.log(`✗ ${slug}: ${resp.status()} ${tipo}`);
    fallas++;
    continue;
  }
  const destino = path.join(carpeta, `${slug}.xlsx`);
  await fs.writeFile(destino, await resp.body());
  console.log(`✓ ${slug}: reporte ${reportes[0].ejercicio} → ${destino}`);
}
await nav.close();
process.exit(fallas === 0 ? 0 : 1);
