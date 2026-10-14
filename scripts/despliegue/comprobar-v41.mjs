#!/usr/bin/env node
// =============================================================================
// COMPROBACIONES DE v41 SOBRE STAGING (encargo 2026-10-14-excel-formato-a-
// produccion, Paso 1; guion v41 en §5.1). También corre contra ensayo, para
// probarlo antes.
//
//   (set -a; source .env.staging.local; set +a; \
//    BASE_URL=https://traceline-staging-70ce5b369e7c.herokuapp.com \
//    node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//      scripts/despliegue/comprobar-v41.mjs <modo> --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json)
//
// Usa la sesión del analista de IRStrat (contraseña del archivo, no se imprime)
// y la de un usuario de área de Empresa Demo, que no llega al Formato (el
// middleware lo manda a /portal). El 403 de la ruta al auditor se prueba solo con
// E2E_PASSWORD_AUDITOR en el entorno (utilería del ensayo): staging no tiene
// cuenta de auditor. Ningún modo llama al modelo.
//
// Modos:
//   --antes <carpeta>     ANTES de migrar. Solo lee. Guarda en <carpeta>:
//                         · banderas.json (vitrina, generador, lectura y topes);
//                         · contexto.json por emisora: generador, alivios
//                           vigentes, documentos aprobados, registros de clima y
//                           objetivos activos (lo que lee comparar-excel-v41.mjs);
//                         e imprime la tabla del Paso 2 y si la plantilla del
//                         Formato ya está en Storage (se espera que no).
//   --despues <carpeta>   DESPUÉS del release. Solo lee (descargas incluidas):
//                         · banderas idénticas a las de antes (v41 no cambia
//                           ninguna) y Grupo Carso con todo apagado;
//                         · las columnas nuevas existen (Perfil ×8,
//                           registros_clima.metricas_asociadas,
//                           objetivos.origen_objetivo, documentos_generados.
//                           respuestas_*) y Grupo Carso las tiene en null;
//                         · respuestas_datapoint legible; Grupo Carso, 0 filas;
//                         · por emisora: documentos aprobados, el último y sus
//                           respuestas (estado y conteo);
//                         · la plantilla del Formato en Storage con el sha256
//                           esperado (descarga con la sesión de staff);
//                         · con BASE_URL, el Formato de Empresa Demo: 200 con el
//                           validador en verde (23 imágenes enlazadas, ninguna K
//                           con «[» fuera de las opciones de lista, hoja
//                           «Leyenda») si tiene respuestas de un aprobado, o 409
//                           con el motivo si no; el de una emisora sin aprobado,
//                           409; Grupo Carso, 409 «generador apagado»; usuario
//                           de área, 307 a /portal; auditor (si
//                           hay cuenta), 403.
//   --respuestas <slug>…  ESCRIBE: POST …/respuestas del último aprobado de cada
//                         emisora (decisión de Esteban, encargo §2.3). Cuesta
//                         ~$0.50 por documento. Se espera 202.
// =============================================================================
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { createServerClient } from "@supabase/ssr";
import { leerAlivios, regimenDe } from "../../lib/perfil-emisor.ts";
import { HOJA_ESTRUCTURA, IMAGENES_EN_CELDA, RUTA_PLANTILLA_FORMATO } from "../../lib/formato/plantilla.ts";
import { celdasConCorchete, opcionesDeListas, validarImagenesEnCelda } from "../../lib/formato/xlsx-xml.ts";
import { rutaDeHoja } from "../../lib/formato/zip.ts";

