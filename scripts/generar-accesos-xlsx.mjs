#!/usr/bin/env node
// Excel de accesos de los mockups: la base intacta, más lo que se pida.
//
//   --slug <slug> --hoja "<nombre>"   añade la hoja de UN prospecto al final (como siempre).
//   --completar                       en cada hoja existente, agrega al final las cuentas del mockup
//                                     que existen en la base y faltan en la hoja (rol y área desde
//                                     perfiles_usuario; contraseña del JSON). Una cuenta que no está
//                                     en el JSON recibe contraseña nueva por la API de administración,
//                                     se registra en el JSON (600) y en la bitácora (fn_log_evento).
//   --ligas [--url <base>]            hoja «Ligas» al frente: por mockup, liga de entrada, liga al
//                                     panel, cuenta para presentar, número de cuentas y vínculo a su hoja.
//
// Uso: node scripts/generar-accesos-xlsx.mjs --base <vN.xlsx> --salida <vN+1.xlsx> [opciones]
// Roles y áreas salen de la base (perfiles_usuario); contraseñas del JSON de credenciales; nada se
// imprime salvo nombres de cuenta, conteos y nombres de hoja. La salida se verifica releyendo los dos
// archivos: las celdas de la base, idénticas; las contraseñas, carácter por carácter contra el JSON.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Parámetros
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const BASE = valor("--base");
const SALIDA = valor("--salida");
const SLUG = valor("--slug");
const HOJA = valor("--hoja");
const COMPLETAR = args.includes("--completar");
const LIGAS = args.includes("--ligas");
const URL_APP = (valor("--url") ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

function abortar(msg, codigo = 2) {
  console.error(`❌ ${msg}`);
  process.exit(codigo);
}

if (!BASE || !SALIDA) abortar('Uso: --base <vN.xlsx> --salida <vN+1.xlsx> [--slug <slug> --hoja "<nombre>"] [--completar] [--ligas --url <base>]');
if (!!SLUG !== !!HOJA) abortar("--slug y --hoja van juntos.");
if (!SLUG && !COMPLETAR && !LIGAS) abortar("Nada que hacer: usa --slug/--hoja, --completar o --ligas.");
if (LIGAS && !/^https:\/\/[^\s/]+$/.test(URL_APP)) abortar("--ligas necesita --url https://<host> (o NEXT_PUBLIC_APP_URL).");
if (!fs.existsSync(BASE)) abortar(`No existe la base: ${BASE}`);
if (path.resolve(BASE) === path.resolve(SALIDA)) abortar("La salida no puede ser la base.");
if (fs.existsSync(SALIDA)) abortar(`La salida ya existe; no se sobrescribe: ${SALIDA}`);

// Mismo destino y mismo archivo de credenciales que crear-demo-prospecto.mjs.
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !SERVICE) abortar("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
const DESTINO = new URL(URL_SB).hostname.split(".")[0];
const CRED_FILE = path.join(process.cwd(), ".credenciales-demo", `prospectos-${DESTINO}.json`);
if (!fs.existsSync(CRED_FILE)) abortar(`No existe ${path.relative(process.cwd(), CRED_FILE)}`);

const sha = (ruta) => crypto.createHash("sha256").update(fs.readFileSync(ruta)).digest("hex");

// Etiquetas que usan las hojas existentes.
const ROL_HOJA = {
  admin_cliente: "Administrador (para presentar)",
  auditor: "Auditor externo",
  jefe_area: "Jefe de área",
  cliente: "Responsable de área",
};
const ORDEN_ROL = { admin_cliente: 0, auditor: 1, jefe_area: 2, cliente: 3 };
const HOJA_LIGAS = "Ligas";

/** Igualdad carácter por carácter. Devuelve el índice de la primera diferencia, o -1. */
function primeraDiferencia(a, b) {
  const x = Array.from(a ?? "");
  const y = Array.from(b ?? "");
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return i;
  return -1;
}

const textoCelda = (v) => (v && typeof v === "object" && "text" in v ? v.text : v);
const numero = (email) => Number(/^usuario(\d+)@/.exec(email)?.[1] ?? 0);
const ordenar = (cs) => [...cs].sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || numero(a.email) - numero(b.email));
const areaDe = (c) => (c.rol === "admin_cliente" || c.rol === "auditor" ? "Todo el ambiente" : c.area);

