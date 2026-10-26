#!/usr/bin/env node
// =============================================================================
// E2E DE LA CARGA EN DOS MOMENTOS (encargo 2026-10-26-carga-lectura-primero).
//
//   node scripts/e2e-carga-lectura-primero.mjs [baseUrl]   (default :3016)
//
// SOLO contra el stack local, con la app de la rama corriendo SIN llave del
// modelo y con CRON_SECRET=e2e-local (o el que se pase en CRON_SECRET). No llama
// al modelo: el estado de la lectura y las sugerencias se fijan con service role,
// como las escribe la cola. Las evidencias de los casos 1–7 se insertan por la
// base para que no corra el `after()` de la acción y la lectura quede donde el
// caso la pone; los casos 8 y 9 suben desde el navegador.
//
//   1. Con hallazgo: «Leyendo…», la pantalla sondea, aparece el paso 3 con
//      cifra, unidad, periodo, fuente y cita, y Confirmar crea la captura.
//   2. Con hallazgo: Corregir propone el periodo de la solicitud (no el de una
//      fila mensual), crea la captura con el valor corregido, y el historial
//      pone la cifra vigente grande y la sugerencia plegada.
//   Confirmar y Corregir refrescan la pantalla sin recarga manual.
//   3. Sin hallazgo: su línea y el paso 3 manual, que guarda la cifra. 3b: sin
//      total que cubra el periodo (sug-num-3), los meses van de referencia, sin
//      botón para usarlos y sin prellenar la cifra.
//   4. Lectura apagada (bandera del tenant): su línea y el paso 3 manual.
//   5. Tope mensual: su línea.
//   6. Fallo técnico: su línea.
//   7. Más de 90 s leyendo: «sigue en curso» y el paso 3 manual.
//   8. Doble captura: con la cifra confirmada, fn_decidir_sugerencia responde
//      «Esta evidencia ya tiene una cifra confirmada.» sin una segunda fila (por
//      la base y por la pantalla); «por decidir» de la portada no la cuenta; una
//      subida real sin llave cae a «fallo» y al manual, y al releerla la cola no
//      genera sugerencia porque ya hay cifra.
//   9. Panel: el administrador del cliente confirma la sugerida en el paso 3 y
//      sube desde el panel con «Subir y leer».
//  10. Consola del navegador limpia.
// =============================================================================
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
// Llaves PÚBLICAS de demostración del stack local de Supabase (las mismas de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICIO_LOCAL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CLAVE_DEMO = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const CRON = process.env.CRON_SECRET || "e2e-local";
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
const responsable = await sesion("operaciones@empresademo.example");
// La bandera del tenant la cambia el admin de IRStrat (en local, service role no escribe en `tenants`).
const adminIrstrat = await sesion("admin@irstrat.example");
async function bandera(valor) {
  const { error } = await adminIrstrat.c.from("tenants").update({ lectura_evidencias_activa: valor }).eq("id", TENANT);
  if (error) throw new Error(`bandera de lectura: ${error.message}`);
}
const marca = `[e2e-carga-lectura ${new Date().toISOString().slice(0, 16)}]`;

