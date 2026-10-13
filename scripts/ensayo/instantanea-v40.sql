-- -----------------------------------------------------------------------------
-- Instantánea de Grupo Carso para v40 (encargo 2026-10-11-suplemento-a-produccion,
-- Paso 1). Parte de instantanea-v33.sql, con estos cambios:
--   · las columnas que agregó v33 ya están en staging: dejan de restarse;
--   · entran el Perfil, sus adjuntos y los documentos del suplemento, sin las
--     columnas que v40 les agrega (se restan del jsonb: sin eso el md5
--     cambiaría sin que cambiara el dato);
--   · `mapeo_solicitud_datapoint` se parte en dos líneas. «…:sin_incisos» debe
--     quedar idéntica. «…:incisos» son los enlaces que la migración del catálogo
--     (20261007170000) escribe a los 18 incisos; antes de migrar es 0, y después
--     se espera el conteo de Carso del Paso 2.
-- Corre igual antes y después de migrar: restar una clave que no existe no
-- hace nada, y los incisos no existen antes de migrar.
--
--   psql "$STAGING_DB_URL" -X -A -t -f scripts/ensayo/instantanea-v40.sql > instantanea-v40.txt
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
  union all select 'registros_clima', to_jsonb(x) from public.registros_clima x join rc using (id)
  union all select 'registros_clima_valores', to_jsonb(x) from public.registros_clima_valores x join rc on x.registro_id = rc.id
  union all select 'objetivos', to_jsonb(x) from public.objetivos x join obj using (id)
  union all select 'objetivos_detalle', to_jsonb(x) from public.objetivos_detalle x join obj on x.objetivo_id = obj.id
  union all select 'perfil_emisor', to_jsonb(x) - 'glosario' from public.perfil_emisor x join t on x.tenant_id = t.id
  union all select 'perfil_emisor_adjuntos', to_jsonb(x) from public.perfil_emisor_adjuntos x join t on x.tenant_id = t.id
  union all select 'documentos_generados', to_jsonb(x) - array['editoriales_incluidos','textos_literales','versiones_aprobadas','cierre_estado','cierre_resultado','cierre_actualizado_en']::text[]
    from public.documentos_generados x join doc using (id)
  union all select 'documentos_bloques', to_jsonb(x) - array['texto_del_emisor','origen_texto','restaurada_de','cobertura','libro_id','anclas']::text[]
    from public.documentos_bloques x join doc on x.documento_id = doc.id
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
         ('storage.objects'), ('perfiles_usuario:roles')
)
select tablas.tabla || '|' || count(filas.j) || '|' || coalesce(md5(string_agg(filas.j::text, ',' order by filas.j::text)), '-')
from tablas left join filas using (tabla)
group by tablas.tabla
order by tablas.tabla;
