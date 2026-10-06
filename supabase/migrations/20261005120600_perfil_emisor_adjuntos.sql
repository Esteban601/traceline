-- =============================================================================
-- perfil_emisor_adjuntos — los archivos de respaldo de cada sección del perfil.
--
-- QUÉ PROBLEMA RESUELVE. El perfil se llena escribiendo, pero lo que el emisor
-- tiene a mano casi nunca es texto listo: es el acta con la estructura de
-- gobierno, el estudio de materialidad del consultor, la política de riesgos en
-- PDF, el organigrama en Excel. Obligar a transcribir todo eso a un textarea es
-- la razón más común de que un formulario se quede vacío.
--
-- EN ESTA FASE LOS ADJUNTOS NO SE LEEN. Se guardan, se listan y se descargan; el
-- generador no los abre. Se dice explícito para que nadie asuma que subir el
-- estudio de materialidad basta para que el bloque 7 se escriba solo: hoy no.
-- Su uso como insumo es §3.2 de la especificación y llega en A5 y A10.
--
-- UNA TABLA Y NO UNA COLUMNA jsonb EN `perfil_emisor`. Un adjunto tiene autor y
-- fecha propios, se borra uno sin tocar los demás y son varios por sección; en
-- un jsonb, quitar un archivo obligaría a reescribir el arreglo entero y se
-- perdería quién subió cada cual.
--
-- POR SECCIÓN Y NO POR CAMPO. El archivo respalda un bloque del perfil
-- ("gobierno", "materialidad"), no una casilla concreta. `seccion` es texto libre
-- con CHECK sobre las nueve que hoy existen: añadir una décima es un ALTER de
-- una línea, no una migración de datos.
-- =============================================================================

create table public.perfil_emisor_adjuntos (
  id              uuid primary key default gen_random_uuid(),
  -- Cuelga del tenant y no de perfil_emisor.id: se pueden subir archivos antes
  -- de que exista una fila de perfil, que es lo que pasa la primera vez.
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  seccion         text not null,

  -- Ruta en el bucket privado `documentos`: {tenant_id}/perfil/{seccion}/…
  archivo_path    text not null unique,
  nombre_original text not null,
  mime            text,
  tamano          bigint,

  subido_por      uuid references public.perfiles_usuario(id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint perfil_emisor_adjuntos_seccion_chk check (
    seccion in (
      'identidad',
      'matriz',
      'horizontes',
      'carta',
      'historia',
      'trayectoria',
      'modelo',
      'gobierno',
      'materialidad'
    )
  )
);

comment on table public.perfil_emisor_adjuntos is
  'Archivos de respaldo de cada sección del perfil del emisor. En Fase A se guardan y se descargan; el generador NO los lee (ver §3.2 de la especificación).';
comment on column public.perfil_emisor_adjuntos.seccion is
  'Sección del perfil que respalda el archivo. Las mismas nueve del formulario.';
comment on column public.perfil_emisor_adjuntos.archivo_path is
  'Ruta en el bucket privado ''documentos'': {tenant_id}/perfil/{seccion}/{marca}-{nombre}. UNIQUE porque la marca de tiempo la hace única y dos filas apuntando al mismo objeto dejarían un huérfano al borrar una.';

create index perfil_emisor_adjuntos_tenant_seccion_idx
  on public.perfil_emisor_adjuntos(tenant_id, seccion);

-- -----------------------------------------------------------------------------
-- RLS — idéntica a `perfil_emisor`: staff y admin_cliente de la propia emisora.
-- Los usuarios de área y los jefes de área no leen: el adjunto es el respaldo de
-- un material de dirección, y abrirlo sería abrir por la puerta de atrás lo que
-- la tabla del perfil ya tiene cerrado.
-- -----------------------------------------------------------------------------
alter table public.perfil_emisor_adjuntos enable row level security;

grant select, insert, update, delete on public.perfil_emisor_adjuntos to authenticated;
grant select on public.perfil_emisor_adjuntos to service_role;

create policy perfil_adjuntos_staff_all on public.perfil_emisor_adjuntos
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

create policy perfil_adjuntos_admin_cliente_select on public.perfil_emisor_adjuntos
  for select to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

create policy perfil_adjuntos_admin_cliente_insert on public.perfil_emisor_adjuntos
  for insert to authenticated
  with check (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

-- DELETE sí se otorga al administrador del cliente, a diferencia del perfil: un
-- adjunto es un archivo que él mismo subió y puede haberse equivocado de
-- documento. Lo que no puede es borrar el perfil entero.
create policy perfil_adjuntos_admin_cliente_delete on public.perfil_emisor_adjuntos
  for delete to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

-- -----------------------------------------------------------------------------
-- Storage: el bucket `documentos` ya existe y sus políticas cubren la ruta
-- {tenant_id}/… , así que los adjuntos entran bajo ellas sin cambios. Lo único
-- que faltaba era el DELETE del administrador del cliente sobre su propia ruta:
-- sin él, quitar un adjunto borraría la fila y dejaría el objeto huérfano en el
-- bucket. Sigue la regla de la casa: el storage nunca es más permisivo que la
-- tabla que lo referencia, y aquí la tabla ya permite DELETE.
-- -----------------------------------------------------------------------------
create policy documentos_admin_cliente_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and public.fn_is_admin_cliente()
    and (storage.foldername(name))[1] = public.fn_current_tenant()::text
  );
