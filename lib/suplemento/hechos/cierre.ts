import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { validarCruzado } from "./cruzado";

// =============================================================================
// CIERRE DE PENDIENTES POR CÓDIGO (Paso 5c, tercera revisión externa, punto 1).
//
// «Dos secciones declaran faltante lo que una tercera ya publicó.» Si un bloque
// marca pendiente algo que otro bloque afirma con un hecho del que es DUEÑO, el
// marcador se sustituye por una remisión a ese bloque, sin llamar al modelo:
//   · si el marcador es toda la oración → «Esta información se presenta en la
//     sección «<título>».»;
//   · si va dentro de una oración → «(véase la sección «<título>»)», sin la
//     preposición que quedaría colgando.
// El bloque se guarda con origen «automatica» (versión en el historial) y una
// nota para el revisor. Idempotente: un marcador cerrado ya no está.
// =============================================================================

type Db = SupabaseClient<Database>;
export type Cierre = { bloque: number; dueno: number; marcador: string; queda: string };

const tituloDe = (n: number) => BLOQUES.find((b) => b.numero === n)?.titulo ?? `bloque ${n}`;
const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** El texto con el marcador sustituido por la remisión. Exportada para la prueba. */
export function sustituirMarcador(texto: string, marcador: string, titulo: string): string {
  const i = texto.indexOf(marcador);
  if (i < 0) return texto;
  const inicio = Math.max(texto.lastIndexOf(". ", i) + 2, texto.lastIndexOf("\n", i) + 1, 0);
  const finPunto = texto.indexOf(".", i + marcador.length);
  const fin = finPunto < 0 ? texto.length : finPunto + 1;
  const resto = `${texto.slice(inicio, i)}${texto.slice(i + marcador.length, fin)}`.replace(/[\s.,;:]+/g, " ").trim();
  if (resto.split(" ").filter(Boolean).length < 4) {
    return `${texto.slice(0, inicio)}Esta información se presenta en la sección «${titulo}».${texto.slice(fin)}`;
  }
  const antes = texto.slice(0, i).replace(/\s+(?:de|del|a|al|en|con|por|para|sobre)\s*$/i, "");
  return `${antes} (véase la sección «${titulo}»)${texto.slice(i + marcador.length)}`.replace(/\s+\)/g, ")").replace(/\(\s+/g, "(");
}

export async function cerrarPendientes(db: Db, documentoId: string): Promise<Cierre[]> {
  const candidatos = (await validarCruzado(db, documentoId)).filter((d) => d.tipo === "pendiente_de_afirmado" && d.duenoAfirma && d.marcador && d.otroBloque != null);
  const porBloque = new Map<number, typeof candidatos>();
  for (const d of candidatos) porBloque.set(d.bloque, [...(porBloque.get(d.bloque) ?? []), d]);
  const hechos: Cierre[] = [];
  for (const [numero, ds] of porBloque) {
    const { data: b } = await db.from("documentos_bloques").select("texto, pendientes").eq("documento_id", documentoId).eq("numero", numero).single();
    if (!b?.texto) continue;
    let texto = b.texto;
    const notas: { campo: string; motivo: string; cubeta: string; etiqueta: null }[] = [];
    const cerrados: string[] = [];
    for (const d of ds) {
      if (!texto.includes(d.marcador!)) continue;
      texto = sustituirMarcador(texto, d.marcador!, tituloDe(d.otroBloque!));
      cerrados.push(d.marcador!);
      notas.push({
        campo: "nota_revision",
        cubeta: "decision_emisor",
        etiqueta: null,
        motivo: `Cierre automático: el pendiente «${d.marcador!.slice(0, 160)}» se sustituyó por una remisión al bloque ${d.otroBloque} («${tituloDe(d.otroBloque!)}»), que lo afirma con un hecho del que es dueño. Confirmar la remisión.`,
      });
      hechos.push({ bloque: numero, dueno: d.otroBloque!, marcador: d.marcador!, queda: tituloDe(d.otroBloque!) });
    }
    if (!cerrados.length) continue;
    const pendientes = ((b.pendientes ?? []) as { campo: string; motivo: string }[]).filter(
      (p) => p.campo !== "bloque" || !cerrados.some((m) => normal(m).includes(normal(p.motivo).replace(/^\[?pendiente:\s*/, "").slice(0, 60)))
    );
    await db
      .from("documentos_bloques")
      .update({ texto, pendientes: [...pendientes, ...notas] as never, origen_texto: "automatica", updated_at: new Date().toISOString() })
      .eq("documento_id", documentoId)
      .eq("numero", numero);
  }
  return hechos;
}
