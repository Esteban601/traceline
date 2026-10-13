#!/usr/bin/env node
// =============================================================================
// E2E · historial de versiones por bloque, confirmación antes de regenerar,
// versiones aprobadas en el Word y figura del organigrama (encargo 2026-10-06,
// suplemento-calidad — Paso 4).
//
//   node scripts/e2e-historial-bloques.mjs [baseUrl]     (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. NO
// llama al modelo: el único bloque que se regenera es el 5, de plantilla.
// Trabaja sobre un documento de prueba propio de Empresa Demo (versión nueva,
// borrador, bloques 5 y 18) y un Perfil temporal con organigrama; lo borra todo
// al terminar.
//
//   1. Generación del 5 (plantilla) → versión 1 «generación».
//   2. Edición a mano en la pantalla → versión 2 «edición», con su autor.
//   3. Historial en la pantalla: dos versiones; «Ver cambios» muestra el diff.
//   4. Regenerar el 5 en la pantalla → el aviso «se perderá la edición de X del
//      día Y; queda en el historial» → se confirma → versión 3 «generación».
//   5. Restaurar la v2 en la pantalla → versión 4 «restauración», texto de la v2,
//      el bloque vuelve a llevar la edición.
//   6. El servidor exige la confirmación: POST bloque/5 sin ella → 428 con el
//      mensaje; POST …/generar del reporte → 428 con la lista, sin tocar nada.
//   7. Solo altas: ni el staff ni el superusuario cambian o borran una versión.
//   8. Aprobar en la pantalla → versiones_aprobadas {5: v4, 18: v1}. Se altera el
//      texto del 5 por debajo (sin trigger) y el Word aprobado sigue saliendo con
//      la v4; lleva la figura con su pie, las propiedades con las versiones y
//      pasa verify-docx sin marca de agua.
//   9. RLS: el administrador del cliente ve el historial de su emisora; el
//      auditor no ve el documento, ni el historial, ni la revisión, y no escribe.
//  10. Borrar el documento borra su historial (la cascada sí puede).
// =============================================================================
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import JSZip from "jszip";
import sharp from "sharp";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const TEXTO_18 = "Empresa Demo, S.A.B. de C.V. organiza la supervisión de los riesgos relacionados con el clima en dos niveles.\n\nEl organigrama que acompaña esta sección muestra esa estructura.";

const psql = (sql, replica = false) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", `${replica ? "set session_replication_role = replica; " : ""}${sql}`], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

async function sesion(email) {
  const jar = new Map();
  const c = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email, password: CLAVE });
  if (error) return null;
  const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  return {
    c,
    jar,
    ruta: (metodo, camino, cuerpo) => fetch(`${BASE}${camino}`, { method: metodo, headers: { cookie: cookie(), "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined, redirect: "manual" }),
  };
}
const versiones = () =>
  psql(`select coalesce(json_agg(json_build_object('id', id, 'version', version, 'origen', origen, 'texto', texto, 'restaurada_de', restaurada_de, 'editado_en', editado_en) order by version), '[]') from documentos_bloques_versiones where documento_id=${lit(DOC)} and numero=5`);
const leerVersiones = () => JSON.parse(versiones());
async function hasta(cond, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 1500)); }
  return false;
}

if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }
const staff = await sesion("admin@irstrat.example");
if (!staff) throw new Error("login staff");
const NOMBRE_STAFF = psql(`select nombre from perfiles_usuario p join auth.users u on u.id = p.id where u.email = 'admin@irstrat.example'`);

// --- Preparación ---------------------------------------------------------------
const banderaOriginal = psql(`select generador_activo from tenants where id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true where id=${lit(TENANT)}`);
const habiaPerfil = psql(`select count(*) from perfil_emisor where tenant_id=${lit(TENANT)}`) !== "0";
const png = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#faf7f0" } })
  .composite([{ input: Buffer.from('<svg width="800" height="400"><rect x="300" y="40" width="200" height="60" fill="#14302a"/><text x="400" y="78" font-size="20" text-anchor="middle" fill="#fff">Consejo</text></svg>'), top: 0, left: 0 }])
  .png().toBuffer();
