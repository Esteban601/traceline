/**
 * =============================================================================
 * Archivos de utilería para las 13 evidencias del seed.
 *
 *   node scripts/seed-evidencias.mjs            (stack local)
 *   node scripts/seed-evidencias.mjs --dev      (proyecto dev, con barrera de ref)
 *
 * POR QUÉ HACE FALTA UN SCRIPT Y NO BASTA `seed.sql`.
 *
 * `seed.sql` puede insertar filas en `storage.objects`, que es una tabla de
 * Postgres, pero NO puede escribir los bytes: el contenido vive en el backend de
 * archivos de Storage, fuera de la base. Durante meses esas trece filas
 * existieron sin archivo detrás, y como `createSignedUrl` firma contra la FILA y
 * no contra el contenido, la descarga devolvía una firma válida que al abrirse
 * contestaba con el 500 de Storage. Se corrigió el 29/09/2026: ahora la ruta
 * comprueba que el objeto tenga bytes y, si no, responde con su propio mensaje.
 *
 * Este script crea la fila Y los bytes, por la API de Storage. Desde el
 * 30/09/2026 `seed.sql` ya no inserta nada en `storage.objects`: se comprobó que
 * subir con `upsert` ENCIMA de una fila creada por SQL deja la metadata real
 * pero ningún archivo en disco —la fila tiene que nacer del propio Storage—, así
 * que el script borra el objeto antes de subirlo y no se apoya en nada previo.
 *
 * SOBRE `db reset`: recrea Postgres, y con él `storage.objects`. Los bytes que
 * quedaron en el volumen se vuelven inalcanzables, porque el backend guarda en
 * <nombre>/<versión> y la versión vive en la fila que se acaba de borrar. Es
 * decir: `supabase db reset` A SECAS NO PUEDE reponer los archivos, y ninguna
 * cantidad de SQL lo arreglaría. Por eso existe `npm run db:reset`, que encadena
 * las dos cosas. Correr el script de más no cuesta nada: es idempotente.
 * =============================================================================
 */
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const DEV = process.argv.includes("--dev");

const URL_SB = DEV
  ? process.env.NEXT_PUBLIC_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE = DEV
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

if (!URL_SB || !SERVICE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const REF = (URL_SB.match(/https:\/\/([^.]+)\./) ?? [])[1] ?? "local";
const REF_STAGING = "ewgnvjtjhvdltvkopptn";
const DEV_AUTORIZADOS = (process.env.DEV_REFS_AUTORIZADOS ?? "kmjkoxecxcujxixlxwlb")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean)
  .filter((r) => r !== REF_STAGING);

// Barrera de ref, igual que en los demás scripts: este sube archivos con
// service_role, y STAGING lleva datos que se entregaron a terceros.
if (REF === REF_STAGING) {
  console.error("ABORTO: el destino es STAGING. Este script no corre ahí.");
  process.exit(1);
}
if (REF !== "local" && !DEV_AUTORIZADOS.includes(REF)) {
  console.error(
    `ABORTO: ref «${REF}» no autorizado. Añádelo a DEV_REFS_AUTORIZADOS si es tu proyecto de desarrollo.`
  );
  process.exit(1);
}

const ANON = DEV
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Cuenta de STAFF con la que se lee `evidencias`. En local es la del seed,
// documentada en README-SCHEMA.md; en dev se pasa por variable.
const STAFF_EMAIL = process.env.SEED_STAFF_EMAIL || "analista@irstrat.example";
const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD || "Demo2025!";

const db = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const BUCKET = "evidencias";

/**
 * PDF de UNA página, escrito a mano.
 *
 * Sin dependencia: un PDF mínimo válido son seis objetos y una tabla xref, y
 * traer una librería de 2 MB para escribir "documento de prueba" habría sido
 * desproporcionado. Los `offsets` de la xref se calculan sobre el texto ya
 * armado, que es la única parte delicada del formato.
 */
