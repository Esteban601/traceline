import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { costoUsd, type Uso } from "@/lib/suplemento/modelos";
import { MODELO_LIBRO } from "./extraer";
import { validarCruzado } from "./cruzado";

// =============================================================================
// CIERRE DE PENDIENTES POR CÓDIGO, VERIFICADO (Paso 5c; verificación autorizada
// por Esteban el 8 de octubre de 2026).
//
// Si un bloque marca pendiente algo que otro bloque afirma con un hecho del que
// es DUEÑO, Sonnet 5.5 lee el pendiente y el texto del bloque dueño y dice si lo
// RESPONDE, lo responde en PARTE o NO lo responde (con las señales de palabras
// solas acertaba 3 de 5). Después, por código:
//   · «responde»: el marcador se sustituye por una remisión al bloque dueño
//     (toda la oración → «Esta información se presenta en la sección «…».»;
//     dentro de una oración → «(véase la sección «…»)»);
//   · «parcial»: el pendiente se queda y la remisión va como nota al revisor;
//   · «no responde»: nada cambia.
// El bloque se guarda con origen «automatica» (versión en el historial) y la
// nota lleva la verificación. Idempotente: un marcador cerrado ya no está.
// =============================================================================

type Db = SupabaseClient<Database>;
export type Veredicto = "responde" | "parcial" | "no_responde";
export type Cierre = { bloque: number; dueno: number; marcador: string; veredicto: Veredicto; razon: string };
export type ResultadoCierre = { cierres: Cierre[]; uso: Uso; costo: number };

const tituloDe = (n: number) => BLOQUES.find((b) => b.numero === n)?.titulo ?? `bloque ${n}`;
const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Gramática mínima de una oración (rúbrica del 5c): empieza con un sujeto en
 * mayúscula y lleva un verbo conjugado después de la primera palabra.
 */
