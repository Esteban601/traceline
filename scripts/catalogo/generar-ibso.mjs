#!/usr/bin/env node
// =============================================================================
// GENERA LA MIGRACIÓN DE DATOS DEL CATÁLOGO IBSO (NIS A-1 del CINIF) DESDE scripts/catalogo/datos/ibso-nis-a1.tsv
// (encargo docs/encargos/2026-11-17-catalogo-ibso.md, Fase 1).
//
//   node scripts/catalogo/generar-ibso.mjs --salida supabase/migrations/<ts>_catalogo_ibso_nis_a1.sql
//   node scripts/catalogo/generar-ibso.mjs --probar        # solo valida el TSV e imprime conteos (no escribe)
//
// El TSV es redacción de IRStrat (clave, nombre, pilar ASG, cómo se mide, qué recopilar): no es el texto de la norma,
// que no se reproduce (CLAUDE.md §4). Cada fila:
//   codigo «IBSO <clave>» · marco NIS · estándar «NIS A-1» · edición «2024» · nombre · pilar_asg · como_se_mide ·
//   descripcion = qué recopilar · pagina_origen nula.
// Columnas NIIF NOT NULL: norma S1 (como GRI); pilar por indicador (decisión 4 de Esteban del 17/11/2026): C.4 riesgos,
// C.5 estrategia, A y S métricas, C.1–C.3 y C.6–C.8 gobernanza.
// =============================================================================
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const TSV = path.join(RAIZ, "scripts/catalogo/datos/ibso-nis-a1.tsv");
const VERSION_TAXONOMIA = "2025";
const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const salida = opcion("--salida");
if (!salida && !argv.includes("--probar")) salir("Uso: --salida <archivo.sql> | --probar");

const [enc, ...filas] = fs.readFileSync(TSV, "utf8").replace(/\r/g, "").trim().split("\n").map((l) => l.split("\t"));
if (enc.join("|") !== "Clave|Nombre del indicador|ASG|Cómo se mide: orientación práctica|Qué información aborda y qué recopilar") salir("Encabezado del TSV inesperado.");
const ESPERADAS = [...Array.from({ length: 16 }, (_, i) => `A.${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `B.${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `C.${i + 1}`)];
const claves = filas.map((f) => f[0]);
if (claves.join(",") !== ESPERADAS.join(",")) salir(`Claves inesperadas: ${claves.join(", ")}`);
for (const f of filas) {
  if (f.length !== 5 || f.some((c) => !c.trim())) salir(`Fila incompleta: ${f[0]}`);
  if (f[2] !== f[0][0].replace("B", "S").replace("C", "G")) salir(`Pilar ${f[2]} no corresponde a la clave ${f[0]}`);
}
const PILAR_NIIF = (clave) => (clave === "C.4" ? "riesgos" : clave === "C.5" ? "estrategia" : clave.startsWith("C.") ? "gobernanza" : "metricas");
const lit = (s) => `'${s.trim().replace(/'/g, "''")}'`;
const conteo = { A: 0, S: 0, G: 0 };
for (const f of filas) conteo[f[2]]++;
console.log(`IBSO: ${filas.length} indicadores (A ${conteo.A}, S ${conteo.S}, G ${conteo.G}).`);
if (!salida) process.exit(0);

const valores = filas.map(([clave, nombre, asg, como, que]) =>
  `  (${lit(`IBSO ${clave}`)}, 'NIS', 'S1'::public.norma_niif, '${PILAR_NIIF(clave)}'::public.pilar_niif, null, 'NIS A-1', '2024', ${lit(nombre)}, '${asg}', ${lit(como)}, ${lit(que)}, null, '${VERSION_TAXONOMIA}')`);
const sql = `-- =============================================================================
-- CATÁLOGO IBSO: LOS 30 INDICADORES BÁSICOS DE SOSTENIBILIDAD DE LA NIS A-1 DEL CINIF (edición 2024)
-- (encargo docs/encargos/2026-11-17-catalogo-ibso.md, Fase 1).
-- GENERADO por scripts/catalogo/generar-ibso.mjs desde scripts/catalogo/datos/ibso-nis-a1.tsv el ${new Date().toISOString().slice(0, 10)}.
-- No se edita a mano: se corrige el TSV o el generador y se genera una migración nueva.
--
-- A: ${conteo.A} · S: ${conteo.S} · G: ${conteo.G} · total ${filas.length}.
--
-- Redacción de IRStrat (nombre, cómo se mide y qué recopilar), no el texto de la norma, que no se reproduce
-- (CLAUDE.md §4): pagina_origen nula. Pilar NIIF (NOT NULL) por indicador, decisión 4 de Esteban del 17/11/2026.
--
-- IDEMPOTENTE: upsert por (codigo, version_taxonomia); solo toca filas de marco NIS. Una fila por código en
-- docs/suplemento-s1s2/auditoria-catalogo.md.
-- =============================================================================

insert into public.datapoints_taxonomia
  (codigo, marco, norma, pilar, seccion_indice, estandar, edicion, nombre, pilar_asg, como_se_mide, descripcion, pagina_origen, version_taxonomia)
values
${valores.join(",\n")}
on conflict (codigo, version_taxonomia) do update set
  marco = excluded.marco,
  norma = excluded.norma,
  pilar = excluded.pilar,
  estandar = excluded.estandar,
  edicion = excluded.edicion,
  nombre = excluded.nombre,
  pilar_asg = excluded.pilar_asg,
  como_se_mide = excluded.como_se_mide,
  descripcion = excluded.descripcion,
  pagina_origen = excluded.pagina_origen,
  activo = true
where public.datapoints_taxonomia.marco = 'NIS';

select public.fn_aplicar_barrera_auditor();
`;
fs.writeFileSync(salida, sql);
console.log(`→ ${salida}`);
