-- =============================================================================
-- solicitudes.nota_alcance — declarar el PERÍMETRO de una cifra en el entregable
--
-- Problema real que la resuelve: el Alcance 1 de GCARSO en la plantilla oficial
-- vale 2,643,446.803 t, pero esa cifra es de la división **Materiales** (Elementia
-- + Fortaleza), no de todo Grupo Carso — es lo único que el cliente entregó con
-- ese desglose. Un lector del Excel no tiene forma de saberlo, y una cifra cuyo
-- perímetro no se declara es una cifra que se leerá con el perímetro equivocado.
--
-- La alternativa era mover el rubro a otra solicitud, lo que habría cambiado una
-- cifra ya validada. Declarar el alcance no cambia ningún dato: lo explica.
--
-- Es una columna y no lógica en el export a propósito. El perímetro es una
-- propiedad DEL DATO de un cliente concreto, así que vive con el dato; el motor
-- del export sigue siendo la definición reutilizable de la plantilla, sin una sola
-- rama por emisora.
--
-- Se puede fijar incluso sobre una solicitud VALIDADA, por la misma razón que el
-- rubro de taxonomía (ver `puedeAsignarRubroTaxonomia`): no es contenido de la
-- solicitud ni cambia su valor ni su estado. De hecho el caso que la motiva es
-- justo una solicitud ya validada. Congelado sí queda fuera: ahí el candado es
-- del reporte entero y lo aplica un trigger.
-- =============================================================================

alter table public.solicitudes add column nota_alcance text;

comment on column public.solicitudes.nota_alcance is
  'Aclaración de PERÍMETRO de la cifra, redactada para el entregable: qué comprende y qué no (p. ej. «corresponde a la división Materiales»). El export de taxonomía la agrega a la celda de Notas/Brechas de la fila que esta solicitud alimenta, junto a lo que ya haya. NULL = sin salvedad de alcance.';

-- El CHECK evita que se cuele una cadena vacía o de espacios: una nota vacía
-- ensuciaría la celda del entregable con un separador sin contenido.
alter table public.solicitudes
  add constraint solicitudes_nota_alcance_no_vacia
  check (nota_alcance is null or btrim(nota_alcance) <> '');
