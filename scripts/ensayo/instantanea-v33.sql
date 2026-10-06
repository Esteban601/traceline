-- -----------------------------------------------------------------------------
-- Instantánea de Grupo Carso para v33 (encargo 2026-10-05-generador-a-produccion, Paso 4):
-- la misma de instantanea.sql, sin las columnas que v33 agrega a tablas existentes
-- (tenants, reportes, capturas_valor, registros_clima), para comparar contra la
-- línea base tomada en staging ANTES de migrar. Solo lee.
--
--   psql "$ENSAYO_DB_URL" -X -A -t -f scripts/ensayo/instantanea-v33.sql > instantanea-v33.txt
--
-- Solo lee. Una línea por tabla: «tabla|filas|md5». El md5 es de las filas del
-- tenant de Grupo Carso (slug gcarso) serializadas con to_jsonb y ordenadas, así
-- que detecta cualquier cambio de valor, no solo de conteo. Las columnas que
-- v33 añade se restan del jsonb: sin eso el md5 cambiaría sin que cambiara el dato.
-- Corrida sobre la base de v32 da lo mismo que instantanea.sql.
-- Al final, «perfiles_usuario:roles» cubre a TODOS los usuarios: id, rol, tenant.
-- -----------------------------------------------------------------------------
with
t as (select id from public.tenants where slug = 'gcarso'),
rep as (select r.id from public.reportes r join t on r.tenant_id = t.id),
sol as (select s.id from public.solicitudes s join rep on s.reporte_id = rep.id),
rc as (select x.id from public.registros_clima x join rep on x.reporte_id = rep.id),
obj as (select x.id from public.objetivos x join rep on x.reporte_id = rep.id),
filas (tabla, j) as (
  select 'tenants', to_jsonb(x) - array['lectura_evidencias_activa','lecturas_mes_max','generaciones_mes_max','generador_activo']::text[] from public.tenants x join t using (id)
  union all select 'areas_tenant', to_jsonb(x) from public.areas_tenant x join t on x.tenant_id = t.id
  union all select 'bitacora', to_jsonb(x) from public.bitacora x join t on x.tenant_id = t.id
  union all select 'invitaciones', to_jsonb(x) from public.invitaciones x join t on x.tenant_id = t.id
  union all select 'perfiles_usuario', to_jsonb(x) from public.perfiles_usuario x join t on x.tenant_id = t.id
  union all select 'reportes', to_jsonb(x) - array['anio_adopcion','alivios']::text[] from public.reportes x join rep using (id)
  union all select 'solicitudes', to_jsonb(x) from public.solicitudes x join sol using (id)
  union all select 'capturas_valor', to_jsonb(x) - array['origen','sugerencia_id']::text[] from public.capturas_valor x join sol on x.solicitud_id = sol.id
  union all select 'comentarios', to_jsonb(x) from public.comentarios x join sol on x.solicitud_id = sol.id
  union all select 'evidencias', to_jsonb(x) from public.evidencias x join sol on x.solicitud_id = sol.id
  union all select 'mapeo_solicitud_datapoint', to_jsonb(x) from public.mapeo_solicitud_datapoint x join sol on x.solicitud_id = sol.id
  union all select 'solicitudes_recordatorios', to_jsonb(x) from public.solicitudes_recordatorios x join sol on x.solicitud_id = sol.id
  union all select 'cuestionarios_respuestas', to_jsonb(x) from public.cuestionarios_respuestas x join rep on x.reporte_id = rep.id
  union all select 'registros_clima', to_jsonb(x) - array['probabilidad','impacto','severidad','nivel','concentracion','impactos_potenciales','respuesta']::text[] from public.registros_clima x join rc using (id)
  union all select 'registros_clima_valores', to_jsonb(x) from public.registros_clima_valores x join rc on x.registro_id = rc.id
  union all select 'objetivos', to_jsonb(x) from public.objetivos x join obj using (id)
  union all select 'objetivos_detalle', to_jsonb(x) from public.objetivos_detalle x join obj on x.objetivo_id = obj.id
  union all select 'storage.objects', to_jsonb(x) from storage.objects x, t where x.name like t.id::text || '/%'
  union all select 'perfiles_usuario:roles', jsonb_build_array(p.id, p.rol, p.tenant_id) from public.perfiles_usuario p
),
tablas (tabla) as (
  values ('tenants'), ('areas_tenant'), ('bitacora'), ('invitaciones'), ('perfiles_usuario'), ('reportes'),
         ('solicitudes'), ('capturas_valor'), ('comentarios'), ('evidencias'), ('mapeo_solicitud_datapoint'),
         ('solicitudes_recordatorios'), ('cuestionarios_respuestas'), ('registros_clima'),
         ('registros_clima_valores'), ('objetivos'), ('objetivos_detalle'), ('storage.objects'),
         ('perfiles_usuario:roles')
)
select tablas.tabla || '|' || count(filas.j) || '|' || coalesce(md5(string_agg(filas.j::text, ',' order by filas.j::text)), '-')
from tablas left join filas using (tabla)
group by tablas.tabla
order by tablas.tabla;
