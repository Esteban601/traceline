// =============================================================================
// FUENTE — captura sugerida, Paso 2.
//
// Dos cosas sobre el mismo contenido extraído (evidencias_contenido.contenido):
//
// 1. `contenidoParaPrompt`: el contenido escrito con las MISMAS etiquetas con
//    que el modelo debe citar —«Energía!B14», «página 2», «párrafo 3», «tabla
//    1, fila 4, columna 3», «imagen»—. Si la etiqueta del prompt y la de la cita
//    coinciden, la cita se puede comprobar.
//
// 2. `verificarFuente`: la comprobación. Una sugerencia sin fuente localizable
//    no se muestra (encargo §3). Localizable quiere decir: la celda, página,
//    párrafo o tabla existe en el contenido, la cita literal está ahí y el
//    número de la cita es el valor sugerido. Se comprueba en código, no se le
//    pregunta al modelo si está seguro.
// =============================================================================

import type { BloqueWord, Contenido, HojaExtraida } from "./extraer";

export type Fuente = {
  tipo: "celda" | "pagina" | "parrafo" | "tabla" | "imagen";
  hoja?: string | null;
  celda?: string | null;
  pagina?: number | null;
  parrafo?: number | null;
  tabla?: number | null;
  fila?: number | null;
  columna?: number | null;
};

// -----------------------------------------------------------------------------
// 1. Contenido para el prompt
// -----------------------------------------------------------------------------

function filaDeRef(ref: string): number {
  return Number(ref.replace(/^[A-Z]+/, ""));
}

function hojaParaPrompt(h: HojaExtraida): string {
  const porFila = new Map<number, string[]>();
  for (const c of h.celdas) {
    const fila = filaDeRef(c.ref);
    const extra = [
      c.formato ? `formato ${c.formato}` : "",
      c.texto !== undefined && c.texto !== String(c.valor) ? `se muestra «${c.texto}»` : "",
    ].filter(Boolean);
    const valor = typeof c.valor === "string" ? JSON.stringify(c.valor) : String(c.valor);
    if (!porFila.has(fila)) porFila.set(fila, []);
    porFila.get(fila)!.push(`${h.nombre}!${c.ref} = ${valor}${extra.length ? ` (${extra.join("; ")})` : ""}`);
  }
  const filas = [...porFila.entries()].sort((a, b) => a[0] - b[0]).map(([, celdas]) => celdas.join(" | "));
  return [`### Hoja «${h.nombre}» (${h.filas} filas × ${h.columnas} columnas)`, ...filas].join("\n");
}

function bloqueWordParaPrompt(b: BloqueWord): string {
  if (b.tipo === "parrafo") return `[párrafo ${b.n}]${b.titulo ? " (título)" : ""} ${b.texto}`;
  return [
    `[tabla ${b.n}]`,
    ...b.filas.map((f, i) => `  fila ${i + 1}: ${f.map((c, j) => `(columna ${j + 1}) ${c}`).join(" | ")}`),
  ].join("\n");
}

export function contenidoParaPrompt(c: Contenido): string {
  switch (c.tipo) {
    case "excel":
    case "csv":
      return c.hojas.map(hojaParaPrompt).join("\n\n");
    case "pdf":
      return c.paginas
        .map((p) => `### página ${p.pagina}${p.origen === "vision" ? " (transcrita de una imagen escaneada)" : ""}\n${p.texto}`)
        .join("\n\n");
    case "word":
      return c.bloques.map(bloqueWordParaPrompt).join("\n");
    case "imagen":
      return `### imagen (transcrita)\n${c.paginas.map((p) => p.texto).join("\n")}`;
  }
}

/** Cómo se cita en este tipo de contenido; va en el prompt. */
export function formaDeCitar(c: Contenido): string {
  switch (c.tipo) {
    case "excel":
    case "csv":
      return 'fuente.tipo = "celda", con fuente.hoja y fuente.celda exactamente como aparecen antes del «=» (p. ej. hoja «Energía», celda «B14»).';
    case "pdf":
      return 'fuente.tipo = "pagina", con fuente.pagina = el número de «### página N» donde está la cifra.';
    case "word":
      return 'fuente.tipo = "parrafo" con fuente.parrafo = N de «[párrafo N]», o fuente.tipo = "tabla" con fuente.tabla, fuente.fila y fuente.columna tal como están etiquetadas.';
    case "imagen":
      return 'fuente.tipo = "imagen".';
  }
}

