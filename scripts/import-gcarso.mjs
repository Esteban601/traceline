#!/usr/bin/env node
// =============================================================================
// Import del tenant GCARSO — proceso IAS 2025 real de Grupo Carso.
//
// Recrea dentro de la plataforma el proceso de recabado que IRStrat corrió con
// Grupo Carso: sus solicitudes, responsables, fechas, capturas y contenido
// REALES. Fuentes (carpeta import-gcarso/, no versionada):
//
//   · Mapeo_Import_GCarso.xlsx      — la especificación (7 hojas). Autoritativa.
//   · Checklist-IAS2025-GCarso.xlsx — el proceso de recabado real.
//   · Informe_GCarso_S1S2_2025.docx — el contenido final (tablas [100002]/[100003]).
//   · IAS_GCarso_2025.pdf           — el informe anual vigente (116 págs).
//
// -----------------------------------------------------------------------------
// MODELO DE IMPORT (decisiones tomadas donde la especificación no cerraba)
// -----------------------------------------------------------------------------
//  1. UNA solicitud por requerimiento REAL de los checklists. Las cuatro filas
//     'Varias' de ChecklistIAS25 (Sanborns/Condumex/CICSA/Elementia) son punteros
//     a las otras hojas, no requerimientos: no generan solicitud.
//  2. Las subsidiarias NO son solicitudes aparte (regla explícita de la spec):
//     van en la descripción, y su dato entra como una CAPTURA por subsidiaria o
//     división sobre la misma solicitud — igual que la spec pide para el GEI de
//     Elementia ('captura por subsidiaria en la misma solicitud').
//  3. Área: las hojas por división mapean a su área; ChecklistIAS25 es el
//     checklist CONSOLIDADO del corporativo (sus tablas abarcan las 5 divisiones
//     a la vez y una solicitud solo puede tener un área) → Corporativo, con el
//     desglose por división en las capturas y en la evidencia.
//  4. Responsables: TEXTO en `responsable_cliente_texto`. Nunca se crean cuentas
//     con nombres de personas reales; los usuarios son genéricos por área.
//  5. Estados y capturas: exactamente los de la hoja 'Capturas y estados'. Lo que
//     el proceso real no entregó (ND, N/A, 'XXXX') NO se captura: el hueco es
//     real y es parte de lo que la plataforma debe mostrar.
//  6. Nada se inventa. Si el informe o el IAS no cubren un atributo, queda vacío
//     y la plataforma lo muestra como pendiente.
//
// -----------------------------------------------------------------------------
// CONTEO — la especificación dice 141 solicitudes; las fuentes dan 134.
// El script imprime la conciliación por hoja al terminar. Se importa lo que las
// fuentes contienen: completar hasta 141 exigiría inventar 7 requerimientos.
// -----------------------------------------------------------------------------
//
// Uso:
//   node scripts/import-gcarso.mjs                 # contra la BD local
//   node scripts/import-gcarso.mjs --limpiar       # solo borra el import previo
//   IMPORT_TARGET_OK=1 node scripts/import-gcarso.mjs   # requerido si NO es local
//
// Es IDEMPOTENTE: retira por completo el import anterior antes de rehacerlo.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

// -----------------------------------------------------------------------------
// Configuración
// -----------------------------------------------------------------------------
const RAIZ = process.cwd();
const DIR = path.join(RAIZ, "import-gcarso");
const F = {
  mapeo: path.join(DIR, "Mapeo_Import_GCarso.xlsx"),
  checklist: path.join(DIR, "Checklist-IAS2025-GCarso.xlsx"),
  informe: path.join(DIR, "Informe_GCarso_S1S2_2025.docx"),
  ias: path.join(DIR, "IAS_GCarso_2025.pdf"),
};

function leerEnvLocal() {
  const out = {};
  const p = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(p)) return out;
  for (const linea of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...leerEnvLocal(), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = env.ADMIN_EMAIL || "admin@irstrat.example";
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "Demo2025!";

const SOLO_LIMPIAR = process.argv.includes("--limpiar");

const TENANT = { nombre: "Grupo Carso", slug: "gcarso", prefijo: "GCSO" };
const REPORTE = { nombre: "Informe Anual Sustentable 2025", ejercicio: 2025 };

// Áreas y usuarios genéricos — hoja 'Tenant y áreas'.
const AREAS = [
  { nombre: "Comercial",    detalle: "Sanborns, Sears, Dax, Claro Shop, Mix Up",        correo: "comercial" },
  { nombre: "Industrial",   detalle: "CIDEC, Condumex Cables, Condumex Autopartes",     correo: "industrial" },
  { nombre: "Construcción", detalle: "Ductos, Perforación T/M, Equipos, Infra, Edificación", correo: "construccion" },
  { nombre: "Energía",      detalle: "MX, Panamá, Gasoductos, Geotermia",               correo: "energia" },
  { nombre: "Materiales",   detalle: "Elementia Materiales, Fortaleza Materiales",      correo: "materiales" },
  { nombre: "Corporativo",  detalle: "Requerimientos consolidados (RRHH, Compras, Consejo)", correo: "corporativo" },
];

// Hoja del checklist → área destino.
const HOJA_AREA = {
  "S1S2-Sanborns": "Comercial",
  "S1S2-Condumex": "Industrial",
  "S1S2-CICSA": "Construcción",
  "S1S2-Elementia": "Materiales",
};

const log = (...a) => console.log(...a);
const paso = (t) => console.log(`\n▸ ${t}`);

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------
const txt = (v) => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return "";
  }
  return String(v);
};
const limpio = (s) => txt(s).replace(/\s+/g, " ").trim();
const recorta = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Contraseña fuerte y legible; NUNCA una compartida ni la del seed demo. */
function passwordFuerte() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(20);
  const ch = Array.from(bytes, (b) => abc[b % abc.length]);
  return `${ch.slice(0,5).join("")}-${ch.slice(5,10).join("")}-${ch.slice(10,15).join("")}-${ch.slice(15,20).join("")}!`;
}

/** ¿La celda trae un dato numérico real, o un hueco del proceso (ND/N/A/XXXX)? */
function valorNumerico(v) {
  const s = limpio(v);
  if (!s) return null;
  if (/^(nd|n\/a|na|xxxx|no reportado|pendiente)/i.test(s)) return null;
  const n = Number(String(s).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// -----------------------------------------------------------------------------
// Clientes Supabase.
//
// El grueso del import corre con una SESIÓN DE STAFF (rol `authenticated`, RLS
// activo): si un analista no pudiera hacerlo por la UI, el script tampoco. Solo
// el alta de cuentas en auth y el canje de estados append-only usan service_role,
// igual que la propia aplicación.
// -----------------------------------------------------------------------------
async function conectar() {
  if (!SUPABASE_URL || !ANON || !SERVICE) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY.");
    process.exit(2);
  }
  const esLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
  log(`\n  Destino: ${SUPABASE_URL} ${esLocal ? "(local)" : "⚠️  NO LOCAL"}`);
  if (!esLocal && env.IMPORT_TARGET_OK !== "1") {
    console.error(
      "\n❌ El destino no es local y falta la confirmación explícita.\n" +
        "   Este import escribe datos de un cliente REAL. Para correrlo contra\n" +
        "   staging o producción hay que autorizarlo a propósito:\n" +
        "     IMPORT_TARGET_OK=1 node scripts/import-gcarso.mjs\n"
    );
    process.exit(2);
  }

  const jar = new Map();
  const db = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await db.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) {
    console.error(`Login de staff falló (${ADMIN_EMAIL}): ${error.message}`);
    process.exit(2);
  }
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: yo } = await db.auth.getUser();
  return { db, admin, staffId: yo.user.id };
}

