// =============================================================================
// Salidas del mapeo del Formato electrónico (JSON y .md), compartidas por
// mapear-formato.mjs (generación desde el asset) y aplicar-correcciones-mapeo.mjs
// (correcciones de filas sobre el JSON versionado, encargo 2026-10-24).
// Conforme a CLAUDE.md §4, ninguna de las dos lleva texto del formato.
// =============================================================================
import path from "node:path";

const clave = (c) => c.toLowerCase().replace(/\s+/g, "");

/** Conceptos con tipo sin datapoint: la lista «sin mapeo». */
export const sinMapeoDe = (resultado) => resultado.filter((x) => x.clasificacion === "concepto" && x.capa === "sin candidato");

/** Párrafos que citan los conceptos y que no tienen código en el catálogo (claves sin espacios). */
export function parrafosSinCodigoDe(resultado, clavesCatalogo) {
  const m = new Map();
  for (const x of resultado.filter((y) => y.clasificacion === "concepto")) for (const p of x.parrafos) if (!clavesCatalogo.some((k) => k === clave(p) || k.startsWith(clave(p) + "("))) m.set(p, [...(m.get(p) ?? []), x.fila]);
  return m;
}

export function resumenDe(resultado, { formato, revision, noInterpretadas }) {
  const cuenta = (f) => resultado.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
  return {
    formato,
    filas: resultado.length,
    porClasificacion: cuenta((x) => x.clasificacion.startsWith("subconcepto de") ? "subconcepto" : x.clasificacion),
    porCapa: cuenta((x) => x.capa),
    porConfianza: cuenta((x) => x.confianza),
    conDatapoint: resultado.filter((x) => x.datapoint).length,
    conBloque: resultado.filter((x) => x.bloque).length,
    conAlivioE5: resultado.filter((x) => x.alivioE5).length,
    revision: revision ? { archivo: revision, porCategoria: cuenta((x) => x.revision?.categoria ?? "(sin decisión)"), noInterpretadas } : null,
  };
}

export const jsonDe = (resumen, resultado, sinMapeo, parrafosSinCodigo) =>
  JSON.stringify({ resumen, conceptos: resultado, sinMapeo: sinMapeo.map((x) => ({ fila: x.fila, seccion: x.seccion, tipo: x.tipo, parrafos: x.parrafos })), parrafosSinCodigo: Object.fromEntries([...parrafosSinCodigo].sort()) }, null, 1);

export function mdDe(resumen, resultado, sinMapeo, parrafosSinCodigo, { formatoArchivo = resumen.formato.archivo, huella = resumen.formato.sha256, hoja = resumen.formato.hoja } = {}) {
  const md = [];
  md.push(`# Mapeo concepto ↔ datapoint del Formato electrónico NIIF S1/S2`, "");
  md.push(`Encargo \`2026-10-13-excel-respuestas-narrativas\`, Paso 1. Generado por \`scripts/formato/mapear-formato.mjs\` (sin modelo) desde el asset \`${path.basename(formatoArchivo)}\` (sha256 \`${huella}\`, hoja «${hoja}») y el catálogo de dev. **Pendiente de la revisión de Esteban** (revisión de IRStrat) en \`referencia/formato-electronico/mapeo-revision.xlsx\`.`, "");
  md.push(`Conforme a CLAUDE.md §4, este archivo no reproduce texto del formato: cada concepto se identifica por su **fila** en el asset, su sección y los párrafos que cita. Las etiquetas están en el asset y en el Excel de revisión (fuera de git).`, "");
  md.push(`## Resumen`, "", `- Filas en alcance: **${resumen.filas}** (secciones [100000]–[211300] y [901000]; [8xxxxx] SASB fuera, Fase C).`);
  md.push(`- Clasificación: ${Object.entries(resumen.porClasificacion).map(([k, v]) => `${k} ${v}`).join(" · ")}.`);
  md.push(`- Capa que resolvió: ${Object.entries(resumen.porCapa).map(([k, v]) => `${k} ${v}`).join(" · ")}.`);
  md.push(`- Confianza: ${Object.entries(resumen.porConfianza).map(([k, v]) => `${k} ${v}`).join(" · ")}.`);
  md.push(`- Con datapoint propuesto: ${resumen.conDatapoint}; con bloque dueño: ${resumen.conBloque}.`, "");
  if (resumen.revision) md.push(`- Revisión de Esteban (\`${resumen.revision.archivo}\`): ${Object.entries(resumen.revision.porCategoria).map(([k, v]) => `${k} ${v}`).join(" · ")}. No interpretadas: ${resumen.revision.noInterpretadas.length ? resumen.revision.noInterpretadas.join(", ") : "ninguna"}.`, `- Llevan la oración fija del alivio E5: ${resumen.conAlivioE5}.`, "");
  md.push(`## Conceptos`, "", `| Fila | Sección | Tipo | Clasificación | Párrafos citados | Datapoint propuesto | Capa | Confianza | Bloque | E5 | Revisión | Regla de llenado |`, `|---:|---|---|---|---|---|---|---|---:|:-:|---|---|`);
  for (const x of resultado) md.push(`| ${x.fila} | ${x.seccion} | ${x.tipo} | ${x.clasificacion} | ${x.parrafos.join("; ") || "—"} | ${x.datapoint ?? (x.perfil ? x.perfil : "—")} | ${x.capa} | ${x.confianza} | ${x.bloque ?? "—"} | ${x.alivioE5 ? "sí" : ""} | ${x.revision ? `${x.revision.categoria} (${x.revision.origen})` : ""} | ${x.regla}${x.nota ? ` (${x.nota})` : ""}${x.grupo ? ` · ${x.grupo}` : ""}${x.estructura ? ` · ${x.estructura}` : ""} |`);
  md.push("", `## Sin mapeo (propuesta de ampliación del catálogo; no se crea nada ahora)`, "", `### Conceptos con tipo sin datapoint (${sinMapeo.length})`, "", `| Fila | Sección | Tipo | Párrafos que piden |`, `|---:|---|---|---|`);
  for (const x of sinMapeo) md.push(`| ${x.fila} | ${x.seccion} | ${x.tipo} | ${x.parrafos.join("; ") || "(sin párrafo citado)"} |`);
  md.push("", `### Párrafos citados por el formato que no tienen código en el catálogo (${parrafosSinCodigo.size})`, "", `| Párrafo | Filas que lo citan |`, `|---|---|`);
  for (const [p, fs_] of [...parrafosSinCodigo].sort()) md.push(`| ${p} | ${fs_.length} (${fs_.slice(0, 12).join(", ")}${fs_.length > 12 ? ", …" : ""}) |`);
  return md.join("\n") + "\n";
}