// -----------------------------------------------------------------------------
// 2. Verificación
// -----------------------------------------------------------------------------

const sinEspacios = (t: string) => t.replace(/\s+/g, "");

function iguales(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9);
}

/**
 * Los números que un texto puede querer decir, bajo las dos convenciones de
 * separadores (1,234.5 y 1.234,5). Se lee dos veces, con los espacios como
 * están y sin ellos: así una cifra que la extracción partió («8,93 0.2») se lee
 * también como «8,930.2», sin perder dos cifras que solo separa un espacio
 * («2025 376,300»). Si es ambiguo («48.210»), devuelve las dos lecturas.
 */
export function numerosPosibles(texto: string): number[] {
  const fuera = new Set<number>();
  for (const t of [texto, sinEspacios(texto)]) leerNumeros(t.replace(/[−–]/g, "-"), fuera);
  return [...fuera];
}

function leerNumeros(t: string, fuera: Set<number>): void {
  for (const m of t.matchAll(/-?\d[\d.,']*/g)) {
    const crudo = m[0].replace(/[.,']$/, "").replace(/'/g, "");
    const comas = (crudo.match(/,/g) ?? []).length;
    const puntos = (crudo.match(/\./g) ?? []).length;
    const lecturas: string[] = [];
    if (comas && puntos) {
      // El último separador es el decimal.
      lecturas.push(crudo.lastIndexOf(",") > crudo.lastIndexOf(".")
        ? crudo.replace(/\./g, "").replace(",", ".")
        : crudo.replace(/,/g, ""));
    } else if (comas || puntos) {
      const sep = comas ? "," : ".";
      const n = comas || puntos;
      const tras = crudo.split(sep).pop() ?? "";
      if (n > 1) lecturas.push(crudo.split(sep).join(""));
      else if (tras.length === 3) lecturas.push(crudo.replace(sep, ""), crudo.replace(sep, "."));
      else lecturas.push(crudo.replace(sep, "."));
    } else {
      lecturas.push(crudo);
    }
    for (const l of lecturas) {
      const n = Number(l);
      if (Number.isFinite(n)) fuera.add(n);
    }
  }
}

const ESCALAS: [RegExp, number][] = [
  [/\b(mil|miles|thousands?|k)\b/i, 1e3],
  [/\b(mill[oó]n|millones|millions?)\b/i, 1e6],
  [/\b(billions?|mil millones)\b/i, 1e9],
];

/** ¿El valor sugerido es un número de la cita (con su escala, si la dice)? */
export function citaContieneValor(cita: string, valor: number): boolean {
  const escalas = [1, ...ESCALAS.filter(([re]) => re.test(cita)).map(([, f]) => f)];
  return numerosPosibles(cita).some((n) => escalas.some((f) => iguales(n * f, valor)));
}

export type Verificacion = { ok: true } | { ok: false; motivo: string };

function textoDeFuente(c: Contenido, f: Fuente): string | null {
  if (c.tipo === "pdf" && f.tipo === "pagina") return c.paginas.find((p) => p.pagina === f.pagina)?.texto ?? null;
  if (c.tipo === "imagen" && f.tipo === "imagen") return c.paginas.map((p) => p.texto).join("\n");
  if (c.tipo === "word" && f.tipo === "parrafo") {
    const b = c.bloques.find((x) => x.tipo === "parrafo" && x.n === f.parrafo);
    return b && b.tipo === "parrafo" ? b.texto : null;
  }
  if (c.tipo === "word" && f.tipo === "tabla") {
    const b = c.bloques.find((x) => x.tipo === "tabla" && x.n === f.tabla);
    return b && b.tipo === "tabla" ? b.filas[(f.fila ?? 0) - 1]?.[(f.columna ?? 0) - 1] ?? null : null;
  }
  return null;
}

export function describirFuente(f: Fuente): string {
  switch (f.tipo) {
    case "celda": return `${f.hoja}!${f.celda}`;
    case "pagina": return `página ${f.pagina}`;
    case "parrafo": return `párrafo ${f.parrafo}`;
    case "tabla": return `tabla ${f.tabla}, fila ${f.fila}, columna ${f.columna}`;
    case "imagen": return "imagen";
  }
}

export function verificarFuente(c: Contenido, f: Fuente | null | undefined, cita: string, valor: number): Verificacion {
  if (!f?.tipo) return { ok: false, motivo: "sin fuente" };
  if (!Number.isFinite(valor)) return { ok: false, motivo: "sin valor numérico" };

  if (f.tipo === "celda") {
    if (c.tipo !== "excel" && c.tipo !== "csv") return { ok: false, motivo: `cita una celda en un ${c.tipo}` };
    const hoja = c.hojas.find((h) => h.nombre === f.hoja);
    if (!hoja) return { ok: false, motivo: `no existe la hoja «${f.hoja}»` };
    const celda = hoja.celdas.find((x) => x.ref === String(f.celda ?? "").toUpperCase().replace(/\$/g, ""));
    if (!celda) return { ok: false, motivo: `la celda ${describirFuente(f)} está vacía o no existe` };
    const numeros = typeof celda.valor === "number" ? [celda.valor] : numerosPosibles(String(celda.valor));
    if (celda.texto) numeros.push(...numerosPosibles(celda.texto));
    // 0.318 con formato de porcentaje se reporta como 31.8 %.
    const esPorcentaje = /%/.test(celda.formato ?? "") || /%/.test(celda.texto ?? "");
    const ok = numeros.some((n) => iguales(n, valor) || (esPorcentaje && iguales(n * 100, valor)));
    return ok ? { ok: true } : { ok: false, motivo: `${describirFuente(f)} vale ${JSON.stringify(celda.valor)}, no ${valor}` };
  }

  const texto = textoDeFuente(c, f);
  if (texto === null) return { ok: false, motivo: `la fuente ${describirFuente(f)} no existe en un ${c.tipo}` };
  const citaLimpia = sinEspacios(cita ?? "");
  if (!citaLimpia) return { ok: false, motivo: "sin cita literal" };
  if (!sinEspacios(texto).includes(citaLimpia)) {
    return { ok: false, motivo: `la cita «${cita.slice(0, 60)}» no está en ${describirFuente(f)}` };
  }
  if (!citaContieneValor(cita, valor)) return { ok: false, motivo: `la cita no contiene el valor ${valor}` };
  return { ok: true };
}

// -----------------------------------------------------------------------------
// 3. Verificación de un fragmento de texto (Paso 3)
// -----------------------------------------------------------------------------

/** Espacios colapsados; sin comillas ni puntos suspensivos alrededor. */
export function normalizarTexto(t: string): string {
  return t
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[«"“'‘]+|[»"”'’]+$/g, "")
    .replace(/^(…|\.\.\.)\s*|\s*(…|\.\.\.)$/g, "")
    .trim();
}

/**
 * El fragmento tiene que existir LITERALMENTE en el lugar que cita: la misma
 * secuencia de caracteres, con los espacios y saltos de línea colapsados (una
 * línea de un PDF partida en dos sigue siendo la misma frase). Nada más se
 * normaliza: ni mayúsculas, ni acentos, ni puntuación interior.
 */
export function verificarFragmento(c: Contenido, f: Fuente | null | undefined, texto: string): Verificacion {
  if (!f?.tipo) return { ok: false, motivo: "sin fuente" };
  const frag = normalizarTexto(texto ?? "");
  if (!frag) return { ok: false, motivo: "fragmento vacío" };
  let enFuente: string | null;
  if (f.tipo === "celda") {
    const celda = c.tipo === "excel" || c.tipo === "csv"
      ? c.hojas.find((h) => h.nombre === f.hoja)?.celdas.find((x) => x.ref === String(f.celda ?? "").toUpperCase())
      : undefined;
    enFuente = celda ? String(celda.texto ?? celda.valor) : null;
  } else {
    enFuente = textoDeFuente(c, f);
  }
  if (enFuente === null) return { ok: false, motivo: `la fuente ${describirFuente(f)} no existe en un ${c.tipo}` };
  if (!normalizarTexto(enFuente).includes(frag)) {
    return { ok: false, motivo: `«${frag.slice(0, 60)}…» no está literalmente en ${describirFuente(f)}` };
  }
  return { ok: true };
}