// -----------------------------------------------------------------------------
// Idempotencia: se retira por completo el import anterior antes de rehacerlo.
// -----------------------------------------------------------------------------
async function limpiar({ db, admin }) {
  const { data: tenant } = await db
    .from("tenants").select("id").eq("slug", TENANT.slug).maybeSingle();
  if (!tenant) return log("  (no había import previo)");

  // Objetos de storage: se enumeran por carpeta de solicitud y se retiran.
  const { data: reportes } = await db.from("reportes").select("id").eq("tenant_id", tenant.id);
  for (const r of reportes ?? []) {
    const { data: sols } = await db.from("solicitudes").select("id").eq("reporte_id", r.id);
    for (const s of sols ?? []) {
      const carpeta = `${tenant.id}/${s.id}`;
      const { data: objs } = await admin.storage.from("evidencias").list(carpeta);
      if (objs?.length) {
        await admin.storage.from("evidencias").remove(objs.map((o) => `${carpeta}/${o.name}`));
      }
    }
  }
  // El reporte cascadea solicitudes, evidencias, capturas, registros, objetivos
  // y cuestionarios.
  await db.from("reportes").delete().eq("tenant_id", tenant.id);

  // Las cuentas: borrar el usuario de auth cascadea su perfil (RESTRICT del
  // tenant obliga a que los perfiles se vayan antes que él).
  const { data: perfiles } = await db
    .from("perfiles_usuario").select("id").eq("tenant_id", tenant.id);
  for (const p of perfiles ?? []) await admin.auth.admin.deleteUser(p.id);

  await db.from("areas_tenant").delete().eq("tenant_id", tenant.id);
  await db.from("tenants").delete().eq("id", tenant.id);
  log(`  import previo retirado (tenant ${tenant.id})`);
}

// -----------------------------------------------------------------------------
// Tenant, áreas, usuarios genéricos y reporte desde la plantilla con rubros.
// -----------------------------------------------------------------------------
async function crearTenant({ db, admin }) {
  const { data: tenant, error } = await db
    .from("tenants")
    .insert({
      nombre: TENANT.nombre, slug: TENANT.slug, prefijo_folio: TENANT.prefijo, activo: true,
      // "Carga por IRStrat" ENCENDIDO, y es un hecho del proceso real, no una
      // conveniencia del script: la evidencia de Carso la subió IRStrat a partir
      // del checklist y del IAS que el cliente entregó por correo. Con el toggle
      // apagado la base rechazaría esas cargas (fn_evidencia_marca_carga), y
      // encenderlo hace que cada una quede marcada `cargado_por_staff = true`:
      // el historial dirá "Cargado por [analista] (IRStrat) en nombre de [área]",
      // que es exactamente lo que ocurrió.
      staff_puede_cargar: true,
    })
    .select("id").single();
  if (error) throw new Error(`tenant: ${error.message}`);

  const { error: aErr } = await db.from("areas_tenant").insert(
    AREAS.map((a, i) => ({ tenant_id: tenant.id, nombre: a.nombre, orden: i }))
  );
  if (aErr) throw new Error(`áreas: ${aErr.message}`);

  // Usuarios genéricos por área: el proceso real lo atendieron personas con
  // nombre y apellido, pero no se crean cuentas a nombre de personas reales
  // (decisión registrada en la portada del mapeo). El responsable real queda
  // como texto en cada solicitud.
  const credenciales = [];
  for (const [i, a] of AREAS.entries()) {
    const email = `${a.correo}@gcarso.example`;
    const password = passwordFuerte();
    const nombre = `Usuario ${i + 1} · ${a.nombre}`;
    const { data: creado, error: uErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nombre },
    });
    if (uErr) throw new Error(`usuario ${email}: ${uErr.message}`);
    const { error: pErr } = await db.from("perfiles_usuario").insert({
      id: creado.user.id, tenant_id: tenant.id, rol: "cliente",
      area: a.nombre, nombre, email, activo: true,
    });
    if (pErr) throw new Error(`perfil ${email}: ${pErr.message}`);
    credenciales.push({ nombre, email, password, area: a.nombre });
  }

  // El reporte se clona de la plantilla CON RUBROS: es lo que hace que su Excel
  // de taxonomía resuelva las celdas GEI en vez de salir vacío.
  const { data: plantilla } = await db
    .from("plantillas")
    .select("id, nombre, plantilla_solicitudes(count)")
    .order("created_at", { ascending: false });
  const conRubros = [];
  for (const p of plantilla ?? []) {
    const { count } = await db
      .from("plantilla_solicitudes")
      .select("id", { count: "exact", head: true })
      .eq("plantilla_id", p.id)
      .not("rubro_taxonomia", "is", null);
    if ((count ?? 0) > 0) conRubros.push({ ...p, rubros: count });
  }
  if (!conRubros.length) {
    throw new Error(
      "No hay ninguna plantilla con rubros de taxonomía. Guarda una desde el reporte demo " +
      "(/admin/plantillas → 'Guardar desde un reporte') antes de importar."
    );
  }
  const elegida = conRubros[0];

  const { data: reporte, error: rErr } = await db
    .from("reportes")
    .insert({ tenant_id: tenant.id, nombre: REPORTE.nombre, ejercicio: REPORTE.ejercicio, estado: "activo" })
    .select("id").single();
  if (rErr) throw new Error(`reporte: ${rErr.message}`);

  log(`  tenant ${TENANT.slug} · ${AREAS.length} áreas · ${credenciales.length} usuarios`);
  log(`  reporte ${REPORTE.ejercicio} (plantilla de referencia: "${elegida.nombre}", ${elegida.rubros} rubros)`);
  return { tenantId: tenant.id, reporteId: reporte.id, credenciales, plantillaId: elegida.id };
}

// -----------------------------------------------------------------------------
// Layout de cada hoja del checklist (leído de sus filas de encabezado).
// resp/sol/ent/dat son rangos [primera, última] de columnas, una por subsidiaria.
// -----------------------------------------------------------------------------
const LAYOUT = {
  "S1S2-Sanborns": { resp: [4, 8], sol: [9, 13], ent: [14, 18], dat: [19, 23], nota: 24,
    subs: ["Sanborns", "Sears", "Dax", "Claro Shop y Claro Pagos", "Ishop / Mix Up"] },
  "S1S2-Condumex": { resp: [4, 6], sol: [7, 9], ent: [10, 12], dat: [13, 15], nota: 16,
    subs: ["CIDEC", "Condumex Cables", "Condumex Autopartes"] },
  "S1S2-CICSA": { resp: [5, 10], sol: [11, 16], ent: [17, 22], dat: [23, 28], nota: null,
    subs: ["Ductos", "Perforación Terrestre", "Perforación Marina", "Equipos y Estructuras", "Infra", "Edificación"] },
  // Elementia lleva UN responsable y UNA fecha para todas sus subsidiarias.
  "S1S2-Elementia": { resp: [4, 4], sol: [5, 5], ent: [6, 6], dat: [7, 9], nota: null,
    subs: ["Elementia Materiales", "Fortaleza Materiales", "Nacobre"] },
};

// Bloques de la hoja consolidada ChecklistIAS25 (fila 2 marca su inicio).
const CONS = { resp: [4, 24], sol: [26, 46], ent: [48, 69], info: [70, 92], com: [94, 99] };

/**
 * Regla de mapeo a rubro/datapoint — hoja 'Solicitudes' de la especificación.
 *
 * El RUBRO se asigna por id exacto del checklist, nunca por texto: un rubro es
 * único por reporte y "alcance 1" aparece también en filas vecinas (1.3 pide el
 * plan para gestionar las emisiones de alcance 1, que no es el dato).
 */
const RUBRO_POR_ID = {
  // Elementia 1.1 — 'Emisiones Brutas GEI Alcance 1 (t)', la única fila del
  // proceso real con el dato entregado (spec, hoja 'Capturas y estados').
  "S1S2-Elementia|1.1": "gei_alcance_1",
};