// Ensayo de v41 (traceline-ensayo-v41); al borrarlo, se quita de aquí.
const REFS = { ewgnvjtjhvdltvkopptn: "staging", wbvqrjqlfmlnbtpejvnm: "ensayo" };
const APPS = {
  staging: "https://traceline-staging-70ce5b369e7c.herokuapp.com",
  ensayo: "https://traceline-dev-d4fd7a3cda04.herokuapp.com",
};
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const SLUG_CARSO = "gcarso";
const USUARIO_AREA = "coordinador@empresademo.example";
// La plantilla revisada (la de dev desde el 13/10/2026; scripts/formato/subir-plantilla.mjs).
const SHA_PLANTILLA = "eb09aa55c5a6073fe9d3ec299f08cbac0b2a0c1fd4dc8ec4a2c00ffefc146786";
const CAMPOS = ["vitrina_habilitada", "generador_activo", "generaciones_mes_max", "lectura_evidencias_activa", "lecturas_mes_max"];
const NUEVAS = {
  perfil_emisor: ["clave_cotizacion", "tipo_instrumento", "fiduciario", "numero_fideicomiso", "hechos_posteriores", "actividades_financieras", "sector_sasb", "metricas_industria"],
  registros_clima: ["metricas_asociadas"],
  objetivos: ["origen_objetivo"],
  documentos_generados: ["respuestas_estado", "respuestas_resultado", "respuestas_actualizado_en"],
};

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); if (i === -1) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const credArch = opcion("--credenciales");
const carpetaAntes = opcion("--antes");
const carpetaDespues = opcion("--despues");
const iResp = argv.indexOf("--respuestas");
const slugsRespuestas = iResp === -1 ? [] : argv.slice(iResp + 1).filter((a) => !a.startsWith("--"));

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ambiente = Object.entries(REFS).find(([ref]) => URL_SB.includes(ref))?.[1];
const BASE = process.env.BASE_URL;
if (!ambiente || !ANON || !credArch || (!carpetaAntes && !carpetaDespues && !slugsRespuestas.length)) {
  console.error("Uso: comprobar-v41.mjs (--antes <dir> | --despues <dir> | --respuestas <slug>…) --credenciales <archivo>");
  console.error("     con NEXT_PUBLIC_SUPABASE_URL (staging o ensayo) y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(2);
}
// Fuera de staging también vale una app local (en el ensayo, main y dev corren en local contra la copia).
if (BASE && BASE !== APPS[ambiente] && (ambiente === "staging" || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE))) {
  console.error(`✗ BASE_URL debe ser la app de ${ambiente}: ${APPS[ambiente]}${ambiente === "staging" ? "" : " o una local"}.`);
  process.exit(2);
}
if (slugsRespuestas.length && !BASE) { console.error("✗ Con --respuestas hace falta BASE_URL."); process.exit(2); }
const credenciales = JSON.parse(await fs.readFile(credArch, "utf8"));
const passwordDe = (email) => credenciales[email]?.password ?? null;
if (!passwordDe("analista@irstrat.example")) { console.error(`✗ ${credArch} no trae la contraseña del analista.`); process.exit(2); }

