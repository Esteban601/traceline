#!/usr/bin/env node
// =============================================================================
// E2E DEL CATÁLOGO IBSO (NIS A-1) — encargo docs/encargos/2026-11-17-catalogo-ibso.md, Fase 1.
//
//   node --env-file=<entorno local o dev> --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs scripts/e2e-catalogo-ibso.mjs
//
// Sin base (siempre):
//   1. El TSV genera exactamente la migración versionada (salvo la fecha de generación).
//   2. Libro: la hoja «IBSO» va al final, con «Indicador», los 30 en el orden de la NIS y sin vocabulario de plataforma.
//   3. Respuestas: «IBSO …» entra por la vía GRI/SASB; C.1 y C.3–C.5 tienen sección; C.2 solo por una captura del consejo;
//      B.1, B.5 y C.6–C.8 sin sección (evidencia
//      directa); la descripción para el modelo lleva el nombre y no las instrucciones de recopilación.
//   4. Correspondencia: códigos válidos; C.7 sin solicitud (decisión 3); Privacidad solo C.8.
// Con base (si hay NEXT_PUBLIC_SUPABASE_URL y llave de servicio):
//   5. El catálogo tiene los 30 NIS con estándar, edición, nombre, pilar ASG, cómo se mide y el pilar NIIF de la
//      decisión 4; ningún NIIF cambió de marco.
//   6. Los títulos de la correspondencia «plantilla» existen en alguna plantilla del destino.
// Solo lectura. No imprime llaves ni URL de base.
// =============================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { armarLibroGriSasb } from "../lib/excel/gri-sasb.ts";
import { FUENTE_GRI_SASB, esGriSasb, descripcionGriSasb, capturaRespondeIbso, respuestaIbsoDeCaptura, erroresIbsoDeCaptura, CAPTURA_IBSO } from "../lib/suplemento/gri-sasb.ts";
import { vocabularioEnCeldaExportada } from "../lib/suplemento/vocabulario.ts";
import { correspondencia } from "./catalogo/ligar-ibso.mjs";

const RAIZ = process.cwd();
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };

