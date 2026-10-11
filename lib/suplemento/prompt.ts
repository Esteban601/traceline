import { BLOQUES, bloqueSeleccionado, type Bloque } from "@/lib/suplemento/bloques";
import { fronteraDe } from "@/lib/suplemento/fronteras";
import { mapaDeDuenos } from "@/lib/suplemento/hechos/remisiones";
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

// calidad-v2: documentos del Perfil del emisor como contexto citado (regla 10)
// y documento sugerido dentro de «qué falta» del marcador (Paso 2).
export const PROMPT_VERSION = "calidad-v2-2026-10-06";
// Modo libro de hechos (Paso 5.3): el bloque redacta solo desde sus hechos.
// v2: caché compartido (requisitos en la volátil), glosario, notas en tres
// cubetas y defectos de insumo reportados a nivel documento (Paso 5.4).
export const PROMPT_VERSION_HECHOS = "hechos-v10-2026-10-08";

export type PreferenciasEmisor = {
  denominacionFormal: string | null;
  nombreCorto: string | null;
  formaDeReferencia: string | null;
};

export type RequisitoNiif = { codigo: string; descripcion: string };

export type FuenteEntregada = {
  id: string;
  tipo: "solicitud" | "registro" | "objetivo" | "cuestionario" | "perfil" | "reporte" | "evidencia" | "documento" | "hecho";
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
  "evi:",
  "adj:",
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

/**
 * ¿Los marcadores llevan el formato pedido? `[Pendiente: qué — dónde]`.
 *
 * Dos fallos distintos, los dos de formato:
 *
 * 1. Un marcador con corchetes pero sin la raya larga, que rompe la separación
 *    entre «qué falta» y «de dónde sale».
 * 2. Un «Pendiente:» SUELTO, sin corchetes. Este es el peor de los dos y es el
 *    que el bloque 31 produjo: sin corchetes, el retiro del marcador antes de
 *    aprobar —que busca `[Pendiente: …]`— no lo encuentra, y la frase se publica
 *    tal cual, diciéndole al inversionista que a la emisora le falta un dato.
 *    Un marcador que no se puede retirar automáticamente es peor que no tenerlo.
 */
export function marcadoresMalFormados(texto: string): string[] {
  const malos: string[] = [];
  for (const m of texto.match(RE_PENDIENTE) ?? []) {
    if (!m.includes("—")) malos.push(m);
  }
  // Lo que queda tras quitar los marcadores bien formados no debería contener
  // la palabra: si aparece, es un «Pendiente:» sin corchetes.
  const sinMarcadores = texto.replace(RE_PENDIENTE, " ");
  for (const m of sinMarcadores.match(/Pendiente\s*:[^.\n]{0,80}/gi) ?? []) {
    malos.push(m.trim());
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

Cuando haya un documento de la emisora que resolvería el hueco, nómbralo DENTRO de «qué falta», entre paréntesis y con la forma «documento sugerido: …»: \`[Pendiente: integrantes del comité que supervisa los asuntos climáticos (documento sugerido: acta de instalación del comité o estatutos sociales) — Perfil del emisor, Gobierno corporativo]\`. Sugiere documentos que una emisora tiene (acta, estatutos, reglamento, política, informe, inventario), no los inventes con nombre propio.

Con los corchetes y con la raya larga, siempre. Un «Pendiente:» sin corchetes no es un marcador y el servidor lo rechaza: el revisor los retira buscando los corchetes, y sin ellos la frase se publicaría tal cual. Ese marcador es para el revisor interno y se retira antes de aprobar el documento; es el único lugar donde puedes nombrar una solicitud o un campo. Fuera de él, el texto no admite ese vocabulario.

**El marcador OCUPA EL LUGAR DEL DATO. No lo anuncies.** Nunca escribas una frase que prometa algo que luego resulta ser un marcador: nada de «la calificación asignada se presenta a continuación» seguido de un pendiente, ni «el detalle se describe más adelante» si ese detalle falta. Si el dato no está, la oración lo dice en el sitio donde iría el dato y no promete nada alrededor. Un borrador que anuncia una tabla inexistente, publicado sin revisar, miente.

**Y VA INTEGRADO EN LA ORACIÓN donde falta el dato, nunca agrupado al final.** Mal: tres párrafos de texto y luego tres marcadores seguidos. Bien: «Las emisiones de Alcance 2 ascendieron a [Pendiente: cifra de Alcance 2 — solicitud Inventario GEI Alcance 2] toneladas métricas equivalentes de CO2.» El revisor tiene que ver el hueco donde está, no en una lista al cierre.

# Las demás reglas

1. CERO DATO INVENTADO. Solo afirmas lo que viene en los datos entregados. No estimes, no completes, no infieras una cifra a partir de otra, no redondees hacia una cifra "razonable".

2. TODA CIFRA LLEVA SU FUENTE EN \`fuentes_usadas\`, nunca en el texto. Si citas un id que no se te entregó, la respuesta se rechaza entera.

3. NO TE SALGAS DE TU BLOQUE. Abajo tienes el índice de los bloques que lleva este documento. Lo que le toca a otro, no lo escribes: se repetiría en el informe. La instrucción volátil te dice qué cubre el tuyo y qué bloques cubren lo contiguo.

4. REGISTRO FORMAL, TERCERA PERSONA. Nada de "nosotros" ni "creemos". Sin adjetivos promocionales: nada de "sólido", "robusto", "líder", "comprometido", "de vanguardia". La norma pide describir, no persuadir.

5. TERMINOLOGÍA DE LA TRADUCCIÓN OFICIAL NIIF EN ESPAÑOL: "riesgos y oportunidades relacionados con el clima", "información a revelar", "gases de efecto invernadero", "Alcance 1 / Alcance 2 / Alcance 3" (nunca "Scope"), "situación financiera, rendimiento financiero y flujos de efectivo", "usuarios de los informes financieros con propósito general", "toneladas métricas equivalentes de CO2".

6. NO CITES PÁRRAFOS DE LA NORMA. Los requisitos que se te dan son lo que hay que CUBRIR, no lo que hay que copiar. El texto habla de la emisora, no de la norma.

7. SIN ENCABEZADOS NI VIÑETAS NI MARKDOWN. Prosa corrida, párrafos separados por una línea en blanco.

8. SI TE DAN UNA TABLA YA ARMADA, la tabla dice las cifras. Tu prosa la introduce y comenta lo que la tabla no puede decir. Menciona una cifra en prosa solo si aporta algo que la tabla no dice, y nunca dos veces.

9. EL DOCUMENTO DE RESPALDO ES CONTEXTO, NO FUENTE DE CIFRAS. Una solicitud puede traer \`documento_de_respaldo\`: el texto leído del archivo que la sustenta, con un id entre corchetes por página, párrafo, tabla u hoja (\`[evi:…]\`). Úsalo para describir con precisión lo que la emisora hace —procesos, responsables, frecuencias, alcance— y pon en \`fuentes_usadas\` el id exacto de la página o párrafo de donde lo tomaste. Pero NINGUNA CIFRA sale de ahí: las cifras vienen solo de \`valor\`, de la tabla, de \`texto_confirmado\` o de los demás datos entregados, y una cifra que solo aparece en el documento se rechaza. Si trae \`texto_confirmado\`, ese texto ya lo revisó la emisora: es la base preferida para redactar; cítalo con los ids de \`citar_con\`. Los ids van en \`fuentes_usadas\`, nunca en el texto.

10. LOS DOCUMENTOS DE LA EMISORA SON CONTEXTO CITADO, NO FUENTE DE CIFRAS. Puede venir una sección «Documentos de la emisora»: extractos de los documentos que la emisora adjuntó a su perfil —estatutos, códigos, actas, reglamentos, organigramas—, ya seleccionados por pertinencia para este bloque, con un id entre corchetes por página o tramo (\`[adj:…]\`). Úsalos para describir lo que la emisora tiene y hace —qué órgano supervisa, qué comité existe y qué le corresponde, cómo se informa, qué política aplica— y pon en \`fuentes_usadas\` el id exacto de cada página o tramo del que tomaste algo. Si un campo del perfil está vacío y su contenido está en un documento, redáctalo desde el documento. Igual que en la regla 9: NINGUNA CIFRA sale de ahí (número de sesiones, de consejeros, porcentajes, montos, fechas de una sesión); si la revelación la necesita, va un marcador de pendiente. Lo que el documento no dice no se completa, y si un documento aparece como «no se pudo leer», lo que dependía de él es un pendiente que lo nombra.

# Qué va en \`notas_revision\` y qué no

\`notas_revision\` es un canal aparte, para el revisor de IRStrat. NO se publica. Ahí —y solo ahí— pones los juicios que tú no debes resolver:

- Un dato que existe y que un alivio transitorio permite omitir: dilo, no lo metas en el texto. El revisor decide si la emisora quiere revelarlo voluntariamente.
- Una inconsistencia entre lo que se pidió y lo que llegó (se pidió desglosado y llegó agregado, la unidad no coincide, el periodo no cuadra).
- Una revelación voluntaria que los datos harían posible y la norma no exige.

En \`notas_revision\` sí puedes hablar con vocabulario interno: ese campo no se publica.`;

// -----------------------------------------------------------------------------
// REGLAS EN MODO LIBRO DE HECHOS (encargo suplemento-calidad, Paso 5.3).
//
// Mismas reglas 1 a 8 y misma sección de notas; las 9 y 10 —documento de
// respaldo y documentos del Perfil como contexto— se sustituyen por las del
// libro: solo hechos, jerarquía de fuentes, contradicciones sin elegir,
// referencias de una línea y cobertura por subrequisito. Responden a la revisión
// externa del 7 de octubre de 2026 (duplicación, procedencia, inferencias).
// -----------------------------------------------------------------------------
const REGLAS_LIBRO = `9. SOLO HECHOS DEL LIBRO. Tus datos son los HECHOS de este bloque: cada uno trae un id (h1, h2…), su rango de fuente, un enunciado, el extracto literal de la fuente y la fuente. Todo lo que el texto afirme sale de un hecho, y su id va en \`fuentes_usadas\`. Lo que no dice ningún hecho no se escribe: ni conclusiones («el Consejo aprueba las políticas de riesgos» no permite decir que existe una política de riesgo climático), ni causas, ni calificativos, ni el desarrollo de una sigla, ni contexto que no traiga un hecho. Puedes juntar dos hechos en una frase; no derivar de ellos algo que ninguno dice. Si un requisito necesita algo que ningún hecho dice, va un marcador de pendiente. NO HAY OBLIGACIÓN DE USAR TODOS LOS HECHOS: usa solo los que respondan a un requisito de tu bloque; los demás, ignóralos (no los publiques ni los comentes en notas). Que un hecho esté verificado no lo hace pertinente.

10. JERARQUÍA DE FUENTES: validado > perfil > adjunto > narrativo. Si dos hechos dicen lo mismo, cita el de mayor rango. Un hecho NARRATIVO (Carta de la Dirección, textos editoriales) no sostiene una afirmación por sí solo: solo acompaña a un hecho de otro rango que diga lo mismo; si es el único que lo dice, no se publica. Las CIFRAS salen solo de hechos validados o del perfil, o de la tabla ya armada; una cifra que solo trae un hecho de adjunto no se publica: va un marcador de pendiente y una nota.

11. CONTRADICCIONES: las decide el libro, no tú. Un hecho con \`contradiccion\` trae el nombre de su grupo (c1, c2…), y en \`contradicciones\` está el veredicto de cada grupo:
   · «excluyente»: las versiones no pueden ser ciertas a la vez. No elijas ninguna: en el lugar del dato va un marcador de pendiente que diga qué hay que conciliar, y una nota «decision_emisor» con etiqueta «contradiccion» con las dos versiones y sus fuentes. El documento sugerido del marcador no puede ser uno que ya está entre tus fuentes (si el reglamento ya se leyó y no resuelve, no lo pidas: pide el documento que sí decidiría).
   · «compatible» o «secuencia»: son ciertas a la vez (el Comité propone y el Consejo aprueba; la propuesta, la creación y la instalación son momentos de una misma cronología). Redacta con la \`conciliacion\` que trae —puedes ajustar la sintaxis, no el contenido— y deja una nota breve «decision_emisor» con etiqueta «por_conciliar». NO va marcador.
   · «por_conciliar»: el libro no lo pudo decidir de forma estable (sus votos no coincidieron). No marques pendiente ni elijas versión: redacta solo lo que las versiones dicen en común (nada, si no comparten nada) y deja una nota «decision_emisor» con etiqueta «por_conciliar» que diga, con las fuentes, qué hay que conciliar y que la decisión del libro fue inestable.
   Los hechos sin \`contradiccion\` no están en conflicto: no declares contradicciones por tu cuenta ni pongas pendientes por diferencias entre ellos.

12. REFERENCIAS: lo que desarrolla otro bloque te llega como referencia de una línea, con el número y el título del bloque DUEÑO. Si tu texto lo necesita, remite en una frase a ESE bloque («como se describe en la sección de …») sin repetir su contenido ni sus cifras. Solo se remite al dueño del hecho: la oración que remite lleva el ancla del hecho del mapa del documento al que remite, [B17.2], junto con sus otras anclas. Si ningún hecho del mapa del bloque destino es lo que remites, no remitas ahí. Si el hecho es tuyo, o ningún bloque es dueño de él, redáctalo aquí o pon un marcador de pendiente. El código verifica cada remisión contra el mapa.

13. COBERTURA: en \`cobertura\` va una fila por cada requisito de «Requisitos de tu bloque», con el código exacto: «cubierto» si el texto lo responde con hechos (sus ids en \`hechos\`); «parcial» si lo responde en parte (ids, y en \`comentario\` qué falta); «pendiente» si falta y el texto lleva su marcador; «asignado» si lo responde otro bloque del documento (su número en \`bloque\`; los requisitos que se remiten vienen en \`remitir_a_otro_bloque\`). Se verifica por código: un id que no se entregó, un requisito que falte o sobre, o un bloque que no responde ese requisito, rechazan la respuesta.

14. NOTAS EN TRES CUBETAS. Cada nota de \`notas_revision\` lleva su cubeta: «decision_emisor» (lo que la emisora tiene que decidir o conciliar: contradicciones entre fuentes —con etiqueta «contradiccion»— y la misma función atribuida a dos sujetos —etiqueta «por_conciliar»—), «revelacion_voluntaria» (lo que los hechos permitirían revelar sin que la norma lo exija) y «defecto_insumo» (lo que falta o está mal en las fuentes: un dato ausente, un nombre o una cifra que no cuadra). Los defectos de insumo que ya se reportaron a nivel documento (te llegan en «Defectos ya reportados») NO se repiten; un defecto de insumo va solo si es de un hecho de este bloque, y a lo sumo dos. Notas cortas: una o dos oraciones.

15. NOMBRES: usa siempre el nombre canónico del glosario de la emisora para órganos, comités y direcciones, aunque el hecho use otro.

16. ANCLAS: cierra cada oración del texto que afirme algo con los ids de los hechos que la sostienen, entre corchetes y antes del punto: «… en su sesión del 27 de febrero de 2025 [h3][h5].». Una oración que solo lleva un marcador de pendiente o una remisión no lleva ancla. El código retira las anclas del texto publicable y las muestra al revisor; un id que no se entregó rechaza la respuesta.

17. INCISOS: en el texto, las notas y la cobertura, un inciso de la norma se nombra solo con el código exacto de «Requisitos de tu bloque» (p. ej. «NIIF S2 25 (a)(ii)»), nunca con un número de inciso que no esté en esa lista.

18. CAMBIOS: no escribas que un proceso «no registró cambios» respecto del periodo anterior si alguno de tus hechos describe un cambio en el ejercicio («integró», «incorporó», «creó en 2025»): ese cambio es lo que se revela.

19. SIN RELLENO: no cierres un párrafo ni el bloque reenunciando lo que acabas de decir («De este modo…», «En suma…», «La secuencia descrita comprende…», «En conjunto…»). Si ya lo dijiste, termina.

20. SIN CALIFICATIVOS SIN SUSTENTO: no califiques una meta, un proceso o una cifra como «alineado con», «consistente con» o «conforme a» un acuerdo, una trayectoria, un estándar o una mejor práctica (el Acuerdo de París, SBTi, 1.5 °C) si ningún hecho dice exactamente eso y cómo se determinó. Si un hecho lo dice, atribúyelo («la Compañía considera que…») y, si no dice el método, deja una nota «defecto_insumo» que lo pida.

21. DECLARACIONES NEGATIVAS: un hecho con \`tipo: "declaracion_negativa"\` («no usa créditos de carbono», «ninguna revisión al objetivo en 2025», «no hace uso del alivio C5», «no existen planes revelados en periodos anteriores») RESPONDE su requisito: publícalo en una oración y ánclalo. Omitirlo deja el requisito sin respuesta; el código lo rechaza.`;

const REGLAS_HECHOS = (() => {
  const ini = REGLAS.indexOf("9. EL DOCUMENTO DE RESPALDO");
  const fin = REGLAS.indexOf("# Qué va en `notas_revision`");
  if (ini < 0 || fin < 0) throw new Error("prompt.ts: no se encontraron las reglas 9 y 10 a sustituir");
  return `${REGLAS.slice(0, ini)}${REGLAS_LIBRO}\n\n${REGLAS.slice(fin)}`;
})();

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

/**
 * El índice de los bloques QUE LLEVA ESTE DOCUMENTO: los normativos y los
 * editoriales seleccionados (encargo suplemento-calidad). Va en la capa estable:
 * es igual para todos los bloques del mismo documento, así que el caché se
 * comparte dentro de la corrida.
 */
function indiceDeBloques(incluidos: string[] | null, duenos?: { dueno: number; enunciado: string }[]): string {
  // MAPA DEL DOCUMENTO (Paso 5c, tercera revisión externa): número, título EXACTO
  // y qué cubre cada bloque seleccionado. Las remisiones se escriben desde aquí,
  // nunca adivinadas (el 18 y el 27 remitían al 16 lo que está en el 17).
  // Con libro, también DE QUÉ HECHOS es dueño cada bloque (rúbrica del 5c: la
  // frontera sola no evitó que el 18 y el 34 remitieran a la sección equivocada).
  const mapa = mapaDeDuenos(duenos ?? []);
  const lineas = BLOQUES.filter((b) => bloqueSeleccionado(b, incluidos)).map((b) => {
    const propios = (mapa.get(b.numero) ?? []).map((h) => `     [${h.id}] ${h.enunciado.slice(0, 110)}`);
    return [`${b.numero}. «${b.titulo}» — cubre ${fronteraDe(b.numero).cubre}`, ...(propios.length ? ["   Es dueño de:", ...propios] : [])].join("\n");
  });
  return [
    `# Mapa del documento: los ${lineas.length} bloques que lleva`,
    "",
    "Cada bloque lo escribe una llamada distinta. Esto es lo que cubre cada uno, para que no invadas el terreno de otro y para remitir bien: solo se remite a un bloque de este mapa, nombrándolo con su título exacto («como se describe en la sección «…»»), y solo si este mapa dice que cubre ese tema o si recibiste una referencia suya. Un bloque que no está en el mapa no existe en este documento.",
    "",
    ...lineas,
  ].join("\n");
}

export function capaEstable(
  bloque: Bloque,
  prefs: PreferenciasEmisor,
  requisitos: RequisitoNiif[],
  /** Editoriales que lleva el documento (null = documento anterior: los 40). */
  incluidos: string[] | null = null,
  /** «hechos»: el bloque redacta desde el libro de hechos (reglas 9 a 15 propias). */
  modo: "datos" | "hechos" = "datos",
  /** Glosario del emisor (modo libro): nombres canónicos y sus variantes. */
  glosario: { canonico: string; variantes: string[] }[] = [],
  /** Hechos vigentes del libro por bloque dueño (modo libro): van al mapa del documento. */
  duenos?: { dueno: number; enunciado: string }[]
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

  // CACHÉ COMPARTIDO (modo libro, Paso 5.4): la capa estable es IGUAL para
  // todos los bloques del documento —reglas, ejemplo, índice, emisora y
  // glosario—, así que el primero la escribe y los demás la leen. Los
  // requisitos, que cambian de bloque a bloque, pasan a la capa volátil.
  if (modo === "hechos") {
    const conGlosario = glosario.length
      ? [
          emisor,
          "",
          "# Glosario de la emisora",
          "",
          "Nombres que se publican (a la izquierda) y otros nombres con que aparecen en las fuentes, que NO se usan:",
          "",
          ...glosario.map((e) => `- ${e.canonico}${e.variantes.length ? ` — no: ${e.variantes.join("; ")}` : ""}`),
        ].join("\n")
      : emisor;
    return [{ texto: REGLAS_HECHOS }, { texto: EJEMPLO_ESTILO }, { texto: indiceDeBloques(incluidos, duenos) }, { texto: conGlosario }];
  }

  return [
    { texto: REGLAS },
    { texto: EJEMPLO_ESTILO },
    { texto: indiceDeBloques(incluidos) },
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
  /** Extractos de los documentos del Perfil, ya seleccionados (adjuntos-bloque.ts). */
  documentos?: string | null;
  /** Modo libro: los requisitos del bloque (salen de la capa estable para compartir el caché). */
  requisitos?: { codigo: string; descripcion: string }[] | null;
  /** Incisos cuyo estado decidió el código («no aplica» heredado o pendiente por falta de dato). */
  heredados?: { codigo: string; estado: "no_aplica" | "pendiente"; motivo: string }[];
  /** Modo libro: defectos de insumo ya reportados a nivel documento (pre-vuelo). */
  defectosDocumento?: string[];
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
    ...(v.requisitos
      ? [
          "# Requisitos de tu bloque",
          "",
          ...(v.requisitos.length
            ? ["Cúbrelos todos; cada uno tiene su fila en `cobertura`.", "", ...v.requisitos.map((r) => `- ${r.codigo} — ${r.descripcion}`)]
            : ["Este bloque no sale de la taxonomía: `cobertura` va vacía."]),
          "",
          ...(v.heredados?.length
            ? [
                "# Incisos ya decididos por el código",
                "",
                "Su estado en `cobertura` es el que se indica, no otro. «no_aplica»: una oración breve que diga por qué no aplica, con el hecho que lo sostiene. «pendiente»: un marcador que haga la pregunta.",
                "",
                ...v.heredados.map((h) => `- ${h.codigo}: ${h.estado} — ${h.motivo}`),
                "",
              ]
            : []),
        ]
      : []),
    ...(v.defectosDocumento?.length
      ? ["# Defectos ya reportados a nivel documento", "", "No los repitas en tus notas:", "", ...v.defectosDocumento.map((d) => `- ${d}`), ""]
      : []),
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
    ...(v.documentos
      ? [
          "# Documentos de la emisora",
          "",
          "Extractos de los documentos que la emisora adjuntó a su perfil, elegidos por pertinencia a este bloque. Contexto que se cita por su id; ninguna cifra sale de aquí (regla 10).",
          "",
          v.documentos,
          "",
        ]
      : []),
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
        "La revelación de la emisora, publicable tal cual. Prosa corrida, sin markdown, sin vocabulario de proceso interno. Los huecos van como [Pendiente: qué falta (documento sugerido: …, si lo hay) — de qué solicitud o campo].",
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

/** Salida en modo libro: la misma, más la cobertura por subrequisito. */
export const ESQUEMA_SALIDA_HECHOS = {
  ...ESQUEMA_SALIDA,
  properties: {
    ...ESQUEMA_SALIDA.properties,
    fuentes_usadas: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Ids de los hechos (h1, h2…) y de las fuentes de la tabla que se usaron. Solo ids entregados.",
    },
    cobertura: {
      type: "array" as const,
      description: "Una fila por requisito del bloque.",
      items: {
        type: "object" as const,
        properties: {
          codigo: { type: "string" as const },
          estado: { type: "string" as const, enum: ["cubierto", "parcial", "pendiente", "asignado"] },
          bloque: { anyOf: [{ type: "integer" as const }, { type: "null" as const }] },
          hechos: { type: "array" as const, items: { type: "string" as const } },
          comentario: { type: "string" as const },
        },
        required: ["codigo", "estado", "bloque", "hechos", "comentario"],
        additionalProperties: false as const,
      },
    },
  },
  required: [...ESQUEMA_SALIDA.required, "cobertura"],
};

/** Modo libro v3 (Paso 5b): anclas en el texto y cobertura compacta. */
export const ESQUEMA_SALIDA_HECHOS_V3_PARCIAL = {
  texto: {
    type: "string" as const,
    description:
      "La revelación de la emisora. Prosa corrida, sin markdown, sin vocabulario de proceso interno. Cada oración que afirma algo cierra con sus anclas [h1][h2] antes del punto (regla 16); el código las retira al publicar. Los huecos van como [Pendiente: qué falta — de qué solicitud o campo].",
  },
  cobertura: {
    type: "array" as const,
    description: "Una fila por requisito del bloque, con su código exacto.",
    items: {
      type: "object" as const,
      properties: {
        codigo: { type: "string" as const },
        estado: { type: "string" as const, enum: ["cubierto", "parcial", "pendiente", "asignado", "no_aplica"] },
        bloque: { anyOf: [{ type: "integer" as const }, { type: "null" as const }] },
        hechos: { type: "array" as const, items: { type: "string" as const } },
        comentario: { type: "string" as const, description: "Vacío si «cubierto» o «asignado». Si «parcial» o «pendiente», qué falta, en 15 palabras o menos. «no_aplica» solo para los incisos ya decididos por el código." },
      },
      required: ["codigo", "estado", "bloque", "hechos", "comentario"],
      additionalProperties: false as const,
    },
  },
};

/** Modo libro v2: notas con su cubeta (regla 14). */
export const ESQUEMA_SALIDA_HECHOS_V2 = {
  ...ESQUEMA_SALIDA_HECHOS,
  properties: {
    ...ESQUEMA_SALIDA_HECHOS.properties,
    notas_revision: {
      type: "array" as const,
      description: "Juicios para el revisor de IRStrat, que NO se publican, cada uno en su cubeta.",
      items: {
        type: "object" as const,
        properties: {
          cubeta: { type: "string" as const, enum: ["decision_emisor", "revelacion_voluntaria", "defecto_insumo"] },
          etiqueta: { anyOf: [{ type: "string" as const, enum: ["contradiccion", "por_conciliar"] }, { type: "null" as const }] },
          texto: { type: "string" as const },
        },
        required: ["cubeta", "etiqueta", "texto"],
        additionalProperties: false as const,
      },
    },
  },
};

export const ESQUEMA_SALIDA_HECHOS_V3 = {
  ...ESQUEMA_SALIDA_HECHOS_V2,
  properties: { ...ESQUEMA_SALIDA_HECHOS_V2.properties, ...ESQUEMA_SALIDA_HECHOS_V3_PARCIAL },
};
