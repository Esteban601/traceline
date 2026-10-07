#!/usr/bin/env node
// =============================================================================
// E2E · adjuntos del Perfil del emisor como contexto del generador (encargo
// 2026-10-06-suplemento-calidad, Paso 2).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-adjuntos-perfil.mjs
//
// SOLO contra el stack local. No llama al modelo: el generador corre con
// `salidaDePrueba`, que sustituye la respuesta y pasa por los mismos
// validadores con el contexto real del bloque. Usa dos emisoras del seed local
// con reporte —Empresa Demo (A) y PINFRA (B)— y un acta ficticia para cada una,
// con una marca que solo existe en su archivo.
//
//   1. Encolado: al insertar el adjunto, su fila de contenido nace `pendiente`.
//   2. Espera: el bloque 18 de A, con el Perfil vacío y el acta aún en cola,
//      queda `pendiente_adjunto` con el motivo «en lectura», sin llamada.
//   3. Lectura: la cola lee las dos actas (misma extracción que evidencias).
//   4. Aislamiento: el contexto de los bloques 15, 18 y 27 de A lleva el acta
//      de A y NUNCA la de B, y al revés; citar en A el id del acta de B se
//      rechaza como fuente no entregada.
//   5. pendiente_adjunto → se redacta: con el acta leída, el bloque 18 de A
//      acepta un texto que la cita.
//   6. Validador con el contexto ampliado: una cifra que solo está en el acta
//      se rechaza; el mismo texto sin la cifra pasa.
//   7. RLS: el administrador del cliente de A lee el contenido de su acta y no
//      el de B; un usuario de área de A no lee ninguno.
//   8. Texto del emisor sin reescribir (Paso 3): un Word en «gobierno» elegido
//      para el bloque 18 sale literal, sin modelo, costo 0, con su cita y la
//      marca `texto_del_emisor`; ningún normativo ofrece la opción; la pasada
//      de coherencia lo marca como texto del emisor. La fila del bloque se
//      restaura al terminar.
// Limpia lo que crea (adjuntos, objetos y el documento de B si lo creó).
// =============================================================================
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { generarBloque } from "../lib/suplemento/generar-bloque.ts";
import { cargarAdjuntosDelBloque, documentosParaPrompt } from "../lib/suplemento/adjuntos-bloque.ts";
import { procesarLecturaAdjunto } from "../lib/evidencias/cola.ts";
import { opcionesLiterales } from "../lib/suplemento/texto-del-emisor.ts";
import { documentoParaRevision } from "../lib/suplemento/coherencia.ts";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { bloquePorClave } from "../lib/suplemento/bloques.ts";

const URL_SB = "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE = "Demo2025!";
const A = { tenant: "10000000-0000-0000-0000-000000000001", nombre: "Empresa Demo", marca: "Comité de Vigilancia Fluvial", cifra: "9" };
const B = { tenant: "4d2a140b-2db5-4638-888f-ed71397accfe", nombre: "PINFRA", marca: "Comité de Conservación de Tramos", cifra: "7" };

// Llaves del stack LOCAL, leídas de `supabase status` sin imprimirlas.
const status = Object.fromEntries(
  execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" })
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
if (!/127\.0\.0\.1|localhost/.test(status.API_URL ?? "")) { console.error("✗ Solo contra el stack local."); process.exit(2); }
process.env.NEXT_PUBLIC_SUPABASE_URL = URL_SB;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
process.env.ANTHROPIC_API_KEY ||= "sin-llamada-en-esta-prueba";
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atc", sql], { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8" }).trim();

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const sesion = async (email) => {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: CLAVE });
  return error ? null : c;
};
const staff = await sesion("admin@irstrat.example");
if (!staff) throw new Error("login staff");

