# Bloque 38 · Objetivos climáticos (atributos por objetivo)

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 3,038 caracteres |
| Costo | $0.3254 |
| Duración | 56,168 ms |
| Velocidad | 79.8 tok/s |
| Tokens | 9,079 entrada · 4,482 salida |

---

## Texto

**Objetivos climáticos y sus atributos**

| Objetivo | Métrica | Meta | Parte de la entidad | Periodo | Periodo base | Hitos | Absoluto o intensidad | Acuerdo internacional |
|---|---|---|---|---|---|---|---|---|
| Reducción absoluta de emisiones GEI (Alcance 1 y 2) | tCO2e absolutas (Alcance 1 + 2, con base en el mercado) | Reducir 42% las emisiones absolutas de Alcance 1 y 2 al 2030 | Toda la entidad (operaciones propias) | 2024–2030 | 2023 | Reducción intermedia de 25% al 2027 | Absoluto | Alineado con la trayectoria de 1.5 °C del Acuerdo de París; compromiso presentado a SBTi. |
| Intensidad de carbono por tonelada producida | tCO2e por tonelada producida | Reducir 50% la intensidad de emisiones al 2030 | Unidades de negocio manufactureras | 2024–2030 | 2022 | Reducción intermedia de 30% al 2027 | De intensidad | Consistente con el enfoque de contracción y convergencia del Acuerdo de París. |
| Consumo de energía renovable | Porcentaje de energía renovable sobre el consumo total | — | — | 2024–2030 | — | — | — | — |

Empresa Demo SAB de CV ha establecido objetivos relacionados con el clima para supervisar el progreso hacia la consecución de sus objetivos estratégicos. La tabla anterior presenta cada objetivo con la métrica que lo mide, la meta fijada, la parte de la entidad a la que aplica, el periodo de aplicación, el periodo base a partir del cual se mide el avance, los hitos intermedios, su carácter absoluto o de intensidad y su relación con acuerdos internacionales sobre el clima. [Pendiente: indicación de si alguno de los objetivos responde a un requerimiento de ley o regulación — de la solicitud Plan de transición climática y objetivos de reducción]

Los dos objetivos de emisiones de gases de efecto invernadero se complementan entre sí: el primero acota las emisiones brutas de Alcance 1 y Alcance 2 del conjunto de las operaciones propias, mientras que el segundo relaciona dichas emisiones con el volumen físico producido por las unidades manufactureras, de modo que el desempeño pueda seguirse con independencia de las variaciones en la producción. Los periodos base de ambos objetivos difieren, por lo que el avance de cada uno se mide respecto de su propio punto de partida. Los hitos intermedios de ambos se ubican en el mismo año, lo que permite una evaluación conjunta del avance a mitad del periodo de aplicación.

El objetivo de consumo de energía renovable, orientado a incrementar la participación de energía renovable en el consumo total de La Compañía, comparte el periodo de aplicación de los objetivos de emisiones. [Pendiente: meta cuantitativa o cualitativa, parte de la entidad a la que aplica, periodo base, hitos intermedios, tipo (absoluto o de intensidad) y alineación con acuerdo internacional — del objetivo Consumo de energía renovable]

Los atributos específicos de los objetivos de emisiones de gases de efecto invernadero, así como el enfoque seguido para establecerlos, revisarlos y evaluar su desempeño, se presentan en las secciones correspondientes de este informe.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000019` — Plan de transición climática y objetivos de reducción — entregada, sin validar
- `obj:d0000000-0000-0000-0000-000000000001` — Objetivo: [DEMO] Reducción absoluta de emisiones GEI (Alcance 1 y 2)
- `obj:d0000000-0000-0000-0000-000000000002` — Objetivo: [DEMO] Intensidad de carbono por tonelada producida
- `obj:d0000000-0000-0000-0000-000000000004` — Objetivo: [DEMO] Consumo de energía renovable
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- [Pendiente: indicación de si alguno de los objetivos responde a un requerimiento de ley o regulación — de la solicitud Plan de transición climática y objetivos de reducción]
- [Pendiente: meta cuantitativa o cualitativa, parte de la entidad a la que aplica, periodo base, hitos intermedios, tipo (absoluto o de intensidad) y alineación con acuerdo internacional — del objetivo Consumo de energía renovable]

## Notas para el revisor — no se publican

- La solicitud sol:c0000000-0000-0000-0000-000000000019 (Plan de transición climática y objetivos de reducción) está entregada pero sin validar; el datapoint NIIF S2 33 sigue en pendiente_validacion. El texto se redactó con los registros de objetivos (obj:...01, 02, 04) que sí están estructurados; confirmar que la validación de la solicitud no altere metas, periodos base ni hitos antes de aprobar.
- El objetivo obj:d0000000-0000-0000-0000-000000000003 (Mujeres en posiciones de liderazgo) es de ámbito sostenibilidad, no climático, y no aparece en la tabla; se excluyó del bloque por corresponder a NIIF S1 y no a NIIF S2 33. Revisar si debe ir en otra sección del informe.
- El objetivo obj:d0000000-0000-0000-0000-000000000004 (Consumo de energía renovable) tiene solo 2 de 8 atributos (métrica y periodo de aplicación); se dejó marcador. Si la emisora no fijó meta, valorar si conviene retirarlo de la tabla o completarlo.
- No hay dato sobre si alguno de los objetivos es requerido por ley o regulación (parte del requisito NIIF S2 33); se dejó marcador. Si ninguno lo es, bastaría una frase afirmándolo.
- Inconsistencia menor en obj:...01: el atributo de alineación dice 'compromiso presentado a SBTi' mientras que las notas del detalle indican 'validados por SBTi en 2024'. Confirmar cuál es el estatus correcto; la validación por tercero corresponde al bloque 39.
- Los campos de detalle (validacion_tercero, procesos_revision, revisiones, resultados, analisis_tendencias) se reservaron para el bloque 39, y gases_cubiertos, alcances_cubiertos, bruto_neto y enfoque_descarbonizacion para el bloque 40; no se usaron aquí para evitar duplicidad.
- En obj:...02 el periodo base 2022 es anterior al inicio del periodo de aplicación 2024 y difiere del de obj:...01 (2023); el detalle indica que el año base se ajustó tras la adquisición de la planta sur. La explicación de esa revisión corresponde al bloque 39; aquí solo se señaló que los periodos base difieren.