function pdfUnaPagina(titulo) {
  const texto = titulo.replace(/[()\\]/g, " ").slice(0, 80);
  const flujo = `BT /F1 14 Tf 60 760 Td (${texto}) Tj 0 -28 Td /F1 10 Tf (Documento de utileria del entorno de demostracion.) Tj 0 -16 Td (No contiene informacion real de ninguna emisora.) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let cuerpo = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(cuerpo.length);
    cuerpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const inicioXref = cuerpo.length;
  cuerpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) cuerpo += `${String(off).padStart(10, "0")} 00000 n \n`;
  cuerpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(cuerpo, "latin1");
}

/** XLSX de una hoja con el título y una nota, vía la misma librería del export. */
async function xlsxUnaHoja(titulo) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "TRACELINE · entorno de demostración";
  const hoja = libro.addWorksheet("Utilería");
  hoja.columns = [{ width: 70 }];
  hoja.addRow([titulo]).font = { bold: true, size: 13 };
  hoja.addRow([]);
  hoja.addRow(["Documento de utilería del entorno de demostración."]);
  hoja.addRow(["No contiene información real de ninguna emisora."]);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

async function main() {
  console.log(`Destino: ${URL_SB} (ref ${REF})`);

  // La lista sale de `evidencias`, no de una constante: el seed manda, y dos
  // listas que mantener sincronizadas a mano se desincronizan solas.
  //
  // Se lee con una SESIÓN DE STAFF y no con service_role porque en este proyecto
  // service_role no tiene SELECT sobre `evidencias` (endurecimiento anterior, y
  // no hay razón para aflojarlo por un script de utilería). El staff sí, por
  // RLS, que es el mismo camino que usa el producto.
  const sesion = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { error: errLogin } = await sesion.auth.signInWithPassword({
    email: STAFF_EMAIL,
    password: STAFF_PASSWORD,
  });
  if (errLogin) {
    console.error(
      `No se pudo entrar como ${STAFF_EMAIL}: ${errLogin.message}\n` +
        "Define SEED_STAFF_EMAIL y SEED_STAFF_PASSWORD si la cuenta es otra."
    );
    process.exit(1);
  }

  const { data: objetos, error } = await sesion
    .from("evidencias")
    .select("archivo_path, nombre_original")
    .order("archivo_path");

  if (error) {
    console.error(`No se pudieron leer las evidencias: ${error.message}`);
    process.exit(1);
  }

  const lista = (objetos ?? []).map((e) => ({
    path: e.archivo_path,
    nombre: e.nombre_original,
  }));

  if (lista.length === 0) {
    console.error("No hay evidencias registradas. ¿Corrió `supabase db reset`?");
    process.exit(1);
  }

  let subidos = 0;
  const fallos = [];
  for (const { path, nombre } of lista) {
    const ext = path.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
    const cuerpo = ext === "pdf" ? pdfUnaPagina(nombre) : await xlsxUnaHoja(nombre);

    // Se borra ANTES de subir, en vez de usar `upsert`. No es simetría estética:
    // subir encima de una fila que no nació de Storage deja metadata sin bytes,
    // que es exactamente el defecto que este script viene a cerrar. Borrar de
    // algo que no existe no es error, así que el orden es seguro siempre.
    await db.storage.from(BUCKET).remove([path]);

    const { error: err } = await db.storage
      .from(BUCKET)
      .upload(path, cuerpo, { contentType: MIME[ext] });

    if (err) fallos.push(`${path}: ${err.message}`);
    else subidos += 1;
  }

  console.log(`  ✓ ${subidos}/${lista.length} archivos de utilería en el bucket`);
  for (const f of fallos) console.log(`  ✗ ${f}`);

  // COMPROBACIÓN POR DESCARGA, no por metadata.
  //
  // Mirar `metadata.size` habría dado verde con los archivos rotos: el upsert la
  // escribía aunque el archivo no quedara en disco. Lo único que prueba que un
  // archivo se puede servir es traerlo, así que se trae.
  let servibles = 0;
  for (const { path } of lista) {
    const { data, error: errDl } = await db.storage.from(BUCKET).download(path);
    if (!errDl && data && data.size > 0) servibles += 1;
    else fallos.push(`${path}: no se puede descargar (${errDl?.message ?? "0 bytes"})`);
  }
  console.log(`  ✓ ${servibles}/${lista.length} se descargan de verdad`);

  for (const f of fallos.slice(subidos === lista.length ? 0 : fallos.length)) {
    console.log(`  ✗ ${f}`);
  }
  process.exit(fallos.length === 0 && servibles === lista.length ? 0 : 1);
}

main().catch((e) => {
  console.error("FALLA:", e.message);
  process.exit(1);
});
