# Bloque 32 · Alcance 2 por ubicación e instrumentos contractuales

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,052 caracteres |
| Costo | $0.2373 |
| Duración | 41,315 ms |
| Velocidad | 76.2 tok/s |
| Tokens | 6,833 entrada · 3,148 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. presenta sus emisiones de gases de efecto invernadero de Alcance 2 correspondientes al ejercicio 2025 conforme al método basado en la ubicación, el cual aplica los factores de emisión promedio de la red eléctrica de la que la Compañía toma su energía. Bajo este método, las emisiones de Alcance 2 del ejercicio ascendieron a 3,860 toneladas métricas equivalentes de CO2, asociadas a un consumo de energía eléctrica de 9,120,000 kWh en el conjunto de sus instalaciones.

La totalidad de la energía eléctrica consumida por la Compañía durante el ejercicio se adquirió a la Comisión Federal de Electricidad bajo contratos de suministro estándar. La Compañía no mantiene contratos de compra de energía renovable, contratos bilaterales con generadores de fuentes limpias, certificados de energía limpia ni otros instrumentos contractuales que le permitan atribuir a su consumo un factor de emisión distinto del promedio de la red. En consecuencia, no existen instrumentos contractuales cuya descripción sea necesaria para comprender las emisiones de Alcance 2 de la Compañía, y el método basado en el mercado arroja para el ejercicio 2025 el mismo valor que el método basado en la ubicación: 3,860 toneladas métricas equivalentes de CO2.

La coincidencia entre ambos métodos refleja que la Compañía no adquirió durante el ejercicio atributos contractuales de energía que reduzcan sus emisiones de Alcance 2 basadas en el mercado respecto de las basadas en la ubicación. Cualquier adquisición futura de energía renovable o de certificados de energía limpia se reflejaría en la cifra basada en el mercado y se revelaría junto con la descripción de los instrumentos correspondientes, en tanto la cifra basada en la ubicación continuaría reflejando la intensidad promedio de la red de la que la Compañía se abastece.

Al tratarse del primer ejercicio anual de aplicación de la NIIF S2, y conforme a la facilidad transitoria del párrafo C3, no se presenta información comparativa del periodo anterior para las emisiones de Alcance 2.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000006` — Consumo de energía eléctrica 2025 por instalación (kWh) — entregada y validada, valor 9120000 kWh
- `sol:c0000000-0000-0000-0000-000000000008` — Inventario GEI Alcance 2 (ubicación y mercado) — entregada y validada, valor 3860 tCO2e
- `sol:638b275a-1c22-45f9-8250-a6193d94b796` — Alcance 2 por ubicación e instrumentos contractuales — entregada y validada

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- La solicitud sol:c0000000-0000-0000-0000-000000000021 (Consumo eléctrico corporativo 2025, consolidado Finanzas) está entregada pero sin validar y sin valor; no se usó. Conviene cotejarla, una vez validada, contra los 9,120,000 kWh de sol:...006 para confirmar que ambas fuentes coinciden antes de aprobar el bloque.
- La solicitud sol:...008 se titula 'Inventario GEI Alcance 2 (ubicación y mercado)' pero trae un solo valor (3,860 tCO2e). Es consistente con sol:...796, que afirma que ambos métodos arrojan el mismo valor, pero el revisor debería confirmar que el inventario efectivamente calculó ambos métodos y no solo el de ubicación.
- Revelación voluntaria posible: con los datos disponibles puede derivarse un factor de emisión implícito de aproximadamente 0.423 kgCO2e/kWh (3,860 tCO2e / 9,120,000 kWh). No se incluyó en el texto por no venir como dato entregado; el revisor decide si la emisora quiere revelarlo o contrastarlo con el factor oficial de la red publicado por la autoridad.
- El párrafo de cierre menciona el alivio NIIF S2 C3 (sin comparativos) acotado a las cifras de Alcance 2 de este bloque. El régimen general de alivios corresponde al bloque 3 y las cifras absolutas de Alcance 1 y 2 al bloque 29; si el revisor considera que la mención duplica lo que se dice ahí, puede retirar ese párrafo sin afectar la cobertura del requisito 29(a)(v).
- El texto nombra a la Comisión Federal de Electricidad como único proveedor con base en la descripción de sol:...796 ('la electricidad se adquiere a la CFE bajo contratos estándar'). Confirmar con la emisora que ninguna instalación tiene suministro por un tercero (suministrador calificado, autoabasto o generación distribuida), ya que la afirmación de 'totalidad' se apoya en esa descripción.

