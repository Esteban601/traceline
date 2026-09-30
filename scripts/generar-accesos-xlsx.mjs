#!/usr/bin/env node
// Añade al Excel de accesos demo la hoja de UN prospecto, sin tocar las hojas que ya trae la base.
// Uso: node scripts/generar-accesos-xlsx.mjs --base <vN.xlsx> --salida <vN+1.xlsx> --slug <slug> --hoja "<nombre>"
// Roles y áreas salen de la base (perfiles_usuario); contraseñas del JSON de credenciales; nada se imprime.
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

function abortar(msg, codigo = 2) {
  console.error(`❌ ${msg}`);
  process.exit(codigo);
}

if (!BASE || !SALIDA || !SLUG || !HOJA) {
  abortar('Uso: --base <vN.xlsx> --salida <vN+1.xlsx> --slug <slug> --hoja "<nombre>"');
}
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
  jefe_area: "Jefe de área",
  cliente: "Responsable de área",
};
const ORDEN_ROL = { admin_cliente: 0, jefe_area: 1, cliente: 2 };

/** Igualdad carácter por carácter. Devuelve el índice de la primera diferencia, o -1. */
function primeraDiferencia(a, b) {
  const x = Array.from(a ?? "");
  const y = Array.from(b ?? "");
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return i;
  return -1;
}

const textoCelda = (v) => (v && typeof v === "object" && "text" in v ? v.text : v);

// -----------------------------------------------------------------------------
// Cuentas del prospecto: base de datos + JSON, y que coincidan
// -----------------------------------------------------------------------------
const db = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const { data: tenant, error: tErr } = await db
  .from("tenants")
  .select("id, nombre, es_demo")
  .eq("slug", SLUG)
  .maybeSingle();
if (tErr) abortar(`tenants: ${tErr.message}`, 1);
if (!tenant) abortar(`No hay tenant con slug "${SLUG}" en ${DESTINO}.`);
if (!tenant.es_demo) abortar(`${SLUG} no es de demostración: este Excel es solo para mockups.`);

const { data: perfiles, error: pErr } = await db
  .from("perfiles_usuario")
  .select("email, rol, area")
  .eq("tenant_id", tenant.id);
if (pErr) abortar(`perfiles_usuario: ${pErr.message}`, 1);

const credenciales = JSON.parse(fs.readFileSync(CRED_FILE, "utf8"));
const delSlug = Object.entries(credenciales).filter(([, c]) => c.slug === SLUG);

const enBase = new Set(perfiles.map((p) => p.email));
const enJson = new Set(delSlug.map(([e]) => e));
const soloBase = [...enBase].filter((e) => !enJson.has(e));
const soloJson = [...enJson].filter((e) => !enBase.has(e));
if (soloBase.length || soloJson.length) {
  abortar(
    `Cuentas que no coinciden: solo en la base ${soloBase.join(", ") || "—"}; ` +
      `solo en el JSON ${soloJson.join(", ") || "—"}.`
  );
}
const areaDistinta = perfiles.filter(
  (p) => (credenciales[p.email].area ?? null) !== (p.area ?? null) || credenciales[p.email].rol !== p.rol
);
if (areaDistinta.length) {
  abortar(`Rol o área distintos entre base y JSON: ${areaDistinta.map((p) => p.email).join(", ")}`);
}

