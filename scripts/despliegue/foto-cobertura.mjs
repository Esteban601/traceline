#!/usr/bin/env node
// =============================================================================
// FOTO de solicitudes y Cobertura por emisora y por código, antes y después de
// una migración del catálogo (encargo 2026-10-24-deuda-s2-formato, §6 punto 4).
// Solo lectura. Mide lo mismo que /admin/cobertura (lib/cobertura-datos.ts):
// catálogo 2025, solicitudes ligadas por mapeo_solicitud_datapoint, sin las
// declinadas ni las desactivadas, y coberturaDe() sobre sus estados.
//
//   Foto:      node --env-file=<.env del destino> --experimental-strip-types \
//                --import ./scripts/captura-sugerida/node/registrar.mjs \
//                scripts/despliegue/foto-cobertura.mjs --destino <dev|staging> --salida <foto.json>
//   Comparar:  node … scripts/despliegue/foto-cobertura.mjs --comparar <antes.json> <despues.json> --esperado <esperado.json>
//
// <esperado.json>: la diferencia escrita ANTES de correr la migración, una
// entrada por código: { "codigo": "NIIF S2 21(a)", "cambio": "nuevo",
// "emisoras": "todas", "solicitudes": 0, "cobertura": "sin_solicitud" }
// ("cambio": "nuevo" | "quitado" | "cambia"; "emisoras": "todas" o un número).
// Cualquier diferencia que no esté en el esperado es «no prevista» y la
// comparación sale con código 1 (el encargo pasa a ensayo en copia de staging).
// La llave (SUPABASE_SERVICE_ROLE_KEY) y la URL no se imprimen.
// =============================================================================
import fs from "node:fs";
import { createRequire } from "node:module";
import { coberturaDe } from "../../lib/cobertura.ts";

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const salir = (m, c = 2) => { console.error(`✗ ${m}`); process.exit(c); };

if (args.includes("--comparar")) {
  const i = args.indexOf("--comparar");
  const [fa, fd] = [args[i + 1], args[i + 2]];
  const fe = arg("--esperado");
  if (!fa || !fd || !fe) salir("Uso: --comparar <antes.json> <despues.json> --esperado <esperado.json>");
  process.exit(comparar(JSON.parse(fs.readFileSync(fa, "utf8")), JSON.parse(fs.readFileSync(fd, "utf8")), JSON.parse(fs.readFileSync(fe, "utf8"))));
}

const REFS = { dev: "kmjkoxecxcujxixlxwlb", staging: "ewgnvjtjhvdltvkopptn" };
const destino = arg("--destino");
const salida = arg("--salida");
if (!destino || !Object.hasOwn(REFS, destino) || !salida) salir("Uso: --destino <dev|staging> --salida <foto.json>");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes(REFS[destino])) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);
for (const [otro, r] of Object.entries(REFS)) if (otro !== destino && URL_SB.includes(r)) salir(`NEXT_PUBLIC_SUPABASE_URL contiene el ref de ${otro}.`);
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) salir("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.");

const { createClient } = createRequire(import.meta.url)("@supabase/supabase-js");
const db = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const todo = async (tabla, campos, orden = "id") => {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await db.from(tabla).select(campos).order(orden).order(campos.split(", ")[1]).range(i, i + 999);
    if (error) salir(`${tabla}: ${error.message}`, 1);
    out.push(...data);
    if (data.length < 1000) return out;
  }
};
const [dps, tenants, reportes, sols, mapeo] = await Promise.all([
  todo("datapoints_taxonomia", "id, codigo, version_taxonomia, activo"),
  todo("tenants", "id, nombre"),
  todo("reportes", "id, tenant_id"),
  todo("solicitudes", "id, reporte_id, estado, declinada, desactivada"),
  todo("mapeo_solicitud_datapoint", "solicitud_id, datapoint_id", "solicitud_id"),
]);
const catalogo = dps.filter((d) => d.version_taxonomia === "2025");
const tenantDeReporte = new Map(reportes.map((r) => [r.id, r.tenant_id]));
const solPorId = new Map(sols.map((s) => [s.id, s]));
const foto = { destino, tomada: new Date().toISOString(), catalogo: catalogo.length, mapeo: mapeo.length, solicitudes: sols.length, emisoras: {} };
for (const t of tenants) {
  const porCodigo = {};
  for (const d of catalogo) {
    const ligadas = mapeo.filter((m) => m.datapoint_id === d.id).map((m) => solPorId.get(m.solicitud_id)).filter((s) => s && tenantDeReporte.get(s.reporte_id) === t.id);
    const vivas = ligadas.filter((s) => !s.declinada && !s.desactivada);
    porCodigo[d.codigo] = { solicitudes: ligadas.length, vivas: vivas.length, cobertura: coberturaDe(vivas.map((s) => s.estado)), activo: d.activo };
  }
  foto.emisoras[t.nombre] = porCodigo;
}
fs.writeFileSync(salida, JSON.stringify(foto, null, 1));
console.log(`Foto de ${destino}: ${tenants.length} emisoras × ${catalogo.length} códigos del catálogo 2025 · ${sols.length} solicitudes · ${mapeo.length} enlaces → ${salida}`);

