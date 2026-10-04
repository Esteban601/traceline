#!/usr/bin/env node
// =============================================================================
// E2E · el jefe de área entrega evidencia (hotfix v32.1).
//
//   node scripts/e2e-jefe-sube-evidencia.mjs
//
// SOLO contra el stack local (aborta si la URL de Supabase no es local). No
// necesita la app: todo pasa por la base con la sesión real de cada cuenta.
//
//   1. El jefe de RH sube evidencia a una solicitud «solicitado» → «recibido».
//   2. El jefe sube a una solicitud «validado» → «en revisión» (reapertura).
//   3. El jefe sigue sin poder cambiar el estado con un UPDATE directo, ni otra
//      columna (el título). La regla del visto bueno se prueba además aislada en
//      SQL (la de origen corre antes y la tapa por la API).
//   4. El jefe sigue dando el visto bueno de su área.
//   5. El responsable de área sigue subiendo como antes.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
// Llaves PÚBLICAS de demostración del stack local de Supabase (las mismas de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICIO_LOCAL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CLAVE_DEMO = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error(`✗ Solo contra el stack local, no ${URL_SB}.`); process.exit(2); }

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };
const svc = createClient(URL_SB, SERVICIO_LOCAL, { auth: { persistSession: false } });
async function sesion(email) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: CLAVE_DEMO });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}
const staff = await sesion("analista@irstrat.example");
const jefe = await sesion("jefe.rh@empresademo.example");
const responsable = await sesion("rh@empresademo.example");
const marca = `[e2e-jefe-sube ${new Date().toISOString().slice(0, 16)}]`;