/** Sesión de Supabase con cookies, para leer con RLS y llamar a la app. */
async function sesion(email, password) {
  const jar = new Map();
  const db = createServerClient(URL_SB, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { db, cookie: () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ") };
}
const { db, cookie } = await sesion("analista@irstrat.example", passwordDe("analista@irstrat.example"));
console.log(`Ambiente: ${ambiente}`);

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const leer = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data ?? []; };
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** Emisoras con su reporte (uno por emisora en staging), alivios vigentes y conteos. */
async function contexto() {
  const tenants = await leer(db.from("tenants").select(`id, slug, es_demo, ${CAMPOS.join(", ")}`).order("slug"));
  const reportes = await leer(db.from("reportes").select("id, tenant_id, ejercicio, anio_adopcion, alivios"));
  const docs = await leer(db.from("documentos_generados").select("id, tenant_id, reporte_id, estado, version").eq("estado", "aprobado"));
  const regs = await leer(db.from("registros_clima").select("reporte_id").eq("activo", true));
  const objs = await leer(db.from("objetivos").select("reporte_id, ambito").eq("activo", true));
  return tenants.map((t) => {
    const reps = reportes.filter((r) => r.tenant_id === t.id);
    const rep = reps.length === 1 ? reps[0] : null;
    const alivios = rep && regimenDe(rep.ejercicio, rep.anio_adopcion) === "primer_anio" ? leerAlivios(rep.alivios) : {};
    const aprobados = docs.filter((d) => d.tenant_id === t.id).sort((a, b) => b.version - a.version);
    return {
      t,
      slug: t.slug,
      reporte: rep?.id ?? null,
      reportes: reps.length,
      generador: t.generador_activo === true,
      alivios: ["C3", "C4", "E5"].filter((k) => alivios[k]),
      aprobados: aprobados.length,
      ultimoAprobado: aprobados[0]?.id ?? null,
      registros: rep ? regs.filter((r) => r.reporte_id === rep.id).length : 0,
      objetivos: rep ? objs.filter((o) => o.reporte_id === rep.id).length : 0,
      objetivosNoClimaticos: rep ? objs.filter((o) => o.reporte_id === rep.id && o.ambito !== "climatico").length : 0,
    };
  });
}
const fila = (c) =>
  `${c.slug.padEnd(24)} ${c.t.es_demo ? "demo" : "REAL"} · generador ${c.generador ? "on " : "off"} · alivios ${(c.alivios.join(",") || "—").padEnd(8)} · aprobados ${c.aprobados} · registros ${String(c.registros).padStart(2)} · objetivos ${String(c.objetivos).padStart(2)} (${c.objetivosNoClimaticos} no climáticos)${c.reportes === 1 ? "" : ` · ${c.reportes} REPORTES`}`;

async function plantillaEnStorage() {
  const carpeta = RUTA_PLANTILLA_FORMATO.slice(0, RUTA_PLANTILLA_FORMATO.lastIndexOf("/"));
  const nombre = RUTA_PLANTILLA_FORMATO.slice(carpeta.length + 1);
  const lista = await leer(db.storage.from("documentos").list(carpeta, { search: nombre }));
  if (!lista.some((o) => o.name === nombre)) return null;
  const { data: blob, error } = await db.storage.from("documentos").download(RUTA_PLANTILLA_FORMATO);
  if (error || !blob) throw new Error(`descargar la plantilla: ${error?.message ?? "sin contenido"}`);
  const b = Buffer.from(await blob.arrayBuffer());
  return { bytes: b.length, sha: sha(b) };
}

const formato = (reporte, ck) => fetch(`${BASE}/admin/cobertura/export-formato?reporte=${reporte}`, { headers: { cookie: ck() }, redirect: "manual" });

if (carpetaAntes) {
  const ctx = await contexto();
  await fs.mkdir(carpetaAntes, { recursive: true });
  await fs.writeFile(path.join(carpetaAntes, "banderas.json"), JSON.stringify(Object.fromEntries(ctx.map((c) => [c.slug, Object.fromEntries(CAMPOS.map((k) => [k, c.t[k]]))])), null, 2));
  await fs.writeFile(
    path.join(carpetaAntes, "contexto.json"),
    JSON.stringify(Object.fromEntries(ctx.map((c) => [c.slug, { generador: c.generador, alivios: c.alivios, aprobados: c.aprobados, registros: c.registros, objetivos: c.objetivos, objetivosNoClimaticos: c.objetivosNoClimaticos }])), null, 2)
  );
  console.log(`\nEmisoras · ${ctx.length} (banderas.json y contexto.json → ${carpetaAntes})`);
  for (const c of ctx) console.log(`  · ${fila(c)}`);
  ok(ctx.every((c) => c.reportes === 1), "una emisora, un reporte (el Excel se descarga por emisora)");
  const carso = ctx.find((c) => c.slug === SLUG_CARSO);
  ok(!!carso && !carso.generador, "Grupo Carso: generador apagado (sin columna «Respuesta» ni Formato)");
  console.log("\nPlantilla del Formato");
  const pl = await plantillaEnStorage();
  ok(!pl, pl ? `ya existe en documentos/${RUTA_PLANTILLA_FORMATO} (sha256 ${pl.sha.slice(0, 12)}…)` : `documentos/${RUTA_PLANTILLA_FORMATO} aún no existe`);
}

if (carpetaDespues) {
  const antes = JSON.parse(await fs.readFile(path.join(carpetaDespues, "..", "antes", "banderas.json"), "utf8"));
  const ctx = await contexto();
  console.log(`\nBanderas · ${ctx.length} emisoras (v41 no cambia ninguna)`);
  for (const c of ctx) {
    const igual = antes[c.slug] && CAMPOS.every((k) => antes[c.slug][k] === c.t[k]);
    ok(!!igual, `${fila(c)}${igual ? "" : " · BANDERAS DISTINTAS de antes"}`);
  }
  ok(ctx.length === Object.keys(antes).length, `mismas emisoras que antes (${Object.keys(antes).length})`);
  const carso = ctx.find((c) => c.slug === SLUG_CARSO);
  ok(!!carso && !carso.t.es_demo && !carso.t.vitrina_habilitada && !carso.generador && !carso.t.lectura_evidencias_activa, "Grupo Carso: vitrina, generador y lectura apagados");

  console.log("\nColumnas nuevas");
  for (const [tabla, cols] of Object.entries(NUEVAS)) {
    const filtro = tabla === "perfil_emisor" || tabla === "documentos_generados" ? "tenant_id" : "reporte_id";
    const { data, error } = await db.from(tabla).select(`${filtro}, ${cols.join(", ")}`);
    if (error) { ok(false, `${tabla}: ${error.message}`); continue; }
    const conValor = (f) => cols.some((k) => f[k] != null);
    const deCarso = carso ? data.filter((f) => f[filtro] === (filtro === "tenant_id" ? carso.t.id : carso.reporte)) : [];
    ok(true, `${tabla}: ${cols.length} columna(s) legibles · ${data.filter(conValor).length} de ${data.length} filas con valor`);
    ok(deCarso.every((f) => !conValor(f)), `${tabla}: Grupo Carso en null (${deCarso.length} filas)`);
  }

  console.log("\nRespuestas por emisora");
  const resp = await leer(db.from("respuestas_datapoint").select("tenant_id, documento_id, destino"));
  ok(true, `respuestas_datapoint legible (${resp.length} filas en total)`);
  ok(!carso || resp.every((r) => r.tenant_id !== carso.t.id), "Grupo Carso: 0 respuestas");
  const estados = new Map((await leer(db.from("documentos_generados").select("id, respuestas_estado").eq("estado", "aprobado"))).map((d) => [d.id, d.respuestas_estado]));
  for (const c of ctx.filter((x) => x.aprobados)) {
    const delUltimo = resp.filter((r) => r.documento_id === c.ultimoAprobado);
    const n = (d) => delUltimo.filter((r) => r.destino === d).length;
    console.log(`  · ${c.slug.padEnd(24)} aprobados ${c.aprobados} · último ${c.ultimoAprobado.slice(0, 8)} · respuestas_estado ${estados.get(c.ultimoAprobado) ?? "—"} · taxonomía ${n("taxonomia")} · formato ${n("formato")}${c.generador ? "" : " · generador apagado"}`);
  }
  if (!ctx.some((x) => x.aprobados)) console.log("  · ninguna emisora con documento aprobado");

  console.log("\nPlantilla del Formato en Storage");
  const pl = await plantillaEnStorage();
  ok(!!pl && pl.sha === SHA_PLANTILLA, pl ? `documentos/${RUTA_PLANTILLA_FORMATO}: ${pl.bytes} bytes · sha256 ${pl.sha}${pl.sha === SHA_PLANTILLA ? " (= esperado)" : ` (se esperaba ${SHA_PLANTILLA})`}` : `no existe documentos/${RUTA_PLANTILLA_FORMATO}`);

  if (BASE) {
    console.log("\nFormato electrónico de Empresa Demo");
    const demo = ctx.find((c) => c.reporte === REPORTE_DEMO);
    const conRespuestas = !!demo?.generador && resp.some((r) => r.documento_id === demo.ultimoAprobado);
    const r = await formato(REPORTE_DEMO, cookie);
    if (conRespuestas) {
      ok(r.status === 200, `GET export-formato → ${r.status} (tiene respuestas de su último aprobado)`);
      if (r.status === 200) {
        const buf = Buffer.from(await r.arrayBuffer());
        await fs.mkdir(carpetaDespues, { recursive: true });
        const destino = path.join(carpetaDespues, "formato-empresa-demo.xlsx");
        await fs.writeFile(destino, buf);
        const zip = await JSZip.loadAsync(buf);
        const hojas = {};
        for (const n of Object.keys(zip.files).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) hojas[n] = await zip.file(n).async("string");
        const imagenes = validarImagenesEnCelda(hojas, Object.keys(zip.files), IMAGENES_EN_CELDA);
        ok(imagenes.length === 0, `${IMAGENES_EN_CELDA} imágenes en celda enlazadas, ningún «#VALUE!» suelto${imagenes.length ? `: ${imagenes.join("; ")}` : ""}`);
        const rutaEst = await rutaDeHoja(zip, HOJA_ESTRUCTURA);
        const opciones = opcionesDeListas((await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "");
        const corchetes = rutaEst ? celdasConCorchete(hojas[rutaEst], "K", opciones) : ["sin hoja de estructura"];
        ok(corchetes.length === 0, `ninguna K con «[» fuera de las opciones de lista${corchetes.length ? `: ${corchetes.slice(0, 10).join(", ")}` : ""}`);
        ok(!!(await rutaDeHoja(zip, "Leyenda")), "hoja «Leyenda»");
        console.log(`    → ${destino}`);
      }
    } else {
      const cuerpo = await r.json().catch(() => ({}));
      ok(r.status === 409, `GET export-formato → ${r.status} «${cuerpo.error ?? ""}» (sin respuestas de un aprobado: se espera 409)`);
    }
    // Grupo Carso: con el generador apagado, el Formato no se ofrece (409), aunque la plantilla ya esté en Storage.
    if (carso?.reporte) {
      const rc = await formato(carso.reporte, cookie);
      const cc = await rc.json().catch(() => ({}));
      ok(rc.status === 409 && /apagado/.test(cc.error ?? ""), `Grupo Carso → ${rc.status} «${cc.error ?? ""}»`);
    }
    const sinAprobado = ctx.find((c) => c.generador && !c.aprobados && c.reporte && c.reporte !== REPORTE_DEMO);
    if (sinAprobado) {
      const r2 = await formato(sinAprobado.reporte, cookie);
      const c2 = await r2.json().catch(() => ({}));
      ok(r2.status === 409, `${sinAprobado.slug} (generador on, sin aprobado) → ${r2.status} «${c2.error ?? ""}»`);
    }
    // El usuario de área no llega a la ruta: el middleware lo manda a /portal.
    const pwArea = passwordDe(USUARIO_AREA);
    if (!pwArea) ok(false, `${credArch} no trae ${USUARIO_AREA}`);
    else {
      const area = await sesion(USUARIO_AREA, pwArea);
      const ra = await formato(REPORTE_DEMO, area.cookie);
      ok(ra.status === 307 && (ra.headers.get("location") ?? "").endsWith("/portal"), `usuario de área → ${ra.status} ${ra.headers.get("location") ?? ""} (el middleware lo saca de /admin)`);
      await area.db.auth.signOut();
    }
    // El auditor sí entra a /admin/cobertura: la ruta le responde 403. Staging no
    // tiene cuenta de auditor; en ensayo se prueba con la utilería.
    if (process.env.E2E_PASSWORD_AUDITOR) {
      try {
        const aud = await sesion("auditor.externo@despacho.example", process.env.E2E_PASSWORD_AUDITOR);
        const rd = await formato(REPORTE_DEMO, aud.cookie);
        ok(rd.status === 403, `auditor → ${rd.status}`);
        await aud.db.auth.signOut();
      } catch (e) {
        ok(false, `auditor: ${e.message}`);
      }
    } else console.log("  · auditor: sin cuenta en este ambiente (en ensayo, con la utilería y E2E_PASSWORD_AUDITOR)");
  }
}

if (slugsRespuestas.length) {
  console.log("\nRespuestas de documentos aprobados (escribe; ~$0.50 por documento)");
  const ctx = await contexto();
  for (const s of slugsRespuestas) {
    const c = ctx.find((x) => x.slug === s);
    if (!c?.ultimoAprobado) { ok(false, `${s}: sin documento aprobado`); continue; }
    if (c.slug === SLUG_CARSO || !c.generador) { ok(false, `${s}: generador apagado; no se piden respuestas`); continue; }
    const r = await fetch(`${BASE}/api/suplemento/${c.ultimoAprobado}/respuestas`, { method: "POST", headers: { cookie: cookie() }, redirect: "manual" });
    const cuerpo = await r.json().catch(() => ({}));
    ok(r.status === 202, `${s}: POST respuestas del documento ${c.ultimoAprobado.slice(0, 8)} → ${r.status}${cuerpo.error ? ` «${cuerpo.error}»` : ""}`);
  }
}

await db.auth.signOut();
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ Todo verde.");
process.exit(fallas.length ? 1 : 0);