async function solicitud(titulo) {
  const { data: m } = await staff.c.from("solicitudes").select("orden").eq("reporte_id", REPORTE).order("orden", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await staff.c.from("solicitudes").insert({
    reporte_id: REPORTE, titulo, descripcion: `${marca} ${titulo}`, area_asignada: "Operaciones",
    es_cuantitativa: true, unidad_esperada: "kWh", estado: "solicitado", orden: (m?.orden ?? 0) + 1,
  }).select("id").single();
  if (error) throw new Error(`solicitud ${titulo}: ${error.message}`);
  return data.id;
}
/** Evidencia por la base (sin el after() de la acción): la lectura queda `pendiente` (bandera encendida) u `omitido` (apagada). */
async function evidencia(solicitudId) {
  const ruta = `${TENANT}/${solicitudId}/${Date.now()}-e2e.csv`;
  const { error: eUp } = await responsable.c.storage.from("evidencias").upload(ruta, Buffer.from("concepto,valor\nelectricidad,376300\n"), { contentType: "text/csv" });
  if (eUp) throw new Error(`subida: ${eUp.message}`);
  const { data, error } = await responsable.c.from("evidencias").insert({
    solicitud_id: solicitudId, archivo_path: ruta, nombre_original: "consumo-2025.csv", subido_por: responsable.id, version: 0, periodo_cubierto: "2025",
  }).select("id, version").single();
  if (error) throw new Error(`evidencia: ${error.message}`);
  return data;
}
const lectura = (ev, campos) => svc.from("evidencias_contenido").update(campos).eq("evidencia_id", ev.id);
async function sugerencia(solicitudId, ev, campos) {
  const { data: cont } = await svc.from("evidencias_contenido").select("id").eq("evidencia_id", ev.id).single();
  const { data, error } = await svc.from("sugerencias_captura").insert({
    solicitud_id: solicitudId, tenant_id: TENANT, evidencia_id: ev.id, contenido_id: cont.id, evidencia_version: ev.version,
    estado: "sugerida", confianza: "alta", modelo: "e2e", prompt_version: "e2e", ...campos,
  }).select("id").single();
  if (error) throw new Error(`sugerencia: ${error.message}`);
  return data.id;
}
const NUM = { tipo: "numerica", valor: 376300, unidad: "kWh", periodo: "2025", cita: "Consumo total de electricidad: 376,300 kWh", fuente: { tipo: "celda", hoja: "Energía", celda: "B14" }, candidatos: [] };
const capturas = async (evId) => (await staff.c.from("capturas_valor").select("valor, unidad, periodo, origen, confirmado").eq("evidencia_id", evId)).data ?? [];

const nav = await chromium.launch();
const errores = [];
async function entrar(email) {
  // Otra zona que la del servidor: una fecha formateada con la zona del navegador no hidrata igual (React #418).
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "Asia/Tokyo" });
  const p = await ctx.newPage();
  p.on("console", (msg) => { if (msg.type() === "error") errores.push(`${email}: ${msg.text().slice(0, 160)}`); });
  p.on("pageerror", (e) => errores.push(`${email}: ${String(e).slice(0, 160)}`));
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', CLAVE_DEMO);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), p.click('button[type="submit"]')]);
  return p;
}
const paso3 = (p) => p.locator('[data-testid="paso3"]');
const fase = async (p) => (await paso3(p).count()) ? await paso3(p).first().getAttribute("data-fase") : null;
async function esperarFase(p, f, ms = 30000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if ((await fase(p)) === f) return true; await p.waitForTimeout(500); }
  return false;
}
async function abrir(p, ruta) { await p.goto(`${BASE}${ruta}`, { timeout: 90000 }); await p.waitForLoadState("networkidle").catch(() => {}); }
async function guardarManual(p, valor) {
  await p.fill("#cifra-valor", String(valor));
  await p.getByRole("button", { name: "Guardar cifra" }).click();
  await p.getByText("Cifra guardada.").first().waitFor({ timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
}
const linea = async (p) => ((await p.locator('[data-testid="paso3-linea"]').count()) ? (await p.locator('[data-testid="paso3-linea"]').innerText()) : "");
/** Espera (sin recargar) a que el paso 3 deje de estar en pantalla. */
async function sinPaso3(p, ms = 15000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if ((await paso3(p).count()) === 0) return true; await p.waitForTimeout(300); }
  return false;
}
/** Espera (sin recargar) a que el valor vigente del historial coincida. */
async function vigenteEs(p, re, ms = 15000) {
  const v = p.locator('[data-testid="cifra-vigente"]');
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if ((await v.count()) && re.test((await v.first().innerText()).replace(/\s+/g, " "))) return true; await p.waitForTimeout(300); }
  return false;
}
async function avisoDecision(p) {
  await abrir(p, "/portal");
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  const m = t.match(/(\d+) sugerencias? de la plataforma esperan? tu decisión/);
  return m ? Number(m[1]) : 0;
}