/** Contraseña fuerte y legible: el mismo generador que crear-demo-prospecto.mjs. */
function passwordFuerte() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const ch = Array.from(crypto.randomBytes(15), (b) => abc[b % abc.length]);
  return `${ch.slice(0, 5).join("")}-${ch.slice(5, 10).join("")}-${ch.slice(10, 15).join("")}!`;
}

const db = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const credenciales = JSON.parse(fs.readFileSync(CRED_FILE, "utf8"));
const guardarCredenciales = () => fs.writeFileSync(CRED_FILE, JSON.stringify(credenciales, null, 2) + "\n", { mode: 0o600 });

/** Tenant de demostración por slug y sus cuentas (email, rol, área). */
async function cuentasDe(slug) {
  const { data: tenant, error: tErr } = await db.from("tenants").select("id, nombre, es_demo").eq("slug", slug).maybeSingle();
  if (tErr) abortar(`tenants: ${tErr.message}`, 1);
  if (!tenant) abortar(`No hay tenant con slug "${slug}" en ${DESTINO}.`);
  if (!tenant.es_demo) abortar(`${slug} no es de demostración: este Excel es solo para mockups.`);
  const { data: perfiles, error: pErr } = await db.from("perfiles_usuario").select("id, email, rol, area").eq("tenant_id", tenant.id);
  if (pErr) abortar(`perfiles_usuario: ${pErr.message}`, 1);
  const raros = perfiles.filter((c) => !(c.rol in ROL_HOJA));
  if (raros.length) abortar(`Rol sin etiqueta en ${slug}: ${raros.map((c) => c.rol).join(", ")}`);
  return { tenant, cuentas: ordenar(perfiles) };
}

/** Rol o área distintos entre la base y el JSON: no se escribe una hoja que contradiga al JSON. */
function verificarJson(slug, cuentas) {
  const distintas = cuentas.filter((p) => credenciales[p.email] && ((credenciales[p.email].area ?? null) !== (p.area ?? null) || credenciales[p.email].rol !== p.rol));
  if (distintas.length) abortar(`Rol o área distintos entre base y JSON (${slug}): ${distintas.map((p) => p.email).join(", ")}`);
}

// -----------------------------------------------------------------------------
// Libro: la base intacta
// -----------------------------------------------------------------------------
const shaBaseAntes = sha(BASE);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(BASE);
const hojasBase = wb.worksheets.map((w) => w.name);
if (SLUG && hojasBase.includes(HOJA)) abortar(`La base ya tiene una hoja "${HOJA}".`);
if (LIGAS && hojasBase.includes(HOJA_LIGAS)) abortar(`La base ya tiene una hoja "${HOJA_LIGAS}".`);

// La primera hoja es la de formato canónico (las editadas a mano en Excel
// pueden traer hipervínculos y fuentes que no son el formato del libro).
const modelo = wb.worksheets[0];
const estilo = (fila, col) => JSON.parse(JSON.stringify(modelo.getRow(fila).getCell(col).style ?? {}));
// Fila del modelo de la que se copia el formato: título, encabezado, admin, jefe, usuario.
// El auditor toma el formato de la fila del jefe (es como lo trae la hoja de AINDA).
const filaModelo = { titulo: 1, encabezado: 2, admin_cliente: 3, auditor: 4, jefe_area: 4, cliente: 5 };

function escribirFila(ws, n, tipo, valores) {
  const fila = ws.getRow(n);
  const origen = modelo.getRow(filaModelo[tipo]);
  if (origen.height) fila.height = origen.height;
  valores.forEach((v, j) => {
    const celda = fila.getCell(j + 1);
    celda.value = v;
    celda.style = estilo(filaModelo[tipo], j + 1);
  });
  fila.commit();
}

