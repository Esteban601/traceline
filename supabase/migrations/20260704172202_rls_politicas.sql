-- =============================================================================
-- Row Level Security — aislamiento multi-tenant + append-only a nivel de BD
--
-- Modelo de acceso:
--   * anon: sin acceso a ninguna tabla de negocio.
--   * authenticated (staff IRStrat, tenant_id NULL): ve y gestiona todo.
--   * authenticated (usuario de tenant): acotado a su tenant; el rol 'cliente'
--     además solo ve solicitudes de su área o donde es responsable.
--   * service_role: BYPASSRLS (uso administrativo / server-side). Ver README.
--
-- Nota: las funciones fn_is_staff / fn_current_* / fn_puede_ver_solicitud se
-- definen en la migración de esquema y son SECURITY DEFINER (no recursan RLS).
-- =============================================================================

-- Privilegios base: RLS decide las filas; los GRANT solo habilitan el comando.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Habilitar RLS en todas las tablas de negocio
alter table public.tenants                   enable row level security;
alter table public.perfiles_usuario          enable row level security;
alter table public.reportes                  enable row level security;
alter table public.datapoints_taxonomia      enable row level security;
alter table public.solicitudes               enable row level security;
alter table public.mapeo_solicitud_datapoint enable row level security;
alter table public.evidencias                enable row level security;
alter table public.capturas_valor            enable row level security;
alter table public.comentarios               enable row level security;
alter table public.bitacora                  enable row level security;

-- -----------------------------------------------------------------------------
-- tenants
-- -----------------------------------------------------------------------------
create policy tenants_select on public.tenants
  for select to authenticated
  using (public.fn_is_staff() or id = public.fn_current_tenant());

create policy tenants_staff_write on public.tenants
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- perfiles_usuario
--   staff ve todo; usuario ve perfiles de su tenant y el suyo propio.
--   Escritura reservada a staff (alta de usuarios).
-- -----------------------------------------------------------------------------
create policy perfiles_select on public.perfiles_usuario
  for select to authenticated
  using (
    public.fn_is_staff()
    or id = auth.uid()
    or (tenant_id is not null and tenant_id = public.fn_current_tenant())
  );

create policy perfiles_staff_write on public.perfiles_usuario
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- reportes
-- -----------------------------------------------------------------------------
create policy reportes_select on public.reportes
  for select to authenticated
  using (public.fn_is_staff() or tenant_id = public.fn_current_tenant());

create policy reportes_staff_write on public.reportes
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- datapoints_taxonomia — catálogo interno IRStrat: solo staff.
-- -----------------------------------------------------------------------------
create policy datapoints_staff_all on public.datapoints_taxonomia
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- mapeo_solicitud_datapoint — mapeo interno IRStrat: solo staff.
-- -----------------------------------------------------------------------------
create policy mapeo_staff_all on public.mapeo_solicitud_datapoint
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- solicitudes
--   SELECT: regla de visibilidad (staff / tenant / cliente por área).
--   Escritura: reservada a staff IRStrat (redactan las solicitudes).
--   Los cambios de estado del cliente ocurren indirectamente al subir evidencia
--   (trigger SECURITY DEFINER), sin necesidad de UPDATE directo.
-- -----------------------------------------------------------------------------
create policy solicitudes_select on public.solicitudes
  for select to authenticated
  using (
    public.fn_is_staff()
    or (
      exists (
        select 1 from public.reportes r
        where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
      )
      and (
        public.fn_current_rol() <> 'cliente'
        or area_asignada is not distinct from public.fn_current_area()
        or responsable_cliente_id = auth.uid()
      )
    )
  );

create policy solicitudes_staff_write on public.solicitudes
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- evidencias — APPEND ONLY
--   SELECT: quien pueda ver la solicitud.
--   INSERT: staff, o usuario de tenant autorizado subiendo como sí mismo.
--   UPDATE/DELETE: PROHIBIDOS (restrictive false + revoke).
-- -----------------------------------------------------------------------------
create policy evidencias_select on public.evidencias
  for select to authenticated
  using (public.fn_puede_ver_solicitud(solicitud_id));

create policy evidencias_insert on public.evidencias
  for insert to authenticated
  with check (
    public.fn_puede_ver_solicitud(solicitud_id)
    and (public.fn_is_staff() or subido_por = auth.uid())
  );

-- Prohibición explícita de mutación (append-only a nivel de base de datos)
create policy evidencias_no_update on public.evidencias
  as restrictive for update to authenticated using (false);
create policy evidencias_no_delete on public.evidencias
  as restrictive for delete to authenticated using (false);
revoke update, delete on public.evidencias from authenticated, anon;

-- -----------------------------------------------------------------------------
-- capturas_valor — APPEND ONLY (correcciones = filas nuevas)
-- -----------------------------------------------------------------------------
create policy capturas_select on public.capturas_valor
  for select to authenticated
  using (public.fn_puede_ver_solicitud(solicitud_id));

create policy capturas_insert on public.capturas_valor
  for insert to authenticated
  with check (
    public.fn_puede_ver_solicitud(solicitud_id)
    and (public.fn_is_staff() or capturado_por = auth.uid())
  );

create policy capturas_no_update on public.capturas_valor
  as restrictive for update to authenticated using (false);
create policy capturas_no_delete on public.capturas_valor
  as restrictive for delete to authenticated using (false);
revoke update, delete on public.capturas_valor from authenticated, anon;

-- -----------------------------------------------------------------------------
-- comentarios — SELECT/INSERT según visibilidad de la solicitud.
-- -----------------------------------------------------------------------------
create policy comentarios_select on public.comentarios
  for select to authenticated
  using (public.fn_puede_ver_solicitud(solicitud_id));

create policy comentarios_insert on public.comentarios
  for insert to authenticated
  with check (
    public.fn_puede_ver_solicitud(solicitud_id)
    and autor_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- bitacora — APPEND ONLY. Solo lectura para usuarios; escritura vía triggers.
--   SELECT: staff, o filas del propio tenant.
--   INSERT directo: PROHIBIDO para authenticated (sin policy de insert);
--     los triggers SECURITY DEFINER (owner postgres) escriben sin RLS.
--   UPDATE/DELETE: PROHIBIDOS.
-- -----------------------------------------------------------------------------
create policy bitacora_select on public.bitacora
  for select to authenticated
  using (public.fn_is_staff() or tenant_id = public.fn_current_tenant());

create policy bitacora_no_update on public.bitacora
  as restrictive for update to authenticated using (false);
create policy bitacora_no_delete on public.bitacora
  as restrictive for delete to authenticated using (false);
revoke insert, update, delete on public.bitacora from authenticated, anon;