const { data: tenantAntes } = await adminIrstrat.c.from("tenants").select("lectura_evidencias_activa").eq("id", TENANT).single();
console.log(`\n${marca}\n`);
try {
  const op = await entrar("operaciones@empresademo.example");

  // 1. Con hallazgo: leyendo → sugerida → Confirmar.
  console.log("1. Con hallazgo · Confirmar");
  const s1 = await solicitud("Consumo de electricidad 2025 (e2e confirmar)");
  const e1 = await evidencia(s1);
  await abrir(op, `/portal/solicitudes/${s1}`);
  ok((await fase(op)) === "leyendo" && (await op.getByText(/Leyendo tu archivo/).count()) > 0, "tras subir, la pantalla dice «Leyendo tu archivo…»");
  ok((await op.locator("#cifra-valor").count()) === 0, "mientras lee no pide la cifra");
  await lectura(e1, { estado: "extraido", contenido: { hojas: [] } });
  await sugerencia(s1, e1, NUM);
  ok(await esperarFase(op, "sugerida", 20000), "el sondeo trae la sugerencia sin recargar la página");
  const t1 = (await paso3(op).innerText()).replace(/\s+/g, " ");
  ok(/376,300/.test(t1) && /kWh/.test(t1) && /2025/.test(t1), "el paso 3 trae la cifra, la unidad y el periodo");
  ok(/Energía/.test(t1) && /B14/.test(t1) && /Consumo total de electricidad/.test(t1), "y la fuente (hoja y celda) y la cita");
  await paso3(op).getByRole("button", { name: "Confirmar" }).click();
  await op.getByText(/Sugerencia confirmada/).first().waitFor({ timeout: 20000 }).catch(() => {});
  await op.waitForTimeout(1500);
  const c1 = await capturas(e1.id);
  ok(c1.length === 1 && c1[0].origen === "sugerida" && Number(c1[0].valor) === 376300 && c1[0].confirmado, "Confirmar crea UNA captura confirmada con origen «sugerida»");
  ok(await sinPaso3(op), "sin recargar, el paso 3 desaparece al confirmar");
  ok(await vigenteEs(op, /376,300\s*kWh/), "y el historial muestra la cifra vigente sin recargar");
  await abrir(op, `/portal/solicitudes/${s1}`);
  ok((await paso3(op).count()) === 0, "con la cifra confirmada, el paso 3 ya no aparece");

  // 2. Con hallazgo: Corregir.
  console.log("2. Con hallazgo · Corregir");
  const s2 = await solicitud("Consumo de electricidad 2025 (e2e corregir)");
  const e2 = await evidencia(s2);
  await lectura(e2, { estado: "extraido", contenido: { hojas: [] } });
  // Una fila mensual: el periodo de la sugerencia no es el de la solicitud.
  await sugerencia(s2, e2, { ...NUM, periodo: "diciembre 2025", confianza: "baja" });
  await abrir(op, `/portal/solicitudes/${s2}`);
  ok((await fase(op)) === "sugerida", "una evidencia ya leída abre directo en el paso 3 prellenado");
  await paso3(op).getByRole("button", { name: "Corregir" }).click();
  ok((await paso3(op).locator('input[name="periodo"]').inputValue()) === "2025", "Corregir propone el periodo de la solicitud (2025), no el de la sugerencia");
  ok(/diciembre 2025/.test(await paso3(op).locator('[data-testid="periodo-archivo"]').innerText().catch(() => "")), "y muestra el periodo de la cifra del archivo");
  await paso3(op).locator('input[name="valor"]').fill("376400");
  await paso3(op).getByRole("button", { name: "Guardar corrección" }).click();
  await op.getByText(/Sugerencia corregida/).first().waitFor({ timeout: 20000 }).catch(() => {});
  await op.waitForTimeout(1500);
  const c2 = await capturas(e2.id);
  ok(c2.length === 1 && Number(c2[0].valor) === 376400 && c2[0].origen === "sugerida", "Corregir crea la captura con el valor corregido");
  ok(await sinPaso3(op), "sin recargar, el paso 3 desaparece al corregir");
  ok(await vigenteEs(op, /376,400\s*kWh · periodo 2025/), "y el historial muestra la cifra corregida como vigente, con periodo 2025, sin recargar");
  const plegada = op.locator('[data-testid="sugerencia-decidida"]');
  ok((await plegada.count()) === 1 && !(await plegada.getAttribute("open")) && /Sugerencia corregida: 376,300 → 376,400 kWh/.test(await plegada.locator("summary").innerText()), "la sugerencia corregida va plegada: «Sugerencia corregida: 376,300 → 376,400 kWh»");
  ok(c2[0]?.periodo === "2025", "la captura corregida queda con periodo 2025");

  // 3. Sin hallazgo.
  console.log("3. Sin hallazgo");
  const s3 = await solicitud("Consumo de electricidad 2025 (e2e sin hallazgo)");
  const e3 = await evidencia(s3);
  await lectura(e3, { estado: "extraido", contenido: { hojas: [] } });
  await sugerencia(s3, e3, { tipo: "numerica", estado: "sin_hallazgo", valor: null, unidad: null, confianza: null, motivo: "El archivo trae el consumo de gas, no el de electricidad." });
  await abrir(op, `/portal/solicitudes/${s3}`);
  ok((await fase(op)) === "sin_hallazgo" && /^No encontramos una cifra en kWh en este archivo\. Puedes escribir la cifra aquí\./.test(await linea(op)), "sin hallazgo: su línea, con la unidad de la solicitud");
  ok(/consumo de gas/.test(await linea(op)), "la línea dice qué trae el archivo");
  await guardarManual(op, 376300);
  const c3 = await capturas(e3.id);
  ok(c3.length === 1 && c3[0].origen === "manual" && c3[0].confirmado && c3[0].periodo === "2025", "el paso 3 manual guarda la cifra (origen manual, periodo del archivo)");

  console.log("3b. Sin hallazgo con cifras parciales de referencia");
  const s3b = await solicitud("Consumo de electricidad 2025 (e2e parciales)");
  const e3b = await evidencia(s3b);
  await lectura(e3b, { estado: "extraido", contenido: { hojas: [] } });
  const meses = [["noviembre 2025", 3870, "Noviembre | 3,870"], ["diciembre 2025", 4080, "Diciembre | 4,080"]].map(([periodo, valor, cita]) => ({
    valor, unidad: "kWh", periodo, cita, nota: "", cubre_periodo: false, conversion: null, origen: "candidato",
    fuente: { tipo: "pagina", pagina: 1 }, fuente_texto: "página 1",
  }));
  await sugerencia(s3b, e3b, { tipo: "numerica", estado: "sin_hallazgo", valor: null, unidad: null, confianza: null, candidatos: meses,
    motivo: "La línea de la cifra sigue ilegible al releer la página a más resolución." });
  await abrir(op, `/portal/solicitudes/${s3b}`);
  const refs = paso3(op).locator('[data-testid="referencias-parciales"]');
  ok((await fase(op)) === "sin_hallazgo" && (await refs.count()) === 1, "sin total del periodo: «sin hallazgo» con las cifras parciales de referencia");
  await refs.locator("summary").click();
  const tRefs = (await refs.innerText()).replace(/\s+/g, " ");
  ok(/3,870 kWh · noviembre 2025/.test(tRefs) && /4,080 kWh · diciembre 2025/.test(tRefs) && (await refs.getByRole("button").count()) === 0, "cada parcial con su periodo y fuente, sin botón para usarla");
  ok((await op.locator("#cifra-valor").inputValue()) === "", "la cifra del paso 3 manual no se prellena con una parcial");
  ok(/sigue ilegible/.test(await linea(op)), "la línea dice que el total sigue ilegible");

  // 4. Lectura apagada.
  console.log("4. Lectura apagada");
  await bandera(false);
  const s4 = await solicitud("Consumo de electricidad 2025 (e2e apagada)");
  const e4 = await evidencia(s4);
  await bandera(tenantAntes.lectura_evidencias_activa);
  await abrir(op, `/portal/solicitudes/${s4}`);
  ok((await fase(op)) === "apagada" && /no está activa/.test(await linea(op)), "lectura apagada: su línea");
  ok((await op.locator("#cifra-valor").count()) === 1, "y el paso 3 manual de inmediato");
  await guardarManual(op, 1200);
  ok((await capturas(e4.id)).length === 1, "la cifra manual queda guardada");

  // 5. Tope mensual.
  console.log("5. Tope");
  const s5 = await solicitud("Consumo de electricidad 2025 (e2e tope)");
  const e5 = await evidencia(s5);
  await lectura(e5, { estado: "omitido", mensaje: "Se alcanzó el tope de 500 lecturas de este mes para la emisora." });
  await abrir(op, `/portal/solicitudes/${s5}`);
  ok((await fase(op)) === "tope" && /ya se usaron todas las lecturas/.test(await linea(op)) && (await op.locator("#cifra-valor").count()) === 1, "tope mensual: su línea y el paso 3 manual");

  // 6. Fallo técnico.
  console.log("6. Fallo");
  const s6 = await solicitud("Consumo de electricidad 2025 (e2e fallo)");
  const e6 = await evidencia(s6);
  await lectura(e6, { estado: "error", error: "e2e: error de lectura" });
  await abrir(op, `/portal/solicitudes/${s6}`);
  const l6 = await linea(op);
  ok((await fase(op)) === "fallo" && /No pudimos leer tu archivo/.test(l6) && !/e2e: error/.test(l6), "fallo técnico: su línea, sin el error técnico");

  // 7. Más de 90 s.
  console.log("7. Más de 90 s");
  const s7 = await solicitud("Consumo de electricidad 2025 (e2e 90 s)");
  const e7 = await evidencia(s7);
  await lectura(e7, { created_at: new Date(Date.now() - 120_000).toISOString() });
  await abrir(op, `/portal/solicitudes/${s7}`);
  ok((await fase(op)) === "tarda" && /sigue en curso/.test(await linea(op)) && (await op.locator("#cifra-valor").count()) === 1, "pasados 90 s: «sigue en curso» y el paso 3 manual");
  await lectura(e7, { estado: "omitido", mensaje: "e2e: cerrado" });

  // 8. Doble captura.
  console.log("8. Doble captura");
  const s8 = await solicitud("Consumo de electricidad 2025 (e2e doble captura)");
  const e8 = await evidencia(s8);
  await lectura(e8, { estado: "extraido", contenido: { hojas: [] } });
  await abrir(op, `/portal/solicitudes/${s8}`);
  ok(await esperarFase(op, "leyendo", 5000), "leída y sin sugerencia todavía: «leyendo»");
  await op.getByRole("button", { name: "Prefiero escribirla" }).click();
  await guardarManual(op, 376300);
  ok((await capturas(e8.id)).length === 1, "quien no quiere esperar escribe la cifra mientras se lee");
  const n0 = await avisoDecision(op);
  const sug8 = await sugerencia(s8, e8, NUM);
  ok((await avisoDecision(op)) === n0, `«por decidir» de la portada no cuenta la sugerencia de una evidencia con cifra (${n0})`);
  const { error: e409 } = await responsable.c.rpc("fn_decidir_sugerencia", { p_sugerencia_id: sug8, p_accion: "confirmar" });
  ok(e409?.message === "Esta evidencia ya tiene una cifra confirmada.", `fn_decidir_sugerencia responde «${e409?.message ?? "sin error"}»`);
  ok((await capturas(e8.id)).length === 1, "y no inserta una segunda captura");
  const { data: sugTras } = await svc.from("sugerencias_captura").select("estado").eq("id", sug8).single();
  ok(sugTras?.estado === "sugerida", "la sugerencia queda como estaba");
  await abrir(op, `/portal/solicitudes/${s8}`);
  const bloque8 = op.locator('section[aria-label="Valor sugerido"]');
  if (await bloque8.count()) {
    await bloque8.getByRole("button", { name: "Confirmar" }).click();
    await op.getByText("Esta evidencia ya tiene una cifra confirmada.").first().waitFor({ timeout: 15000 }).catch(() => {});
    ok((await op.getByText("Esta evidencia ya tiene una cifra confirmada.").count()) > 0, "la pantalla muestra «Esta evidencia ya tiene una cifra confirmada»");
    ok((await capturas(e8.id)).length === 1, "y sigue habiendo una sola captura");
  } else ok(false, "el bloque de la sugerencia aparece bajo la evidencia con cifra");
  // Control: la misma portada sí cuenta una sugerencia de una evidencia sin cifra.
  const s8b = await solicitud("Consumo de electricidad 2025 (e2e control por decidir)");
  const e8b = await evidencia(s8b);
  await lectura(e8b, { estado: "extraido", contenido: { hojas: [] } });
  const sug8b = await sugerencia(s8b, e8b, NUM);
  ok((await avisoDecision(op)) === n0 + 1, "control: una evidencia sin cifra sí suma a «por decidir»");
  await svc.from("sugerencias_captura").update({ estado: "obsoleta" }).in("id", [sug8, sug8b]);

  // Subida real desde el navegador (sin llave del modelo): leyendo → fallo → manual; al releer, sin sugerencia.
  console.log("8b. Subida real y relectura con cifra");
  const s9 = await solicitud("Consumo de electricidad 2025 (e2e subida real)");
  await abrir(op, `/portal/solicitudes/${s9}`);
  ok((await op.locator("#cifra-valor").count()) === 0 && (await op.locator("#valor").count()) === 0, "antes de subir no se pide la cifra");
  await op.setInputFiles("#evidencia-file", path.join(AQUI, "captura-sugerida", "conjunto", "x01_electricidad_2025.xlsx"));
  await op.fill("#periodo", "2025");
  await op.getByRole("button", { name: "Subir y leer" }).click();
  await op.getByText(/Ahora lo leemos para proponerte la cifra/).first().waitFor({ timeout: 60000 }).catch(() => {});
  const { data: ev9 } = await staff.c.from("evidencias").select("id, version").eq("solicitud_id", s9).single();
  ok(!!ev9, "«Subir y leer» registra la evidencia");
  ok(await esperarFase(op, "fallo", 60000), "sin llave del modelo, la lectura cae a «fallo» y el paso 3 manual");
  await guardarManual(op, 376300);
  ok((await capturas(ev9.id)).length === 1, "la cifra manual queda guardada");
  // La relectura: la fila vuelve a `pendiente` y la procesa la cola. Se cuentan las sugerencias NUEVAS (la
  // `fallida` de la subida se queda: en local, service role no borra en sugerencias_captura).
  const antesDeReleer = new Date().toISOString();
  await svc.from("evidencias_contenido").update({ estado: "pendiente", intentos: 0, error: null }).eq("evidencia_id", ev9.id);
  const r = await fetch(`${BASE}/api/evidencias/procesar?maximo=50`, { method: "POST", headers: { "x-cron-secret": CRON } });
  const { data: cont9 } = await svc.from("evidencias_contenido").select("estado").eq("evidencia_id", ev9.id).single();
  const { count: sugs9 } = await svc.from("sugerencias_captura").select("id", { count: "exact", head: true }).eq("evidencia_id", ev9.id).gt("created_at", antesDeReleer);
  ok(r.status === 200 && cont9?.estado === "extraido" && sugs9 === 0, `al releer una evidencia con cifra, la cola la lee y no genera sugerencia (HTTP ${r.status}, lectura ${cont9?.estado}, ${sugs9} sugerencias)`);

  // 9. Panel.
  console.log("9. Panel");
  const adm = await entrar("admin.cliente@empresademo.example");
  const s10 = await solicitud("Consumo de electricidad 2025 (e2e panel confirmar)");
  const e10 = await evidencia(s10);
  await lectura(e10, { estado: "extraido", contenido: { hojas: [] } });
  await sugerencia(s10, e10, NUM);
  await abrir(adm, `/admin/solicitudes/${s10}`);
  ok((await fase(adm)) === "sugerida" && (await adm.locator('[data-testid="carga-segundo-momento"]').count()) === 1, "el panel muestra el paso 3 prellenado");
  ok((await adm.locator('section[aria-label="Valor sugerido"]').count()) === 1, "la sugerencia aparece una sola vez (no también en «Acción ahora»)");
  await paso3(adm).getByRole("button", { name: "Confirmar" }).click();
  await adm.getByText(/Sugerencia confirmada/).first().waitFor({ timeout: 20000 }).catch(() => {});
  await adm.waitForTimeout(1500);
  ok((await capturas(e10.id)).length === 1, "y Confirmar crea la captura desde el panel");
  const s11 = await solicitud("Consumo de electricidad 2025 (e2e panel subida)");
  await abrir(adm, `/admin/solicitudes/${s11}`);
  await adm.getByRole("button", { name: "Cargar archivo" }).click();
  ok((await adm.locator(`#carga-valor-${s11}`).count()) === 0, "el panel no pide la cifra antes del archivo");
  await adm.setInputFiles(`#carga-panel-file-${s11}`, path.join(AQUI, "captura-sugerida", "conjunto", "x01_electricidad_2025.xlsx"));
  const sel = adm.locator(`#carga-area-${s11}`);
  if ((await sel.evaluate((e) => e.tagName)) === "SELECT") await sel.selectOption("Operaciones"); else await sel.fill("Operaciones");
  await adm.fill(`#carga-periodo-${s11}`, "2025");
  await adm.getByRole("button", { name: "Subir y leer" }).click();
  ok(await esperarFase(adm, "fallo", 60000) || (await fase(adm)) === "leyendo", "tras «Subir y leer», el panel muestra el paso 3");
  if ((await fase(adm)) === "leyendo") await adm.getByRole("button", { name: "Prefiero escribirla" }).click();
  await guardarManual(adm, 376300);
  const { data: ev11 } = await staff.c.from("evidencias").select("id").eq("solicitud_id", s11).single();
  ok(ev11 && (await capturas(ev11.id)).length === 1, "y guarda la cifra manual");

  // 10. Consola.
  ok(errores.length === 0, `consola limpia (${errores.length} errores${errores.length ? `: ${errores.slice(0, 2).join(" | ")}` : ""})`);
} finally {
  await bandera(tenantAntes.lectura_evidencias_activa);
  await nav.close();
}
console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ E2E de la carga con lectura primero OK");
process.exit(fallas.length ? 1 : 0);
