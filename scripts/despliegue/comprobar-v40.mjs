#!/usr/bin/env node
// =============================================================================
// COMPROBACIONES DE v40 SOBRE STAGING (encargo 2026-10-11-suplemento-a-produccion,
// Paso 1; guion v40 en §5.2). También corre contra ensayo, para probarlo antes.
//
//   (set -a; source .env.staging.local; set +a; \
//    BASE_URL=https://traceline-staging-70ce5b369e7c.herokuapp.com \
//    node <rama>/scripts/despliegue/comprobar-v40.mjs <modo> --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json)
//
// desde la copia del repositorio que tiene .env.staging.local y .credenciales-demo.
// Usa la sesión del analista de IRStrat (contraseña del archivo, no se imprime).
// Ningún modo llama al modelo.
//
// Modos:
//   --antes <carpeta>     ANTES de migrar. Solo lee. Guarda <carpeta>/banderas.json
//                         (vitrina, generador, lectura y topes por emisora).
//   --despues <carpeta>   DESPUÉS del release. Solo lee:
//                         · banderas idénticas a las de antes (v40 no cambia
//                           ninguna) y Grupo Carso con vitrina, generador y
//                           lectura apagados;
//                         · los 18 incisos del catálogo, activos; guarda
//                           <carpeta>/catalogo.json para comparar los Excel;
//                         · Grupo Carso sin libro de hechos, sin hechos, sin
//                           pasadas de coherencia ni historial de bloques, y sus
//                           adjuntos del Perfil, si los hay, en «omitido» (ninguno
//                           fue a la API de Anthropic);
//                         · con BASE_URL, GET …/cierre de un documento de Empresa
//                           Demo responde 200 (la ruta nueva está desplegada).
//   --generar             ESCRIBE: POST …/generar del reporte de Empresa Demo por
//                         la app (BASE_URL) → se espera 200. Abre el documento con
//                         sus bloques en cola, sin llamar al modelo (los bloques
//                         los pide la pantalla), y cuenta 1 corrida del tope del mes.
// =============================================================================
import fs from "node:fs/promises";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";

// El ensayo de v40 (vdubzcjtujxayefzhhco) se borró al cerrar el despliegue: solo staging.
const REFS = { ewgnvjtjhvdltvkopptn: "staging" };
const APPS = {
  staging: "https://traceline-staging-70ce5b369e7c.herokuapp.com",
  ensayo: "https://traceline-dev-d4fd7a3cda04.herokuapp.com",
};
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const SLUG_CARSO = "gcarso";
const INCISOS = [
  "NIIF S2 25 (a)(i)", "NIIF S2 25 (a)(ii)", "NIIF S2 25 (a)(iii)", "NIIF S2 25 (a)(iv)", "NIIF S2 25 (a)(v)",
  "NIIF S1 44 (a)(i)", "NIIF S1 44 (a)(ii)", "NIIF S1 44 (a)(iii)", "NIIF S1 44 (a)(iv)", "NIIF S1 44 (a)(v)",
  "NIIF S2 36 (a)", "NIIF S2 36 (b)", "NIIF S2 36 (c)", "NIIF S2 36 (d)",
  "NIIF S2 36 (e)(i)", "NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)",
];
const CAMPOS = ["vitrina_habilitada", "generador_activo", "generaciones_mes_max", "lectura_evidencias_activa", "lecturas_mes_max"];

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
  console.error("Uso: comprobar-v40.mjs (--antes <dir> | --despues <dir> | --generar) --credenciales <archivo>");
  console.error("     con NEXT_PUBLIC_SUPABASE_URL (staging o ensayo) y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(2);
}
if (BASE && BASE !== APPS[ambiente]) {
  console.error(`✗ BASE_URL debe ser la app de ${ambiente}: ${APPS[ambiente]}.`);
  process.exit(2);
}
if (generar && !BASE) { console.error("✗ Con --generar hace falta BASE_URL."); process.exit(2); }
const password = JSON.parse(await fs.readFile(credArch, "utf8"))["analista@irstrat.example"]?.password;
if (!password) { console.error(`✗ ${credArch} no trae la contraseña del analista.`); process.exit(2); }

const jar = new Map();
const db = createServerClient(URL_SB, ANON, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) },
});
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
console.log(`Ambiente: ${ambiente}`);

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const leerBanderas = async () => {
  const { data, error } = await db.from("tenants").select(`id, slug, es_demo, ${CAMPOS.join(", ")}`).order("slug");
  if (error) throw new Error(error.message);
  return data;
};
/** Filas de Grupo Carso en una tabla con tenant_id (solo el conteo). */
const deCarso = async (tabla, carsoId, filtro = (q) => q) => {
  const { count, error } = await filtro(db.from(tabla).select("*", { count: "exact", head: true }).eq("tenant_id", carsoId));
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return count ?? 0;
};

