-- =============================================================================
-- solicitudes.responsable_cliente_texto — quién respondió del lado del cliente
-- cuando esa persona NO tiene cuenta en la plataforma.
--
-- En el proceso real de una emisora, el requerimiento lo atiende una persona
-- concreta (con nombre y apellidos) que muchas veces no es usuario del sistema:
-- responde por correo, por Teams o en una llamada. Hasta ahora ese dato se
-- perdía —`responsable_cliente_id` exige una cuenta— y con él se perdía la
-- trazabilidad de quién entregó qué, que es justo lo que el aseguramiento pide.
--
-- Es un campo de TRAZABILIDAD, no de acceso: no otorga permisos, no recibe
-- correos y no sustituye al responsable con cuenta (los dos pueden convivir).
-- =============================================================================
alter table public.solicitudes
  add column responsable_cliente_texto text;

comment on column public.solicitudes.responsable_cliente_texto is
  'Nombre de la persona del cliente que atendió el requerimiento cuando no tiene cuenta en la plataforma (dato de trazabilidad, no de acceso). Convive con responsable_cliente_id.';
