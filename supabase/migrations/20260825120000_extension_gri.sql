-- =============================================================================
-- EXTENSIÓN VERT → EXTENSIÓN GRI (renombre CON mapeo, no a secas).
--
-- Los cuatro datapoints que la firma recaba además de NIIF S1/S2 no eran
-- invención propia: son conceptos que GRI ya norma. Presentarlos como "extensión
-- VERT" los dejaba sin referencia verificable; con su código GRI, quien lee el
-- entregable puede ir a la norma y comprobar qué se pidió.
--
-- El mapeo lo confirmó el usuario:
--   agua               → GRI 303-5   (consumo de agua)
--   residuos           → GRI 306-3   (residuos generados)
--   capacitación       → GRI 404-1   (horas de formación por empleado)
--   plantilla/rotación → GRI 2-7 / 401-1  (empleados / nuevas contrataciones y
--                        rotación). Son DOS códigos porque el datapoint cubre las
--                        dos cosas: partirlo en dos habría cambiado el universo y
--                        el mapeo de las solicitudes ya ligadas, que es dato del
--                        cliente. Se deja el código compuesto y se explica.
--
-- LO QUE NO CAMBIA: los 91 datapoints NIIF, sus conteos, la plantilla oficial de
-- taxonomía y su export. `marco` sigue siendo la línea que separa los dos mundos
-- —ahora 'NIIF' | 'GRI'— y la UI nunca los mezcla.
-- =============================================================================

-- El CHECK viejo solo admitía 'VERT': se retira ANTES del backfill y se vuelve a
-- poner después, ya sin ese valor. Dejarlo abierto entre los dos pasos es lo que
-- permite que la actualización ocurra en una sola transacción.
alter table public.datapoints_taxonomia
  drop constraint if exists datapoints_marco_chk;

-- Backfill: marco, código GRI y el rótulo de la sección, por código actual. Se
-- escribe uno por uno (no con un CASE genérico) para que la correspondencia
-- código-viejo → código-GRI quede legible en la migración, que es donde alguien
-- va a venir a comprobarla.
update public.datapoints_taxonomia
   set marco = 'GRI', codigo = 'GRI 303-5', seccion_indice = 'Extensión GRI'
 where codigo = 'VERT-AMB-01';

update public.datapoints_taxonomia
   set marco = 'GRI', codigo = 'GRI 306-3', seccion_indice = 'Extensión GRI'
 where codigo = 'VERT-AMB-02';

update public.datapoints_taxonomia
   set marco = 'GRI', codigo = 'GRI 2-7 / 401-1', seccion_indice = 'Extensión GRI'
 where codigo = 'VERT-SOC-01';

update public.datapoints_taxonomia
   set marco = 'GRI', codigo = 'GRI 404-1', seccion_indice = 'Extensión GRI'
 where codigo = 'VERT-SOC-02';

-- Cualquier resto (una base que hubiera sembrado otros VERT) queda igualmente
-- fuera de 'VERT': el marco es lo que la UI y el export leen, y un valor huérfano
-- se pintaría como si fuera de la norma.
update public.datapoints_taxonomia
   set marco = 'GRI', seccion_indice = coalesce(seccion_indice, 'Extensión GRI')
 where marco = 'VERT';

alter table public.datapoints_taxonomia
  add constraint datapoints_marco_chk check (marco in ('NIIF', 'GRI'));

comment on column public.datapoints_taxonomia.marco is
  'Marco al que pertenece el datapoint: ''NIIF'' (los 91 de la taxonomía oficial S1/S2) o ''GRI'' (los que la firma recaba además, con su código GRI). La UI y los entregables NUNCA los mezclan: los conteos de avance y la plantilla oficial son solo de ''NIIF''.';

comment on column public.datapoints_taxonomia.codigo is
  'Código del datapoint en su marco: el de la taxonomía NIIF S1/S2, o el de GRI para los de la extensión (p. ej. ''GRI 303-5''). Único por versión de taxonomía.';
