import { BLOQUES, type Bloque } from "@/lib/suplemento/bloques";
import { REGIMEN_LABEL, type Regimen } from "@/lib/perfil-emisor";

// =============================================================================
// EL PROMPT DE UN BLOQUE, EN DOS CAPAS.
//
// La división no es estética: es lo que hace que el caché sirva. El caché es una
// coincidencia de PREFIJO —un byte distinto en cualquier parte invalida todo lo
// que viene después— así que lo que se repite entre bloques va primero y lo que
// cambia va al final.
//
//   Estable (con marca de caché):  rol · reglas · ejemplo de estilo · índice de
//                                  los 40 bloques · la emisora · los requisitos
//   Volátil (sin marca):           fronteras de ESTE bloque · datos en JSON ·
//                                  tabla ya armada · régimen · extensión
//
// NADA DE FECHAS NI IDENTIFICADORES DE CORRIDA EN LA CAPA ESTABLE. Un
// `new Date()` ahí dentro invalida el caché en cada llamada y el ahorro
// desaparece sin que nada falle de forma visible.
//
// v3: ejemplo de estilo tomado del informe real (p. 34), frase única sobre la
// medida transitoria C4, requisitos eximidos por alivio fuera del prompt, y
// normalización determinista de la denominación después de recibir el texto.
//
// v2 DEL PROMPT (tras revisar los tres textos de A4 contra un informe real):
// ninguno era publicable. Los tres narraban cómo se había recabado el dato
// —"entregado y validado", "no cuenta con evidencia en el expediente"—, se
// metían en terreno de otros bloques y repetían en prosa cada cifra. Las cinco
// reglas nuevas atacan eso.
// =============================================================================

export const PROMPT_VERSION = "a5b-v1-2026-09-15";

export type PreferenciasEmisor = {
  denominacionFormal: string | null;
  nombreCorto: string | null;
  formaDeReferencia: string | null;
};

export type RequisitoNiif = { codigo: string; descripcion: string };

export type FuenteEntregada = {
  id: string;
  tipo: "solicitud" | "registro" | "objetivo" | "cuestionario" | "perfil" | "reporte";
  detalle: string;
};

// -----------------------------------------------------------------------------
// Vocabulario prohibido en `texto`.
//
// El texto ES la revelación de la emisora, lista para publicarse en su informe
// anual. Todo lo que hable del proceso interno de recolección —quién pidió qué,
// quién lo validó, en qué plataforma— es de TRACELINE, no del informe. Un
// inversionista que lee "el inventario fue entregado y validado" está leyendo
// nuestra cocina, no su información a revelar.
//
// La única excepción es el marcador de pendiente, que existe para el revisor y
// se retira antes de aprobar.
// -----------------------------------------------------------------------------
export const VOCABULARIO_PROHIBIDO = [
  "solicitud",
  "solicitudes",
  "evidencia",
  "evidencias",
  "expediente",
  "entregado",
  "entregada",
  "entregados",
  "entregadas",
  "recibido",
  "recibida",
  "validado",
  "validada",
  "validados",
  "validadas",
  "IRStrat",
  "plataforma",
  "bloque",
  "datapoint",
  "sol:",
  "reg:",
  "obj:",
  "cue:",
  "perfil:",
  "reporte:",
];

/** El marcador de pendiente, con formato uniforme. Es lo único que se permite. */
const RE_PENDIENTE = /\[Pendiente:[^\]]*\]/g;

/**
 * Busca vocabulario prohibido FUERA del marcador de pendiente. Devuelve los
 * términos encontrados, para poder decírselo al modelo en el reintento: un
 * reintento que solo dice "hubo un error" repite el mismo fallo.
 */
export function vocabularioProhibidoEn(texto: string): string[] {
  const sinMarcadores = texto.replace(RE_PENDIENTE, " ");
  const encontrados = new Set<string>();
  for (const t of VOCABULARIO_PROHIBIDO) {
    const re = t.endsWith(":")
      ? new RegExp(t.replace(":", ":"), "i")
      : new RegExp(`\\b${t}\\b`, "i");
    if (re.test(sinMarcadores)) encontrados.add(t);
  }
  return [...encontrados];
}

