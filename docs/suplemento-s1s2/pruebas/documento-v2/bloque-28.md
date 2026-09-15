# Bloque 28 · Plan de transición

**Sección:** IV · Riesgos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 2,116 caracteres |
| Costo | $0.2232 |
| Duración | 41,009 ms |
| Velocidad | 72.9 tok/s |
| Tokens | 6,241 entrada · 2,989 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. cuenta con un plan de transición relacionado con el clima para el periodo 2025-2030, orientado a reducir las emisiones de gases de efecto invernadero generadas por su operación y a reorientar de manera gradual su cartera hacia actividades alineadas con la Taxonomía Sostenible de México. El plan es de ámbito climático y alcanza a toda la Compañía, con excepción del componente relativo a emisiones financiadas, que se acota a la cartera empresarial.

El plan se articula en cuatro líneas de acción. La primera consiste en reducir en 30% las emisiones brutas de Alcance 1 y Alcance 2 respecto del nivel de 2025, con horizonte a 2030. La segunda establece que la cartera sostenible represente al menos 20% de la cartera total en 2028, a partir de un nivel de 8.0% en 2025. La tercera contempla la medición de las emisiones financiadas conforme a la metodología del Partnership for Carbon Accounting Financials (PCAF) para el 80% de la cartera empresarial en 2027. La cuarta prevé la revisión anual de los límites sectoriales aplicables a la cartera. Los atributos de cada uno de los objetivos que integran el plan, incluidos sus periodos base, hitos intermedios y alcance de gases cubiertos, se presentan en la sección de objetivos climáticos de este informe.

El desarrollo del plan se sustenta en tres supuestos clave. El primero es la continuidad de la Taxonomía Sostenible de México como marco de referencia para clasificar las actividades elegibles dentro de la cartera sostenible. El segundo es la disponibilidad de fondeo verde proveniente de la banca de desarrollo, del cual depende el crecimiento previsto de dicha cartera. El tercero es la trayectoria regulatoria de la Comisión Nacional Bancaria y de Valores en materia de riesgos relacionados con el clima.

Estos supuestos constituyen, a su vez, las dependencias en las que se basa el plan. El cumplimiento de las líneas de acción y de sus plazos depende de que dichas condiciones se mantengan durante el periodo de aplicación; la Compañía revisa anualmente la vigencia de estos supuestos como parte del seguimiento del plan.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000019` — Plan de transición climática y objetivos de reducción — entregada y validada
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- Los atributos detallados de cada objetivo (absoluto/relativo, gases CO2/CH4/N2O, periodo base 2025, hito intermedio de 12% al 2027 para emisiones e hito de 12% en 2026 para cartera sostenible, consistencia con el Acuerdo de París, no validado por SBTi, alineación con la Taxonomía) se dejaron fuera de este bloque para no invadir los bloques 38 y 40; verificar que allí se cubran.
- Posible inconsistencia a confirmar con el cliente: la solicitud reporta un hito intermedio de 12% para el objetivo de emisiones (2027) y también un hito de 12% para el objetivo de cartera sostenible (2026). Coincidencia plausible, pero conviene confirmar que no sea un error de captura.
- La solicitud describe objetivos pero el arreglo `objetivos` del bloque llegó vacío; la información se tomó únicamente de la descripción de la solicitud. Sugiero cargar los objetivos como registros estructurados para los bloques 38-40.
- La frase de cierre sobre la revisión anual de los supuestos se apoya en la 'revisión anual de límites sectoriales' de la solicitud; si la Compañía no revisa formalmente los supuestos del plan, ajustar o eliminar esa oración.
- El plan incluye la medición de emisiones financiadas con PCAF al 80% de la cartera empresarial en 2027. Dado que la emisora adopta el alivio C4 (sin Alcance 3) en 2025, la mención del plan de medición es coherente, pero cualquier cifra de emisiones financiadas que exista corresponde al bloque 33 y su revelación en este ejercicio sería voluntaria.