function mapearRubro(texto, hoja, id = null) {
  const t = texto.toLowerCase();
  const rubroId = RUBRO_POR_ID[`${hoja}|${id}`];
  if (rubroId) return { rubro: rubroId, datapoints: ["NIIF S2 29 (a)(i)"] };
  if (/\bagua\b|hídric/.test(t)) return { rubro: null, datapoints: ["VERT-AMB-01"] };
  if (/residuo/.test(t)) return { rubro: null, datapoints: ["VERT-AMB-02"] };
  if (/rotación|colaboradores|plantilla|permiso parental|tipo de colaborador/.test(t))
    return { rubro: null, datapoints: ["VERT-SOC-01"] };
  if (/capacitac|capacitad/.test(t)) return { rubro: null, datapoints: ["VERT-SOC-02"] };
  if (/gases de efecto invernadero|gases efecto invernadero|emisiones/.test(t))
    return { rubro: null, datapoints: ["NIIF S2 29 (a)(i)"] };
  if (/anticorrupción|corrupción|soborno|denuncia|consejo|derechos humanos|discriminación|ética/.test(t))
    return { rubro: null, datapoints: ["NIIF S1 44 (b)"] };
  // Resto: métricas de industria SASB. Se recaban pero su hoja de export está
  // bloqueada por licenciamiento (ver la recomendación de la portada del mapeo).
  return { rubro: null, datapoints: ["NIIF S1 46 a 50"] };
}

/**
 * ¿El requerimiento pide un número?
 *
 * `tieneDato` solo se pasa desde las hojas por división, donde la celda de datos
 * trae el valor entregado. En la hoja consolidada NO se usa: ahí la columna
 * 'Información' guarda la respuesta en prosa, y tener respuesta no convierte en
 * cuantitativa una pregunta abierta.
 */
