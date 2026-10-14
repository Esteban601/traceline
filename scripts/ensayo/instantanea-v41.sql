-- -----------------------------------------------------------------------------
-- Instantánea de Grupo Carso para v41 (encargo 2026-10-14-excel-formato-a-
-- produccion, Paso 1). Parte de instantanea-v40.sql, con estos cambios:
--   · las columnas que agregó v40 ya están en staging: dejan de restarse;
--   · se restan del jsonb las que v41 agrega (perfil_emisor ×8,
--     registros_clima.metricas_asociadas, objetivos.origen_objetivo,
--     documentos_generados.respuestas_*): sin eso el md5 cambiaría sin que
--     cambiara el dato;
--   · «v41:columnas_nuevas_con_valor» cuenta las filas de Carso con alguna de
--     esas columnas con valor: 0 antes (no existen) y 0 después (sin relleno ni
--     default);
--   · «v41:respuestas_datapoint» cuenta las respuestas de Carso: 0 antes (la
--     tabla no existe) y 0 después (generador apagado).
-- `mapeo_solicitud_datapoint` sigue partida en dos líneas, como en v40 (los
-- incisos ya están en staging: después de v40, «…:incisos» es la cuenta de
-- Carso; v41 no la toca).
-- Corre igual antes y después de migrar: restar una clave que no existe no hace
-- nada, y la tabla nueva solo se consulta si existe. Esperado: las 26 líneas
-- idénticas.
--
--   psql "$STAGING_DB_URL" -X -A -t -f scripts/ensayo/instantanea-v41.sql > instantanea-v41.txt
--
-- Solo lee. Una línea por tabla: «tabla|filas|md5». El md5 es de las filas del
-- tenant de Grupo Carso (slug gcarso) serializadas con to_jsonb y ordenadas, así
-- que detecta cualquier cambio de valor, no solo de conteo.
-- Al final, «perfiles_usuario:roles» cubre a TODOS los usuarios: id, rol, tenant.
-- -----------------------------------------------------------------------------
with
t as (select id from public.tenants where slug = 'gcarso'),
rep as (select r.id from public.reportes r join t on r.tenant_id = t.id),
sol as (select s.id from public.solicitudes s join rep on s.reporte_id = rep.id),
rc as (select x.id from public.registros_clima x join rep on x.reporte_id = rep.id),
obj as (select x.id from public.objetivos x join rep on x.reporte_id = rep.id),
doc as (select d.id from public.documentos_generados d join t on d.tenant_id = t.id),
incisos as (
  select id from public.datapoints_taxonomia where codigo in (
    'NIIF S2 25 (a)(i)', 'NIIF S2 25 (a)(ii)', 'NIIF S2 25 (a)(iii)', 'NIIF S2 25 (a)(iv)', 'NIIF S2 25 (a)(v)',
    'NIIF S1 44 (a)(i)', 'NIIF S1 44 (a)(ii)', 'NIIF S1 44 (a)(iii)', 'NIIF S1 44 (a)(iv)', 'NIIF S1 44 (a)(v)',
    'NIIF S2 36 (a)', 'NIIF S2 36 (b)', 'NIIF S2 36 (c)', 'NIIF S2 36 (d)',
    'NIIF S2 36 (e)(i)', 'NIIF S2 36 (e)(ii)', 'NIIF S2 36 (e)(iii)', 'NIIF S2 36 (e)(iv)')
),
filas (tabla, j) as (
  select 'tenants', to_jsonb(x) from public.tenants x join t using (id)
  union all select 'areas_tenant', to_jsonb(x) from public.areas_tenant x join t on x.tenant_id = t.id
  union all select 'bitacora', to_jsonb(x) from public.bitacora x join t on x.tenant_id = t.id
  union all select 'invitaciones', to_jsonb(x) from public.invitaciones x join t on x.tenant_id = t.id
  union all select 'perfiles_usuario', to_jsonb(x) from public.perfiles_usuario x join t on x.tenant_id = t.id
  union all select 'reportes', to_jsonb(x) from public.reportes x join rep using (id)
  union all select 'solicitudes', to_jsonb(x) from public.solicitudes x join sol using (id)
  union all select 'capturas_valor', to_jsonb(x) from public.capturas_valor x join sol on x.solicitud_id = sol.id
  union all select 'comentarios', to_jsonb(x) from public.comentarios x join sol on x.solicitud_id = sol.id
  union all select 'evidencias', to_jsonb(x) from public.evidencias x join sol on x.solicitud_id = sol.id
  union all select 'mapeo_solicitud_datapoint:sin_incisos', to_jsonb(x) from public.mapeo_solicitud_datapoint x join sol on x.solicitud_id = sol.id
    where x.datapoint_id not in (select id from incisos)
  union all select 'mapeo_solicitud_datapoint:incisos', to_jsonb(x) - 'created_at' from public.mapeo_solicitud_datapoint x join sol on x.solicitud_id = sol.id
    where x.datapoint_id in (select id from incisos)
  union all select 'solicitudes_recordatorios', to_jsonb(x) from public.solicitudes_recordatorios x join sol on x.solicitud_id = sol.id
  union all select 'cuestionarios_respuestas', to_jsonb(x) from public.cuestionarios_respuestas x join rep on x.reporte_id = rep.id
  union all select 'registros_clima', to_jsonb(x) - 'metricas_asociadas' from public.registros_clima x join rc using (id)
  union all select 'registros_clima_valores', to_jsonb(x) from public.registros_clima_valores x join rc on x.registro_id = rc.id
  union all select 'objetivos', to_jsonb(x) - 'origen_objetivo' from public.objetivos x join obj using (id)
  union all select 'objetivos_detalle', to_jsonb(x) from public.objetivos_detalle x join obj on x.objetivo_id = obj.id
  union all select 'perfil_emisor', to_jsonb(x) - array['clave_cotizacion','tipo_instrumento','fiduciario','numero_fideicomiso','hechos_posteriores','actividades_financieras','sector_sasb','metricas_industria']::text[]
    from public.perfil_emisor x join t on x.tenant_id = t.id
  union all select 'perfil_emisor_adjuntos', to_jsonb(x) from public.perfil_emisor_adjuntos x join t on x.tenant_id = t.id
  union all select 'documentos_generados', to_jsonb(x) - array['respuestas_estado','respuestas_resultado','respuestas_actualizado_en']::text[]
    from public.documentos_generados x join doc using (id)
  union all select 'documentos_bloques', to_jsonb(x) from public.documentos_bloques x join doc on x.documento_id = doc.id
  -- Las columnas nuevas de v41 en las filas de Carso: ninguna con valor (antes no existen).
  union all select 'v41:columnas_nuevas_con_valor', to_jsonb(x.j) from (
    select jsonb_build_object('t', 'perfil_emisor', 'id', p.tenant_id) as j from public.perfil_emisor p join t on p.tenant_id = t.id
      where jsonb_strip_nulls(to_jsonb(p)) ?| array['clave_cotizacion','tipo_instrumento','fiduciario','numero_fideicomiso','hechos_posteriores','actividades_financieras','sector_sasb','metricas_industria']
    union all select jsonb_build_object('t', 'registros_clima', 'id', r.id) from public.registros_clima r join rc using (id)
      where jsonb_strip_nulls(to_jsonb(r)) ? 'metricas_asociadas'
    union all select jsonb_build_object('t', 'objetivos', 'id', o.id) from public.objetivos o join obj using (id)
      where jsonb_strip_nulls(to_jsonb(o)) ? 'origen_objetivo'
    union all select jsonb_build_object('t', 'documentos_generados', 'id', d.id) from public.documentos_generados d join doc using (id)
      where jsonb_strip_nulls(to_jsonb(d)) ?| array['respuestas_estado','respuestas_resultado','respuestas_actualizado_en']
  ) x
  -- respuestas_datapoint no existe antes de migrar: se cuenta con SQL dinámico,
  -- que solo corre si la tabla ya está (antes, 0).
  union all select 'v41:respuestas_datapoint', jsonb_build_object('id', n) from (
    select g as n from generate_series(1, (
      select case when to_regclass('public.respuestas_datapoint') is null then 0
        else (xpath('/row/n/text()', query_to_xml(format(
          'select count(*) as n from public.respuestas_datapoint where tenant_id = %L', (select id from t)), false, true, '')))[1]::text::int
      end)) g
  ) y
  union all select 'storage.objects', to_jsonb(x) from storage.objects x, t where x.name like t.id::text || '/%'
  union all select 'perfiles_usuario:roles', jsonb_build_array(p.id, p.rol, p.tenant_id) from public.perfiles_usuario p
),
tablas (tabla) as (
  values ('tenants'), ('areas_tenant'), ('bitacora'), ('invitaciones'), ('perfiles_usuario'), ('reportes'),
         ('solicitudes'), ('capturas_valor'), ('comentarios'), ('evidencias'),
         ('mapeo_solicitud_datapoint:sin_incisos'), ('mapeo_solicitud_datapoint:incisos'),
         ('solicitudes_recordatorios'), ('cuestionarios_respuestas'), ('registros_clima'),
         ('registros_clima_valores'), ('objetivos'), ('objetivos_detalle'),
         ('perfil_emisor'), ('perfil_emisor_adjuntos'), ('documentos_generados'), ('documentos_bloques'),
         ('storage.objects'), ('perfiles_usuario:roles'),
         ('v41:columnas_nuevas_con_valor'), ('v41:respuestas_datapoint')
)
select tablas.tabla || '|' || count(filas.j) || '|' || coalesce(md5(string_agg(filas.j::text, ',' order by filas.j::text)), '-')
from tablas left join filas using (tabla)
group by tablas.tabla
order by tablas.tabla;
