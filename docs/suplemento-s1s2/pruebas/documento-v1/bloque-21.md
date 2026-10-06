# Bloque 21 · Riesgos climáticos prioritarios

**Sección:** III · Estrategia · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 2,542 caracteres |
| Costo | $0.2709 |
| Duración | 305,279 ms |
| Velocidad | 11.6 tok/s |
| Tokens | 8,234 entrada · 3,539 salida |

---

## Texto

**Riesgos climáticos prioritarios**

| Riesgo | Tipo | Horizontes | Descripción | Nivel |
|---|---|---|---|---|
| Estrés hídrico en planta norte | Riesgo físico | Corto plazo, Mediano plazo | Reducción de disponibilidad de agua para procesos en la planta norte por sequías recurrentes. | — |
| Inundación costera en centro de distribución | Riesgo físico | Largo plazo | Exposición del centro de distribución del golfo a marejadas e inundación por elevación del nivel del mar. | — |
| Precio del carbono y endurecimiento regulatorio | Riesgo de transición | Mediano plazo, Largo plazo | Aumento de costos operativos por impuestos al carbono y regulación de emisiones en jurisdicciones clave. | — |

Empresa Demo SAB de CV identifica los riesgos relacionados con el clima que podrían afectar razonablemente sus perspectivas y los clasifica en riesgos físicos y riesgos de transición. La tabla anterior presenta los riesgos climáticos que La Compañía considera prioritarios para el ejercicio 2025, junto con su tipo, su descripción y los horizontes temporales en los que cabe esperar razonablemente que se produzcan sus efectos.

Los dos riesgos físicos priorizados se asocian a instalaciones concretas de La Compañía: la planta norte y el centro de distribución del golfo. Sus efectos se distribuyen en horizontes distintos, pues la menor disponibilidad de agua para procesos ya se manifiesta en el corto y mediano plazo, mientras que la exposición del centro de distribución a marejadas e inundación se espera en el largo plazo. La exposición del conjunto de sitios de La Compañía a eventos físicos agudos y crónicos es [Pendiente: descripción de la exposición de los sitios a eventos físicos agudos y crónicos — solicitud Riesgos físicos climáticos en instalaciones].

El riesgo de transición priorizado no se vincula a una instalación en particular, sino a las jurisdicciones clave en las que opera La Compañía, y sus efectos sobre los costos operativos se esperan en el mediano y largo plazo conforme se extiendan los impuestos al carbono y la regulación de emisiones.

El nivel asignado a cada uno de estos riesgos dentro de la matriz de riesgos de La Compañía es [Pendiente: nivel asignado a cada riesgo prioritario — campo Nivel de los registros de clima].

La definición de corto, mediano y largo plazo empleada para clasificar estos riesgos, así como su vinculación con los horizontes de planificación que La Compañía utiliza para la toma de decisiones estratégicas, se describe en la sección de horizontes temporales de este informe.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000011` — Riesgos físicos climáticos en instalaciones — sin evidencia
- `reg:f0000000-0000-0000-0000-000000000001` — Registro de clima: [DEMO] Estrés hídrico en planta norte (riesgo_fisico)
- `reg:f0000000-0000-0000-0000-000000000002` — Registro de clima: [DEMO] Inundación costera en centro de distribución (riesgo_fisico)
- `reg:f0000000-0000-0000-0000-000000000003` — Registro de clima: [DEMO] Precio del carbono y endurecimiento regulatorio (riesgo_transicion)
- `perfil:matriz_riesgos` — Perfil del emisor, campo matriz_riesgos
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- [Pendiente: descripción de la exposición de los sitios a eventos físicos agudos y crónicos — solicitud Riesgos físicos climáticos en instalaciones]
- [Pendiente: nivel asignado a cada riesgo prioritario — campo Nivel de los registros de clima]

## Notas para el revisor — no se publican

- La columna Nivel de la tabla aparece vacía ('—') para los tres riesgos, aunque el perfil del emisor (perfil:matriz_riesgos) define una escala de cuatro niveles (Bajo, Medio, Alto, Crítico) sobre 25. Sin ese dato no es posible decir qué distingue a los riesgos de mayor nivel, como pedía la instrucción del bloque; se dejó marcador. Verificar si los registros de clima tienen puntuación asignada que no llegó a la tabla.
- La solicitud sol:...011 (Riesgos físicos climáticos en instalaciones) está sin evidencia, pero los registros reg:...001 y reg:...002 ya describen dos riesgos físicos con instalación, descripción y horizontes. Evaluar si esos registros bastan para cubrir NIIF S2 10(a)-(c) y el marcador puede retirarse, o si la solicitud buscaba una exposición sitio por sitio (agudos/crónicos) que efectivamente falta.
- Los registros de clima incluyen métricas del ejercicio (cantidad de activos, porcentaje, capital de gasto, financiación e inversión). No se usaron aquí porque corresponden a los bloques 34 y 35. Nota para el bloque 35: reg:...002 tiene capital_inversion nulo.
- Los registros reg:...004 y reg:...005 son oportunidades (eficiencia energética; productos bajos en carbono) y no se citaron: corresponden a los bloques 24 y 36. reg:...005 no tiene métricas del ejercicio.
- Los nombres de los registros traen el prefijo '[DEMO]'; se omitió en el texto. Confirmar que la tabla final del documento tampoco lo muestre.
- La descripción de los riesgos no indica si los eventos físicos son agudos o crónicos; el texto evitó esa clasificación para no inferirla. Si el cliente la aporta, puede enriquecer la revelación.

