#!/usr/bin/env node
// =============================================================================
// COMPROBACIONES DE v33 SOBRE STAGING (encargo 2026-10-05-generador-a-produccion,
// guion v33 en §5.2). También corre contra ensayo, para probarlo antes.
//
//   (set -a; source .env.staging.local; set +a; \
//    BASE_URL=https://traceline-staging-70ce5b369e7c.herokuapp.com \
//    node <rama>/scripts/despliegue/comprobar-v33.mjs <modo> --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json)
//
// desde la copia del repositorio que tiene .env.staging.local y .credenciales-demo.
// Usa la sesión del analista de IRStrat (contraseña del archivo, no se imprime).
//
// Modos:
//   --antes <carpeta>     ANTES de migrar. Solo lee. Guarda <carpeta>/vitrina.json
//                         (vitrina por emisora), para comprobar después que las
//                         emisoras de demostración la conservan.
//   --despues <carpeta>   DESPUÉS del release. Solo lee. Afirma las banderas de §3
//                         por consulta (vitrina igual que antes salvo Grupo Carso,
//                         apagada; generador y lectura encendidos en demo y
//                         apagados en Grupo Carso; topes 10 y 500), el año de
//                         adopción (demo con año, Grupo Carso sin él), y guarda
//                         <carpeta>/catalogo.json para comparar-excel-v33.mjs.
//   --generar             ESCRIBE: POST …/generar del reporte de Empresa Demo por
//                         la app (BASE_URL) → se espera 200. Abre el documento con
//                         sus bloques en cola, sin llamar al modelo (los bloques
//                         los pide la pantalla), y cuenta 1 corrida del tope del mes.
// =============================================================================
import fs from "node:fs/promises";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";

const REFS = { ewgnvjtjhvdltvkopptn: "staging", sqpxcxewoznhpwvhxamy: "ensayo" };
const APPS = {
  staging: "https://traceline-staging-70ce5b369e7c.herokuapp.com",
  ensayo: "https://traceline-dev-d4fd7a3cda04.herokuapp.com",
};
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const SLUG_CARSO = "gcarso";

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); if (i === -1) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const bandera = (n) => { const i = argv.indexOf(n); if (i === -1) return false; argv.splice(i, 1); return true; };
const credArch = opcion("--credenciales");
const carpetaAntes = opcion("--antes");
const carpetaDespues = opcion("--despues");
const generar = bandera("--generar");

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ambiente = Object.entries(REFS).find(([ref]) => URL_SB.includes(ref))?.[1];
const BASE = process.env.BASE_URL;
if (!ambiente || !ANON || !credArch || (!carpetaAntes && !carpetaDespues && !generar)) {
  console.error("Uso: comprobar-v33.mjs (--antes <dir> | --despues <dir> | --generar) --credenciales <archivo>");
  console.error("     con NEXT_PUBLIC_SUPABASE_URL (staging o ensayo) y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(2);
}
if (generar && BASE !== APPS[ambiente]) {
  console.error(`✗ Con --generar, BASE_URL debe ser la app de ${ambiente}: ${APPS[ambiente]}.`);
  process.exit(2);
}
const password = JSON.parse(await fs.readFile(credArch, "utf8"))["analista@irstrat.example"]?.password;
if (!password) { console.error(`✗ ${credArch} no trae la contraseña del analista.`); process.exit(2); }

const jar = new Map();
const db = createServerClient(URL_SB, ANON, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) },
});
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }
console.log(`Ambiente: ${ambiente}`);

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };

if (carpetaAntes) {
  const { data, error } = await db.from("tenants").select("slug, vitrina_habilitada").order("slug");
  if (error) throw new Error(error.message);
  await fs.mkdir(carpetaAntes, { recursive: true });
  const destino = path.join(carpetaAntes, "vitrina.json");
  await fs.writeFile(destino, JSON.stringify(Object.fromEntries(data.map((t) => [t.slug, t.vitrina_habilitada])), null, 2));
  console.log(`  ✓ vitrina de ${data.length} emisoras → ${destino} (${data.filter((t) => !t.vitrina_habilitada).map((t) => t.slug).join(", ") || "ninguna"} apagada)`);
}

if (carpetaDespues) {
  const antes = JSON.parse(await fs.readFile(path.join(carpetaDespues, "..", "antes", "vitrina.json"), "utf8"));
  const { data: ts, error } = await db.from("tenants")
    .select("id, slug, es_demo, vitrina_habilitada, generador_activo, generaciones_mes_max, lectura_evidencias_activa, lecturas_mes_max")
    .order("slug");
  if (error) throw new Error(error.message);
  console.log(`\nBanderas (§3) · ${ts.length} emisoras`);
  for (const t of ts) {
    const carso = t.slug === SLUG_CARSO;
    const vitrinaEsperada = carso ? false : antes[t.slug];
    const bien =
      t.vitrina_habilitada === vitrinaEsperada &&
      t.generador_activo === t.es_demo && t.lectura_evidencias_activa === t.es_demo &&
      t.generaciones_mes_max === 10 && t.lecturas_mes_max === 500 &&
      (carso ? !t.es_demo : true);
    ok(bien, `${t.slug.padEnd(24)} ${t.es_demo ? "demo" : "REAL"} · vitrina ${t.vitrina_habilitada ? "on " : "off"} · generador ${t.generador_activo ? "on " : "off"} (${t.generaciones_mes_max}/mes) · lectura ${t.lectura_evidencias_activa ? "on " : "off"} (${t.lecturas_mes_max}/mes)`);
  }
  ok(ts.some((t) => t.slug === SLUG_CARSO), "Grupo Carso está en la lista");

  console.log("\nAño de adopción de los reportes");
  const { data: rs, error: eR } = await db.from("reportes").select("tenant_id, ejercicio, anio_adopcion");
  if (eR) throw new Error(eR.message);
  const demo = new Map(ts.map((t) => [t.id, t.es_demo]));
  const demoSinAnio = rs.filter((r) => demo.get(r.tenant_id) && r.anio_adopcion == null).length;
  const realConAnio = rs.filter((r) => !demo.get(r.tenant_id) && r.anio_adopcion != null).length;
  ok(demoSinAnio === 0, `reportes de demostración sin año: ${demoSinAnio}`);
  ok(realConAnio === 0, `reportes de emisoras reales con año puesto por la migración: ${realConAnio}`);

  const { data: cat, error: eC } = await db.from("datapoints_taxonomia").select("codigo, descripcion").eq("activo", true);
  if (eC) throw new Error(eC.message);
  await fs.mkdir(carpetaDespues, { recursive: true });
  const destino = path.join(carpetaDespues, "catalogo.json");
  await fs.writeFile(destino, JSON.stringify(Object.fromEntries(cat.map((d) => [d.codigo.trim(), d.descripcion]))));
  ok(cat.length > 0, `catálogo activo (${cat.length} códigos) → ${destino}`);
}

if (generar) {
  console.log("\nGenerador de Empresa Demo (escribe)");
  const cookie = [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  const r = await fetch(`${BASE}/api/suplemento/${REPORTE_DEMO}/generar`, { method: "POST", headers: { cookie, "content-type": "application/json" }, redirect: "manual" });
  const cuerpo = await r.json().catch(() => ({}));
  ok(r.status === 200, `POST generar → ${r.status}${cuerpo.error ? ` «${cuerpo.error}»` : ""}`);
}

await db.auth.signOut();
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ Todo verde.");
process.exit(fallas.length ? 1 : 0);
