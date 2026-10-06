# Bloque 38 · Objetivos climáticos (atributos por objetivo)

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,850 caracteres |
| Costo | $0.4866 |
| Duración | 81,144 ms |
| Velocidad | 76.5 tok/s |
| Tokens | 20,970 entrada · 6,211 salida |

---

## Texto

**Objetivos climáticos y sus atributos**

| Objetivo | Métrica | Meta | Parte de la entidad | Periodo | Periodo base | Hitos | Absoluto o intensidad | Acuerdo internacional |
|---|---|---|---|---|---|---|---|---|
| Reducción de emisiones de Alcances 1 y 2 | tCO2e | Reducción de 30% al 2030 | Toda la Compañía | 2026-2030 | 2025 | 12% al 2027 | Absoluto | Consistente con la trayectoria del Acuerdo de París; no validado por SBTi. |
| Cartera sostenible | Porcentaje de la cartera total con etiqueta sostenible conforme a la Taxonomía Sostenible de México | 20% al 2028 | Toda la Compañía | 2026-2028 | 2025 (8.0%) | 12% en 2026 | Relativo | Taxonomía Sostenible de México. |
| Medición de emisiones financiadas | Porcentaje de la cartera empresarial con emisiones financiadas medidas bajo PCAF | 80% en 2027 | Cartera empresarial | 2026-2027 | 2025 (42%) | 60% en 2026 | Relativo | Metodología PCAF. |

Empresa Demo, S.A.B. de C.V. ha establecido tres objetivos cuantitativos relacionados con el clima para supervisar el progreso hacia sus objetivos estratégicos, derivados de su plan de transición 2025-2030. La tabla anterior presenta, para cada uno de ellos, la métrica utilizada, la meta, la parte de la entidad a la que aplica, el periodo de aplicación, el periodo base, los hitos intermedios, su carácter absoluto o relativo y el acuerdo internacional o marco de referencia que lo informa.

Los tres objetivos son de ámbito climático. Dos de ellos responden a riesgos relacionados con el clima: la reducción de las emisiones brutas de gases de efecto invernadero de Alcances 1 y 2, que la Compañía prevé alcanzar mediante eficiencia energética, generación solar distribuida y renovación de flota, y la ampliación de la cobertura de medición de las emisiones financiadas de la cartera empresarial conforme a la metodología PCAF. El tercero responde a una oportunidad relacionada con el clima: el crecimiento de la cartera con etiqueta sostenible conforme a la Taxonomía Sostenible de México.

Los objetivos de cartera sostenible y de medición de emisiones financiadas se expresan en términos relativos, como porcentaje de la cartera total y de la cartera empresarial, respectivamente, por lo que su cumplimiento depende tanto de la evolución del saldo etiquetado o medido como del tamaño de la cartera de referencia. El objetivo de emisiones es el único formulado en términos absolutos. Los objetivos de emisiones y de cartera sostenible aplican a toda la Compañía, mientras que el de emisiones financiadas se acota a la cartera empresarial.

El objetivo de emisiones toma como referencia la trayectoria del Acuerdo de París y no cuenta con la aprobación de la iniciativa Science Based Targets; los otros dos se apoyan en marcos técnicos, la Taxonomía Sostenible de México y la metodología PCAF, y no en un acuerdo internacional sobre el clima.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000019` — Plan de transición climática y objetivos de reducción — entregada y validada
- `obj:70a56eb6-556e-4af7-86b6-b24b776e4f81` — Objetivo: Reducción de emisiones de Alcances 1 y 2
- `obj:014b1a2e-b4dc-45dd-a566-0cf6cda34388` — Objetivo: Cartera sostenible
- `obj:c6ac8144-b4dc-4769-9312-cb75be6c1e04` — Objetivo: Medición de emisiones financiadas
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- Se sustituyó 'validado por SBTi' por 'no cuenta con la aprobación de la iniciativa Science Based Targets' para evitar vocabulario de proceso interno; el sentido del dato (validacion_tercero: Falso) se conserva.
- NIIF S2 33 pide incluir los objetivos requeridos por ley o regulación. Los datos no indican si alguno de los tres objetivos deriva de una obligación legal o regulatoria ni si existen otros objetivos exigidos por la autoridad; conviene confirmar con la emisora antes de publicar. No se afirmó en el texto que todos sean voluntarios porque no hay dato que lo respalde.
- La columna de la tabla se titula 'Absoluto o intensidad' (conforme a S2 33(g)), pero dos objetivos aparecen como 'Relativo'. Un objetivo expresado como porcentaje de cartera no es un objetivo de intensidad en el sentido de la norma; sugiero revisar el encabezado o la clasificación para evitar confusión en auditoría.
- La solicitud sol:...019 menciona un cuarto compromiso del plan de transición ('revisión anual de límites sectoriales') que no está registrado como objetivo ni aparece en la tabla. Decidir si es un objetivo cualitativo a revelar bajo S2 33 (cabría en este bloque) o un proceso del plan de transición (bloque 28).
- Datos disponibles que corresponden a otros bloques y se omitieron deliberadamente: validación por tercero (cartera sostenible: Verdadero; los otros: Falso), procesos de revisión, métricas de supervisión y resultados 2025 (línea base Alcance 1: 1,240 tCO2e; Alcance 2: 3,860 tCO2e; cartera sostenible 8.0% / 6,910 MDP; cobertura PCAF 42% con calidad de datos 4-5) van al bloque 39; gases cubiertos, alcances, bruto/neto y ausencia de compensaciones van al bloque 40; supuestos del plan (continuidad de la Taxonomía, fondeo verde de banca de desarrollo, trayectoria regulatoria CNBV) van al bloque 28.
- El objetivo de medición de emisiones financiadas registra 'Alcance 3' como alcance cubierto. Dado el alivio C4 adoptado (sin Alcance 3 en 2025), verificar que su presentación en los bloques 33 y 40 sea coherente: es un objetivo de cobertura de medición, no un objetivo de reducción de Alcance 3.
- Revelación voluntaria posible: el texto menciona las palancas del objetivo de emisiones (eficiencia energética, solar distribuida, renovación de flota) tomadas de la descripción del objetivo; si el bloque 28 las desarrolla con detalle, valorar recortarlas aquí para evitar duplicidad.