async function solicitud(titulo) {
  const { data: m } = await staff.c.from("solicitudes").select("orden").eq("reporte_id", REPORTE).order("orden", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await staff.c.from("solicitudes").insert({
    reporte_id: REPORTE, titulo: `${marca} ${titulo}`, area_asignada: "RH", es_cuantitativa: false, estado: "solicitado", orden: (m?.orden ?? 0) + 1,
  }).select("id").single();
  if (error) throw new Error(`solicitud: ${error.message}`);
  return data.id;
}
async function subir(quien, solicitudId, nombre) {
  const ruta = `${TENANT}/${solicitudId}/${Date.now()}-${nombre}`;
  const { error: eUp } = await quien.c.storage.from("evidencias").upload(ruta, Buffer.from(`e2e ${nombre}`), { contentType: "text/plain" });
  if (eUp) return { error: eUp };
  const r = await quien.c.from("evidencias").insert({
    solicitud_id: solicitudId, archivo_path: ruta, nombre_original: nombre, subido_por: quien.id, version: 0, periodo_cubierto: "2025",
  }).select("id, version").single();
  // Si la rama de captura sugerida está aplicada, la lectura se marca omitida (sin modelo).
  if (r.data) await svc.from("evidencias_contenido").update({ estado: "omitido" }).eq("evidencia_id", r.data.id).then(() => {}, () => {});
  return r;
}
const estado = async (id) => (await staff.c.from("solicitudes").select("estado").eq("id", id).single()).data.estado;

console.log(`\n${marca}\n`);
const s1 = await solicitud("Política de capacitación");
const r1 = await subir(jefe, s1, "politica.txt");
ok(!r1.error, `el jefe sube a una solicitud «solicitado» (${r1.error?.message ?? "ok"})`);
ok((await estado(s1)) === "recibido", `y pasa a «recibido» (${await estado(s1)})`);

const s2 = await solicitud("Programa de bienestar");
await subir(responsable, s2, "programa.txt");
for (const e of ["en_revision", "validado"]) {
  const { error } = await staff.c.from("solicitudes").update({ estado: e }).eq("id", s2);
  if (error) throw new Error(`estado ${e}: ${error.message}`);
}
const r2 = await subir(jefe, s2, "programa-v2.txt");
ok(!r2.error, `el jefe sube a una solicitud «validado» (${r2.error?.message ?? "ok"})`);
ok((await estado(s2)) === "en_revision", `y se reabre a «en revisión» (${await estado(s2)})`);

const s3 = await solicitud("Encuesta de clima laboral");
await subir(responsable, s3, "encuesta.txt");
const { error: eDirecto } = await jefe.c.from("solicitudes").update({ estado: "validado" }).eq("id", s3);
ok(Boolean(eDirecto), `el UPDATE directo del estado por el jefe se rechaza (solicitud de IRStrat): «${eDirecto?.message ?? "lo aceptó"}»`);
ok((await estado(s3)) === "recibido", "el estado no cambió");
const { error: eTitulo } = await jefe.c.from("solicitudes").update({ titulo: "otro título" }).eq("id", s3);
ok(Boolean(eTitulo), `el jefe tampoco cambia otra columna (título): «${eTitulo?.message ?? "lo aceptó"}»`);

// Solicitud INTERNA del cliente: ahí la regla de origen no frena al cliente, así
// que lo que rechace el UPDATE directo del jefe es la del visto bueno.
const admin = await sesion("admin.cliente@empresademo.example");
const { data: mi } = await staff.c.from("solicitudes").select("orden").eq("reporte_id", REPORTE).order("orden", { ascending: false }).limit(1).maybeSingle();
const { data: interna, error: eInt } = await admin.c.from("solicitudes").insert({
  reporte_id: REPORTE, titulo: `${marca} Interna: política de diversidad`, area_asignada: "RH", es_cuantitativa: false, estado: "solicitado", orden: (mi?.orden ?? 0) + 1,
  origen: "cliente",
}).select("id, origen").single();
if (eInt) throw new Error(`interna: ${eInt.message}`);
await subir(responsable, interna.id, "diversidad.txt");
const { error: eDirInt } = await jefe.c.from("solicitudes").update({ estado: "en_revision" }).eq("id", interna.id);
ok(Boolean(eDirInt), `en una solicitud interna (origen ${interna.origen}) el UPDATE directo del estado también se rechaza: «${eDirInt?.message ?? "lo aceptó"}»`);
ok((await estado(interna.id)) === "recibido", "y el estado no cambió");

// La regla de ORIGEN corre antes y frena todo cambio de estado de quien no
// revisa, así que por la API no se ve la del visto bueno. Se prueba aislada en
// SQL, con la sesión del jefe y dentro de una transacción que se revierte:
//   · solo con app.transicion_automatica (pasa la regla de origen) → el visto
//     bueno rechaza: sin la marca de la carga, el jefe no cambia el estado;
//   · con las dos marcas (el camino de la carga) → pasa.
const DB_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const comoJefe = (marcas) => `begin;
select set_config('request.jwt.claims', '{"sub":"${jefe.id}","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '${jefe.id}', true);
set local role authenticated;
${marcas.map((m) => `select set_config('${m}', '1', true);`).join("\n")}
update public.solicitudes set estado = 'en_revision' where id = '${interna.id}';
rollback;`;
const psql = (sql) => {
  try { execFileSync("psql", [DB_LOCAL, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], { stdio: ["ignore", "pipe", "pipe"] }); return null; }
  catch (e) { return String(e.stderr ?? e.message); }
};
const sinMarca = psql(comoJefe(["app.transicion_automatica"]));
ok(Boolean(sinMarca) && /solo puede dar o retirar el visto bueno/.test(sinMarca),
  `aislado en SQL: sin la marca de la carga, el trigger del visto bueno rechaza el cambio de estado del jefe`);
const conMarca = psql(comoJefe(["app.transicion_automatica", "app.estado_por_evidencia"]));
ok(conMarca === null, `aislado en SQL: con la marca de la carga, el cambio de estado del jefe pasa (${conMarca ? conMarca.split("\n")[0] : "ok"})`);

const { error: eVB } = await jefe.c.from("solicitudes").update({ vb_area_por: jefe.id }).eq("id", s3);
const { data: vb } = await staff.c.from("solicitudes").select("vb_area_por").eq("id", s3).single();
ok(!eVB && vb.vb_area_por === jefe.id, `el jefe sigue dando el visto bueno de su área (${eVB?.message ?? "ok"})`);

const s4 = await solicitud("Rotación de personal");
const r4 = await subir(responsable, s4, "rotacion.txt");
ok(!r4.error && (await estado(s4)) === "recibido", "el responsable de área sigue subiendo como antes");

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ E2E jefe de área OK");
process.exit(fallas.length ? 1 : 0);
