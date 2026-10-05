-- =============================================================================
-- documentos_bloques.estado: dos estados más para el documento completo (A5a).
--
-- 'no_aplica'         — el régimen excluye el bloque (el 33 bajo el alivio C4).
--                       Hoy se guardaría como 'borrador' sin texto, que es
--                       indistinguible de uno que falló o que nadie generó. El
--                       documento tiene que poder decir "este bloque no va" sin
--                       que parezca un hueco.
--
-- 'pendiente_adjunto' — el bloque se redacta desde un campo del Perfil que está
--                       vacío, PERO la sección tiene un archivo del que podrá
--                       derivarse en A5b. No es un error ni un borrador: es un
--                       bloque que espera a que el generador sepa leer adjuntos.
--                       Marcarlo como 'error' mandaría a alguien a arreglar algo
--                       que no está roto.
--
-- Como la anterior, AMPLÍA el CHECK: los cinco valores previos siguen siendo
-- válidos, ninguna fila existente queda fuera y la migración no puede fallar por
-- datos. Idempotente: el DROP lleva IF EXISTS y el ADD usa el mismo nombre.
-- =============================================================================

alter table public.documentos_bloques
  drop constraint if exists documentos_bloques_estado_chk;

alter table public.documentos_bloques
  add constraint documentos_bloques_estado_chk
  check (estado in (
    'generando',
    'no_aplica',
    'pendiente_adjunto',
    'error',
    'borrador',
    'en_revision',
    'aprobado'
  ));

comment on column public.documentos_bloques.estado is
  'generando → borrador → en_revision → aprobado. Fuera de ese camino: no_aplica (el régimen lo excluye), pendiente_adjunto (el campo del Perfil está vacío pero hay archivo del que derivarlo en A5b) y error (la generación falló; reintentable).';
