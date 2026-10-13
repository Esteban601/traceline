// =============================================================================
// CATÁLOGO PARTIDO EN INCISOS (migración 20261007170000_catalogo_incisos; códigos
// aprobados por Esteban el 8 de octubre de 2026).
//
// Cada inciso tiene su fila en `datapoints_taxonomia`; el código agrupado sigue
// activo como PADRE. La pantalla de revisión muestra los hijos bajo su padre (no
// la concatenación «(i)a(v)»), y el «no aplica» heredado de 36(c) y 36(e) se
// decide sobre estos códigos.
// =============================================================================

/** Inciso → código padre (agrupado). */
export const PADRE_DE: Record<string, string> = {
  "NIIF S2 25 (a)(i)": "NIIF S2 25 (a)(i)a(v)",
  "NIIF S2 25 (a)(ii)": "NIIF S2 25 (a)(i)a(v)",
  "NIIF S2 25 (a)(iii)": "NIIF S2 25 (a)(i)a(v)",
  "NIIF S2 25 (a)(iv)": "NIIF S2 25 (a)(i)a(v)",
  "NIIF S2 25 (a)(v)": "NIIF S2 25 (a)(i)a(v)",
  "NIIF S1 44 (a)(i)": "NIIF S1 44 (a)(i)a(v)",
  "NIIF S1 44 (a)(ii)": "NIIF S1 44 (a)(i)a(v)",
  "NIIF S1 44 (a)(iii)": "NIIF S1 44 (a)(i)a(v)",
  "NIIF S1 44 (a)(iv)": "NIIF S1 44 (a)(i)a(v)",
  "NIIF S1 44 (a)(v)": "NIIF S1 44 (a)(i)a(v)",
  "NIIF S2 36 (a)": "NIIF S2 36 (a)a(d)",
  "NIIF S2 36 (b)": "NIIF S2 36 (a)a(d)",
  "NIIF S2 36 (c)": "NIIF S2 36 (a)a(d)",
  "NIIF S2 36 (d)": "NIIF S2 36 (a)a(d)",
  "NIIF S2 36 (e)(i)": "NIIF S2 36 (e)(i)a(iv)",
  "NIIF S2 36 (e)(ii)": "NIIF S2 36 (e)(i)a(iv)",
  "NIIF S2 36 (e)(iii)": "NIIF S2 36 (e)(i)a(iv)",
  "NIIF S2 36 (e)(iv)": "NIIF S2 36 (e)(i)a(iv)",
};

export const padreDe = (codigo: string): string | null => PADRE_DE[codigo] ?? null;

// -----------------------------------------------------------------------------
// «NO APLICA» HEREDADO (decisión de Esteban, 8 de octubre de 2026). 36(c) y
// 36(e)(i)–(iv) dependen de una condición de la emisora que se lee de los datos,
// no del modelo:
//   · 36(c) solo aplica si algún objetivo de emisiones es NETO (detalle del
//     objetivo, `bruto_neto`);
//   · 36(e)(i)–(iv) solo aplican si la emisora PREVÉ usar créditos de carbono
//     (cuestionario «S2 36(e)»).
// Con la condición en falso, el inciso es «no aplica»; sin dato, «pendiente» con
// la pregunta (nunca «no aplica» por omisión).
// -----------------------------------------------------------------------------

export type Heredado = { estado: "no_aplica" | "pendiente"; motivo: string };

export const INCISOS_CREDITOS = ["NIIF S2 36 (e)(i)", "NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"];

export function noAplicaHeredado(datos: {
  /** `bruto_neto` de los objetivos de emisiones (vacíos incluidos). */
  brutoNeto: (string | null)[];
  /** Respuestas del cuestionario «S2 36(e)», en orden. */
  respuestasCreditos: (string | null)[];
}): Map<string, Heredado> {
  const out = new Map<string, Heredado>();
  const conDato = datos.brutoNeto.map((x) => (x ?? "").trim()).filter(Boolean);
  if (!conDato.length) {
    out.set("NIIF S2 36 (c)", { estado: "pendiente", motivo: "¿El objetivo de emisiones es bruto o neto? — Objetivos, detalle «Bruto o neto»" });
  } else if (!conDato.some((x) => /net[oa]/i.test(x) && !/brut[oa]/i.test(x))) {
    out.set("NIIF S2 36 (c)", { estado: "no_aplica", motivo: `Ningún objetivo de emisiones es neto (detalle: «${conDato[0]}»), así que no hay objetivo bruto asociado que revelar por separado.` });
  }
  const respuestas = datos.respuestasCreditos.map((x) => (x ?? "").trim()).filter(Boolean);
  const niega = respuestas.some((r) => /no (?:se basa|prevé|preve|usa|utiliza|hace uso)[^.]*cr[eé]ditos de carbono|no aplica[^.]*cr[eé]ditos de carbono/i.test(r));
  for (const c of INCISOS_CREDITOS) {
    if (niega) out.set(c, { estado: "no_aplica", motivo: "La emisora no prevé usar créditos de carbono para alcanzar sus objetivos (cuestionario «S2 36(e)»)." });
    else if (!respuestas.length) out.set(c, { estado: "pendiente", motivo: "¿Prevé la Compañía usar créditos de carbono para alcanzar algún objetivo de emisiones netas? — Cuestionario «S2 36(e)»" });
  }
  return out;
}
