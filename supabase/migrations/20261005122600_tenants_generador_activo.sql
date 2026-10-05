-- =============================================================================
-- Bandera del generador del suplemento por emisora (encargo
-- 2026-10-05-generador-a-produccion, decisión del Paso 0).
--
-- El generador manda los datos de la emisora a la API de Anthropic. Como la
-- lectura de evidencias, en clientes reales empieza APAGADO hasta que su contrato
-- de encargado nombre a Anthropic; en las emisoras de demostración se enciende
-- aquí (relleno de una columna nueva, no cambio de un dato). Lo aplican en el
-- servidor las tres rutas de /api/suplemento (generar, bloque, word); lo mueve
-- el administrador de IRStrat en /admin/clientes.
--
-- En la misma pasada, `generaciones_mes_max` empieza a aplicarse. Su unidad se
-- precisa: una CORRIDA COMPLETA del documento (POST …/generar), por emisora y
-- mes natural, la lance quien la lance —hoy solo el staff puede lanzarla, así
-- que eximirlo dejaba el tope sin efecto—. Regenerar UN bloque no cuenta: es el
-- camino barato que el tope quiere favorecer. 0 sigue apagando el generador.
--
-- Aditiva: una columna con default y comentarios. Idempotente.
-- =============================================================================

alter table public.tenants
  add column if not exists generador_activo boolean not null default false;

comment on column public.tenants.generador_activo is
  'Generador del suplemento (los datos van a la API de Anthropic). Apagado en clientes reales hasta que su contrato de encargado lo cubra; encendido en demostraciones. Lo aplican las rutas /api/suplemento.';

update public.tenants set generador_activo = true
 where es_demo and not generador_activo;

comment on column public.tenants.generaciones_mes_max is
  'Máximo de corridas completas del suplemento (POST /api/suplemento/…/generar) por mes natural y emisora, las lance quien las lance. Regenerar un bloque no cuenta. 0 deshabilita el generador.';

select public.fn_aplicar_barrera_auditor();
