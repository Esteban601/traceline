# Bloque 40 · Objetivo de emisiones GEI

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 2,096 caracteres |
| Costo | $0.2589 |
| Duración | 36,875 ms |
| Velocidad | 73.8 tok/s |
| Tokens | 11,202 entrada · 2,720 salida |

---

## Texto

**Objetivos de emisiones de gases de efecto invernadero**

| Objetivo | Gases cubiertos | Alcances cubiertos | Bruto o neto | Enfoque de descarbonización |
|---|---|---|---|---|
| Reducción absoluta de emisiones GEI (Alcance 1 y 2) | Dióxido de carbono (CO2); Metano (CH4); Óxido nitroso (N2O) | Alcance 1; Alcance 2 | Emisiones brutas de gases de efecto invernadero | Falso |
| Intensidad de carbono por tonelada producida | Dióxido de carbono (CO2); Metano (CH4); Óxido nitroso (N2O) | Alcance 1; Alcance 2 | Emisiones brutas de gases de efecto invernadero | Verdadero |

Empresa Demo SAB de CV ha fijado dos objetivos de emisiones de gases de efecto invernadero, cuyos atributos se presentan en la tabla anterior. Ambos objetivos cubren el dióxido de carbono, el metano y el óxido nitroso, y se refieren a las emisiones de Alcance 1 y Alcance 2 de La Compañía. Ninguno de los dos incorpora emisiones de Alcance 3, lo que resulta congruente con la aplicación de la facilidad transitoria del párrafo C4 del Apéndice C de la NIIF S2 durante este primer periodo anual de aplicación.

Los dos objetivos están formulados en términos de emisiones brutas de gases de efecto invernadero. En consecuencia, no existe un objetivo neto que requiera revelar por separado un objetivo bruto asociado, y las reducciones comprometidas se refieren a la disminución de las emisiones generadas por las operaciones de La Compañía.

El objetivo de reducción absoluta de emisiones de Alcance 1 y 2 no se ha obtenido mediante un enfoque de descarbonización sectorial. El objetivo de intensidad de carbono por tonelada producida sí se ha obtenido utilizando un enfoque de descarbonización sectorial, aplicable a las unidades de negocio manufactureras.

En cuanto al uso previsto de créditos de carbono para compensar emisiones con el fin de alcanzar un objetivo en términos netos: [Pendiente: confirmar si existe un objetivo de emisiones netas y, en su caso, el uso previsto de créditos de carbono, su verificación por terceros, tipo de créditos y demás factores — NIIF S2 36(e), cuestionario S2 36(e) preguntas 1 y 2].

## Fuentes

- `obj:d0000000-0000-0000-0000-000000000001` — Objetivo: [DEMO] Reducción absoluta de emisiones GEI (Alcance 1 y 2)
- `obj:d0000000-0000-0000-0000-000000000002` — Objetivo: [DEMO] Intensidad de carbono por tonelada producida
- `cue:S2 36(e):1` — Cuestionario S2 36(e), pregunta 1
- `cue:S2 36(e):2` — Cuestionario S2 36(e), pregunta 2
- `sol:c0000000-0000-0000-0000-000000000019` — Plan de transición climática y objetivos de reducción — entregada, sin validar
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- [Pendiente: confirmar si existe un objetivo de emisiones netas y, en su caso, el uso previsto de créditos de carbono, su verificación por terceros, tipo de créditos y demás factores — NIIF S2 36(e), cuestionario S2 36(e) preguntas 1 y 2]

## Notas para el revisor — no se publican

- Inconsistencia: el cuestionario S2 36(e) (preguntas 1 y 2) describe un 'objetivo de emisiones netas' que prevé créditos de carbono hasta 10% de las reducciones al 2030 (Verra VCS y Gold Standard), pero los dos objetivos GEI registrados (obj ...0001 y ...0002) están marcados como emisiones brutas. Si alguno es realmente neto, hay que corregir el campo bruto_neto y revelar el objetivo bruto asociado por separado (36(c)); si ambos son brutos, el requisito 36(e) no aplica y el marcador puede sustituirse por una frase de no aplicabilidad. No se incorporó el dato de créditos al texto para no afirmar la existencia de un objetivo neto.
- La solicitud sol:c0000000-0000-0000-0000-000000000019 (Plan de transición climática y objetivos de reducción) está entregada pero sin validar por IRStrat; el datapoint 36(a)-(d) figura como pendiente_validacion aunque la tabla se construyó con los atributos de los objetivos. Confirmar validación antes de aprobar.
- El datapoint 36(e) figura como sin_solicitud: ninguna solicitud del reporte cubre créditos de carbono. Conviene abrir una solicitud si se confirma la existencia de un objetivo neto (36(e)(i)-(iv): proporción de reducciones vía créditos, verificación por tercero, tipo de crédito naturaleza/tecnología, remoción/reducción, otros factores).
- El objetivo [DEMO] Consumo de energía renovable (obj ...0004) no es un objetivo de emisiones GEI y carece de meta, año base y detalle; no se incluyó en este bloque. Corresponde a los bloques 38/39 si se completa.
- Para el objetivo de intensidad se marca enfoque de descarbonización sectorial = Verdadero, pero no se indica cuál (p. ej., SDA de SBTi). El párrafo 36(d) se cubre con la afirmación binaria; la identificación del método sería revelación voluntaria útil si el cliente la aporta.
- Revelación voluntaria posible: ambos objetivos cuentan con validación por tercero (SBTi 2024; consultor externo para la metodología de intensidad). Se omitió en este bloque para no invadir los bloques 38 y 39.