/**
 * NORMALIZACIÓN DETERMINISTA DE LA DENOMINACIÓN.
 *
 * El emisor eligió cómo se llama a sí mismo —«la Compañía», con artículo en
 * minúscula— y el modelo lo capitaliza a media frase más o menos una vez de cada
 * dos. Es una diferencia de un carácter que no merece una llamada de reintento:
 * se arregla aquí, en el texto ya recibido, y cuesta cero.
 *
 * Se respeta el INICIO DE ORACIÓN: ahí la mayúscula es correcta en español y
 * forzar la minúscula rompería la frase. Se considera inicio de oración el
 * principio del texto, el de cada párrafo, y lo que sigue a `.`, `?` o `!`.
 */
export function normalizarDenominacion(
  texto: string,
  prefs: PreferenciasEmisor
): { texto: string; cambios: number } {
  let out = texto;
  let cambios = 0;

  for (const forma of [prefs.formaDeReferencia, prefs.denominacionFormal, prefs.nombreCorto]) {
    if (!forma || !forma.trim()) continue;
    const escapada = forma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escapada, "gi");
    out = out.replace(re, (hallado, pos: number) => {
      if (hallado === forma) return hallado;
      // ¿Arranca oración? Se mira hacia atrás saltando espacios y comillas.
      const antes = out.slice(0, pos).replace(/[\s"«»(]+$/, "");
      const inicioDeOracion = antes === "" || /[.?!:]$/.test(antes);
      if (inicioDeOracion) {
        const conMayuscula = forma.charAt(0).toUpperCase() + forma.slice(1);
        if (hallado === conMayuscula) return hallado;
        cambios++;
        return conMayuscula;
      }
      cambios++;
      return forma;
    });
  }

  return { texto: out, cambios };
}

/** ¿Los marcadores llevan el formato pedido? `[Pendiente: qué — dónde]`. */
export function marcadoresMalFormados(texto: string): string[] {
  const malos: string[] = [];
  for (const m of texto.match(RE_PENDIENTE) ?? []) {
    if (!m.includes("—")) malos.push(m);
  }
  return malos;
}

const REGLAS = `# Quién eres

Redactas la información a revelar bajo las Normas NIIF S1 y S2 de una emisora mexicana que cotiza en bolsa. Lo que escribes se publica tal cual en su informe anual, con su nombre y su firma. Lo leerán inversionistas, auditores y la autoridad.

# Regla número uno: escribes EN VOZ DE LA EMISORA

El campo \`texto\` es la revelación, lista para publicarse. No es un reporte de avance, ni un resumen de lo que nos entregó el cliente, ni una explicación de cómo conseguimos el dato.

NO uses jamás, dentro de \`texto\`, estas palabras ni sus variantes: solicitud, evidencia, expediente, entregado, recibido, validado, IRStrat, plataforma, bloque, datapoint. Tampoco identificadores internos (ids, uuids, nada con dos puntos como \`sol:\` o \`reg:\`). Y no narres de dónde salió una cifra: "según el inventario entregado y validado", "la información recibida no permite", "no cuenta con evidencia en el expediente" — nada de eso va en un informe anual.

Escribe lo que la emisora afirma. Si el dato está, se afirma. Si no está, va el marcador de pendiente y punto.

# La única excepción: el marcador de pendiente

Donde falte un dato, escribe exactamente:

\`[Pendiente: <qué falta> — <de qué solicitud o campo>]\`

Con la raya larga. Ese marcador es para el revisor interno y se retira antes de aprobar el documento; es el único lugar donde puedes nombrar una solicitud o un campo. Fuera de él, el texto no admite ese vocabulario.

**El marcador OCUPA EL LUGAR DEL DATO. No lo anuncies.** Nunca escribas una frase que prometa algo que luego resulta ser un marcador: nada de «la calificación asignada se presenta a continuación» seguido de un pendiente, ni «el detalle se describe más adelante» si ese detalle falta. Si el dato no está, la oración lo dice en el sitio donde iría el dato y no promete nada alrededor. Un borrador que anuncia una tabla inexistente, publicado sin revisar, miente.

**Y VA INTEGRADO EN LA ORACIÓN donde falta el dato, nunca agrupado al final.** Mal: tres párrafos de texto y luego tres marcadores seguidos. Bien: «Las emisiones de Alcance 2 ascendieron a [Pendiente: cifra de Alcance 2 — solicitud Inventario GEI Alcance 2] toneladas métricas equivalentes de CO2.» El revisor tiene que ver el hueco donde está, no en una lista al cierre.

# Las demás reglas

1. CERO DATO INVENTADO. Solo afirmas lo que viene en los datos entregados. No estimes, no completes, no infieras una cifra a partir de otra, no redondees hacia una cifra "razonable".

2. TODA CIFRA LLEVA SU FUENTE EN \`fuentes_usadas\`, nunca en el texto. Si citas un id que no se te entregó, la respuesta se rechaza entera.

3. NO TE SALGAS DE TU BLOQUE. Abajo tienes el índice de los cuarenta bloques del documento. Lo que le toca a otro, no lo escribes: se repetiría en el informe. La instrucción volátil te dice qué cubre el tuyo y qué bloques cubren lo contiguo.

4. REGISTRO FORMAL, TERCERA PERSONA. Nada de "nosotros" ni "creemos". Sin adjetivos promocionales: nada de "sólido", "robusto", "líder", "comprometido", "de vanguardia". La norma pide describir, no persuadir.

5. TERMINOLOGÍA DE LA TRADUCCIÓN OFICIAL NIIF EN ESPAÑOL: "riesgos y oportunidades relacionados con el clima", "información a revelar", "gases de efecto invernadero", "Alcance 1 / Alcance 2 / Alcance 3" (nunca "Scope"), "situación financiera, rendimiento financiero y flujos de efectivo", "usuarios de los informes financieros con propósito general", "toneladas métricas equivalentes de CO2".

6. NO CITES PÁRRAFOS DE LA NORMA. Los requisitos que se te dan son lo que hay que CUBRIR, no lo que hay que copiar. El texto habla de la emisora, no de la norma.

7. SIN ENCABEZADOS NI VIÑETAS NI MARKDOWN. Prosa corrida, párrafos separados por una línea en blanco.

8. SI TE DAN UNA TABLA YA ARMADA, la tabla dice las cifras. Tu prosa la introduce y comenta lo que la tabla no puede decir. Menciona una cifra en prosa solo si aporta algo que la tabla no dice, y nunca dos veces.

# Qué va en \`notas_revision\` y qué no

\`notas_revision\` es un canal aparte, para el revisor de IRStrat. NO se publica. Ahí —y solo ahí— pones los juicios que tú no debes resolver:

- Un dato que existe y que un alivio transitorio permite omitir: dilo, no lo metas en el texto. El revisor decide si la emisora quiere revelarlo voluntariamente.
- Una inconsistencia entre lo que se pidió y lo que llegó (se pidió desglosado y llegó agregado, la unidad no coincide, el periodo no cuadra).
- Una revelación voluntaria que los datos harían posible y la norma no exige.

En \`notas_revision\` sí puedes hablar con vocabulario interno: ese campo no se publica.`;

// -----------------------------------------------------------------------------
// EJEMPLO DE ESTILO — el bloque equivalente de un informe real ya publicado.
//
// Transcrito de la página 34 del informe anual NIIF S1/S2 2025 que la firma
// acompañó, que es la referencia de resultado esperado de toda la Fase A. Las
// cifras van como marcadores: lo que se le enseña al modelo es la FORMA —cómo
// se enuncia una revelación, dónde se corta, cómo se declara un alivio— no los
// datos de otra emisora.
//
// El emisor original ya se refiere a sí mismo como "la Compañía", así que no
// hubo nombre que sustituir.
//
// El documento fuente vive en `referencia/` y NO se versiona: es material con
// licencia. Esta constante es lo único que entra al repositorio.
// -----------------------------------------------------------------------------
const EJEMPLO_ESTILO = `# Cómo se ve este bloque en un informe ya publicado

Ejemplar de FORMA, no de contenido: fíjate en cómo se enuncia, no en los datos. Las cifras van como «###».

---

**Emisiones brutas absolutas de GEI durante el periodo (tCO2e)**

La Compañía revela información sobre sus emisiones brutas absolutas de gases de efecto invernadero generadas durante el periodo, expresadas en toneladas métricas de CO2 equivalente (tCO2e). Las emisiones se presentan para:

| | Emisiones de GEI Alcance 1 | Emisiones de GEI Alcance 2 |
|---|---|---|
| Total revelado | ### tCO2e | ### tCO2e |

**Aplicación de la medida transitoria · Emisiones de Alcance 3**

Conforme al párrafo C4 del Apéndice C de la NIIF S2, durante este primer periodo anual de aplicación la Compañía se acoge a la facilidad transitoria que la exime de revelar sus emisiones de gases de efecto invernadero de Alcance 3, incluida, en su caso, la información adicional relativa a emisiones financiadas. En consecuencia, las cifras de emisiones brutas absolutas corresponden a los Alcances 1 y 2.

La Compañía continuará avanzando de forma gradual en la medición y administración de sus emisiones de Alcance 3, priorizando las fuentes más relevantes asociadas a su operación, con el propósito de incorporar dicha revelación en periodos subsecuentes.

---

Lo que hace bien, y tienes que imitar:

- Afirma en voz de la emisora. No dice de dónde salió el dato ni quién lo validó.
- No repite en prosa las cifras que ya están en la tabla.
- Declara la medida transitoria C4 en UNA frase, con su párrafo, y dice qué consecuencia tiene sobre las cifras de ESTE bloque. No explica el resto del régimen ni los demás alivios: eso va en otro bloque.
- Cierra con la intención declarada hacia periodos subsecuentes, sin prometer cifras ni fechas que no estén en los datos.
- Frases largas y llanas, sin adjetivos.

`;

function indiceDeBloques(): string {
  const lineas = BLOQUES.map((b) => `${b.numero}. ${b.titulo}`);
  return [
    "# El documento completo: los 40 bloques",
    "",
    "Cada bloque lo escribe una llamada distinta. Esto es lo que cubre cada uno, para que no invadas el terreno de otro:",
    "",
    ...lineas,
  ].join("\n");
}

export function capaEstable(
  bloque: Bloque,
  prefs: PreferenciasEmisor,
  requisitos: RequisitoNiif[]
): { texto: string }[] {
  // La denominación se copia CARÁCTER POR CARÁCTER, incluido el artículo en
  // minúscula si lo trae: "la Compañía" no es lo mismo que "La Compañía", y el
  // emisor eligió una de las dos.
  const emisor = [
    "# La emisora",
    "",
    `Denominación formal, exacta: «${prefs.denominacionFormal ?? "[Pendiente: denominación formal — Perfil del emisor]"}»`,
    `Nombre corto, exacto: «${prefs.nombreCorto ?? "—"}»`,
    `Forma de referencia, exacta: «${prefs.formaDeReferencia ?? "la Emisora"}»`,
    "",
    "Copia esas cadenas carácter por carácter, incluido si el artículo va en minúscula. No las corrijas, no las capitalices, no las abrevies por tu cuenta.",
    "",
    "La denominación formal se escribe completa la primera vez que aparece en el bloque; después se usa la forma de referencia.",
  ].join("\n");

  const req = requisitos.length
    ? [
        "# Los requisitos que este bloque satisface",
        "",
        "Cúbrelos todos. Si para alguno no hay dato, ese es un marcador de pendiente.",
        "",
        ...requisitos.map((r) => `- ${r.codigo} — ${r.descripcion}`),
      ].join("\n")
    : [
        "# Los requisitos que este bloque satisface",
        "",
        "Este bloque no sale de la taxonomía: se redacta a partir de las tablas y del perfil de la emisora.",
      ].join("\n");

  return [
    { texto: REGLAS },
    { texto: EJEMPLO_ESTILO },
    { texto: indiceDeBloques() },
    { texto: emisor },
    { texto: req },
  ];
}

export type DatosVolatiles = {
  bloque: Bloque;
  regimen: Regimen;
  anioAdopcion: number | null;
  aliviosActivos: string[];
  ejercicio: number;
  fuentes: FuenteEntregada[];
  datos: unknown;
  /** Tabla ya armada por el código, en markdown. El modelo no la recalcula. */
  tabla: string | null;
  /** Qué cubre este bloque y qué cubren los contiguos, para no invadirlos. */
  fronteras: { cubre: string; noCubre: { numeros: number[]; que: string }[] };
  extension: string;
};

/**
 * E5 como BANDERA DE ALCANCE, no como exención.
 *
 * El alivio permite que el primer informe se limite a clima. Eso NO deroga la
 * NIIF S1 ni convierte sus requisitos en inaplicables: siguen aplicando en lo
 * pertinente a ese alcance. Tratarlo como exención —que es lo que hacía el
 * evaluador— ponía bloques enteros en "no aplica" y dejaba sin fuente a los de
 * gobernanza y juicios, que son justamente requisitos de S1 que el clima
 * necesita. Lo que el modelo tiene que saber es dónde está el borde del informe,
 * y eso se dice, no se resta.
 */
export function banderaAlcanceE5(aliviosActivos: string[]): string | null {
  const tieneE5 = aliviosActivos.some((a) => /\bE5\b/.test(a));
  if (!tieneE5) return null;
  return [
    "# Alcance de este informe",
    "",
    "Este informe se limita a los riesgos y oportunidades relacionados con el CLIMA (alivio NIIF S1 E5, primer ejercicio). Los requisitos de la NIIF S1 siguen aplicando: acótalos a ese alcance, no los omitas. Cuando un requisito general de S1 —gobernanza, juicios, materialidad, conectividad— pida algo que en esta emisora abarca más que el clima, responde por la parte climática y no menciones los demás temas de sostenibilidad.",
    "",
  ].join("\n");
}

export function capaVolatil(v: DatosVolatiles): string {
  const alivios = v.aliviosActivos.length
    ? v.aliviosActivos.map((a) => `- ${a}`).join("\n")
    : "- Ninguno.";

  const noCubre = v.fronteras.noCubre.length
    ? v.fronteras.noCubre
        .map(
          (n) =>
            `- ${n.que} lo cubre${n.numeros.length > 1 ? "n" : ""} el${n.numeros.length > 1 ? "los" : ""} bloque${n.numeros.length > 1 ? "s" : ""} ${n.numeros.join(" y ")}. No lo repitas.`
        )
        .join("\n")
    : "- Nada que delimitar.";

  const partes = [
    `# Tu bloque: ${v.bloque.numero} · ${v.bloque.titulo}`,
    "",
    `Este bloque cubre: ${v.fronteras.cubre}`,
    "",
    "Lo que NO te toca:",
    noCubre,
    "",
    "# Régimen del ejercicio",
    "",
    `Ejercicio sobre el que se informa: ${v.ejercicio}.`,
    `Régimen: ${REGIMEN_LABEL[v.regimen]}${v.anioAdopcion != null ? ` (año de adopción: ${v.anioAdopcion})` : ""}.`,
    "Alivios transitorios adoptados:",
    alivios,
    "",
  ];

  const alcance = banderaAlcanceE5(v.aliviosActivos);
  if (alcance) partes.push(alcance);

  if (v.tabla) {
    partes.push(
      "# La tabla, ya armada",
      "",
      "Esta tabla la construyó el sistema con los datos verificados y va a aparecer en el documento JUSTO ANTES de tu texto. No la reescribas, no la repitas y no recalcules sus cifras.",
      "",
      v.tabla,
      ""
    );
  }

  partes.push(
    "# Fuentes que puedes citar",
    "",
    "Estos son los ÚNICOS ids válidos para `fuentes_usadas`. Van en ese campo, NUNCA dentro del texto.",
    "",
    ...v.fuentes.map((f) => `- \`${f.id}\` — ${f.detalle}`),
    "",
    "# Datos",
    "",
    "```json",
    JSON.stringify(v.datos, null, 1),
    "```",
    "",
    "# Extensión y forma",
    "",
    v.extension,
    "",
    "Devuelve el esquema pedido: `texto` con la revelación publicable, `fuentes_usadas` con los ids que usaste, `pendientes` con cada marcador que pusiste, y `notas_revision` con los juicios que le dejas al revisor."
  );

  return partes.join("\n");
}

export const ESQUEMA_SALIDA = {
  type: "object" as const,
  properties: {
    texto: {
      type: "string" as const,
      description:
        "La revelación de la emisora, publicable tal cual. Prosa corrida, sin markdown, sin vocabulario de proceso interno. Los huecos van como [Pendiente: qué falta — de qué solicitud o campo].",
    },
    fuentes_usadas: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Ids de las fuentes entregadas que se usaron. Solo ids de la lista entregada.",
    },
    pendientes: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Un renglón por marcador puesto en el texto, con el mismo contenido.",
    },
    notas_revision: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "Juicios para el revisor de IRStrat, que NO se publican: datos que un alivio permite omitir, inconsistencias entre lo pedido y lo recibido, revelaciones voluntarias posibles.",
    },
  },
  required: ["texto", "fuentes_usadas", "pendientes", "notas_revision"],
  additionalProperties: false as const,
};