const RUTA_ORG = `${TENANT}/perfil/organigrama-e2e-${Date.now()}.png`;
const { error: eOrg } = await staff.c.storage.from("documentos").upload(RUTA_ORG, png, { contentType: "image/png" });
if (eOrg) throw new Error(`organigrama: ${eOrg.message}`);
if (!habiaPerfil) {
  psql(`insert into perfil_emisor (tenant_id, denominacion_formal, nombre_corto, forma_de_referencia, organigrama_path) values (${lit(TENANT)}, 'Empresa Demo, S.A.B. de C.V.', 'Empresa Demo', 'la Compañía', ${lit(RUTA_ORG)})`);
}
const VERSION_DOC = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
const DOC = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${VERSION_DOC}, 'borrador', '{estructura_gobierno}') returning id`).split("\n")[0];
const T5 = psql(`select titulo from documentos_bloques where numero = 5 limit 1`) || "Conexiones";
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado) values (${lit(DOC)}, 5, 'conexiones', ${lit(T5)}, 'I · Introducción', 'es', 'en_cola')`);
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en) values (${lit(DOC)}, 18, 'estructura_gobierno', 'Estructura de gobierno corporativo y organigrama', 'II · Gobernanza', 'es', 'borrador', ${lit(TEXTO_18)}, 'generacion', '[]', '[]', now())`);

const nav = await chromium.launch();
try {
  // --- 1. Generación del 5 ---------------------------------------------------
  console.log("\n1. Generación del bloque 5 (plantilla, sin modelo)");
  const g = await staff.ruta("POST", `/api/suplemento/${DOC}/bloque/5`, {});
  ok(g.status === 202, `POST bloque/5 → ${g.status}`);
  ok(await hasta(() => leerVersiones().length === 1), "versión 1 registrada");
  ok(leerVersiones()[0]?.origen === "generacion", `v1 con origen «${leerVersiones()[0]?.origen}»`);
  ok(psql(`select count(*) from documentos_bloques_versiones where documento_id=${lit(DOC)} and numero=18`) === "1", "el bloque 18 insertado ya tiene su versión 1 (trigger en INSERT)");

  const ctx = await nav.newContext();
  await ctx.addCookies([...staff.jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  const abrirBloque = async () => {
    await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 90000 });
    await p.getByRole("button", { name: new RegExp(T5.slice(0, 20)) }).first().click();
  };

  // --- 2. Edición ------------------------------------------------------------
  console.log("\n2. Edición a mano en la pantalla");
  await abrirBloque();
  await p.getByRole("button", { name: "Editar" }).click();
  const textoEditado = `${(await p.locator("textarea[name=texto]").inputValue()).trim()}\n\nPárrafo agregado a mano en el e2e del historial.`;
  await p.locator("textarea[name=texto]").fill(textoEditado);
  await p.getByRole("button", { name: "Guardar" }).click();
  ok(await hasta(() => leerVersiones().length === 2), "versión 2 registrada");
  const v2 = leerVersiones()[1];
  ok(v2?.origen === "edicion" && v2?.editado_en, `v2 «${v2?.origen}» con fecha de edición`);
  const autorV2 = psql(`select coalesce(p.nombre, '') from documentos_bloques_versiones v left join perfiles_usuario p on p.id = v.autor_id where v.id=${lit(v2.id)}`);
  ok(autorV2 === NOMBRE_STAFF, `autor de la v2: ${autorV2}`);

  // --- 3. Historial y diff ---------------------------------------------------
  console.log("\n3. Historial y diff en la pantalla");
  await abrirBloque();
  await p.locator('[data-historial="5"] summary').click();
  ok((await p.locator('[data-historial="5"] [data-version]').count()) === 2, "la pantalla lista 2 versiones");
  ok((await p.locator('[data-historial="5"] [data-version="2"]').innerText()).includes("Edición manual"), "la v2 aparece como «Edición manual»");
  await p.locator('[data-historial="5"] [data-version="1"]').getByRole("button", { name: "Ver cambios" }).click();
  const agregado = await p.locator('[data-diff] [data-tipo="agregado"]').allInnerTexts();
  ok(agregado.join(" ").includes("Párrafo agregado a mano"), `el diff de la v1 a la actual marca lo agregado («${agregado.join(" ").trim().slice(0, 40)}…»)`);

  // --- 4. Regenerar con confirmación ----------------------------------------------
  console.log("\n4. Regenerar el bloque editado");
  await p.getByRole("button", { name: "Regenerar", exact: true }).click();
  const dialogo = p.getByRole("dialog");
  const aviso = await dialogo.innerText();
  ok(aviso.includes(`Se perderá la edición de ${NOMBRE_STAFF} del día`) && aviso.includes("queda en el historial"), `aviso: «${aviso.split("\n").find((l) => l.includes("Se perderá")) ?? aviso.slice(0, 80)}»`);
  await dialogo.getByRole("button", { name: "Regenerar de todos modos" }).click();
  ok(await hasta(() => leerVersiones().length === 3), "versión 3 registrada");
  ok(leerVersiones()[2]?.origen === "generacion", "v3 «generacion»; la edición sigue en el historial como v2");

  // --- 5. Restaurar ----------------------------------------------------------------
  console.log("\n5. Restaurar la v2 en la pantalla");
  await abrirBloque();
  await p.locator('[data-historial="5"] summary').click();
  await p.locator('[data-historial="5"] [data-version="2"]').getByRole("button", { name: "Restaurar" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Restaurar" }).click();
  ok(await hasta(() => leerVersiones().length === 4), "versión 4 registrada");
  const v4 = leerVersiones()[3];
  ok(v4?.origen === "restauracion" && v4?.restaurada_de === v2.id, "v4 «restauracion» apunta a la v2");
  const bloque5 = JSON.parse(psql(`select row_to_json(b)::text from documentos_bloques b where documento_id=${lit(DOC)} and numero=5`));
  ok(bloque5.texto === v2.texto && bloque5.editado_en, "el bloque tiene el texto de la v2 y vuelve a llevar la edición");

  // --- 6. El servidor exige la confirmación ------------------------------------------
  console.log("\n6. Confirmación en el servidor");
  const sin = await staff.ruta("POST", `/api/suplemento/${DOC}/bloque/5`, {});
  const cuerpoSin = await sin.json().catch(() => ({}));
  ok(sin.status === 428 && /Se perderá la edición de .+ del día .+; queda en el historial\./.test(cuerpoSin.error ?? ""), `POST bloque/5 sin confirmar → ${sin.status} «${cuerpoSin.error ?? ""}»`);
  const antesGen = psql(`select string_agg(numero || ':' || estado || ':' || md5(coalesce(texto, '')), ',' order by numero) from documentos_bloques where documento_id=${lit(DOC)}`);
  const gen = await staff.ruta("POST", `/api/suplemento/${REPORTE}/generar`, { editoriales: ["estructura_gobierno"] });
  const cuerpoGen = await gen.json().catch(() => ({}));
  ok(gen.status === 428 && (cuerpoGen.ediciones ?? []).some((e) => e.numero === 5), `POST generar → ${gen.status}, ediciones: ${(cuerpoGen.ediciones ?? []).map((e) => e.numero).join(", ")}`);
  ok(psql(`select string_agg(numero || ':' || estado || ':' || md5(coalesce(texto, '')), ',' order by numero) from documentos_bloques where documento_id=${lit(DOC)}`) === antesGen, "el 428 no tocó los bloques");

  // --- 7. Solo altas -------------------------------------------------------------------
  console.log("\n7. Solo altas");
  const { data: upd } = await staff.c.from("documentos_bloques_versiones").update({ texto: "x" }).eq("id", v2.id).select("id");
  const { data: del } = await staff.c.from("documentos_bloques_versiones").delete().eq("id", v2.id).select("id");
  ok(!(upd ?? []).length && !(del ?? []).length && leerVersiones()[1].texto === v2.texto, "el staff no cambia ni borra una versión");
  let superusuario = "permitido";
  try { psql(`update documentos_bloques_versiones set texto = 'x' where id=${lit(v2.id)}`); } catch (e) { superusuario = /solo altas/.test(String(e.stderr ?? e.message)) ? "rechazado por el trigger" : `error: ${String(e.stderr ?? e.message).slice(0, 80)}`; }
  ok(superusuario === "rechazado por el trigger", `ni el superusuario: ${superusuario}`);

  // --- 8. Aprobar, versiones aprobadas y Word ----------------------------------------
  console.log("\n8. Aprobación, versiones aprobadas y Word");
  await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 90000 });
  await p.getByRole("button", { name: "Aprobar", exact: true }).click();
  ok(await hasta(() => psql(`select estado from documentos_generados where id=${lit(DOC)}`) === "aprobado"), "documento aprobado desde la pantalla");
  const aprobadas = JSON.parse(psql(`select versiones_aprobadas::text from documentos_generados where id=${lit(DOC)}`));
  ok(aprobadas?.["5"]?.version === 4 && aprobadas?.["18"]?.version === 1, `versiones_aprobadas: ${JSON.stringify(Object.fromEntries(Object.entries(aprobadas ?? {}).map(([k, v]) => [k, v.version])))}`);
  // Un cambio por debajo, sin trigger: el Word aprobado no debe tomarlo.
  psql(`update documentos_bloques set texto = 'TEXTO CAMBIADO DESPUES DE APROBAR' where documento_id=${lit(DOC)} and numero=5`, true);
  const w = await staff.ruta("GET", `/api/suplemento/${DOC}/word`);
  ok(w.status === 200, `GET word → ${w.status}`);
  const docx = Buffer.from(await w.arrayBuffer());
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file("word/document.xml").async("string");
  const plano = xml.replace(/<[^>]+>/g, "");
  ok(plano.includes("Párrafo agregado a mano en el e2e del historial.") && !plano.includes("TEXTO CAMBIADO"), "el Word aprobado sale con la v4, no con el texto cambiado después");
  ok(Object.keys(zip.files).some((f) => f.startsWith("word/media/")) && plano.includes("Figura 1. Estructura de gobierno"), "el bloque 18 lleva la imagen con «Figura 1. Estructura de gobierno»");
  const custom = (await zip.file("docProps/custom.xml")?.async("string")) ?? "";
  ok(/TRACELINE versiones aprobadas"><vt:lpwstr>5:v4 18:v1</.test(custom) && custom.includes(DOC), "propiedades del Word: documento y «5:v4 18:v1»");
  const archivo = path.join(os.tmpdir(), `e2e-historial-${process.pid}.docx`);
  fs.writeFileSync(archivo, docx);
  let verify = "";
  try { verify = execFileSync("node", ["scripts/verify-docx.mjs", archivo, "--sin-marca"], { encoding: "utf8" }); } catch (e) { verify = String(e.stdout ?? e.message); }
  fs.rmSync(archivo, { force: true });
  ok(/ESTRUCTURA VÁLIDA/.test(verify), "verify-docx: estructura válida y sin marca de agua");

  // --- 9. RLS: admin del cliente y auditor ---------------------------------------------
  console.log("\n9. RLS del historial");
  const admin = await sesion("admin.cliente@empresademo.example");
  if (admin) {
    const { data } = await admin.c.from("documentos_bloques_versiones").select("id").eq("documento_id", DOC);
    ok((data ?? []).length >= 5, `el admin del cliente ve el historial de su emisora (${(data ?? []).length} versiones)`);
  } else console.log("    (sin sesión del admin del cliente en local; se omite)");
  const auditor = await sesion("auditor.externo@despacho.example");
  if (auditor) {
    const [{ data: vs }, { data: bs }, { data: ds }] = await Promise.all([
      auditor.c.from("documentos_bloques_versiones").select("id").eq("documento_id", DOC),
      auditor.c.from("documentos_bloques").select("numero").eq("documento_id", DOC),
      auditor.c.from("documentos_generados").select("id").eq("id", DOC),
    ]);
    ok(!(vs ?? []).length && !(bs ?? []).length && !(ds ?? []).length, "el auditor no ve el documento, sus bloques ni su historial (fuera de su alcance)");
    const { data: updA } = await auditor.c.from("documentos_bloques_versiones").update({ texto: "x" }).eq("documento_id", DOC).select("id");
    ok(!(updA ?? []).length, "el auditor no escribe en el historial");
    // Next redirige con 3xx o, si el render ya empezó a transmitirse, con un 200
    // que lleva NEXT_REDIRECT a /admin en el cuerpo. En los dos casos el texto del
    // documento no viaja.
    const rev = await auditor.ruta("GET", `/admin/cobertura/suplemento/${DOC}`);
    const cuerpoRev = await rev.text();
    const redirige = ([302, 303, 307, 308].includes(rev.status) && /\/admin(\?|$)/.test(rev.headers.get("location") ?? "")) || /NEXT_REDIRECT;replace;\/admin;/.test(cuerpoRev);
    ok(redirige && !cuerpoRev.includes("organiza la supervisión de los riesgos"), `la revisión lo redirige a /admin sin el texto del documento (${rev.status})`);
    const regen = await auditor.ruta("POST", `/api/suplemento/${DOC}/bloque/5`, { confirmarEdicion: true });
    ok(regen.status === 403, `el auditor no regenera (POST bloque/5 → ${regen.status})`);
  } else console.log("    (sin sesión del auditor en local; se omite)");
} finally {
  await nav.close();
  // --- 10. Limpieza: la cascada sí borra el historial --------------------------------
  console.log("\n10. Limpieza");
  psql(`delete from documentos_generados where id=${lit(DOC)}`);
  const quedan = psql(`select count(*) from documentos_bloques_versiones where documento_id=${lit(DOC)}`);
  ok(quedan === "0", `borrar el documento borra su historial (quedan ${quedan})`);
  if (!habiaPerfil) psql(`delete from perfil_emisor where tenant_id=${lit(TENANT)}`);
  await staff.c.storage.from("documentos").remove([RUTA_ORG]);
  psql(`update tenants set generador_activo = ${banderaOriginal === "t"} where id=${lit(TENANT)}`);
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