function comparar(antes, despues, esperado) {
  const emisoras = [...new Set([...Object.keys(antes.emisoras), ...Object.keys(despues.emisoras)])];
  const difs = [];
  for (const e of emisoras) {
    const a = antes.emisoras[e] ?? {}, d = despues.emisoras[e] ?? {};
    if (!antes.emisoras[e] || !despues.emisoras[e]) { difs.push({ emisora: e, codigo: "(emisora)", cambio: antes.emisoras[e] ? "quitada" : "nueva" }); continue; }
    for (const c of new Set([...Object.keys(a), ...Object.keys(d)])) {
      if (!a[c]) difs.push({ emisora: e, codigo: c, cambio: "nuevo", ...d[c] });
      else if (!d[c]) difs.push({ emisora: e, codigo: c, cambio: "quitado", ...a[c] });
      else if (JSON.stringify(a[c]) !== JSON.stringify(d[c])) difs.push({ emisora: e, codigo: c, cambio: "cambia", antes: a[c], despues: d[c] });
    }
  }
  console.log(`Antes: ${antes.destino} ${antes.tomada} · catálogo ${antes.catalogo} · solicitudes ${antes.solicitudes} · enlaces ${antes.mapeo}`);
  console.log(`Después: ${despues.destino} ${despues.tomada} · catálogo ${despues.catalogo} · solicitudes ${despues.solicitudes} · enlaces ${despues.mapeo}`);
  const total = emisoras.length;
  const noPrevistas = [];
  const porCodigo = new Map();
  for (const x of difs) porCodigo.set(`${x.codigo}|${x.cambio}`, [...(porCodigo.get(`${x.codigo}|${x.cambio}`) ?? []), x]);
  for (const [k, xs] of porCodigo) {
    const [codigo, cambio] = k.split("|");
    const e = esperado.find((y) => y.codigo === codigo && y.cambio === cambio);
    const cuantas = xs.length;
    const estados = [...new Set(xs.map((x) => `${x.solicitudes ?? "?"} solicitudes · ${x.cobertura ?? JSON.stringify(x.despues)}`))];
    const ok = e && (e.emisoras === "todas" ? cuantas === total : cuantas === e.emisoras) && (cambio !== "nuevo" || xs.every((x) => x.solicitudes === e.solicitudes && x.cobertura === e.cobertura));
    console.log(`${ok ? "✓" : "✗"} ${codigo} · ${cambio} en ${cuantas} de ${total} emisoras · ${estados.join(" | ")}${ok ? " (prevista)" : " (NO PREVISTA)"}`);
    if (!ok) noPrevistas.push(k);
  }
  for (const e of esperado) if (!porCodigo.has(`${e.codigo}|${e.cambio}`)) { console.log(`✗ ${e.codigo} · ${e.cambio}: esperado y no apareció`); noPrevistas.push(e.codigo); }
  if (antes.solicitudes !== despues.solicitudes || antes.mapeo !== despues.mapeo) console.log(`· solicitudes ${antes.solicitudes} → ${despues.solicitudes}, enlaces ${antes.mapeo} → ${despues.mapeo}`);
  console.log(noPrevistas.length ? `\n✗ ${noPrevistas.length} diferencia(s) no prevista(s): el encargo pasa a ensayo en copia de staging.` : `\n✓ La diferencia es exactamente la esperada (${difs.length} celdas emisora × código).`);
  return noPrevistas.length ? 1 : 0;
}
