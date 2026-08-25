/**
 * =============================================================================
 * E2E de los TENANTS DE DEMOSTRACIÓN PARA PROSPECTOS (mockups comerciales).
 *
 *   node scripts/e2e-demo-prospectos.mjs [baseUrl]
 *   BASE_URL=http://localhost:3001 node scripts/e2e-demo-prospectos.mjs
 *
 * Requiere `pnpm dev` corriendo y que scripts/crear-demo-prospecto.mjs ya se haya
 * ejecutado (lee sus credenciales de .credenciales-demo/prospectos.json).
 *
 * QUÉ FIJA, Y POR QUÉ CADA COSA
 * -----------------------------
 *  1. LA FRANJA. Estos tenants llevan el nombre y el logo REALES de una empresa
 *     que no es cliente. Lo único que impide que su pantalla se lea como
 *     información oficial suya es la franja "Entorno de demostración". Se
 *     comprueba en el portal (usuario de área) Y en el panel (administrador del
 *     cliente): son las dos vistas que se enseñan en una reunión.
 *  2. EL PIE [DEMO] en su Excel de taxonomía, por lo mismo: el entregable sale de
 *     la plataforma y puede acabar en el correo de alguien.
 *  3. LAS CELDAS de NIIF S2 29(a)(i): que el mockup tenga números donde importa
 *     —si el Excel sale vacío, la demo no demuestra nada—.
 *  4. QUE CARSO Y EMPRESA DEMO SIGAN INTACTOS. Tres tenants nuevos con 111
 *     solicitudes entre ellos no deben haber tocado al cliente real ni a la demo.
 *     En particular: el Excel de Carso NO lleva [DEMO].
 *  5. AISLAMIENTO por RLS: el usuario de un prospecto no ve nada del otro, ni de
 *     Grupo Carso. Es la misma frontera que protege a un cliente real, probada
 *     con las sesiones reales de estas cuentas.
 *  6. IDEMPOTENCIA: correr el script otra vez no duplica nada.
 * =============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import ExcelJS from "exceljs";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const RAIZ = process.cwd();

function envLocal() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(path.join(RAIZ, ".env.local"), "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    );
  } catch {
    return {};
  }
}
const ENV = { ...envLocal(), ...process.env };
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = ENV.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = ENV.ADMIN_EMAIL || "admin@irstrat.example";
const ADMIN_PASSWORD = ENV.ADMIN_PASSWORD || "Demo2025!";

const SLUGS = ["gav", "traton-fs", "inmobilia"];
const FRANJA = /entorno de demostraci.n/i;
const EJERCICIO = 2025;
// Las tres celdas que llenan las solicitudes validadas de la escena, y su valor.
const CELDAS_GEI = [
  ["C3", 100000],
  ["C4", 50000],
  ["C5", 250000],
];

const problemas = [];
let seccion = "";
const bloque = (t) => {
  seccion = t;
  console.log(`\n════════ ${t} ════════`);
};
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) problemas.push(`[${seccion}] ${msg}`);
  return cond;
};

const credenciales = (() => {
  const p = path.join(RAIZ, ".credenciales-demo", "prospectos.json");
  if (!fs.existsSync(p)) {
    console.error(
      `\nFalta ${path.relative(RAIZ, p)}.\n` +
        "Corre primero: node scripts/crear-demo-prospecto.mjs\n"
    );
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
})();
const cuentaDe = (slug, rol) => {
  const email = Object.keys(credenciales).find(
    (e) => credenciales[e].slug === slug && credenciales[e].rol === rol
  );
  return email ? { email, ...credenciales[email] } : null;
};

const texto = (ws, dir) => {
  let v = ws.getCell(dir).value;
  if (v && typeof v === "object") {
    if (v.richText) v = v.richText.map((t) => t.text).join("");
    else if (v.result !== undefined) v = v.result;
    else v = "";
  }
  return v == null ? "" : String(v);
};

async function sesionDatos(email, password) {
  const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login de datos (${email}): ${error.message}`);
  return c;
}

async function sesionUI(browser, email, password) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto("/login", { waitUntil: "load" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return { ctx, page };
}

/** Cookies de staff, para pedir el export por su ruta HTTP autenticada. */
async function cookieStaff() {
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
  if (error) throw new Error(`login staff: ${error.message}`);
  return {
    db,
    cookie: [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; "),
  };
}

async function main() {
  console.log(`E2E tenants de demostración para prospectos — ${BASE}`);
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { db: staffDb, cookie } = await cookieStaff();
  const browser = await chromium.launch();
  const ctxs = [];

  try {
    // -----------------------------------------------------------------------
    bloque("1) Los tres existen, marcados como demostración, con logo");
    // -----------------------------------------------------------------------
    const { data: tenants } = await staffDb
      .from("tenants")
      .select("id, slug, nombre, es_demo, logo_url, prefijo_folio")
      .in("slug", [...SLUGS, "gcarso", "empresa-demo-sab"]);
    const porSlug = new Map((tenants ?? []).map((t) => [t.slug, t]));

    for (const slug of SLUGS) {
      const t = porSlug.get(slug);
      ok(!!t, `${slug} existe (${t?.nombre ?? "—"})`);
      ok(t?.es_demo === true, `  es_demo = true (${t?.es_demo})`);
      ok(!!t?.logo_url, `  tiene logo (${t?.logo_url ? "sí" : "NO"})`);
      // El logo se sirve del bucket público: si la URL no responde, la pantalla
      // cae a las iniciales y el mockup pierde justo lo que lo hace convincente.
      if (t?.logo_url) {
        const r = await fetch(t.logo_url);
        ok(r.ok, `  el logo se descarga (HTTP ${r.status})`);
      }
    }
    ok(
      porSlug.get("gcarso")?.es_demo === false,
      `Grupo Carso sigue SIN la marca de demostración (es_demo=${porSlug.get("gcarso")?.es_demo})`
    );

    // -----------------------------------------------------------------------
    bloque("2) La franja de demostración, en el portal y en el panel");
    // -----------------------------------------------------------------------
    for (const slug of SLUGS) {
      const area = cuentaDe(slug, "cliente");
      const admin_ = cuentaDe(slug, "admin_cliente");
      ok(!!area?.password && !!admin_?.password, `${slug}: hay credenciales de las dos vistas`);
      if (!area?.password || !admin_?.password) continue;

      const s1 = await sesionUI(browser, area.email, area.password);
      ctxs.push(s1.ctx);
      const portal = await s1.page.locator("body").innerText();
      ok(FRANJA.test(portal), `  ${slug}: PORTAL con franja de demostración`);
      ok(
        portal.includes(porSlug.get(slug).nombre),
        `  ${slug}: el portal lleva su nombre (${porSlug.get(slug).nombre})`
      );
      const logos = await s1.page.locator(`img[src*="${porSlug.get(slug).id}"]`).count();
      ok(logos > 0, `  ${slug}: y su logo a la vista (${logos} imagen(es))`);

      const s2 = await sesionUI(browser, admin_.email, admin_.password);
      ctxs.push(s2.ctx);
      const panel = await s2.page.locator("body").innerText();
      ok(FRANJA.test(panel), `  ${slug}: PANEL con franja de demostración`);
    }

    // Contraprueba: la sesión de un cliente REAL no la lleva.
    const gcarsoUser = "materiales@gcarso.example";
    const { data: existeGcarso } = await admin
      .from("perfiles_usuario")
      .select("id")
      .eq("email", gcarsoUser)
      .maybeSingle();
    if (existeGcarso) {
      // La contraseña de esta cuenta la fija quien opera; si no está en el
      // entorno, se salta la contraprueba en vez de fingirla.
      const pass = ENV.GCARSO_PASSWORD;
      if (pass) {
        const s3 = await sesionUI(browser, gcarsoUser, pass);
        ctxs.push(s3.ctx);
        const t = await s3.page.locator("body").innerText();
        ok(!FRANJA.test(t), "Grupo Carso NO ve la franja (su información es real)");
      } else {
        console.log("  · (sin GCARSO_PASSWORD: contraprueba del portal de Carso omitida)");
      }
    }

    // -----------------------------------------------------------------------
    bloque("3) Su Excel de taxonomía: pie [DEMO] y celdas con números");
    // -----------------------------------------------------------------------
    const reportePorSlug = new Map();
    for (const slug of SLUGS) {
      const { data: rep } = await staffDb
        .from("reportes")
        .select("id, ejercicio, tenant_id")
        .eq("tenant_id", porSlug.get(slug).id)
        .eq("ejercicio", EJERCICIO)
        .maybeSingle();
      if (!ok(!!rep, `${slug}: tiene reporte ${EJERCICIO}`)) continue;
      reportePorSlug.set(slug, rep.id);

      const res = await fetch(
        `${BASE}/admin/cobertura/export-taxonomia?reporte=${rep.id}`,
        { headers: { cookie }, redirect: "manual" }
      );
      const buf = Buffer.from(await res.arrayBuffer());
      if (!ok(res.status === 200, `  HTTP 200 (${res.status})`)) continue;

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.getWorksheet("NIIF S2 29(a)(i)");
      if (!ok(!!ws, "  la hoja NIIF S2 29(a)(i) existe")) continue;

      for (const [celda, esperado] of CELDAS_GEI) {
        const v = Number(texto(ws, celda));
        ok(v === esperado, `  ${celda} = ${esperado.toLocaleString("es-MX")} (leído ${texto(ws, celda) || "vacío"})`);
      }

      // El pie va bajo la última fila tocada de cada hoja llenada: se busca en
      // todas las celdas de la columna A en vez de adivinar el número de fila.
      let pie = null;
      ws.eachRow({ includeEmpty: false }, (row) => {
        const v = row.getCell(1).value;
        const s = typeof v === "string" ? v : "";
        if (/^Generado por /.test(s)) pie = s;
      });
      ok(!!pie, `  la hoja lleva pie de generación (${pie ?? "ninguno"})`);
      ok(!!pie && pie.includes("[DEMO]"), "  y el pie dice [DEMO]");
    }

    // -----------------------------------------------------------------------
    bloque("4) Grupo Carso y Empresa Demo, intactos");
    // -----------------------------------------------------------------------
    for (const [slug, debeLlevarDemo] of [
      ["gcarso", false],
      ["empresa-demo-sab", true],
    ]) {
      const t = porSlug.get(slug);
      if (!ok(!!t, `${slug} sigue existiendo`)) continue;
      const { data: rep } = await staffDb
        .from("reportes")
        .select("id, ejercicio")
        .eq("tenant_id", t.id)
        .order("ejercicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ok(!!rep, `  tiene reporte (${rep?.ejercicio})`)) continue;

      const res = await fetch(
        `${BASE}/admin/cobertura/export-taxonomia?reporte=${rep.id}`,
        { headers: { cookie }, redirect: "manual" }
      );
      const buf = Buffer.from(await res.arrayBuffer());
      ok(res.status === 200, `  su Excel sigue saliendo (HTTP ${res.status})`);
      if (res.status !== 200) continue;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      let pie = null;
      for (const ws of wb.worksheets) {
        ws.eachRow({ includeEmpty: false }, (row) => {
          const v = row.getCell(1).value;
          const s = typeof v === "string" ? v : "";
          if (/^Generado por /.test(s)) pie = pie ?? s;
        });
      }
      ok(!!pie, `  con su pie de generación (${pie ?? "ninguno"})`);
      ok(
        !!pie && pie.includes("[DEMO]") === debeLlevarDemo,
        `  y ${debeLlevarDemo ? "SÍ" : "NO"} lleva [DEMO], como corresponde`
      );
    }

    // Ninguna solicitud de los prospectos cayó en el reporte de otro cliente.
    const idsProspectos = SLUGS.map((s) => porSlug.get(s).id);
    const { count: cruzadas } = await admin
      .from("solicitudes")
      .select("id, reporte:reportes!solicitudes_reporte_id_fkey!inner(tenant_id)", {
        count: "exact",
        head: true,
      })
      .in("reporte.tenant_id", [porSlug.get("gcarso").id, porSlug.get("empresa-demo-sab").id])
      .like("titulo", "%[PROSPECTO]%");
    ok((cruzadas ?? 0) === 0, `sin solicitudes de prospecto en Carso ni en la demo (${cruzadas ?? 0})`);

    // Y ninguna cuenta de prospecto quedó colgada de otro tenant.
    const { data: colgadas } = await admin
      .from("perfiles_usuario")
      .select("email, tenant_id")
      .or(SLUGS.map((s) => `email.like.%@${s}.example`).join(","));
    const malUbicadas = (colgadas ?? []).filter((u) => !idsProspectos.includes(u.tenant_id));
    ok(
      malUbicadas.length === 0,
      `las ${colgadas?.length ?? 0} cuentas de prospecto están en su propio tenant (${malUbicadas.length} fuera)`
    );

    // -----------------------------------------------------------------------
    bloque("5) Aislamiento: cada prospecto ve lo suyo y nada más");
    // -----------------------------------------------------------------------
    const gav = cuentaDe("gav", "cliente");
    const gavAdmin = cuentaDe("gav", "admin_cliente");
    if (gav?.password) {
      const db = await sesionDatos(gav.email, gav.password);

      const { data: tVistos } = await db.from("tenants").select("slug");
      const slugsVistos = (tVistos ?? []).map((t) => t.slug).sort();
      ok(
        slugsVistos.length === 1 && slugsVistos[0] === "gav",
        `el usuario de gav solo ve su emisora (${slugsVistos.join(", ") || "ninguna"})`
      );

      const { data: sols } = await db
        .from("solicitudes")
        .select("id, area_asignada, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)");
      const fuera = (sols ?? []).filter((s) => s.reporte?.tenant_id !== porSlug.get("gav").id);
      ok(
        fuera.length === 0,
        `y ninguna solicitud de otro cliente (${sols?.length ?? 0} suyas, ${fuera.length} ajenas)`
      );
      // Su área: un usuario de área ve SU área, no las cinco.
      const areas = new Set((sols ?? []).map((s) => s.area_asignada));
      ok(areas.size === 1, `acotado a su área (${[...areas].join(", ") || "ninguna"})`);

      const { data: perfilesVistos } = await db.from("perfiles_usuario").select("email");
      const ajenos = (perfilesVistos ?? []).filter(
        (u) => !u.email.endsWith("@gav.example") && !u.email.endsWith("@irstrat.example")
      );
      ok(ajenos.length === 0, `ni usuarios de otros clientes (${ajenos.length} ajenos)`);

      // Por id explícito: una solicitud de traton-fs, pedida a mano.
      const repTraton = reportePorSlug.get("traton-fs");
      if (repTraton) {
        const { data: unaDeTraton } = await admin
          .from("solicitudes")
          .select("id")
          .eq("reporte_id", repTraton)
          .limit(1)
          .single();
        const { data: intento } = await db
          .from("solicitudes")
          .select("id")
          .eq("id", unaDeTraton.id);
        ok(
          (intento ?? []).length === 0,
          `pedir por id una solicitud de traton-fs devuelve nada (${(intento ?? []).length} filas)`
        );
      }
    } else {
      ok(false, "no hay credenciales del usuario de área de gav");
    }

    if (gavAdmin?.password) {
      const db = await sesionDatos(gavAdmin.email, gavAdmin.password);
      const { data: sols } = await db
        .from("solicitudes")
        .select("id, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)");
      const fuera = (sols ?? []).filter((s) => s.reporte?.tenant_id !== porSlug.get("gav").id);
      ok(
        (sols ?? []).length > 0 && fuera.length === 0,
        `el administrador de gav ve sus ${sols?.length ?? 0} solicitudes y ninguna ajena (${fuera.length})`
      );
    }

    // -----------------------------------------------------------------------
    bloque("6) Correrlo otra vez no duplica nada");
    // -----------------------------------------------------------------------
    const conteos = async () => {
      const out = {};
      for (const slug of SLUGS) {
        const t = porSlug.get(slug).id;
        const { count: sols } = await admin
          .from("solicitudes")
          .select("id, reporte:reportes!solicitudes_reporte_id_fkey!inner(tenant_id)", {
            count: "exact",
            head: true,
          })
          .eq("reporte.tenant_id", t);
        const { count: users } = await admin
          .from("perfiles_usuario")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t);
        const { count: areas } = await admin
          .from("areas_tenant")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t);
        out[slug] = `${sols}/${users}/${areas}`;
      }
      return out;
    };
    const antes = await conteos();
    execFileSync("node", ["scripts/crear-demo-prospecto.mjs"], {
      stdio: "pipe",
      encoding: "utf8",
    });
    const despues = await conteos();
    for (const slug of SLUGS) {
      ok(
        antes[slug] === despues[slug],
        `${slug}: solicitudes/usuarios/áreas sin cambio (${antes[slug]} → ${despues[slug]})`
      );
    }
  } finally {
    for (const c of ctxs) await c.close().catch(() => {});
    await browser.close();
  }

  if (problemas.length) {
    console.log(`\n✗ ${problemas.length} fallo(s):`);
    for (const p of problemas) console.log(`   · ${p}`);
    process.exit(1);
  }
  console.log(
    "\n✅ E2E OK — mockups de prospecto: franja, pie [DEMO], celdas con números,\n" +
      "   Carso y la demo intactos, aislamiento por RLS e idempotencia.\n"
  );
}

main().catch((e) => {
  console.error(`\nError inesperado: ${e.message}`);
  process.exit(1);
});