const filasTsv = fs.readFileSync(path.join(RAIZ, "scripts/catalogo/datos/ibso-nis-a1.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const CLAVES = filasTsv.map((f) => f[0]);

console.log("1. TSV → migración");
{
  const tmp = path.join(os.tmpdir(), `ibso-${process.pid}.sql`);
  execFileSync(process.execPath, ["scripts/catalogo/generar-ibso.mjs", "--salida", tmp], { stdio: "ignore" });
  const sinFecha = (s) => s.replace(/ el \d{4}-\d{2}-\d{2}\./, " el <fecha>.");
  const versionada = fs.readdirSync("supabase/migrations").find((f) => f.endsWith("_catalogo_ibso_nis_a1.sql"));
  ok(!!versionada && sinFecha(fs.readFileSync(tmp, "utf8")) === sinFecha(fs.readFileSync(path.join("supabase/migrations", versionada), "utf8")), `el TSV genera exactamente ${versionada ?? "la migración"}`);
  fs.rmSync(tmp, { force: true });
  ok(CLAVES.length === 30, `30 indicadores en el TSV (${CLAVES.length})`);
}

console.log("\n2. Libro: hoja IBSO");
{
  const filas = [
    { codigo: "GRI 2-1", marco: "GRI", estandar: "GRI 2", edicion: "2021", descripcion: "La organización debe…" },
    { codigo: "FN-CB-000.A", marco: "SASB", estandar: "SASB FN-CB", edicion: "2025-12", descripcion: "Number of accounts" },
    ...filasTsv.map(([k, nombre, , , que]) => ({ codigo: `IBSO ${k}`, marco: "NIS", estandar: "NIS A-1", edicion: "2024", descripcion: que, nombre })),
  ];
  const { wb, hojas } = armarLibroGriSasb({ filas, respuestas: new Map(), titulo: "x", esDemo: false, ejercicio: 2025 });
  ok(hojas.map((h) => h.nombre).join(",") === "GRI,SASB FN-CB,IBSO", `orden de hojas: ${hojas.map((h) => h.nombre).join(", ")} (GRI, SASB, IBSO al final)`);
  const ws = wb.getWorksheet("IBSO");
  const enc = [1, 2, 3].map((c) => String(ws.getRow(1).getCell(c).value ?? ""));
  ok(enc.join("|") === "Código|Indicador|Respuesta", `encabezados: ${enc.join(" / ")}`);
  const codigos = [];
  ws.eachRow((r, i) => { if (i > 1) codigos.push(String(r.getCell(1).value)); });
  ok(codigos.join(",") === CLAVES.map((k) => `IBSO ${k}`).join(","), `los 30 en el orden de la NIS (${codigos[0]} … ${codigos.at(-1)})`);
  let conVocab = 0;
  ws.eachRow((r) => r.eachCell((c) => { if (vocabularioEnCeldaExportada(String(c.value ?? "")).length) conVocab++; }));
  ok(conVocab === 0, `sin vocabulario de plataforma en la hoja IBSO (${conVocab} celdas)`);
  const nombre2 = String(ws.getRow(2).getCell(2).value);
  ok(nombre2 === filasTsv[0][1], `la columna Indicador lleva el nombre («${nombre2}»), no «qué recopilar»`);
}

console.log("\n3. Respuestas");
{
  ok(CLAVES.every((k) => esGriSasb(`IBSO ${k}`)) && !esGriSasb("NIIF S2 29 (a)(i)"), "los 30 «IBSO …» entran por la vía GRI/SASB; NIIF no");
  const conSeccion = CLAVES.filter((k) => FUENTE_GRI_SASB[`IBSO ${k}`]);
  ok(conSeccion.join(",") === "C.1,C.3,C.4,C.5", `con sección: ${conSeccion.join(", ")} (C.1 y C.3–C.5; C.2 solo por captura del consejo)`);
  // Correcciones antes de v48: la captura responde un IBSO solo si su solicitud liga ese único IBSO o su título nombra
  // lo que mide; C.2 solo con una captura del consejo; la respuesta lleva el nombre del indicador y su alcance.
  const residuos = "Generación y disposición de residuos 2025 (ton)";
  ok(capturaRespondeIbso("IBSO A.14", residuos, 3) && !capturaRespondeIbso("IBSO A.15", residuos, 3) && !capturaRespondeIbso("IBSO A.16", residuos, 3), "residuos (tres IBSO en la solicitud): la captura del total responde A.14; A.15 y A.16 no");
  ok(capturaRespondeIbso("IBSO A.1", "Inventario GEI Alcance 1 con memoria de cálculo", 1) && !capturaRespondeIbso("IBSO B.1", "x", 2), "un único IBSO en la solicitud: responde; dos sin desglose: no");
  ok(!capturaRespondeIbso("IBSO C.2", "Mujeres en plantilla y en el Consejo 2025", 1) && capturaRespondeIbso("IBSO C.2", "Mujeres en el Consejo de Administración 2025", 1), "C.2: no con plantilla y consejo mezclados; sí con una captura del consejo");
  const a1 = respuestaIbsoDeCaptura("IBSO A.1", "Emisiones GEI: alcance 1", "Inventario GEI Alcance 1 con memoria de cálculo", "1,240 tCO2e (ejercicio 2025).");
  ok(a1 === "Emisiones GEI, alcance 1: 1,240 tCO2e (ejercicio 2025).", `A.1 con el nombre del indicador, no el título («${a1}»)`);
  ok(/Alcance: solo electricidad; no incluye combustibles\.$/.test(respuestaIbsoDeCaptura("IBSO A.4", "Consumo energético", "Consumo de energía eléctrica 2025 por instalación (kWh)", "9 kWh.")), "A.4 de una captura eléctrica declara su alcance");
  ok(/Alcance: inversión y gasto ambiental; no se distingue la parte que califica como inversión sostenible\.$/.test(respuestaIbsoDeCaptura("IBSO A.6", "Inversión sostenible", "Inversión y gastos ambientales 2025", "31.4 MDP.")), "A.6 de inversión y gasto declara su alcance");
  ok(respuestaIbsoDeCaptura("IBSO A.7", "Agua ingresada", "Consumo de agua 2025 por fuente (m3)", "71,500 m3 (ejercicio 2025).") === "Agua ingresada: 71,500 m3 (ejercicio 2025). Alcance: consumo de agua por fuente, reportado como agua ingresada; no distingue agua reaprovechada.", "A.7 de consumo de agua declara su alcance");
  ok(respuestaIbsoDeCaptura("IBSO A.3", "Emisiones GEI: alcance 3", "Emisiones GEI Alcance 3 — total (todas las categorías)", "15,750 tCO2e (ejercicio 2025).") === "Emisiones GEI, alcance 3: 15,750 tCO2e (ejercicio 2025). Alcance: total de Alcance 3; la cifra no identifica las categorías incluidas ni los métodos de estimación.", "A.3 del total declara su alcance");
  // Validador: con `pide`, la línea de alcance es obligatoria; sin `pide`, no.
  ok(erroresIbsoDeCaptura("IBSO A.7", "Agua ingresada: 71,500 m3 (ejercicio 2025).").length === 1 && !erroresIbsoDeCaptura("IBSO A.7", respuestaIbsoDeCaptura("IBSO A.7", "Agua ingresada", "Consumo de agua 2025 por fuente (m3)", "71,500 m3.")).length, "el validador exige la línea de alcance de A.7");
  ok(!!erroresIbsoDeCaptura("IBSO A.4", respuestaIbsoDeCaptura("IBSO A.4", "Consumo energético", "Consumo total de energía 2025 (GJ)", "10 GJ.")).length, "una captura sin regla de alcance para lo que falta no sale (A.4 de un título sin «eléctrico»)");
  ok(!erroresIbsoDeCaptura("IBSO A.1", "Emisiones GEI, alcance 1: 1,240 tCO2e (ejercicio 2025).").length, "A.1 (solo la cifra) no exige alcance");
  ok(Object.entries(CAPTURA_IBSO).filter(([, r]) => r.pide).map(([k]) => k).join(",") === "IBSO A.3,IBSO A.4,IBSO A.6,IBSO A.7,IBSO B.3", "alcance obligatorio en A.3, A.4, A.6, A.7 y B.3");
  ok(["B.1", "B.5", "C.6", "C.7", "C.8"].every((k) => !FUENTE_GRI_SASB[`IBSO ${k}`]), "B.1, B.5 y C.6–C.8 sin sección: evidencia directa");
  const malas = filasTsv.filter(([k, nombre, , , que]) => {
    const d = descripcionGriSasb({ codigo: `IBSO ${k}`, marco: "NIS", estandar: "NIS A-1", edicion: "2024", descripcion: que, nombre });
    return !d.includes(nombre) || /\bevidencia\b|Recopilar|Conservar/.test(d) || !/no de NIIF S1\/S2/.test(d);
  });
  ok(!malas.length, `descripción para el modelo: nombre, sin instrucciones de recopilación ni «evidencia»${malas.length ? ` (fallan ${malas.map((f) => f[0]).join(", ")})` : ""}`);
}

console.log("\n4. Correspondencia");
const todas = correspondencia(["plantilla", "demo-dev", "fondo-de-fondos"]);
{
  const codigos = new Set([...todas.values()].flat());
  ok([...codigos].every((c) => CLAVES.includes(c.replace(/^IBSO /, ""))), `${codigos.size} códigos citados, todos del TSV`);
  ok(![...codigos].includes("IBSO C.7"), "C.7 sin solicitud (decisión 3)");
  ok(![...codigos].includes("IBSO C.2"), "C.2 no se liga por título (solo una captura del consejo lo responde)");
  ok(JSON.stringify(correspondencia(["fondo-de-fondos"]).get("Política de Privacidad")) === JSON.stringify(["IBSO C.8"]), "Política de Privacidad liga solo C.8");
  ok(correspondencia(["fondo-de-fondos"]).size === 9, "nueve solicitudes de Fondo de Fondos");
}

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (URL_SB && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  console.log("\n5. Catálogo en la base");
  const { data: nis, error } = await db.from("datapoints_taxonomia").select("codigo, marco, norma, pilar, estandar, edicion, nombre, pilar_asg, como_se_mide, descripcion, pagina_origen, activo").eq("marco", "NIS").eq("version_taxonomia", "2025");
  if (error) ok(false, `leer el catálogo: ${error.message}`);
  else {
    const PILAR = (k) => (k === "C.4" ? "riesgos" : k === "C.5" ? "estrategia" : k.startsWith("C.") ? "gobernanza" : "metricas");
    const malas = filasTsv.filter(([k, nombre, asg, como, que]) => {
      const d = nis.find((x) => x.codigo === `IBSO ${k}`);
      return !d || !d.activo || d.norma !== "S1" || d.pilar !== PILAR(k) || d.estandar !== "NIS A-1" || d.edicion !== "2024" || d.nombre !== nombre.trim() || d.pilar_asg !== asg || d.como_se_mide !== como.trim() || d.descripcion !== que.trim() || d.pagina_origen !== null;
    });
    ok(nis.length === 30 && !malas.length, `30 filas NIS como el TSV, con el pilar NIIF de la decisión 4${malas.length ? ` (distintas: ${malas.map((f) => f[0]).join(", ")})` : ""}`);
    const asg = ["A", "S", "G"].map((p) => `${p} ${nis.filter((d) => d.pilar_asg === p).length}`).join(" · ");
    ok(asg === "A 16 · S 6 · G 8", `por pilar ASG: ${asg}`);
    const { count } = await db.from("datapoints_taxonomia").select("id", { count: "exact", head: true }).not("pilar_asg", "is", null).neq("marco", "NIS");
    ok((count ?? 0) === 0, "ningún datapoint de otro marco lleva pilar ASG");
  }
  console.log("\n6. Títulos de la correspondencia en las plantillas");
  const titulos = [...correspondencia(["plantilla"]).keys()];
  const { data: rs } = await db.from("plantilla_solicitudes").select("titulo").in("titulo", titulos);
  const presentes = new Set((rs ?? []).map((r) => r.titulo));
  const faltan = titulos.filter((t) => !presentes.has(t));
  ok(!faltan.length, `los ${titulos.length} títulos de «plantilla» están en alguna plantilla${faltan.length ? ` (faltan: ${faltan.join(" | ")})` : ""}`);
} else console.log("\n(sin base: se omiten 5 y 6)");

console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
