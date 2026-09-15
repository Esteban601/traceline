# Bloque 32 · Alcance 2 por ubicación e instrumentos contractuales

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 2,244 caracteres |
| Costo | $0.2818 |
| Duración | 50,832 ms |
| Velocidad | 83.8 tok/s |
| Tokens | 5,823 entrada · 4,262 salida |

---

## Texto

Empresa Demo SAB de CV presenta la información relativa a sus emisiones indirectas de gases de efecto invernadero de Alcance 2, derivadas de la energía eléctrica adquirida y consumida en sus instalaciones durante el ejercicio 2025. Esta información complementa las cifras de emisiones brutas absolutas y tiene por objeto que los usuarios de los informes financieros con propósito general comprendan cómo se determinan dichas emisiones y en qué medida dependen de las características de la red eléctrica de la que La Compañía se abastece.

Las emisiones de Alcance 2 de La Compañía correspondientes al ejercicio 2025 ascendieron a 3,120.4 toneladas métricas equivalentes de CO2. [Pendiente: confirmación de que esta cifra corresponde al método basado en la ubicación y, en su caso, cifra calculada con el método basado en el mercado — campo de método del Inventario GEI Alcance 2 (ubicación y mercado)]. El método basado en la ubicación refleja la intensidad promedio de emisiones de la red eléctrica de la que se toma la energía, con independencia de los acuerdos de compra celebrados por La Compañía, por lo que constituye la referencia para comparar el desempeño entre periodos.

Respecto de los instrumentos contractuales, [Pendiente: descripción de los contratos de suministro de energía, certificados de energía limpia u otros instrumentos contractuales que afecten la determinación de las emisiones de Alcance 2, o confirmación de que La Compañía no cuenta con ellos — campo de instrumentos contractuales de Alcance 2]. En caso de existir tales instrumentos, La Compañía revelará su naturaleza, la proporción del consumo eléctrico que amparan y su efecto sobre la diferencia entre las cifras basadas en la ubicación y en el mercado.

Al tratarse del primer periodo anual de aplicación de las Normas NIIF S1 y S2, La Compañía no presenta información comparativa respecto de sus emisiones de Alcance 2, conforme a la medida transitoria prevista en el párrafo C3 del Apéndice C de la NIIF S2. La Compañía prevé consolidar en periodos subsecuentes la desagregación del consumo eléctrico por instalación como base para la determinación de sus emisiones de Alcance 2 y para la explicación de cualquier diferencia entre ambos métodos de cálculo.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000008` — Inventario GEI Alcance 2 (ubicación y mercado) — entregada y validada, valor 3120.4 tCO2e
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- [Pendiente: confirmación de que esta cifra corresponde al método basado en la ubicación y, en su caso, cifra calculada con el método basado en el mercado — campo de método del Inventario GEI Alcance 2 (ubicación y mercado)]
- [Pendiente: descripción de los contratos de suministro de energía, certificados de energía limpia u otros instrumentos contractuales que afecten la determinación de las emisiones de Alcance 2, o confirmación de que la Compañía no cuenta con ellos — campo de instrumentos contractuales de Alcance 2]

## Notas para el revisor — no se publican

- Inconsistencia: la solicitud sol:c0000000-0000-0000-0000-000000000008 pide el inventario de Alcance 2 por ambos métodos (ubicación y mercado) pero llegó un único valor (3120.4 tCO2e) sin indicar a qué método corresponde. El requisito 29(a)(v) exige específicamente la cifra basada en la ubicación; no se asignó el valor a ese método para no inferir. Si el cliente confirma que 3120.4 es la cifra por ubicación y que no hay instrumentos contractuales (cifra por mercado igual), el marcador se resuelve afirmando que ambos métodos coinciden.
- El estado de completitud marca el datapoint como cubierto, pero no hay ningún dato sobre instrumentos contractuales (CELs, PPAs, contratos de suministro renovable). Se requiere confirmación expresa de existencia o inexistencia; si no existen, la frase 'En caso de existir tales instrumentos...' debe retirarse del texto final.
- Las solicitudes sol:c0000000-0000-0000-0000-000000000006 (consumo por instalación, kWh) y sol:c0000000-0000-0000-0000-000000000021 (consumo consolidado Finanzas, kWh) están entregadas pero sin validar y sin valor; no se citaron. Una vez validadas, el consumo eléctrico total en kWh sería una revelación voluntaria útil en este bloque como dato de entrada del Alcance 2. Conviene verificar que ambas fuentes de consumo concilien entre sí antes de publicar cualquiera.
- La mención de C3 (sin comparativos) se limita a una frase con su consecuencia sobre este bloque; el detalle del régimen de alivios corresponde al bloque 3. Verificar que no se duplique la cifra total de Alcance 2 con el bloque 29 más allá de lo necesario para el requisito de ubicación.