function esCuantitativa(texto, tieneDato) {
  if (tieneDato) return true;
  return (
    /^tabla /i.test(texto) ||
    /\((t|ton|m3|m³|gj|kg|mwh|%|\$|#)[^)]*\)/i.test(texto) ||
    /^¿cu[áa]nt/i.test(texto) ||
    /n[úu]mero de|cantidad total|porcentaje de|tasa de|total colaboradores|saldos de|proporción/i.test(texto)
  );
}

/** Descripción con el rastro real del proceso: subsidiarias, fechas y notas. */
function descripcionProceso({ categoria, subs, solicitado, entregado, notas, hoja }) {
  const partes = [];
  if (categoria) partes.push(`Categoría del checklist: ${categoria}.`);
  if (subs.length) partes.push(`Alcance: ${subs.join(", ")}.`);
  if (solicitado.length) partes.push(`Solicitado ${solicitado.join(" / ")}.`);
  if (entregado.length) partes.push(`Entregado: ${entregado.join(" / ")}.`);
  if (notas.length) partes.push(`Notas del proceso: ${notas.join(" · ")}.`);
  partes.push(`Fuente: ${hoja} (Checklist IAS 2025).`);
  return partes.join(" ");
}

// -----------------------------------------------------------------------------
// Parseo del checklist → solicitudes
// -----------------------------------------------------------------------------
async function parsearChecklist() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(F.checklist);

  // Directorio de iniciales → nombre (hoja 'Responsables').
  const dir = new Map();
  const wsR = wb.getWorksheet("Responsables");
  wsR.eachRow((row) => {
    const ini = limpio(row.getCell(3).value);
    const nom = limpio(row.getCell(4).value);
    if (ini && nom && ini !== "Iniciales") dir.set(ini, nom);
  });

  const solicitudes = [];
  const conciliacion = {};

  // --- Hoja consolidada -------------------------------------------------------
  const wsC = wb.getWorksheet("ChecklistIAS25");
  let nCons = 0, punteros = 0;
  for (let i = 5; i <= wsC.rowCount; i++) {
    const row = wsC.getRow(i);
    const area = limpio(row.getCell(1).value);
    const categoria = limpio(row.getCell(2).value);
    const req = limpio(row.getCell(3).value);
    if (!req) continue;
    if (area === "Varias") { punteros++; continue; } // puntero a otra hoja

    const rango = (a, b) => {
      const out = [];
      for (let c = a; c <= b; c++) {
        const v = limpio(row.getCell(c).value);
        if (v && !out.includes(v)) out.push(v);
      }
      return out;
    };
    const responsables = rango(...CONS.resp).map((x) => dir.get(x) ?? x);
    const solicitado = rango(...CONS.sol);
    const entregado = rango(...CONS.ent);
    const info = rango(...CONS.info);
    const comentarios = rango(...CONS.com);

    const { rubro, datapoints } = mapearRubro(req, "ChecklistIAS25");
    solicitudes.push({
      hoja: "ChecklistIAS25",
      titulo: recorta(req, 120),
      area: "Corporativo",
      categoria,
      areaChecklist: area,
      responsableTexto: responsables.join(", ") || null,
      esCuantitativa: esCuantitativa(req, false),
      unidad: null,
      rubro,
      datapoints,
      descripcion: descripcionProceso({
        categoria: `${area} · ${categoria}`, subs: [], solicitado, entregado,
        notas: [...info.slice(0, 3), ...comentarios].filter(Boolean), hoja: "ChecklistIAS25",
      }),
      datos: [],
    });
    nCons++;
  }
  conciliacion["ChecklistIAS25"] = { real: nCons, punteros, spec: 44 };

  // --- Hojas por división -----------------------------------------------------
  const SPEC = { "S1S2-Sanborns": 21, "S1S2-Condumex": 22, "S1S2-CICSA": 22, "S1S2-Elementia": 32 };
  for (const [hoja, lay] of Object.entries(LAYOUT)) {
    const ws = wb.getWorksheet(hoja);
    const porId = new Map();
    for (let i = 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const id = limpio(row.getCell(1).value);
      const req = limpio(row.getCell(3).value);
      if (!/^\d+(\.\d+)?$/.test(id) || !req) continue;

      const col = (c) => limpio(row.getCell(c).value);
      const unico = (a, b) => {
        const out = [];
        for (let c = a; c <= b; c++) { const v = col(c); if (v && !out.includes(v)) out.push(v); }
        return out;
      };
      // Datos: uno por subsidiaria, conservando de cuál viene.
      const datos = [];
      for (let c = lay.dat[0]; c <= lay.dat[1]; c++) {
        const bruto = col(c);
        if (!bruto) continue;
        datos.push({ sub: lay.subs[c - lay.dat[0]] ?? `col${c}`, bruto, valor: valorNumerico(bruto) });
      }

      if (!porId.has(id)) {
        const { rubro, datapoints } = mapearRubro(req, hoja, id);
        porId.set(id, {
          hoja, id, titulo: recorta(req, 120), area: HOJA_AREA[hoja],
          categoria: col(2), areaChecklist: HOJA_AREA[hoja],
          responsables: [], solicitado: [], entregado: [], notas: [],
          rubro, datapoints, datos: [],
          reqCompleto: req,
        });
      }
      const s = porId.get(id);
      for (const r of unico(...lay.resp)) if (!s.responsables.includes(r)) s.responsables.push(dir.get(r) ?? r);
      for (const d of unico(...lay.sol)) if (!s.solicitado.includes(d)) s.solicitado.push(d);
      for (const d of unico(...lay.ent)) if (!s.entregado.includes(d)) s.entregado.push(d);
      if (lay.nota) { const n = col(lay.nota); if (n && !s.notas.includes(n)) s.notas.push(n); }
      s.datos.push(...datos);
    }

    for (const s of porId.values()) {
      solicitudes.push({
        hoja: s.hoja, idChecklist: s.id, titulo: s.titulo, area: s.area, categoria: s.categoria,
        areaChecklist: s.areaChecklist,
        responsableTexto: s.responsables.join(", ") || null,
        esCuantitativa: esCuantitativa(s.reqCompleto, s.datos.some((d) => d.valor != null)),
        unidad: unidadDe(s.reqCompleto),
        rubro: s.rubro, datapoints: s.datapoints,
        descripcion: descripcionProceso({
          categoria: s.categoria, subs: lay.subs, solicitado: s.solicitado,
          entregado: s.entregado, notas: s.notas, hoja: s.hoja,
        }),
        datos: s.datos,
      });
    }
    conciliacion[hoja] = { real: porId.size, punteros: 0, spec: SPEC[hoja] };
  }

  return { solicitudes, conciliacion };
}

/** Unidad esperada, tomada del propio texto del requerimiento. */
function unidadDe(texto) {
  const m = texto.match(/\((t|ton|m3|m³|GJ|kg|MWh|%|\$|#)[^)]*\)/i);
  if (!m) return null;
  return m[1].replace(/^m3$/i, "m³");
}

// -----------------------------------------------------------------------------
// Tablas de datos del checklist: totales por división.
//
// Todas comparten forma: col1 = división, col2 = empresa, y una fila 'Total' al
// cerrar cada división. Cuando el total es una fórmula que Excel no dejó
// calculada (o los valores vienen con unidad embebida, como el agua Industrial
// en 'ML'), se suman las filas miembro y se conserva la unidad como nota.
// -----------------------------------------------------------------------------
function numeroConUnidad(bruto) {
  const s = limpio(bruto);
  if (!s || /^(nd|n\/a|na|xxxx|no reportado)/i.test(s)) return null;
  const m = s.match(/^([\d.,]+)\s*([A-Za-z³]*)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { valor: n, unidad: m[2] || null };
}

function totalesPorDivision(wb, hoja, columnas) {
  const ws = wb.getWorksheet(hoja);
  const out = new Map();
  let division = null;
  const acumulado = new Map();
  for (let i = 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const c1 = limpio(row.getCell(1).value);
    const c2 = limpio(row.getCell(2).value);
    if (c1 && c1 !== "Total") division = c1;
    if (!division) continue;

    const suma = (cols) => {
      let total = 0, unidad = null, hubo = false;
      for (const c of cols) {
        const p = numeroConUnidad(row.getCell(c).value);
        if (!p) continue;
        total += p.valor; hubo = true;
        if (p.unidad && !unidad) unidad = p.unidad;
      }
      return hubo ? { valor: total, unidad } : null;
    };

    if (/^total$/i.test(c2)) {
      const t = suma(columnas);
      const acc = acumulado.get(division);
      // El total de la hoja gana; si viene como fórmula sin calcular, sirve la
      // suma de las filas miembro (es el caso del agua Industrial, en ML).
      const elegido = t && t.valor > 0 ? t : acc;
      if (elegido) out.set(division, elegido);
      acumulado.delete(division);
      continue;
    }
    const p = suma(columnas);
    if (p) {
      const acc = acumulado.get(division) ?? { valor: 0, unidad: null };
      acc.valor += p.valor;
      if (p.unidad && !acc.unidad) acc.unidad = p.unidad;
      acumulado.set(division, acc);
    }
  }
  for (const [d, v] of acumulado) if (!out.has(d)) out.set(d, v);
  return out;
}

// -----------------------------------------------------------------------------
// Plan de capturas — hoja 'Capturas y estados' de la especificación.
// `buscar` localiza la solicitud por su título; `origen` dice de qué tabla y
// columnas del checklist sale el valor de cada división.
// -----------------------------------------------------------------------------
const PLAN = [
  { clave: "agua", hoja: "ChecklistIAS25", buscar: /Tabla Desempeño Ambiental\. Agua/i,
    origen: { tabla: "Ambiental", cols: [3] }, unidad: "m³",
    estado: "validado", evidencias: ["checklist"] },
  { clave: "residuos", hoja: "ChecklistIAS25", buscar: /Tabla Desempeño Ambiental\. Residuos/i,
    origen: { tabla: "Ambiental", cols: [6, 7, 8] }, unidad: "kg",
    estado: "validado", evidencias: ["checklist"],
    nota: "Suma de residuos sólidos urbanos, de manejo especial y peligrosos." },
  { clave: "colaboradores", hoja: "ChecklistIAS25", buscar: /^Total colaboradores/i,
    origen: { tabla: "Colaboradores", cols: [24] }, unidad: "personas",
    estado: "recibido", evidencias: ["checklist"],
    nota: "Total de la división; el desglose por género, edad y jornada está en la evidencia." },
  { clave: "rotacion", hoja: "ChecklistIAS25", buscar: /Tabla Rotación de Personal/i,
    origen: { tabla: "Rotación", cols: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] }, unidad: "personas",
    estado: "recibido", evidencias: ["checklist"],
    nota: "Salidas totales de la división (renuncias, despidos, jubilaciones y otros)." },
  { clave: "capacitacion", hoja: "ChecklistIAS25", buscar: /Tabla Capacitación Especializada/i,
    origen: { tabla: "CapEsp", cols: [3] }, unidad: "brigadistas",
    estado: "recibido", evidencias: ["checklist"],
    nota: "Brigadistas por división; el resto de temáticas y coberturas está en la evidencia." },
  { clave: "salud", hoja: "ChecklistIAS25", buscar: /diagnosticados médicamente|campañas de salud/i,
    origen: { tabla: "CapEsp", cols: [5] }, unidad: "personas",
    estado: "recibido", evidencias: ["checklist"],
    nota: "Personas valoradas en el Programa de Salud Integral Carso." },
];

/** Filas de Elementia que la especificación marca con captura por subsidiaria. */
const PLAN_ELEMENTIA = [
  { id: "1.1", unidad: "tCO2e", estado: "validado", evidencias: ["checklist", "informe"] },
  { id: "3.1", unidad: "GJ",    estado: "validado", evidencias: ["checklist", "informe"] },
  { id: "4.1", unidad: "m³",    estado: "validado", evidencias: ["checklist", "informe"] },
  { id: "5.1", unidad: "t",     estado: "validado", evidencias: ["checklist", "informe"] },
];

// -----------------------------------------------------------------------------
// Escritura: solicitudes, evidencias, capturas y estados.
//
// El orden importa y es el mismo que usa el seed: TODO se inserta con la
// solicitud en su estado de trabajo y los estados finales se fijan al FINAL, en
// un UPDATE. Los triggers de Fase 2 reabren una solicitud validada en cuanto
// entra evidencia o captura; fijar el estado antes lo perdería.
// -----------------------------------------------------------------------------
async function subirEvidencia({ db, admin }, { tenantId, solicitudId, staffId, area, archivo, nombre, notas }) {
  const ruta = `${tenantId}/${solicitudId}/${nombre}`;
  const cuerpo = Buffer.isBuffer(archivo) ? archivo : fs.readFileSync(archivo);
  const tipo = nombre.endsWith(".pdf") ? "application/pdf"
    : nombre.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const { error: upErr } = await admin.storage.from("evidencias")
    .upload(ruta, cuerpo, { contentType: tipo, upsert: true });
  if (upErr) throw new Error(`storage ${nombre}: ${upErr.message}`);

  // `area_origen` es el ÁREA EN CUYO NOMBRE carga IRStrat, y con el toggle
  // `staff_puede_cargar` encendido la base la exige (fn_evidencia_marca_carga):
  // una carga del staff sin área dejaría el historial sin poder decir de parte de
  // quién es la evidencia. Se toma el área de la propia solicitud.
  const { error } = await db.from("evidencias").insert({
    solicitud_id: solicitudId, archivo_path: ruta, nombre_original: nombre,
    periodo_cubierto: String(REPORTE.ejercicio), area_origen: area ?? null,
    subido_por: staffId, notas: notas ?? null,
  });
  if (error) throw new Error(`evidencia ${nombre}: ${error.message}`);
  return ruta;
}

async function crearSolicitudes(ctx, { reporteId }, solicitudes, datapointIds) {
  const creadas = [];
  let orden = 0;
  for (const s of solicitudes) {
    const { data, error } = await ctx.db.from("solicitudes").insert({
      reporte_id: reporteId,
      titulo: s.titulo,
      descripcion: s.descripcion,
      area_asignada: s.area,
      es_cuantitativa: s.esCuantitativa,
      unidad_esperada: s.unidad,
      responsable_cliente_texto: s.responsableTexto,
      rubro_taxonomia: s.rubro,
      orden: (orden += 10),
    }).select("id").single();
    if (error) throw new Error(`solicitud "${s.titulo.slice(0, 40)}": ${error.message}`);

    const dps = (s.datapoints ?? []).map((c) => datapointIds.get(c)).filter(Boolean);
    if (dps.length) {
      await ctx.db.from("mapeo_solicitud_datapoint")
        .insert(dps.map((datapoint_id) => ({ solicitud_id: data.id, datapoint_id })));
    }
    creadas.push({ ...s, id: data.id });
  }
  return creadas;
}

/**
 * Capturas del proceso real. Cada captura necesita una evidencia que la
 * respalde (la BD lo exige), así que la evidencia se sube primero y las
 * capturas de esa solicitud cuelgan de ella.
 */
async function aplicarCapturas(ctx, { tenantId, staffId }, creadas, wbChecklist) {
  const stats = { capturas: 0, evidencias: 0, porEstado: {} };
  const estadosFinales = new Map();
  const conCaptura = new Set();
  const archivo = {
    checklist: { ruta: F.checklist, nombre: "Checklist-IAS2025-GCarso.xlsx" },
    informe: { ruta: F.informe, nombre: "Informe_GCarso_S1S2_2025.docx" },
  };

  const adjuntar = async (sol, cuales, notas) => {
    for (const c of cuales) {
      await subirEvidencia(ctx, {
        tenantId, solicitudId: sol.id, staffId, area: sol.area,
        archivo: archivo[c].ruta, nombre: archivo[c].nombre, notas,
      });
      stats.evidencias++;
    }
    const { data } = await ctx.db.from("evidencias")
      .select("id").eq("solicitud_id", sol.id).order("version", { ascending: false }).limit(1);
    return data?.[0]?.id ?? null;
  };

  // --- Tablas consolidadas: una captura por división -------------------------
  for (const plan of PLAN) {
    const sol = creadas.find((s) => s.hoja === plan.hoja && plan.buscar.test(s.titulo));
    if (!sol) { log(`  ⚠️  sin solicitud para el plan "${plan.clave}"`); continue; }
    const totales = totalesPorDivision(wbChecklist, plan.origen.tabla, plan.origen.cols);
    const evidenciaId = await adjuntar(sol, plan.evidencias, plan.nota ?? null);
    if (!evidenciaId) continue;
    let suma = 0; const divisionesSumadas = []; const excluidas = [];

    for (const [division, v] of totales) {
      if (!AREAS.some((a) => a.nombre === division)) continue; // solo las 5 divisiones
      const unidad = v.unidad && v.unidad !== plan.unidad ? v.unidad : plan.unidad;
      const nota = v.unidad && v.unidad !== plan.unidad
        ? `${division}: reportado en ${v.unidad}, no en ${plan.unidad}.`
        : `${division}.`;
      const { error } = await ctx.db.from("capturas_valor").insert({
        solicitud_id: sol.id, evidencia_id: evidenciaId, valor: v.valor,
        unidad, periodo: String(REPORTE.ejercicio), capturado_por: staffId, confirmado: true,
        justificacion: `${nota}${plan.nota ? ` ${plan.nota}` : ""}`.trim(),
      });
      if (error) throw new Error(`captura ${plan.clave}/${division}: ${error.message}`);
      stats.capturas++;
      conCaptura.add(sol.id);
      if (unidad === plan.unidad) { suma += v.valor; divisionesSumadas.push(division); }
      else excluidas.push(`${division} (${v.unidad})`);
    }

    // Consolidado AL FINAL: la plataforma toma la última captura confirmada como
    // valor vigente, así que sin este total el dato visible sería el de una
    // división cualquiera. El desglose queda íntegro en el historial.
    if (divisionesSumadas.length > 1) {
      const nota = `Total ${TENANT.nombre}: suma de ${divisionesSumadas.join(", ")}.` +
        (excluidas.length ? ` No incluye ${excluidas.join(", ")} por venir en otra unidad.` : "");
      const { error } = await ctx.db.from("capturas_valor").insert({
        solicitud_id: sol.id, evidencia_id: evidenciaId, valor: suma, unidad: plan.unidad,
        periodo: String(REPORTE.ejercicio), capturado_por: staffId, confirmado: true,
        justificacion: nota,
      });
      if (error) throw new Error(`captura consolidada ${plan.clave}: ${error.message}`);
      stats.capturas++;
    }
    estadosFinales.set(sol.id, plan.estado);
  }

  // --- Elementia: captura por subsidiaria ------------------------------------
  for (const plan of PLAN_ELEMENTIA) {
    const sol = creadas.find((s) => s.hoja === "S1S2-Elementia" && s.idChecklist === plan.id);
    if (!sol) { log(`  ⚠️  sin solicitud Elementia ${plan.id}`); continue; }
    const evidenciaId = await adjuntar(sol, plan.evidencias, "Valores entregados por mail el 20/04/2026.");
    if (!evidenciaId) continue;
    let suma = 0; const subsSumadas = [];
    for (const d of sol.datos) {
      if (d.valor == null) continue;
      const { error } = await ctx.db.from("capturas_valor").insert({
        solicitud_id: sol.id, evidencia_id: evidenciaId, valor: d.valor,
        unidad: plan.unidad, periodo: String(REPORTE.ejercicio),
        capturado_por: staffId, confirmado: true,
        justificacion: `${d.sub}.`,
      });
      if (error) throw new Error(`captura Elementia ${plan.id}/${d.sub}: ${error.message}`);
      stats.capturas++;
      conCaptura.add(sol.id);
      suma += d.valor; subsSumadas.push(d.sub);
    }

    // Esta solicitud SÍ llega a la plantilla oficial (lleva rubro GEI): sin el
    // consolidado, la celda de la norma mostraría el dato de una sola
    // subsidiaria y le atribuiría a la división el valor de una parte.
    if (subsSumadas.length > 1) {
      const { error } = await ctx.db.from("capturas_valor").insert({
        solicitud_id: sol.id, evidencia_id: evidenciaId, valor: suma, unidad: plan.unidad,
        periodo: String(REPORTE.ejercicio), capturado_por: staffId, confirmado: true,
        justificacion: `Total de la división: suma de ${subsSumadas.join(" y ")}.`,
      });
      if (error) throw new Error(`captura consolidada Elementia ${plan.id}: ${error.message}`);
      stats.capturas++;
    }
    estadosFinales.set(sol.id, plan.estado);
  }

  return { stats, estadosFinales, conCaptura };
}

// -----------------------------------------------------------------------------
// Contenido del informe (docx) — tablas [100002] riesgos/oportunidades y
// [100003] objetivos. Se extraen los ítems NUMERADOS y sus atributos; lo que el
// informe no dice se queda vacío y la plataforma lo mostrará como pendiente.
// -----------------------------------------------------------------------------
function textoDocx() {
  const xml = execFileSync("unzip", ["-p", F.informe, "word/document.xml"], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8");
  return xml
    .replace(/<w:tbl[ >]/g, "\n@@TABLA@@<w:tbl ")
    .replace(/<\/w:tc>/g, " @@CELDA@@")
    .replace(/<w:tr[ >]/g, "\n@@FILA@@<w:tr ")
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<w:br[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
}

/** Quita los códigos de referencia NIIF (S1.30.a.1…) que acompañan cada etiqueta. */
const sinCodigos = (s) => s.replace(/\s+S[12]\.[0-9a-zA-Z.]+/g, "").replace(/@@CELDA@@/g, "").trim();

function extraerBloque(lineas, marcador, siguiente) {
  const i = lineas.findIndex((l) => l.includes(marcador));
  const j = siguiente ? lineas.findIndex((l) => l.includes(siguiente)) : lineas.length;
  if (i < 0) return [];
  return lineas.slice(i, j > i ? j : lineas.length).map((l) => l.replace(/@@FILA@@/g, "").trim());
}

function extraerItems(bloque, claves) {
  const items = [];
  let actual = null;
  for (let i = 0; i < bloque.length; i++) {
    const l = sinCodigos(bloque[i]);
    const m = l.match(/^(\d+)\.\s+(.+)$/);
    // Un ítem empieza cuando su título aparece SOLO en la fila (el índice
    // inicial los lista juntos y ese no cuenta).
    if (m && !/\n/.test(bloque[i]) && m[2].length < 120) {
      const yaExiste = items.find((x) => x.n === m[1]);
      actual = yaExiste ?? { n: m[1], nombre: m[2].trim(), attrs: {} };
      if (!yaExiste) items.push(actual);
      continue;
    }
    if (!actual) continue;
    if (claves.includes(l)) {
      // Entre la etiqueta y su valor va el marcador de fila (queda como línea
      // vacía). El valor puede ocupar varios párrafos seguidos: se toman todos
      // hasta el siguiente marcador, para no truncar las descripciones largas.
      const partes = [];
      let j = i + 1;
      while (j < bloque.length && !sinCodigos(bloque[j])) j++;   // saltar el marcador
      for (; j < bloque.length; j++) {
        const cand = sinCodigos(bloque[j]);
        if (!cand) break;                       // fin de la celda
        if (claves.includes(cand)) break;       // ya es la siguiente etiqueta
        partes.push(cand);
      }
      if (partes.length) actual.attrs[l] = partes.join("\n\n");
    }
  }
  return items.filter((x) => Object.keys(x.attrs).length > 0);
}

// Espejo de TIPO_POR_AMBITO en lib/objetivos-opciones.ts (ese archivo es la
// fuente canónica; es TypeScript y no se puede importar desde un .mjs).
const TIPO_POR_AMBITO = {
  climatico: [
    "Fijado por la entidad",
    "Fijado por ley o regulación",
    "Objetivo de emisiones de gases de efecto invernadero",
  ],
  sostenibilidad: ["Fijado por la entidad", "Fijado por ley o regulación"],
};

const TIPO_REGISTRO = {
  "Riesgo físico": "riesgo_fisico",
  "Riesgo de transición": "riesgo_transicion",
};

async function importarContenidoInforme(ctx, { reporteId }) {
  const lineas = textoDocx();
  const stats = { registros: 0, objetivos: 0, cuestionarios: 0 };

  // --- [100002] riesgos y oportunidades → registros de clima ------------------
  const bloqueR = extraerBloque(lineas, "[100002]", "[100003]");
  const riesgos = extraerItems(bloqueR, [
    "Descripción del riesgo o la oportunidad",
    "Categoría del riesgo o la oportunidad",
    "Tipo de riesgo climático",
    "Horizontes temporales en los que cabe esperar razonablemente que se produzcan los efectos del riesgo o la oportunidad",
    "Métrica(s) relacionada(s) con riesgos y oportunidades",
  ]);

  const registros = [];
  for (const [i, r] of riesgos.entries()) {
    const categoria = r.attrs["Categoría del riesgo o la oportunidad"] ?? "";
    const tipoClim = r.attrs["Tipo de riesgo climático"] ?? "";
    const tipo = /oportunidad/i.test(categoria) ? "oportunidad" : (TIPO_REGISTRO[tipoClim] ?? "riesgo_fisico");
    const horizontesRaw = r.attrs["Horizontes temporales en los que cabe esperar razonablemente que se produzcan los efectos del riesgo o la oportunidad"] ?? "";
    const horizontes = ["Corto plazo", "Mediano plazo", "Largo plazo"]
      .filter((h) => horizontesRaw.toLowerCase().includes(h.toLowerCase()));

    const { data, error } = await ctx.db.from("registros_clima").insert({
      reporte_id: reporteId, tipo, nombre: r.nombre,
      descripcion: r.attrs["Descripción del riesgo o la oportunidad"] ?? null,
      horizontes: horizontes.length ? horizontes : null,
      orden: (i + 1) * 10, activo: true,
    }).select("id").single();
    if (error) throw new Error(`registro "${r.nombre}": ${error.message}`);
    registros.push({ id: data.id, nombre: r.nombre });
    stats.registros++;
  }

  // --- [100003] objetivos ----------------------------------------------------
  const bloqueO = extraerBloque(lineas, "[100003]", "[200000]");
  const objs = extraerItems(bloqueO, [
    "¿Se trata de un objetivo relacionado con el clima?",
    "Objetivo fijado por la Emisora, por ley o regulación, incluido cualquier objetivo de emisiones de gases de efecto invernadero",
    "Métrica utilizada para fijar el objetivo",
    "Objetivo de la meta",
  ]);

  const objetivos = [];
  for (const [i, o] of objs.entries()) {
    const climatico = /^s[ií]/i.test(o.attrs["¿Se trata de un objetivo relacionado con el clima?"] ?? "");
    const ambito = climatico ? "climatico" : "sostenibilidad";
    // 'Fijado por la entidad / por ley' es el campo `tipo` (enum condicionado por
    // ámbito), no `naturaleza` — que es riesgo/oportunidad y el informe no lo
    // declara para los objetivos, así que queda vacío.
    const tipoBruto = o.attrs["Objetivo fijado por la Emisora, por ley o regulación, incluido cualquier objetivo de emisiones de gases de efecto invernadero"] ?? "";
    const tipo = TIPO_POR_AMBITO[ambito].find(
      (t) => t.toLowerCase() === tipoBruto.trim().toLowerCase()
    ) ?? null;

    const { data, error } = await ctx.db.from("objetivos").insert({
      reporte_id: reporteId,
      ambito,
      // `naturaleza` (riesgo/oportunidad) ubica el objetivo en las secciones de
      // la hoja S1 51 y es obligatoria. El informe NO lo clasifica, así que se
      // deja el valor por omisión de la plataforma y se deja constancia en las
      // notas de la ficha, en vez de inventar una clasificación.
      nombre: o.nombre,
      descripcion: o.attrs["Objetivo de la meta"] ?? null,
      metrica: o.attrs["Métrica utilizada para fijar el objetivo"] ?? null,
      tipo,
      // El informe dice explícitamente que NO es una meta cuantitativa: no hay
      // meta, periodo base, hito ni tipo de objetivo. Se dejan vacíos para que
      // el export los muestre como pendientes en vez de inventarlos.
      meta: null, periodo_aplicacion: null, periodo_base: null, hito_intermedio: null,
      tipo_objetivo: null, parte_entidad: null,
      alineacion_acuerdo_internacional: null,
      orden: (i + 1) * 10, activo: true,
    }).select("id").single();
    if (error) throw new Error(`objetivo "${o.nombre}": ${error.message}`);

    await ctx.db.from("objetivos_detalle").insert({
      objetivo_id: data.id,
      notas:
        "Importado del Informe Anual S1/S2 2025 de Grupo Carso, tabla [100003]. " +
        "El informe declara expresamente que para el ejercicio 2025 este objetivo NO es una meta " +
        "cuantitativa, por lo que no hay meta, periodo base ni hito intermedio. Tampoco clasifica " +
        "el objetivo entre riesgos y oportunidades: se ubicó en Riesgos por el valor por omisión " +
        "de la plataforma. Las secciones sin dato quedan pendientes a propósito.",
    });

    objetivos.push({ id: data.id, nombre: o.nombre });
    stats.objetivos++;
  }

  // --- Cuestionarios narrativos ---------------------------------------------
  // Solo lo que el informe responde de verdad. El análisis de escenarios existe
  // (S2.22.a.1) y es cualitativo; de créditos de carbono no dice nada, así que
  // esas preguntas quedan pendientes.
  const resiliencia = lineas.find((l) => l.includes("dos escenarios narrativos aplicados"));
  const horizontesEsc = lineas.find((l) => l.includes("horizontes de corto, mediano y largo plazo"));
  const respuestas = [];
  if (resiliencia) {
    respuestas.push({ hoja: "S2 22(b)(i)", pregunta_orden: 1, respuesta: sinCodigos(resiliencia), tipo_dato: "Texto" });
    const escenarios = lineas
      .filter((l) => /^\(i+\)\s+un escenario/.test(l.trim()))
      .map((l) => sinCodigos(l)).join(" ");
    if (escenarios) {
      respuestas.push({ hoja: "S2 22(b)(i)", pregunta_orden: 2, respuesta: escenarios, tipo_dato: "Texto",
        notas: "El informe describe los escenarios pero no cita fuentes externas." });
    }
  }
  if (horizontesEsc) {
    respuestas.push({ hoja: "S2 22(b)(i)", pregunta_orden: 7,
      respuesta: "Corto plazo; Mediano plazo; Largo plazo", tipo_dato: "Enumeración" });
  }
  for (const r of respuestas) {
    const { error } = await ctx.db.from("cuestionarios_respuestas")
      .insert({ reporte_id: reporteId, ...r });
    if (error) throw new Error(`cuestionario ${r.hoja}#${r.pregunta_orden}: ${error.message}`);
    stats.cuestionarios++;
  }

  return { stats, registros, objetivos };
}

// -----------------------------------------------------------------------------
// Narrativa del IAS 2025 (PDF, 116 págs) — hoja 'Narrativa IAS'.
//
// Regla maestra de la especificación: el IAS es fuente de CONTENIDO y de
// EVIDENCIA CUALITATIVA de políticas. NUNCA evidencia de una solicitud
// cuantitativa (el pipeline es dato → evidencia → informe, no al revés), y donde
// difiera del checklist o del docx en cifras, gana el checklist.
//
// Cada capítulo se recorta a su propio PDF con pdf-lib y se adjunta solo a las
// solicitudes que la especificación lista, citando las páginas.
// -----------------------------------------------------------------------------
const CAPITULOS = [
  { clave: "ambiental", titulo: "Compromiso de Grupo Carso con el",
    hasta: "Nuestro desempeño económico", respaldo: [63, 73],
    destino: "registros",
    solicitudes: [{ hoja: null, buscar: /gestión ambiental|desempeño ambiental|política.*ambient/i, area: null }] },
  { clave: "sostenibilidad", titulo: "Marco de sostenibilidad", hasta: "Nuestro desempeño económico",
    respaldo: [21, 29], destino: "objetivos", solicitudes: [] },
  { clave: "anticorrupcion", titulo: "Prevención de la corrupción", hasta: "Anexos",
    respaldo: [98, 105], destino: "solicitudes",
    solicitudes: [{ buscar: /anticorrupción|corrupción|soborno/i, area: "Corporativo" }] },
  { clave: "ddhh", titulo: "No discriminación y diversidad", hasta: "Prevención de la corrupción",
    respaldo: [91, 97], destino: "solicitudes",
    solicitudes: [{ buscar: /derechos humanos|discriminación|denuncia|remediación/i, area: "Corporativo" }] },
  { clave: "salud", titulo: "Salud y seguridad de nuestros", hasta: "Transparencia, privacidad",
    respaldo: [55, 61], destino: "solicitudes",
    solicitudes: [{ buscar: /lesiones|fallecimientos|campañas de salud|diagnosticados/i, area: "Corporativo" }] },
  { clave: "talento", titulo: "Atracción, retención y desarrollo", hasta: "Salud y seguridad de nuestros",
    respaldo: [52, 55], destino: "solicitudes",
    solicitudes: [{ buscar: /capacitación|capacitad/i, area: "Corporativo" }] },
];

function paginasIAS() {
  const texto = execFileSync("pdftotext", ["-layout", F.ias, "-"], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8");
  return texto.split("\f");
}

/** Página donde arranca una sección, localizada por su título (nunca el índice). */
function localizar(paginas, titulo, desde = 3) {
  for (let i = desde - 1; i < paginas.length; i++) {
    if (paginas[i].toLowerCase().includes(titulo.toLowerCase())) return i + 1;
  }
  return null;
}

/** Frases utilizables de un rango de páginas: sin la barra de navegación ni ruido. */
function frasesDe(paginas, desde, hasta) {
  const NAV = ["Sostenibilidad", "Acerca de", "Mensaje del Presidente", "Nuestro Perfil Corporativo",
    "Nuestro desempeño", "Gobernanza corporativa", "Informe Anual", "Identidad y Trayectoria",
    "socioambiental", "Anexos", "ÍNDICE"];
  const out = [];
  for (let p = desde; p <= hasta && p <= paginas.length; p++) {
    for (const linea of paginas[p - 1].split("\n")) {
      const l = linea.replace(/\s+/g, " ").trim();
      if (l.length < 80 || NAV.some((n) => l.includes(n))) continue;
      if (!/[.]$/.test(l) && l.length < 140) continue;
      out.push({ pagina: p, texto: l });
    }
  }
  return out;
}

async function recortarCapitulo(pdfOriginal, desde, hasta) {
  const doc = await PDFDocument.load(pdfOriginal, { ignoreEncryption: true });
  const salida = await PDFDocument.create();
  const idx = [];
  for (let p = desde; p <= hasta && p <= doc.getPageCount(); p++) idx.push(p - 1);
  const paginas = await salida.copyPages(doc, idx);
  paginas.forEach((pg) => salida.addPage(pg));
  return Buffer.from(await salida.save());
}

async function aplicarNarrativaIAS(ctx, { tenantId, staffId }, creadas, registros, objetivos, conCaptura) {
  const stats = { evidencias: 0, registrosEnriquecidos: 0, objetivosEnriquecidos: 0 };
  const paginas = paginasIAS();
  const pdfOriginal = fs.readFileSync(F.ias);
  const estadosIAS = new Map();

  for (const cap of CAPITULOS) {
    const inicio = localizar(paginas, cap.titulo) ?? cap.respaldo[0];
    const fin = (cap.hasta ? localizar(paginas, cap.hasta, inicio + 1) : null) ?? cap.respaldo[1];
    const desde = Math.min(inicio, fin), hasta = Math.max(inicio, fin);
    const frases = frasesDe(paginas, desde, hasta);
    if (!frases.length) { log(`  ⚠️  capítulo "${cap.clave}" sin texto utilizable (págs ${desde}-${hasta})`); continue; }

    // --- Enriquecimiento de descripciones ------------------------------------
    if (cap.destino === "registros") {
      for (const r of registros) {
        const clave = r.nombre.toLowerCase().split(/[ ,]/).filter((w) => w.length > 6).slice(0, 3);
        const match = frases.find((f) => clave.some((k) => f.texto.toLowerCase().includes(k)));
        if (!match) continue;   // sin texto real que lo respalde: no se toca
        const { data: actual } = await ctx.db.from("registros_clima")
          .select("descripcion").eq("id", r.id).single();
        const cita = `${match.texto} (IAS 2025, p. ${match.pagina})`;
        await ctx.db.from("registros_clima")
          .update({ descripcion: `${actual?.descripcion ?? ""}\n\n${cita}`.trim() })
          .eq("id", r.id);
        stats.registrosEnriquecidos++;
      }
    }
    if (cap.destino === "objetivos") {
      for (const o of objetivos) {
        const clave = o.nombre.toLowerCase().split(/[ ,]/).filter((w) => w.length > 6).slice(0, 3);
        const match = frases.find((f) => clave.some((k) => f.texto.toLowerCase().includes(k)));
        if (!match) continue;
        const { data: actual } = await ctx.db.from("objetivos")
          .select("descripcion").eq("id", o.id).single();
        const cita = `${match.texto} (IAS 2025, p. ${match.pagina})`;
        await ctx.db.from("objetivos")
          .update({ descripcion: `${actual?.descripcion ?? ""}\n\n${cita}`.trim() })
          .eq("id", o.id);
        stats.objetivosEnriquecidos++;
      }
    }

    // --- Evidencia cualitativa ------------------------------------------------
    if (!cap.solicitudes.length) continue;
    const recorte = await recortarCapitulo(pdfOriginal, desde, hasta);
    const nombre = `IAS2025-${cap.clave}-p${desde}-${hasta}.pdf`;
    for (const regla of cap.solicitudes) {
      const objetivo = creadas.filter(
        (s) => regla.buscar.test(s.titulo) &&
               (!regla.area || s.area === regla.area) &&
               // NUNCA sobre una solicitud cuyo entregable es la CIFRA: el IAS
               // no es fuente de datos (el pipeline es dato → evidencia →
               // informe). Sobre las de política sí: el capítulo ES donde Carso
               // la declara.
               !conCaptura.has(s.id)
      );
      for (const sol of objetivo) {
        await subirEvidencia(ctx, {
          tenantId, solicitudId: sol.id, staffId, area: sol.area, archivo: recorte, nombre,
          notas: `Capítulo del Informe Anual Sustentable 2025 de Grupo Carso, págs. ${desde}-${hasta}. ` +
                 `Evidencia del enfoque declarado; las cifras provienen del checklist.`,
        });
        await ctx.db.from("comentarios").insert({
          solicitud_id: sol.id, autor_id: staffId, es_observacion: false,
          contenido:
            `Respuesta base tomada del Informe Anual Sustentable 2025 de Grupo Carso ` +
            `(págs. ${desde}-${hasta}), adjunto como evidencia. Falta que ${TENANT.nombre} ` +
            `confirme o complemente lo que el informe no cubre.`,
        });
        stats.evidencias++;
        estadosIAS.set(sol.id, "recibido");
      }
    }
  }
  return { stats, estadosIAS };
}

// -----------------------------------------------------------------------------
// Estados finales.
//
// Se fijan AL FINAL, después de toda inserción de evidencia y captura: los
// triggers de Fase 2 reabren a 'en_revision' cualquier solicitud validada en
// cuanto entra una carga nueva. Es el mismo patrón que usa el seed.
//
// Las que no aparecen en el plan de capturas ni en la narrativa reflejan el
// proceso real: se solicitaron y no llegó dato (financieras con 'XXXX', filas
// con ND/N-A). Ese hueco es información, no un defecto del import.
// -----------------------------------------------------------------------------
async function fijarEstados(ctx, creadas, estadosFinales, estadosIAS) {
  const porEstado = {};
  for (const sol of creadas) {
    const estado = estadosFinales.get(sol.id) ?? estadosIAS.get(sol.id) ??
      (sol.datos?.some((d) => d.valor != null) ? "recibido" : "solicitado");
    const { error } = await ctx.db.from("solicitudes").update({ estado }).eq("id", sol.id);
    if (error) throw new Error(`estado de "${sol.titulo.slice(0, 40)}": ${error.message}`);
    porEstado[estado] = (porEstado[estado] ?? 0) + 1;
  }
  return porEstado;
}

// -----------------------------------------------------------------------------
// Orquestación
// -----------------------------------------------------------------------------
async function main() {
  for (const [k, p] of Object.entries(F)) {
    if (!fs.existsSync(p)) { console.error(`Falta ${k}: ${p}`); process.exit(2); }
  }
  const ctx = await conectar();

  paso("Limpieza del import previo");
  await limpiar(ctx);
  if (SOLO_LIMPIAR) { log("\n✅ Import de GCARSO retirado."); return; }

  paso("Tenant, áreas, usuarios y reporte");
  const base = await crearTenant(ctx);

  paso("Catálogo de datapoints");
  const { data: dps } = await ctx.db.from("datapoints_taxonomia").select("id, codigo");
  const datapointIds = new Map((dps ?? []).map((d) => [d.codigo, d.id]));

  paso("Checklist → solicitudes");
  const { solicitudes, conciliacion } = await parsearChecklist();
  const creadas = await crearSolicitudes(ctx, { ...base, staffId: ctx.staffId }, solicitudes, datapointIds);
  log(`  ${creadas.length} solicitudes creadas`);

  paso("Capturas, evidencias y estados del proceso real");
  const wbChecklist = new ExcelJS.Workbook();
  await wbChecklist.xlsx.readFile(F.checklist);
  const { stats: capStats, estadosFinales, conCaptura } =
    await aplicarCapturas(ctx, { ...base, staffId: ctx.staffId }, creadas, wbChecklist);
  log(`  ${capStats.capturas} capturas · ${capStats.evidencias} evidencias`);

  paso("Contenido del informe (docx)");
  const { stats: infStats, registros, objetivos } =
    await importarContenidoInforme(ctx, { reporteId: base.reporteId });
  log(`  ${infStats.registros} registros de clima · ${infStats.objetivos} objetivos · ${infStats.cuestionarios} respuestas de cuestionario`);

  paso("Narrativa del IAS 2025 (pdf)");
  const { stats: iasStats, estadosIAS } =
    await aplicarNarrativaIAS(ctx, { ...base, staffId: ctx.staffId }, creadas, registros, objetivos, conCaptura);
  log(`  ${iasStats.evidencias} capítulos adjuntos · ${iasStats.registrosEnriquecidos} registros y ${iasStats.objetivosEnriquecidos} objetivos enriquecidos`);

  paso("Estados finales");
  const porEstado = await fijarEstados(ctx, creadas, estadosFinales, estadosIAS);

  // ---------------------------------------------------------------------------
  // Resumen
  // ---------------------------------------------------------------------------
  const porArea = {};
  for (const s of creadas) porArea[s.area] = (porArea[s.area] ?? 0) + 1;

  console.log(`\n${"═".repeat(70)}\nRESUMEN DEL IMPORT — ${TENANT.nombre} (${TENANT.slug})\n${"═".repeat(70)}`);
  console.log("\nSolicitudes por área:");
  for (const [a, n] of Object.entries(porArea).sort((x, y) => y[1] - x[1])) {
    console.log(`  ${a.padEnd(14)} ${String(n).padStart(3)}`);
  }
  console.log("\nSolicitudes por estado:");
  for (const [e, n] of Object.entries(porEstado).sort((x, y) => y[1] - x[1])) {
    console.log(`  ${e.padEnd(14)} ${String(n).padStart(3)}`);
  }
  console.log("\nConciliación con la especificación (hoja 'Solicitudes'):");
  let real = 0, spec = 0;
  for (const [hoja, c] of Object.entries(conciliacion)) {
    real += c.real; spec += c.spec;
    const delta = c.real - c.spec;
    const nota = c.punteros ? ` (+${c.punteros} filas puntero, no son requerimientos)` : "";
    console.log(`  ${hoja.padEnd(16)} fuente ${String(c.real).padStart(3)} · spec ${String(c.spec).padStart(3)} · Δ ${delta > 0 ? "+" : ""}${delta}${nota}`);
  }
  console.log(`  ${"TOTAL".padEnd(16)} fuente ${String(real).padStart(3)} · spec ${String(spec).padStart(3)} · Δ ${real - spec}`);
  console.log("\nContenido:");
  console.log(`  registros de clima      ${infStats.registros}`);
  console.log(`  objetivos               ${infStats.objetivos}`);
  console.log(`  respuestas cuestionario ${infStats.cuestionarios}`);
  console.log(`  capturas de valor       ${capStats.capturas}`);
  console.log(`  evidencias adjuntas     ${capStats.evidencias + iasStats.evidencias}`);

  console.log(`\n${"─".repeat(70)}\nUSUARIOS CREADOS — contraseñas mostradas UNA vez\n${"─".repeat(70)}`);
  for (const c of base.credenciales) {
    console.log(`  ${c.email.padEnd(28)} ${c.password.padEnd(26)} ${c.nombre}`);
  }
  console.log(`\n✅ Import completado.\n`);
}

main().catch((e) => {
  console.error("\n❌ Import falló:", e.message);
  console.error(e.stack?.split("\n").slice(1, 4).join("\n"));
  process.exit(1);
});