export function tieneSujetoYVerbo(oracion: string): boolean {
  const t = oracion.trim();
  if (!/^[«"(]?[A-ZÁÉÍÓÚÑ]/.test(t)) return false;
  const resto = t.split(/\s+/).slice(1).join(" ");
  return /(?<!\p{L})(?:se\s+\p{L}+|es|son|está|están|fue|fueron|ha|han|hay|\p{L}{3,}(?:an|en|ó|aron|ieron|ía|ían|aba|aban))(?!\p{L})/iu.test(resto);
}

const COLA = /\s*(?:,\s*)?(?:(?:que\s+)?(?:corresponden?|es|son|está|están|se\s+encuentran?|consisten?|equivalen?|ascienden?|se\s+ubican?|se\s+describen?|se\s+presentan?|figuran?|aparecen?)\s*)?(?:a|al|de|del|en|con|por|para|sobre)?\s*$/i;

/**
 * El texto con la ORACIÓN COMPLETA reescrita (rúbrica del 5c: el 21 quedó
 * «…corresponden (véase la sección…)»). Exportada para la prueba.
 *   · marcador al final de la oración → «<sujeto> se describe(n) en la sección «…».»;
 *   · marcador a mitad de la oración → «(véase la sección «…»)»;
 *   · si la oración resultante no tiene sujeto y verbo → «Esta información se
 *     presenta en la sección «…».»
 */
export function sustituirMarcador(texto: string, marcador: string, titulo: string | string[], sujetoSiFalta?: string): string {
  const i = texto.indexOf(marcador);
  if (i < 0) return texto;
  const punto = texto.lastIndexOf(". ", i);
  const inicio = Math.max(punto >= 0 ? punto + 2 : 0, texto.lastIndexOf("\n", i) + 1);
  const finPunto = texto.indexOf(".", i + marcador.length);
  const fin = finPunto < 0 ? texto.length : finPunto + 1;
  const antes = texto.slice(inicio, i);
  const despues = texto.slice(i + marcador.length, fin);
  // Varias secciones (cierre dirigido): «las secciones «A» y «B»», «véanse».
  const titulos = Array.isArray(titulo) ? titulo : [titulo];
  const seccion = titulos.length > 1 ? `las secciones ${titulos.slice(0, -1).map((t) => `«${t}»`).join(", ")} y «${titulos.at(-1)}»` : `la sección «${titulos[0]}»`;
  const vease = titulos.length > 1 ? "véanse" : "véase";
  const neutra = `Esta información se presenta en ${seccion}.`;
  let oracion: string;
  if (despues.replace(/[\s.,;:]+/g, " ").trim().split(" ").filter(Boolean).length < 4) {
    // El marcador es toda la oración: el que llama puede dar el sujeto, para no dejar «Esta información» sin antecedente.
    const sujeto = antes.replace(COLA, "").trim() || (sujetoSiFalta ?? "");
    const plural = /^(?:los|las)\s/i.test(sujeto) || /\s(?:y|e)\s+(?:su|sus|el|la|los|las)\s/i.test(sujeto);
    oracion = sujeto.split(/\s+/).length >= 3 ? `${sujeto} ${plural ? "se describen" : "se describe"} en ${seccion}.` : neutra;
  } else {
    oracion = `${antes.replace(/\s+(?:de|del|a|al|en|con|por|para|sobre)\s*$/i, "")} (${vease} ${seccion})${despues}`.replace(/\s+\)/g, ")").replace(/\(\s+/g, "(");
  }
  if (!tieneSujetoYVerbo(oracion)) oracion = neutra;
  return `${texto.slice(0, inicio)}${oracion}${texto.slice(fin)}`;
}

/**
 * La oración repetida del bloque que no es dueño, cambiada por una remisión al
 * dueño (rúbrica del 5c, 4/31). Si trae un encabezado («En lo que corresponde a
 * la desagregación…,»), se conserva. Exportada para la prueba.
 */
export function remitirDuplicada(texto: string, oracion: string, titulo: string): string {
  const i = texto.indexOf(oracion);
  if (i < 0) return texto;
  const coma = oracion.indexOf(", ");
  const encabezado = coma > 0 && /^(?:en lo que|en cuanto|respecto|por lo que|sobre)\b/i.test(oracion) ? oracion.slice(0, coma) : null;
  let nueva = encabezado ? `${encabezado}, véase la sección «${titulo}».` : `Esta información se presenta en la sección «${titulo}».`;
  if (!tieneSujetoYVerbo(nueva) && !encabezado) nueva = `Esta información se presenta en la sección «${titulo}».`;
  return `${texto.slice(0, i)}${nueva}${texto.slice(i + oracion.length)}`;
}

const ESQUEMA = {
  type: "object",
  properties: {
    veredicto: { type: "string", enum: ["responde", "parcial", "no_responde"] },
    razon: { type: "string" },
  },
  required: ["veredicto", "razon"],
  additionalProperties: false,
};

const SISTEMA = `Revisas un informe de sostenibilidad. Un bloque dejó un PENDIENTE (lo que dice que falta). Otro bloque del mismo informe dice algo parecido. Decide si un lector que va a esa sección encuentra lo que el requisito detrás del pendiente necesita:
- «responde»: la sección da lo CENTRAL que se pide (el dato, la definición, la escala o la descripción), aunque el pendiente pida además algo accesorio (una justificación, un matiz, una aclaración sobre un defecto de la fuente). Remitir ahí deja el requisito atendido.
- «parcial»: la sección da algo del tema, pero falta una parte CENTRAL de lo que se pide (por ejemplo, el pendiente pide dos cosas sustantivas y solo está una).
- «no_responde»: habla del mismo tema pero no da lo que se pide, o habla de otra cosa.
Juzga por el sentido, no por palabras en común. En «razon», una oración que diga qué da y qué falta.`;

/** Verificación de un cierre. Exportada para la prueba de los casos. */
export async function verificarCierre(
  pendiente: string,
  titulo: string,
  textoDueno: string,
  apiKey: string
): Promise<{ veredicto: Veredicto; razon: string; uso: Uso }> {
  const client = new Anthropic({ apiKey });
  const m = await client.messages
    .stream(
      {
        model: MODELO_LIBRO,
        max_tokens: 4000,
        system: SISTEMA,
        messages: [
          {
            role: "user",
            content: `# Pendiente\n\n${pendiente}\n\n# Texto de la sección «${titulo}»\n\n${textoDueno.replace(/\[Pendiente:[^\]]*\]/g, "[pendiente]").slice(0, 12000)}\n\n¿Lo responde?`,
          },
        ],
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      },
      { timeout: 120_000, maxRetries: 1 }
    )
    .finalMessage();
  const uso: Uso = {
    entrada: m.usage.input_tokens ?? 0,
    cacheEscritura: m.usage.cache_creation_input_tokens ?? 0,
    cacheLectura: m.usage.cache_read_input_tokens ?? 0,
    salida: m.usage.output_tokens ?? 0,
  };
  const r = JSON.parse(m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("")) as { veredicto: Veredicto; razon: string };
  return { ...r, uso };
}

export async function cerrarPendientes(db: Db, documentoId: string): Promise<ResultadoCierre> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { cierres: [], uso: vacio, costo: 0 };
  const discrepancias = await validarCruzado(db, documentoId);
  const candidatos = discrepancias.filter((d) => d.tipo === "pendiente_de_afirmado" && d.duenoAfirma && d.marcador && d.otroBloque != null);
  // Duplicación literal: el bloque que no es dueño remite (sin modelo: es literal).
  const duplicadas = discrepancias.filter((d) => d.tipo === "duplicacion" && d.oracionRepetida && d.otroBloque != null);
  const { data: filas } = await db.from("documentos_bloques").select("numero, texto, pendientes").eq("documento_id", documentoId);
  const textoDe = new Map((filas ?? []).map((f) => [f.numero, f.texto ?? ""]));
  let uso = vacio;
  const cierres: Cierre[] = [];
  const porBloque = new Map<number, typeof candidatos>();
  for (const d of candidatos) porBloque.set(d.bloque, [...(porBloque.get(d.bloque) ?? []), d]);
  for (const d of duplicadas) if (!porBloque.has(d.bloque)) porBloque.set(d.bloque, []);
  for (const [numero, ds] of porBloque) {
    const fila = (filas ?? []).find((f) => f.numero === numero);
    if (!fila?.texto) continue;
    let texto = fila.texto;
    const notas: { campo: string; motivo: string; cubeta: string; etiqueta: null }[] = [];
    const cerrados: string[] = [];
    for (const d of ds) {
      if (!texto.includes(d.marcador!)) continue;
      const titulo = tituloDe(d.otroBloque!);
      let v: Awaited<ReturnType<typeof verificarCierre>>;
      try {
        v = await verificarCierre(d.marcador!, titulo, textoDe.get(d.otroBloque!) ?? "", apiKey);
      } catch {
        continue; // sin verificación no se cierra
      }
      uso = { entrada: uso.entrada + v.uso.entrada, cacheEscritura: uso.cacheEscritura + v.uso.cacheEscritura, cacheLectura: uso.cacheLectura + v.uso.cacheLectura, salida: uso.salida + v.uso.salida };
      cierres.push({ bloque: numero, dueno: d.otroBloque!, marcador: d.marcador!, veredicto: v.veredicto, razon: v.razon });
      if (v.veredicto === "responde") {
        texto = sustituirMarcador(texto, d.marcador!, titulo);
        cerrados.push(d.marcador!);
        notas.push({
          campo: "nota_revision",
          cubeta: "decision_emisor",
          etiqueta: null,
          motivo: `Cierre automático: el pendiente «${d.marcador!.slice(0, 160)}» se sustituyó por una remisión al bloque ${d.otroBloque} («${titulo}»). Verificación (Sonnet 5.5): responde — ${v.razon}`,
        });
      } else if (v.veredicto === "parcial") {
        notas.push({
          campo: "nota_revision",
          cubeta: "decision_emisor",
          etiqueta: null,
          motivo: `Remisión posible: el bloque ${d.otroBloque} («${titulo}») responde en parte el pendiente «${d.marcador!.slice(0, 160)}». Verificación (Sonnet 5.5): parcial — ${v.razon}. El pendiente se queda.`,
        });
      }
    }
    for (const d of duplicadas.filter((x) => x.bloque === numero)) {
      if (!texto.includes(d.oracionRepetida!)) continue;
      const titulo = tituloDe(d.otroBloque!);
      texto = remitirDuplicada(texto, d.oracionRepetida!, titulo);
      notas.push({
        campo: "nota_revision",
        cubeta: "decision_emisor",
        etiqueta: null,
        motivo: `Cierre automático: la oración «${d.oracionRepetida!.slice(0, 160)}» repetía literalmente al bloque ${d.otroBloque} («${titulo}»), dueño del hecho; se sustituyó por una remisión.`,
      });
      cierres.push({ bloque: numero, dueno: d.otroBloque!, marcador: d.oracionRepetida!, veredicto: "responde", razon: "duplicación literal" });
    }
    if (!notas.length) continue;
    const pendientes = ((fila.pendientes ?? []) as { campo: string; motivo: string }[]).filter(
      (p) => p.campo !== "bloque" || !cerrados.some((m) => normal(m).includes(normal(p.motivo).replace(/^\[?pendiente:\s*/, "").slice(0, 60)))
    );
    await db
      .from("documentos_bloques")
      .update({ texto, pendientes: [...pendientes, ...notas] as never, origen_texto: "automatica", updated_at: new Date().toISOString() })
      .eq("documento_id", documentoId)
      .eq("numero", numero);
  }
  return { cierres, uso, costo: costoUsd(MODELO_LIBRO, uso) };
}

// =============================================================================
// CIERRES DIRIGIDOS (lector externo del 11 de octubre de 2026). Los decide una
// persona —qué pendiente y a qué secciones— y el código los ejecuta con las
// mismas reglas que el cierre automático, sin regenerar:
//   · cerrarPendienteDirigido: un pendiente que el validador cruzado no propone
//     (p. ej. lo responden DOS secciones juntas). Se verifica con el texto de
//     todas; solo «responde» sustituye. Si no, el pendiente se queda con nota.
//   · remitirPendienteDuplicado: el mismo pendiente en dos bloques; queda en uno
//     y el otro remite a él. Sin modelo: no cierra nada, solo quita el duplicado.
// =============================================================================

type Dirigido = { veredicto: Veredicto | "sin_marcador"; razon: string; texto: string | null; costo: number };

async function guardarCierre(db: Db, documentoId: string, numero: number, texto: string, quitar: string | null, nota: string) {
  const { data: fila } = await db.from("documentos_bloques").select("pendientes").eq("documento_id", documentoId).eq("numero", numero).single();
  const pendientes = ((fila?.pendientes ?? []) as { campo: string; motivo: string }[]).filter(
    (p) => !quitar || p.campo !== "bloque" || !normal(quitar).includes(normal(p.motivo).replace(/^\[?pendiente:\s*/, "").slice(0, 60))
  );
  const notas = [{ campo: "nota_revision", cubeta: "decision_emisor", etiqueta: null, motivo: nota }];
  await db
    .from("documentos_bloques")
    .update({ texto, pendientes: [...pendientes, ...notas] as never, origen_texto: "automatica", updated_at: new Date().toISOString() })
    .eq("documento_id", documentoId)
    .eq("numero", numero);
}

const marcadorQueEmpieza = (texto: string, empieza: string) => texto.match(new RegExp(`\\[Pendiente: ${empieza.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\]]*\\]`))?.[0] ?? null;

export async function cerrarPendienteDirigido(
  db: Db,
  documentoId: string,
  c: { bloque: number; empieza: string; destinos: number[]; motivo: string }
): Promise<Dirigido> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("sin ANTHROPIC_API_KEY");
  const { data: filas } = await db.from("documentos_bloques").select("numero, texto").eq("documento_id", documentoId).in("numero", [c.bloque, ...c.destinos]);
  const textoDe = (n: number) => filas?.find((f) => f.numero === n)?.texto ?? "";
  const marcador = marcadorQueEmpieza(textoDe(c.bloque), c.empieza);
  if (!marcador) return { veredicto: "sin_marcador", razon: "el marcador ya no está en el bloque", texto: null, costo: 0 };
  const titulos = c.destinos.map(tituloDe);
  const juntos = c.destinos.map((n) => `## ${tituloDe(n)}\n\n${textoDe(n)}`).join("\n\n");
  const v = await verificarCierre(marcador, titulos.join("» y «"), juntos, apiKey);
  const costo = costoUsd(MODELO_LIBRO, v.uso);
  const secciones = titulos.map((t) => `«${t}»`).join(" y ");
  if (v.veredicto !== "responde") {
    await guardarCierre(db, documentoId, c.bloque, textoDe(c.bloque), null,
      `Cierre dirigido no aplicado (${c.motivo}): las secciones ${secciones} no responden por completo el pendiente «${marcador.slice(0, 160)}». Verificación (Sonnet 5.5): ${v.veredicto} — ${v.razon}. El pendiente se queda.`);
    return { veredicto: v.veredicto, razon: v.razon, texto: null, costo };
  }
  const texto = sustituirMarcador(textoDe(c.bloque), marcador, titulos);
  await guardarCierre(db, documentoId, c.bloque, texto, marcador,
    `Cierre dirigido (${c.motivo}): el pendiente «${marcador.slice(0, 160)}» se sustituyó por una remisión a ${secciones}. Verificación (Sonnet 5.5): responde — ${v.razon}`);
  return { veredicto: "responde", razon: v.razon, texto, costo };
}

export async function remitirPendienteDuplicado(
  db: Db,
  documentoId: string,
  c: { bloque: number; empieza: string; destino: number; empiezaEnDestino: string; sujeto: string; motivo: string }
): Promise<Dirigido> {
  const { data: filas } = await db.from("documentos_bloques").select("numero, texto").eq("documento_id", documentoId).in("numero", [c.bloque, c.destino]);
  const textoDe = (n: number) => filas?.find((f) => f.numero === n)?.texto ?? "";
  const marcador = marcadorQueEmpieza(textoDe(c.bloque), c.empieza);
  if (!marcador) return { veredicto: "sin_marcador", razon: "el marcador ya no está en el bloque", texto: null, costo: 0 };
  // Solo si el destino conserva su propio pendiente: si no, la remisión no apuntaría a nada.
  if (!marcadorQueEmpieza(textoDe(c.destino), c.empiezaEnDestino)) return { veredicto: "no_responde", razon: "el destino ya no tiene el pendiente", texto: null, costo: 0 };
  const titulo = tituloDe(c.destino);
  // sustituirMarcador ya aplica la gramática mínima (si falla, queda la remisión neutra).
  const texto = sustituirMarcador(textoDe(c.bloque), marcador, titulo, c.sujeto);
  await guardarCierre(db, documentoId, c.bloque, texto, marcador,
    `Pendiente duplicado (${c.motivo}): «${marcador.slice(0, 160)}» queda solo en el bloque ${c.destino} («${titulo}»); este bloque remite ahí.`);
  return { veredicto: "responde", razon: "duplicado", texto, costo: 0 };
}