async function acta(e) {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage([612, 792]);
  const lineas = [
    `Acta de sesión del ${e.marca} de ${e.nombre} (documento ficticio de prueba).`,
    `El Consejo de Administración constituyó el ${e.marca} para supervisar los riesgos relacionados con el clima.`,
    `Durante el ejercicio el comité sesionó ${e.cifra} veces e informó al Consejo de sus conclusiones.`,
  ];
  lineas.forEach((l, i) => p.drawText(l, { x: 60, y: 720 - i * 18, size: 10, font: f }));
  return Buffer.from(await pdf.save());
}

const creados = { adjuntos: [], objetos: [], documentoB: null, seleccionA: null, bloque18: null };
const perfilA = psql(`select count(*) from perfil_emisor where tenant_id='${A.tenant}'`);
try {
  // --- Preparación -----------------------------------------------------------
  psql(`update tenants set lectura_evidencias_activa = true where id in ('${A.tenant}','${B.tenant}')`);
  const docDe = (t) => psql(`select d.id from documentos_generados d join reportes r on r.id = d.reporte_id where r.tenant_id='${t}' order by d.created_at desc limit 1`);
  let docA = docDe(A.tenant);
  let docB = docDe(B.tenant);
  if (!docA) throw new Error("Empresa Demo no tiene documento en local: genera uno primero (POST …/generar).");
  if (!docB) {
    docB = psql(`insert into documentos_generados (tenant_id, reporte_id) select tenant_id, id from reportes where tenant_id='${B.tenant}' limit 1 returning id`).split("\n")[0];
    creados.documentoB = docB;
  }
  // El bloque 18 es editorial recomendado: el documento de A tiene que llevarlo.
  // Se guarda la selección y se restaura al terminar.
  creados.seleccionA = { doc: docA, valor: psql(`select coalesce(array_to_json(editoriales_incluidos)::text, 'null') from documentos_generados where id='${docA}'`) };
  psql(`update documentos_generados set editoriales_incluidos = array(select distinct unnest(coalesce(editoriales_incluidos, '{}') || '{estructura_gobierno}')) where id='${docA}'`);
  ok(perfilA === "0", `Empresa Demo sin fila de Perfil en local (los campos del bloque 18 están vacíos): ${perfilA === "0"}`);

  // --- 1. Encolado -----------------------------------------------------------
  console.log("\n1. Encolado al insertar el adjunto");
  const ids = {};
  for (const e of [A, B]) {
    const ruta = `${e.tenant}/perfil/gobierno/${Date.now()}-acta-e2e.pdf`;
    const { error: eUp } = await staff.storage.from("documentos").upload(ruta, await acta(e), { contentType: "application/pdf" });
    if (eUp) throw new Error(`subida ${e.nombre}: ${eUp.message}`);
    creados.objetos.push(ruta);
    const { data, error } = await staff.from("perfil_emisor_adjuntos")
      .insert({ tenant_id: e.tenant, seccion: "gobierno", archivo_path: ruta, nombre_original: `acta-e2e-${e.nombre.replace(/\s/g, "")}.pdf`, mime: "application/pdf", tamano: 1000 })
      .select("id").single();
    if (error) throw new Error(`adjunto ${e.nombre}: ${error.message}`);
    creados.adjuntos.push(data.id);
    ids[e.tenant] = data.id;
    const estado = psql(`select estado from perfil_emisor_adjuntos_contenido where adjunto_id='${data.id}'`);
    ok(estado === "pendiente", `${e.nombre}: fila de contenido creada por el trigger en «${estado}»`);
  }

  // --- 2. Espera ---------------------------------------------------------------
  console.log("\n2. Bloque 18 de A con el acta en cola");
  const r18cola = await generarBloque(staff, docA, 18, { sinPersistir: true, salidaDePrueba: { texto: "x", fuentes_usadas: [] } });
  ok(!r18cola.ok && r18cola.motivo === "pendiente_adjunto" && /en lectura/.test(r18cola.detalle ?? ""), `pendiente_adjunto «en lectura»: ${r18cola.ok ? "ok" : `${r18cola.motivo} · ${r18cola.detalle}`}`);

  // --- 3. Lectura --------------------------------------------------------------
  console.log("\n3. Lectura por la cola");
  for (const e of [A, B]) {
    const fila = psql(`select id from perfil_emisor_adjuntos_contenido where adjunto_id='${ids[e.tenant]}'`);
    const r = await procesarLecturaAdjunto(fila);
    ok(r.estado === "extraido", `${e.nombre}: ${r.estado}${r.detalle ? ` (${r.detalle})` : ""}`);
  }

  // --- 4. Aislamiento ----------------------------------------------------------
  console.log("\n4. Aislamiento entre emisoras");
  for (const clave of ["roles_organo", "estructura_gobierno", "gestion_riesgos"]) {
    const b = bloquePorClave(clave);
    for (const [propia, ajena] of [[A, B], [B, A]]) {
      const ctx = await cargarAdjuntosDelBloque(staff, propia.tenant, b, `${b.titulo} comité clima supervisión`);
      const texto = documentosParaPrompt(ctx) ?? "";
      const conPropia = texto.includes(propia.marca) && ctx.fuentes.some((f) => f.id.startsWith(`adj:${ids[propia.tenant]}`));
      const conAjena = texto.includes(ajena.marca) || ctx.fuentes.some((f) => f.id.includes(ids[ajena.tenant]));
      ok(conPropia && !conAjena, `bloque ${b.numero} de ${propia.nombre}: su acta sí (${conPropia}), la de ${ajena.nombre} no (${!conAjena})`);
    }
  }
  const ajeno = await generarBloque(staff, docA, 18, { sinPersistir: true, salidaDePrueba: { texto: "El Consejo supervisa los riesgos relacionados con el clima.", fuentes_usadas: [`adj:${ids[B.tenant]}:p1`] } });
  ok(!ajeno.ok && ajeno.motivo === "fuentes_invalidas", `citar en A el acta de B se rechaza: ${ajeno.ok ? "aceptado" : ajeno.motivo}`);

  // --- 5. pendiente_adjunto → se redacta -----------------------------------------
  console.log("\n5. Bloque 18 de A con el acta leída");
  const propio = `adj:${ids[A.tenant]}:p1`;
  const r18 = await generarBloque(staff, docA, 18, { sinPersistir: true, salidaDePrueba: { texto: `El Consejo de Administración constituyó el ${A.marca} para supervisar los riesgos relacionados con el clima.`, fuentes_usadas: [propio] } });
  ok(r18.ok, `se redacta citando ${propio.slice(0, 16)}…: ${r18.ok ? "aceptado" : `${r18.motivo} · ${r18.detalle}`}`);

  // --- 6. Validador con el contexto ampliado ---------------------------------------
  console.log("\n6. Validador de cifras con el contexto ampliado");
  for (const n of [15, 18, 27]) {
    const conCifra = await generarBloque(staff, docA, n, { sinPersistir: true, salidaDePrueba: { texto: `El ${A.marca} sesionó ${A.cifra} veces durante el ejercicio.`, fuentes_usadas: [propio] } });
    ok(!conCifra.ok && conCifra.motivo === "cifras_sin_respaldo", `bloque ${n}: la cifra que solo está en el acta se rechaza (${conCifra.ok ? "aceptado" : conCifra.motivo})`);
    const sinCifra = await generarBloque(staff, docA, n, { sinPersistir: true, salidaDePrueba: { texto: `El ${A.marca} sesiona de forma periódica e informa al Consejo de sus conclusiones.`, fuentes_usadas: [propio] } });
    ok(sinCifra.ok, `bloque ${n}: el mismo texto sin la cifra pasa (${sinCifra.ok ? "aceptado" : `${sinCifra.motivo} · ${sinCifra.detalle}`})`);
  }

  // --- 7. RLS --------------------------------------------------------------------
  console.log("\n7. RLS del contenido");
  const adminA = await sesion("admin.cliente@empresademo.example");
  if (adminA) {
    const { data } = await adminA.from("perfil_emisor_adjuntos_contenido").select("adjunto_id").in("adjunto_id", Object.values(ids));
    const vistos = (data ?? []).map((x) => x.adjunto_id);
    ok(vistos.includes(ids[A.tenant]) && !vistos.includes(ids[B.tenant]), `admin del cliente A: ve la suya (${vistos.includes(ids[A.tenant])}), no la de B (${!vistos.includes(ids[B.tenant])})`);
    const { error } = await adminA.from("perfil_emisor_adjuntos_contenido").update({ mensaje: "x" }).eq("adjunto_id", ids[A.tenant]);
    const sigue = psql(`select coalesce(mensaje,'') from perfil_emisor_adjuntos_contenido where adjunto_id='${ids[A.tenant]}'`);
    ok(sigue !== "x", `admin del cliente A no escribe en el contenido (${error ? "rechazado" : "sin efecto"})`);
  } else console.log("    (sin sesión del admin del cliente A en local; se omite)");
  const areaA = await sesion("finanzas@empresademo.example");
  if (areaA) {
    const { data } = await areaA.from("perfil_emisor_adjuntos_contenido").select("adjunto_id");
    ok((data ?? []).length === 0, `usuario de área de A: no ve contenido (${(data ?? []).length} filas)`);
  } else console.log("    (sin sesión de usuario de área de A en local; se omite)");
  const barrera = psql(`select count(*) from pg_policies where tablename='perfil_emisor_adjuntos_contenido' and policyname ilike '%auditor%'`);
  ok(Number(barrera) > 0, `barrera del auditor puesta en la tabla (${barrera} políticas)`);

  // --- 8. Texto del emisor sin reescribir ----------------------------------------
  console.log("\n8. Texto del emisor sin reescribir");
  const PARRAFOS = [
    "Nuestra estructura de gobierno",
    "El Consejo de Administración, con once consejeros, supervisa la estrategia y los riesgos de la Compañía.",
    "Tres comités lo auxilian; el de Sostenibilidad y Riesgos Climáticos se creó en 2025.",
  ];
  const docx = await Packer.toBuffer(new Document({ sections: [{ children: [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(PARRAFOS[0])] }),
    ...PARRAFOS.slice(1).map((t) => new Paragraph({ children: [new TextRun(t)] })),
  ] }] }));
  const rutaW = `${A.tenant}/perfil/gobierno/${Date.now()}-gobierno-e2e.docx`;
  const { error: eW } = await staff.storage.from("documentos").upload(rutaW, Buffer.from(docx), { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  if (eW) throw new Error(`subida docx: ${eW.message}`);
  creados.objetos.push(rutaW);
  const { data: adjW, error: eAW } = await staff.from("perfil_emisor_adjuntos")
    .insert({ tenant_id: A.tenant, seccion: "gobierno", archivo_path: rutaW, nombre_original: "gobierno-e2e.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", tamano: docx.length })
    .select("id").single();
  if (eAW) throw new Error(`adjunto docx: ${eAW.message}`);
  creados.adjuntos.push(adjW.id);
  await procesarLecturaAdjunto(psql(`select id from perfil_emisor_adjuntos_contenido where adjunto_id='${adjW.id}'`));

  const ops = await opcionesLiterales(staff, A.tenant);
  ok((ops.estructura_gobierno ?? []).some((o) => o.adjuntoId === adjW.id), `el bloque 18 ofrece usar gobierno-e2e.docx sin reescribir`);
  const normativosConOpcion = Object.keys(ops).filter((k) => (bloquePorClave(k)?.clase ?? "normativo") === "normativo");
  ok(normativosConOpcion.length === 0, `ningún bloque normativo ofrece texto literal (${normativosConOpcion.join(", ") || "ninguno"})`);

  creados.bloque18 = psql(`select coalesce((select row_to_json(b)::text from documentos_bloques b where documento_id='${docA}' and numero=18), 'null')`);
  psql(`update documentos_generados set textos_literales = '{"estructura_gobierno":"${adjW.id}"}'::jsonb where id='${docA}'`);
  const lit = await generarBloque(staff, docA, 18);
  ok(lit.ok && lit.conModelo === false && lit.costo === 0, `bloque 18 sin modelo y costo 0: ${lit.ok ? `conModelo=${lit.conModelo}, $${lit.costo}` : `${lit.motivo} · ${lit.detalle}`}`);
  const fila = JSON.parse(psql(`select row_to_json(b)::text from documentos_bloques b where documento_id='${docA}' and numero=18`));
  const esperado = [`**${PARRAFOS[0]}**`, ...PARRAFOS.slice(1)].join("\n\n");
  ok(fila.texto === esperado, `texto literal, palabra por palabra (título como **título**)`);
  ok(fila.texto_del_emisor === true && fila.estado === "borrador", `guardado como borrador con texto_del_emisor = ${fila.texto_del_emisor}`);
  ok((fila.fuentes ?? []).some((f) => f.id.startsWith(`adj:${adjW.id}`) && /gobierno-e2e\.docx/.test(f.detalle)), `cita al archivo: ${(fila.fuentes ?? []).map((f) => f.detalle).join("; ")}`);
  const paraRevision = documentoParaRevision(
    [{ numero: 18, titulo: "Estructura", seccion: "II", texto: fila.texto, textoDelEmisor: fila.texto_del_emisor }, { numero: 15, titulo: "Roles", seccion: "II", texto: "Otro texto.", textoDelEmisor: false }],
    { denominacionFormal: null, formaDeReferencia: null }
  );
  ok(/Bloque 18 .*TEXTO DEL EMISOR/.test(paraRevision) && !/Bloque 15 .*TEXTO DEL EMISOR/.test(paraRevision), "la pasada de coherencia lo recibe marcado como texto del emisor (y solo a él)");
} finally {
  if (creados.bloque18 !== null) {
    if (creados.bloque18 === "null") psql(`delete from documentos_bloques where documento_id='${creados.seleccionA?.doc}' and numero=18`);
    else psql(`insert into documentos_bloques select * from json_populate_record(null::documentos_bloques, '${creados.bloque18.replace(/'/g, "''")}'::json) on conflict (documento_id, numero) do update set (estado, texto, texto_del_emisor, fuentes, pendientes, modelo, prompt_version, costo_usd, tokens_entrada, tokens_salida, duracion_ms, generado_en, updated_at) = (excluded.estado, excluded.texto, excluded.texto_del_emisor, excluded.fuentes, excluded.pendientes, excluded.modelo, excluded.prompt_version, excluded.costo_usd, excluded.tokens_entrada, excluded.tokens_salida, excluded.duracion_ms, excluded.generado_en, excluded.updated_at)`);
    psql(`update documentos_generados set textos_literales = null where id='${creados.seleccionA?.doc}'`);
  }
  if (creados.objetos.length) await staff.storage.from("documentos").remove(creados.objetos);
  if (creados.adjuntos.length) psql(`delete from perfil_emisor_adjuntos where id in (${creados.adjuntos.map((i) => `'${i}'`).join(",")})`);
  if (creados.seleccionA) {
    const v = creados.seleccionA.valor;
    psql(`update documentos_generados set editoriales_incluidos = ${v === "null" ? "null" : `array(select json_array_elements_text('${v}'::json))`} where id='${creados.seleccionA.doc}'`);
  }
  if (creados.documentoB) psql(`delete from documentos_generados where id='${creados.documentoB}'`);
  const quedan = psql(`select count(*) from perfil_emisor_adjuntos_contenido where adjunto_id in (${creados.adjuntos.map((i) => `'${i}'`).join(",") || "null"})`);
  console.log(`\nLimpieza: ${creados.adjuntos.length} adjuntos y ${creados.objetos.length} objetos quitados; contenido que queda: ${quedan}.`);
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