/** Emails de una hoja de mockup (columna A desde la fila 3). */
const emailsDe = (w) => {
  const out = [];
  for (let r = 3; r <= w.rowCount; r++) {
    const e = textoCelda(w.getRow(r).getCell(1).value);
    if (typeof e === "string" && e.includes("@")) out.push(e.trim().toLowerCase());
  }
  return out;
};

const resumen = { agregadas: [], nuevas: [], hojaNueva: null, ligas: 0 };
// Lo que se espera ver en la salida más allá de la base, para la verificación.
const esperado = new Map(); // hoja → [{ fila, valores }]
let staffId = null;

// --- 1. Completar hojas existentes --------------------------------------------
if (COMPLETAR) {
  const { data: staff } = await db.from("perfiles_usuario").select("id").eq("email", "admin@irstrat.example").maybeSingle();
  staffId = staff?.id ?? null;
  // PRIMERO SE VALIDA TODO, DESPUÉS SE ESCRIBE. Cambiar una contraseña y abortar
  // en la hoja siguiente (un rol sin etiqueta, un área que no cuadra) dejaba el
  // cambio hecho y el libro sin generar: pasó con la cuenta de Bafar el 7 de
  // octubre de 2026, al topar con el auditor de AINDA.
  const plan = [];
  for (const w of wb.worksheets) {
    const enHoja = new Set(emailsDe(w));
    const slug = [...enHoja].map((e) => credenciales[e]?.slug).find(Boolean);
    if (!slug) {
      console.log(`  (hoja «${w.name}»: sin cuentas del JSON; no se completa)`);
      continue;
    }
    const { tenant, cuentas } = await cuentasDe(slug);
    verificarJson(slug, cuentas);
    plan.push({ w, enHoja, slug, tenant, cuentas });
  }
  for (const { w, enHoja, slug, tenant, cuentas } of plan) {
    const faltan = cuentas.filter((c) => !enHoja.has(c.email.toLowerCase()));
    let fila = w.rowCount;
    for (const c of faltan) {
      if (!credenciales[c.email]) {
        // Cuenta sin contraseña registrada: se le pone una nueva y se registra.
        const nueva = passwordFuerte();
        const { error } = await db.auth.admin.updateUserById(c.id, { password: nueva });
        if (error) abortar(`contraseña de ${c.email}: ${error.message}`, 1);
        credenciales[c.email] = { password: nueva, rol: c.rol, area: c.area ?? null, slug };
        guardarCredenciales();
        const { error: eLog } = await db.rpc("fn_log_evento", {
          p_tenant_id: tenant.id,
          p_usuario_id: staffId,
          p_accion: "usuario_password_establecida",
          p_entidad: "perfiles_usuario",
          p_entidad_id: c.id,
          p_detalle: { motivo: "cuenta sin contraseña en el JSON de prospectos", via: "generar-accesos-xlsx --completar", rol: c.rol },
        });
        if (eLog) console.error(`  ❌ bitácora de ${c.email}: ${eLog.message}`);
        resumen.nuevas.push(c.email);
      }
      fila++;
      const valores = [c.email, credenciales[c.email].password, ROL_HOJA[c.rol], areaDe(c)];
      escribirFila(w, fila, c.rol, valores);
      esperado.set(w.name, [...(esperado.get(w.name) ?? []), { fila, valores }]);
      resumen.agregadas.push(`${w.name}: ${c.email}`);
    }
    if (faltan.length) {
      const largo = Math.max(...emailsDe(w).map((e) => e.length));
      if ((w.getColumn(1).width ?? 0) < largo + 4) w.getColumn(1).width = largo + 4;
    }
  }
}

