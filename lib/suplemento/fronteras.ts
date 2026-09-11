import { BLOQUES } from "@/lib/suplemento/bloques";

// =============================================================================
// FRONTERAS ENTRE BLOQUES — qué cubre cada uno y qué le toca al vecino.
//
// POR QUÉ EXISTE. Cada bloque lo escribe una llamada distinta que no ve lo que
// escribieron las otras. Sin decirle dónde termina su terreno, el modelo
// rellena: el bloque 29, que solo tiene que dar las cifras de emisiones, se puso
// a explicar los tres alivios transitorios —que son del bloque 3— y el método de
// medición —que es del 30—. En el documento final eso aparece tres veces.
//
// Está en una tabla explícita y no derivada del título porque es una decisión
// editorial: dónde se corta entre "qué emitimos" y "cómo lo medimos" no se
// deduce de la palabra "Emisiones".
//
// Los bloques sin entrada usan su propio título como alcance. Añadir una entrada
// solo hace falta donde dos bloques se rozan.
// =============================================================================

export type Frontera = {
  /** Qué cubre este bloque, en una frase. */
  cubre: string;
  /** Lo que NO le toca, con el bloque que sí lo cubre. */
  noCubre: { numeros: number[]; que: string }[];
};

export const FRONTERAS: Record<number, Frontera> = {
  3: {
    cubre:
      "el marco normativo bajo el que se informa y la enumeración de los alivios transitorios adoptados, con su fundamento",
    noCubre: [{ numeros: [29, 30], que: "el efecto de esos alivios sobre las cifras concretas de emisiones" }],
  },

  21: {
    cubre: "la descripción de cada riesgo climático priorizado, su tipo y sus horizontes temporales",
    noCubre: [
      { numeros: [34, 35], que: "las métricas de exposición y despliegue de capital de esos riesgos" },
      { numeros: [9], que: "la escala y el método con que se priorizan" },
    ],
  },

  29: {
    cubre:
      "las cifras de emisiones brutas absolutas de gases de efecto invernadero del ejercicio, por alcance, y qué comprende cada alcance",
    noCubre: [
      {
        numeros: [3],
        que: "la explicación del régimen de primer año y la enumeración de los alivios transitorios adoptados",
      },
      {
        numeros: [30],
        que: "el enfoque y el método de medición, los datos de entrada, los supuestos y el alivio C5 sobre método previo",
      },
      { numeros: [31], que: "las razones de la elección del enfoque y la desagregación" },
      { numeros: [32], que: "el Alcance 2 basado en la ubicación frente a los instrumentos contractuales" },
      { numeros: [33], que: "las emisiones financiadas de la Categoría 15" },
      { numeros: [38, 39, 40], que: "los objetivos de reducción de emisiones y su seguimiento" },
    ],
  },

  30: {
    cubre:
      "el enfoque de medición de las emisiones, sus datos de entrada y supuestos, los cambios del periodo y, si aplica, el método previo conservado bajo el alivio C5",
    noCubre: [{ numeros: [29], que: "las cifras de emisiones" }],
  },

  38: {
    cubre: "los objetivos climáticos y sus ocho atributos por objetivo",
    noCubre: [
      { numeros: [39], que: "el enfoque para establecerlos y revisarlos, y los resultados" },
      { numeros: [40], que: "lo específico de los objetivos de emisiones de gases de efecto invernadero" },
    ],
  },
};

export function fronteraDe(numero: number): Frontera {
  const ya = FRONTERAS[numero];
  if (ya) return ya;
  const b = BLOQUES.find((x) => x.numero === numero);
  return { cubre: (b?.titulo ?? "su materia").toLowerCase(), noCubre: [] };
}
