#!/usr/bin/env node
// Extractor de LISTA BLANCA de las credenciales demo: solo salen correo, rol y área, nunca la contraseña.
// Uso: node scripts/resumir-credenciales.mjs <prospectos-*.json> [--slug s]  ·  --log <corrida.log> [--slug s]
// Del JSON se copian por nombre los campos permitidos; del log, solo grupos capturados de líneas conocidas.
import fs from "node:fs";

// Red de seguridad: si algo con forma de contraseña llega a la salida, no se
// imprime nada. Es la forma de `passwordFuerte()` y la de la cuenta de staff.
const FORMA_CONTRASENA = /[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}!|Demo20\d\d!/;

const args = process.argv.slice(2);
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const SLUG = valor("--slug");
const LOG = valor("--log");
const JSON_RUTA = LOG ? null : args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--slug");

if (!LOG && !JSON_RUTA) {
  console.error("Uso: resumir-credenciales.mjs <prospectos-*.json> [--slug s]  |  --log <archivo> [--slug s]");
  process.exit(2);
}

function emitir(lineas) {
  if (lineas.some((l) => FORMA_CONTRASENA.test(l))) {
    console.error("❌ La salida contenía algo con forma de contraseña. No se imprime nada.");
    process.exit(3);
  }
  console.log(lineas.join("\n"));
}

// -----------------------------------------------------------------------------
// JSON de credenciales: { email: { password, rol, area, slug } }
// -----------------------------------------------------------------------------
function resumirJson(ruta) {
  const mapa = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const filas = [];
  const porSlug = new Map();
  let sinContrasena = 0;
  for (const [email, cuenta] of Object.entries(mapa)) {
    if (SLUG && cuenta.slug !== SLUG) continue;
    // La contraseña solo se consulta para saber si existe; su valor no sale de aquí.
    if (!(typeof cuenta.password === "string" && cuenta.password.length > 0)) sinContrasena++;
    filas.push({ email, rol: cuenta.rol, area: cuenta.area ?? "—", slug: cuenta.slug });
    porSlug.set(cuenta.slug, (porSlug.get(cuenta.slug) ?? 0) + 1);
  }
  const salida = [
    `cuentas: ${filas.length} · tenants: ${porSlug.size} · sin contraseña: ${sinContrasena}`,
  ];
  if (!SLUG) {
    salida.push(`por tenant: ${[...porSlug].map(([s, n]) => `${s}=${n}`).join(" ")}`);
  }
  if (SLUG) {
    for (const f of filas) salida.push(`  ${f.email.padEnd(32)} ${f.rol.padEnd(14)} ${f.area}`);
  }
  emitir(salida);
}

// -----------------------------------------------------------------------------
// Log de crear-demo-prospecto.mjs. Cada regla es una línea que el script
// imprime; de ella sale SOLO lo que capturan sus grupos. Lo demás se cuenta.
// -----------------------------------------------------------------------------
const REGLAS = [
  [/^\s*Destino: https:\/\/([a-z0-9]+)\.supabase\.co/, (m) => `destino: ${m[1]}`],
  [/^▸ (.+)$/, (m) => `paso: ${m[1]}`],
  [
    // "tenant, 6 área(s), logo (reducido a 400 px (106 kB → 9 kB))": se toman
    // solo los fragmentos conocidos, no la línea.
    /^\s+alta: (.+)$/,
    (m) =>
      `  alta: ${[
        ...m[1].matchAll(/tenant|\d+ área\(s\)|logo reemplazado|logo|reducido a \d+ px|sin reducir|\d+ kB → \d+ kB/g),
      ]
        .map((x) => x[0])
        .join(", ")}`,
  ],
  [
    /^\s+usuarios: (\d+) \((\d+) nuevos, (\d+) ya existían\)$/,
    (m) => `  usuarios: ${m[1]} (${m[2]} nuevos, ${m[3]} ya existían)`,
  ],
  [
    /^\s+reporte (\d{4}): (\d+) solicitudes clonadas de "(.+)"$/,
    (m) => `  reporte ${m[1]}: ${m[2]} clonadas de "${m[3]}"`,
  ],
  [/^\s+reporte (\d{4}): ya existía \((\d+) solicitudes\)$/, (m) => `  reporte ${m[1]}: ya existía (${m[2]})`],
  [
    /^\s+escena: (\d+) evidencia\(s\), (\d+) captura\(s\), (\d+) visto\(s\) bueno\(s\), (\d+) observación\(es\)$/,
    (m) => `  escena: ${m[1]} evidencias, ${m[2]} capturas, ${m[3]} vistos buenos, ${m[4]} observaciones`,
  ],
  [/^\s+estados: ([a-z_0-9 ·]+)$/, (m) => `  estados: ${m[1]}`],
  [/^\s+solicitudes: (\d+)\s+\(([a-z_0-9 ,]+)\)$/, (m) => `  solicitudes: ${m[1]} (${m[2]})`],
  [/^\s+jefe de área en: (.+)$/, (m) => `  jefe de área en: ${m[1]}`],
  [/^\s+áreas: (.+)$/, (m) => `  áreas: ${m[1]}`],
  [
    // Línea de credencial: correo y rol por grupos; de la cola solo si ya existía.
    /^\s{6}([a-z0-9.]+@[a-z0-9.-]+\.example)\s+(cliente|jefe_area|admin_cliente)\s+(\(ya existía)?/,
    (m) => `  cuenta: ${m[1]} · ${m[2]} · ${m[3] ? "ya existía" : "nueva"}`,
  ],
  [/^✅ (Listo[^\n]*)$/, (m) => `fin: ${m[1]}`],
];

function resumirLog(ruta) {
  const lineas = fs.readFileSync(ruta, "utf8").split("\n");
  const salida = [];
  let sinRegla = 0;
  let errores = 0;
  let cuentas = 0;
  for (const linea of lineas) {
    if (!linea.trim()) continue;
    // El texto de un error no se imprime: puede traer cualquier cosa.
    if (/❌/.test(linea)) {
      errores++;
      continue;
    }
    const regla = REGLAS.find(([re]) => re.test(linea));
    if (!regla) {
      sinRegla++;
      continue;
    }
    const texto = regla[1](regla[0].exec(linea));
    if (SLUG && texto.startsWith("  cuenta:") && !texto.includes(`@${SLUG}.example`)) continue;
    if (texto.startsWith("  cuenta:")) cuentas++;
    salida.push(texto);
  }
  salida.push(
    `líneas: ${lineas.filter((l) => l.trim()).length} · reconocidas: ${salida.length} · ` +
      `sin regla (no se imprimen): ${sinRegla} · con ❌: ${errores} · cuentas: ${cuentas}`
  );
  emitir(salida);
}

if (LOG) resumirLog(LOG);
else resumirJson(JSON_RUTA);