// --- 2. Hoja de un prospecto nuevo ---------------------------------------------
if (SLUG) {
  const { tenant, cuentas } = await cuentasDe(SLUG);
  const delSlug = Object.entries(credenciales).filter(([, c]) => c.slug === SLUG);
  const enBase = new Set(cuentas.map((p) => p.email));
  const enJson = new Set(delSlug.map(([e]) => e));
  const soloBase = [...enBase].filter((e) => !enJson.has(e));
  const soloJson = [...enJson].filter((e) => !enBase.has(e));
  if (soloBase.length || soloJson.length) {
    abortar(`Cuentas que no coinciden: solo en la base ${soloBase.join(", ") || "—"}; solo en el JSON ${soloJson.join(", ") || "—"}.`);
  }
  verificarJson(SLUG, cuentas);
  const ws = wb.addWorksheet(HOJA, { views: [{ state: "normal", activeCell: "A3" }] });
  const titulo = `${tenant.nombre} — ambiente de demostración`;
  const filas = [
    { tipo: "titulo", valores: [titulo, titulo, titulo, titulo] },
    { tipo: "encabezado", valores: ["Usuario", "Contraseña", "Rol", "Área"] },
    ...cuentas.map((c) => ({ tipo: c.rol, valores: [c.email, credenciales[c.email].password, ROL_HOJA[c.rol], areaDe(c)] })),
  ];
  filas.forEach((f, i) => escribirFila(ws, i + 1, f.tipo, f.valores));
  ws.mergeCells("A1:D1");
  const largo = (col) => Math.max(...filas.slice(1).map((f) => String(f.valores[col] ?? "").length));
  ws.columns = modelo.columns.slice(0, 4).map((c, j) => ({ width: j === 0 || j === 3 ? Math.max(c.width ?? 10, largo(j) + 4) : c.width }));
  resumen.hojaNueva = { nombre: HOJA, cuentas: cuentas.length, slug: SLUG };
}

// --- 3. Hoja «Ligas» al frente -------------------------------------------------
if (LIGAS) {
  const ws = wb.addWorksheet(HOJA_LIGAS, { views: [{ state: "normal", activeCell: "A3" }] });
  // Al frente: exceljs ordena las hojas por orderNo al escribir.
  const minimo = Math.min(...wb.worksheets.filter((w) => w !== ws).map((w) => w.orderNo));
  ws.orderNo = minimo - 1;
  const titulo = "Mockups de TRACELINE — ligas de acceso";
  escribirFila(ws, 1, "titulo", [titulo, titulo, titulo, titulo, titulo, titulo]);
  ws.mergeCells("A1:F1");
  escribirFila(ws, 2, "encabezado", ["Emisora", "Entrar", "Panel", "Cuenta para presentar", "Cuentas", "Hoja"]);
  let fila = 2;
  for (const w of wb.worksheets.filter((x) => x !== ws)) {
    const emails = emailsDe(w);
    const slug = emails.map((e) => credenciales[e]?.slug).find(Boolean);
    if (!slug) continue;
    const { cuentas } = await cuentasDe(slug);
    const admin = cuentas.find((c) => c.rol === "admin_cliente");
    fila++;
    escribirFila(ws, fila, "cliente", [
      w.name,
      { text: "Entrar", hyperlink: `${URL_APP}/login` },
      { text: "Panel", hyperlink: `${URL_APP}/admin` },
      admin?.email ?? "—",
      emails.length,
      { text: `Ir a «${w.name}»`, hyperlink: `#'${w.name.replace(/'/g, "''")}'!A1` },
    ]);
    resumen.ligas++;
  }
  ws.columns = [{ width: 26 }, { width: 10 }, { width: 10 }, { width: 34 }, { width: 10 }, { width: 30 }];
}

await wb.xlsx.writeFile(SALIDA);
if (sha(BASE) !== shaBaseAntes) abortar("La base cambió durante la generación.", 1);

// -----------------------------------------------------------------------------
// Verificación, releyendo los dos archivos desde disco
// -----------------------------------------------------------------------------
const [base, nuevo] = [new ExcelJS.Workbook(), new ExcelJS.Workbook()];
await base.xlsx.readFile(BASE);
await nuevo.xlsx.readFile(SALIDA);
const fallas = [];