if (carpetaAntes) {
  const ts = await leerBanderas();
  await fs.mkdir(carpetaAntes, { recursive: true });
  const destino = path.join(carpetaAntes, "banderas.json");
  await fs.writeFile(destino, JSON.stringify(Object.fromEntries(ts.map((t) => [t.slug, Object.fromEntries(CAMPOS.map((c) => [c, t[c]]))])), null, 2));
  console.log(`  ✓ banderas de ${ts.length} emisoras → ${destino}`);
}

if (carpetaDespues) {
  const antes = JSON.parse(await fs.readFile(path.join(carpetaDespues, "..", "antes", "banderas.json"), "utf8"));
  const ts = await leerBanderas();
  console.log(`\nBanderas · ${ts.length} emisoras (v40 no cambia ninguna)`);
  for (const t of ts) {
    const igual = antes[t.slug] && CAMPOS.every((c) => antes[t.slug][c] === t[c]);
    ok(!!igual, `${t.slug.padEnd(24)} ${t.es_demo ? "demo" : "REAL"} · vitrina ${t.vitrina_habilitada ? "on " : "off"} · generador ${t.generador_activo ? "on " : "off"} (${t.generaciones_mes_max}/mes) · lectura ${t.lectura_evidencias_activa ? "on " : "off"} (${t.lecturas_mes_max}/mes)${igual ? "" : " · DISTINTA de antes"}`);
  }
  ok(ts.length === Object.keys(antes).length, `mismas emisoras que antes (${Object.keys(antes).length})`);
  const carso = ts.find((t) => t.slug === SLUG_CARSO);
  ok(!!carso && !carso.es_demo && !carso.vitrina_habilitada && !carso.generador_activo && !carso.lectura_evidencias_activa, "Grupo Carso: vitrina, generador y lectura apagados");

  console.log("\nCatálogo");
  const { data: cat, error: eC } = await db.from("datapoints_taxonomia").select("codigo, descripcion").eq("activo", true);
  if (eC) throw new Error(eC.message);
  const codigos = new Set(cat.map((d) => d.codigo));
  const faltan = INCISOS.filter((c) => !codigos.has(c));
  ok(faltan.length === 0, `18 incisos activos${faltan.length ? `; faltan: ${faltan.join(", ")}` : ""}`);
  await fs.mkdir(carpetaDespues, { recursive: true });
  const destino = path.join(carpetaDespues, "catalogo.json");
  await fs.writeFile(destino, JSON.stringify(Object.fromEntries(cat.map((d) => [d.codigo.trim(), d.descripcion]))));
  ok(cat.length > 0, `catálogo activo (${cat.length} códigos) → ${destino}`);

  if (carso) {
    console.log("\nGrupo Carso no llegó al modelo");
    ok((await deCarso("libros_hechos", carso.id)) === 0, "sin libro de hechos");
    ok((await deCarso("hechos", carso.id)) === 0, "sin hechos");
    ok((await deCarso("observaciones_coherencia", carso.id)) === 0, "sin pasadas de coherencia");
    ok((await deCarso("documentos_bloques_versiones", carso.id)) === 0, "sin historial de bloques");
    // El relleno de la migración deja una fila de lectura por adjunto: se cuenta
    // contra los adjuntos, para que un relleno incompleto no pase como «0 de 0»
    // (observación P2 de Codex sobre el PR #19).
    const adjuntos = await deCarso("perfil_emisor_adjuntos", carso.id);
    const lecturas = await deCarso("perfil_emisor_adjuntos_contenido", carso.id);
    const noOmitidos = await deCarso("perfil_emisor_adjuntos_contenido", carso.id, (q) => q.neq("estado", "omitido"));
    ok(lecturas === adjuntos, `adjuntos del Perfil: ${adjuntos}; filas de lectura: ${lecturas}`);
    ok(noOmitidos === 0, `todas las filas de lectura en «omitido» (${noOmitidos} en otro estado)`);
  }

  if (BASE) {
    console.log("\nRuta nueva del cierre");
    const { data: d } = await db.from("documentos_generados").select("id").eq("reporte_id", REPORTE_DEMO).order("version", { ascending: false }).limit(1).maybeSingle();
    if (!d) ok(false, "Empresa Demo no tiene documento para consultar el cierre");
    else {
      const r = await fetch(`${BASE}/api/suplemento/${d.id}/cierre`, { headers: { cookie: cookie() }, redirect: "manual" });
      ok(r.status === 200, `GET …/cierre → ${r.status}`);
    }
  }
}

if (generar) {
  console.log("\nGenerador de Empresa Demo (escribe)");
  const r = await fetch(`${BASE}/api/suplemento/${REPORTE_DEMO}/generar`, { method: "POST", headers: { cookie: cookie(), "content-type": "application/json" }, redirect: "manual" });
  const cuerpo = await r.json().catch(() => ({}));
  ok(r.status === 200, `POST generar → ${r.status}${cuerpo.error ? ` «${cuerpo.error}»` : ""}`);
}

await db.auth.signOut();
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ Todo verde.");
process.exit(fallas.length ? 1 : 0);