const numero = (email) => Number(/^usuario(\d+)@/.exec(email)?.[1] ?? 0);
const cuentas = [...perfiles].sort(
  (a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || numero(a.email) - numero(b.email)
);
const rolDesconocido = cuentas.filter((c) => !(c.rol in ROL_HOJA));
if (rolDesconocido.length) abortar(`Rol sin etiqueta: ${rolDesconocido.map((c) => c.rol).join(", ")}`);

// -----------------------------------------------------------------------------
// Libro: la base intacta más una hoja al final, con el formato de la primera
// -----------------------------------------------------------------------------
const shaBaseAntes = sha(BASE);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(BASE);
const hojasBase = wb.worksheets.map((w) => w.name);
if (hojasBase.includes(HOJA)) abortar(`La base ya tiene una hoja "${HOJA}".`);

// La primera hoja es la de formato canónico (las editadas a mano en Excel
// pueden traer hipervínculos y fuentes que no son el formato del libro).
const modelo = wb.worksheets[0];
const estilo = (fila, col) => JSON.parse(JSON.stringify(modelo.getRow(fila).getCell(col).style ?? {}));
// Fila del modelo de la que se copia el formato: título, encabezado, admin, jefe, usuario.
const filaModelo = { titulo: 1, encabezado: 2, admin_cliente: 3, jefe_area: 4, cliente: 5 };

const ws = wb.addWorksheet(HOJA, { views: [{ state: "normal", activeCell: "A3" }] });
const titulo = `${tenant.nombre} — ambiente de demostración`;
const filas = [
  { tipo: "titulo", valores: [titulo, titulo, titulo, titulo] },
  { tipo: "encabezado", valores: ["Usuario", "Contraseña", "Rol", "Área"] },
  ...cuentas.map((c) => ({
    tipo: c.rol,
    valores: [
      c.email,
      credenciales[c.email].password,
      ROL_HOJA[c.rol],
      c.rol === "admin_cliente" ? "Todo el ambiente" : c.area,
    ],
  })),
];
filas.forEach((f, i) => {
  const fila = ws.getRow(i + 1);
  const origen = modelo.getRow(filaModelo[f.tipo]);
  if (origen.height) fila.height = origen.height;
  f.valores.forEach((v, j) => {
    const celda = fila.getCell(j + 1);
    celda.value = v;
    celda.style = estilo(filaModelo[f.tipo], j + 1);
  });
  fila.commit();
});
ws.mergeCells("A1:D1");
const largo = (col) => Math.max(...filas.slice(1).map((f) => String(f.valores[col] ?? "").length));
ws.columns = modelo.columns.slice(0, 4).map((c, j) => ({
  width: j === 0 || j === 3 ? Math.max(c.width ?? 10, largo(j) + 4) : c.width,
}));

await wb.xlsx.writeFile(SALIDA);
if (sha(BASE) !== shaBaseAntes) abortar("La base cambió durante la generación.", 1);

// -----------------------------------------------------------------------------
// Verificación, releyendo los dos archivos desde disco
// -----------------------------------------------------------------------------
const [base, nuevo] = [new ExcelJS.Workbook(), new ExcelJS.Workbook()];
await base.xlsx.readFile(BASE);
await nuevo.xlsx.readFile(SALIDA);

const fallas = [];

// 1. Las hojas previas, idénticas celda por celda (valor y estilo), mismas
//    combinaciones y anchos, en el mismo orden.
const huella = (w) => ({
  merges: Object.keys(w._merges ?? {}).sort(),
  anchos: w.columns?.map((c) => c.width ?? null) ?? [],
  alturas: Array.from({ length: w.rowCount }, (_, i) => w.getRow(i + 1).height ?? null),
});
// exceljs no conserva el orden de las claves anidadas del estilo al releer:
// se compara con las claves ordenadas.
const canon = (o) =>
  JSON.stringify(o ?? {}, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v
  );
// Y al guardar vacía el estilo de las celdas cubiertas por una combinación
// (B1:D1) cuando es el de por defecto del libro. Esa, y solo esa, se acepta
// como equivalente, y se cuenta aparte.
const ESTILO_DEFAULT = canon({
  font: { size: 11, color: { theme: 1 }, name: "Calibri", family: 2, scheme: "minor" },
  border: {},
  fill: { type: "pattern", pattern: "none" },
});
const esclavaDefault = (a, b) =>
  a.isMerged && a.master.address !== a.address && canon(a.style) === ESTILO_DEFAULT && canon(b.style) === "{}";
let celdasComparadas = 0;
let esclavasEquivalentes = 0;
base.worksheets.forEach((wBase, i) => {
  const wNuevo = nuevo.worksheets[i];
  if (!wNuevo || wNuevo.name !== wBase.name) {
    fallas.push(`hoja ${i + 1}: nombre u orden distinto`);
    return;
  }
  if (JSON.stringify(huella(wBase)) !== JSON.stringify(huella(wNuevo))) {
    fallas.push(`${wBase.name}: combinaciones, anchos o alturas distintos`);
  }
  const filasMax = Math.max(wBase.rowCount, wNuevo.rowCount);
  const colsMax = Math.max(wBase.columnCount, wNuevo.columnCount);
  for (let r = 1; r <= filasMax; r++) {
    for (let c = 1; c <= colsMax; c++) {
      const a = wBase.getRow(r).getCell(c);
      const b = wNuevo.getRow(r).getCell(c);
      celdasComparadas++;
      const valorIgual = JSON.stringify(a.value) === JSON.stringify(b.value);
      const estiloIgual = canon(a.style) === canon(b.style);
      if (valorIgual && !estiloIgual && esclavaDefault(a, b)) {
        esclavasEquivalentes++;
      } else if (!valorIgual || !estiloIgual) {
        // Solo la dirección y qué difiere, nunca el valor.
        fallas.push(`${wBase.name}!${a.address}: ${valorIgual ? "estilo" : "valor"} distinto`);
      }
    }
  }
});
if (nuevo.worksheets.length !== base.worksheets.length + 1) {
  fallas.push(`hojas: ${nuevo.worksheets.length}, se esperaban ${base.worksheets.length + 1}`);
}
if (nuevo.worksheets.at(-1)?.name !== HOJA) fallas.push(`la última hoja no es "${HOJA}"`);

// 2. Todas las contraseñas del libro contra el JSON, carácter por carácter.
let contrasenas = 0;
let iguales = 0;
const vistas = new Set();
for (const w of nuevo.worksheets) {
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
if (sinHoja.length) fallas.push(`cuentas del JSON sin hoja: ${sinHoja.length}`);

// -----------------------------------------------------------------------------
// Resumen: conteos y nombres, nunca contraseñas
// -----------------------------------------------------------------------------
console.log(`destino: ${DESTINO} · tenant: ${tenant.nombre} (${SLUG})`);
console.log(`hoja nueva "${HOJA}": ${cuentas.length} cuentas`);
for (const c of cuentas) {
  console.log(`  ${c.email.padEnd(32)} ${ROL_HOJA[c.rol].padEnd(31)} ${c.rol === "admin_cliente" ? "Todo el ambiente" : c.area}`);
}
console.log(`hojas: base ${base.worksheets.length} → salida ${nuevo.worksheets.length}`);
console.log(
  `celdas de las hojas previas comparadas: ${celdasComparadas} · ` +
    `celdas cubiertas por combinación con estilo por defecto vaciado: ${esclavasEquivalentes}`
);
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