// exceljs no conserva el orden de las claves anidadas del estilo al releer:
// se compara con las claves ordenadas.
const canon = (o) =>
  JSON.stringify(o ?? {}, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
// Y al guardar vacía el estilo de las celdas cubiertas por una combinación
// (B1:D1) cuando es el de por defecto del libro. Esa, y solo esa, se acepta
// como equivalente, y se cuenta aparte.
const ESTILO_DEFAULT = canon({
  font: { size: 11, color: { theme: 1 }, name: "Calibri", family: 2, scheme: "minor" },
  border: {},
  fill: { type: "pattern", pattern: "none" },
});
const esclavaDefault = (a, b) => a.isMerged && a.master.address !== a.address && canon(a.style) === ESTILO_DEFAULT && canon(b.style) === "{}";

// 1. Las hojas de la base, por nombre y en el mismo orden relativo; dentro del
//    rango de la base, idénticas celda por celda (valor y estilo), con las mismas
//    combinaciones y alturas. Más allá, solo las filas que se agregaron.
let celdasComparadas = 0;
let esclavasEquivalentes = 0;
const nombresNuevo = nuevo.worksheets.map((w) => w.name);
const ordenRelativo = nombresNuevo.filter((n) => hojasBase.includes(n));
if (JSON.stringify(ordenRelativo) !== JSON.stringify(hojasBase)) fallas.push("las hojas de la base cambiaron de orden o falta alguna");
for (const wBase of base.worksheets) {
  const wNuevo = nuevo.getWorksheet(wBase.name);
  if (!wNuevo) continue;
  if (JSON.stringify(Object.keys(wBase._merges ?? {}).sort()) !== JSON.stringify(Object.keys(wNuevo._merges ?? {}).sort())) {
    fallas.push(`${wBase.name}: combinaciones distintas`);
  }
  for (let r = 1; r <= wBase.rowCount; r++) {
    if ((wBase.getRow(r).height ?? null) !== (wNuevo.getRow(r).height ?? null)) fallas.push(`${wBase.name}: alto de la fila ${r} distinto`);
    for (let c = 1; c <= wBase.columnCount; c++) {
      const a = wBase.getRow(r).getCell(c);
      const b = wNuevo.getRow(r).getCell(c);
      celdasComparadas++;
      const valorIgual = JSON.stringify(a.value) === JSON.stringify(b.value);
      const estiloIgual = canon(a.style) === canon(b.style);
      if (valorIgual && !estiloIgual && esclavaDefault(a, b)) esclavasEquivalentes++;
      else if (!valorIgual || !estiloIgual) fallas.push(`${wBase.name}!${a.address}: ${valorIgual ? "estilo" : "valor"} distinto`);
    }
  }
  // Lo que hay más allá de la base es exactamente lo agregado.
  const agregadas = esperado.get(wBase.name) ?? [];
  if (wNuevo.rowCount !== wBase.rowCount + agregadas.length) fallas.push(`${wBase.name}: ${wNuevo.rowCount - wBase.rowCount} filas nuevas, se esperaban ${agregadas.length}`);
  for (const e of agregadas) {
    const vals = [1, 2, 3, 4].map((c) => textoCelda(wNuevo.getRow(e.fila).getCell(c).value));
    if (vals[0] !== e.valores[0] || vals[2] !== e.valores[2] || vals[3] !== e.valores[3]) fallas.push(`${wBase.name}!A${e.fila}: fila agregada distinta de lo esperado`);
  }
}
const extra = (SLUG ? 1 : 0) + (LIGAS ? 1 : 0);
if (nuevo.worksheets.length !== base.worksheets.length + extra) fallas.push(`hojas: ${nuevo.worksheets.length}, se esperaban ${base.worksheets.length + extra}`);
if (SLUG && nombresNuevo.at(-1) !== HOJA) fallas.push(`la última hoja no es "${HOJA}"`);
if (LIGAS && nombresNuevo[0] !== HOJA_LIGAS) fallas.push(`la primera hoja no es "${HOJA_LIGAS}"`);

// 2. Todas las contraseñas del libro contra el JSON, carácter por carácter, y
//    todas las cuentas de cada mockup en su hoja (con --completar, también las
//    que la base tiene y la hoja no).
let contrasenas = 0;
let iguales = 0;
const vistas = new Set();
for (const w of nuevo.worksheets) {
  if (w.name === HOJA_LIGAS) continue;
  for (let r = 3; r <= w.rowCount; r++) {
    const email = textoCelda(w.getRow(r).getCell(1).value);
    if (!email) continue;
    contrasenas++;
    vistas.add(email);
    const esperada = credenciales[email]?.password;
    if (esperada === undefined) {
      fallas.push(`${w.name}!A${r}: ${email} no está en el JSON`);
      continue;
    }
    const d = primeraDiferencia(String(w.getRow(r).getCell(2).value ?? ""), esperada);
    if (d === -1) iguales++;
    else fallas.push(`${w.name}!B${r} (${email}): difiere desde el carácter ${d + 1}`);
  }
}
const sinHoja = Object.keys(credenciales).filter((e) => !vistas.has(e));
if (sinHoja.length && (COMPLETAR || SLUG)) fallas.push(`cuentas del JSON sin hoja: ${sinHoja.join(", ")}`);
if (LIGAS) {
  const wl = nuevo.getWorksheet(HOJA_LIGAS);
  const vinculos = [];
  for (let r = 3; r <= wl.rowCount; r++) vinculos.push(wl.getRow(r).getCell(6).value?.hyperlink ?? "");
  const rotos = vinculos.filter((h) => !nombresNuevo.some((n) => h === `#'${n.replace(/'/g, "''")}'!A1`));
  if (rotos.length) fallas.push(`Ligas: ${rotos.length} vínculo(s) a hojas que no existen`);
}

// -----------------------------------------------------------------------------
// Resumen: conteos y nombres, nunca contraseñas
// -----------------------------------------------------------------------------
console.log(`destino: ${DESTINO}`);
if (resumen.hojaNueva) console.log(`hoja nueva «${resumen.hojaNueva.nombre}» (${resumen.hojaNueva.slug}): ${resumen.hojaNueva.cuentas} cuentas`);
if (COMPLETAR) {
  console.log(`cuentas agregadas a hojas existentes: ${resumen.agregadas.length}`);
  for (const a of resumen.agregadas) console.log(`  ${a}`);
  console.log(`contraseñas nuevas (API de administración, JSON y bitácora): ${resumen.nuevas.length}${resumen.nuevas.length ? ` · ${resumen.nuevas.join(", ")}` : ""}`);
}
if (LIGAS) console.log(`hoja «${HOJA_LIGAS}» al frente: ${resumen.ligas} mockups · ${URL_APP}`);
console.log(`hojas: base ${base.worksheets.length} → salida ${nuevo.worksheets.length}`);
console.log(`celdas de la base comparadas: ${celdasComparadas} · cubiertas por combinación con estilo por defecto vaciado: ${esclavasEquivalentes}`);
console.log(`contraseñas comparadas carácter por carácter: ${contrasenas} · iguales: ${iguales} · JSON: ${Object.keys(credenciales).length}`);
console.log(`sha256 base (sin cambio): ${shaBaseAntes.slice(0, 16)}…`);
console.log(`sha256 salida: ${sha(SALIDA).slice(0, 16)}…`);

if (fallas.length) {
  // Un Excel de accesos que no pasó la verificación no se queda en disco.
  fs.rmSync(SALIDA);
  console.error(`\n❌ ${fallas.length} falla(s); la salida se borró:`);
  for (const f of fallas.slice(0, 40)) console.error(`  ${f}`);
  process.exit(1);
}
fs.chmodSync(SALIDA, 0o600);
console.log("\n✅ Verificado.");
