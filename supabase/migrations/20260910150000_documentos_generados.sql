-- =============================================================================
-- documentos_generados y documentos_bloques — el suplemento, versionado y con
-- su rastro.
--
-- QUÉ PROBLEMA RESUELVE. Hoy nada de lo que la plataforma genera se persiste: el
-- Excel de taxonomía se arma en memoria y se devuelve como descarga. Para el
-- Excel basta, porque es reproducible: se vuelve a pedir y sale igual. Un
-- documento redactado por un modelo NO es reproducible —dos corridas no dan el
-- mismo texto— y además se revisa, se edita y se aprueba. Sin persistirlo no hay
-- revisión posible, ni versión que aprobar, ni forma de responder "¿de dónde
-- salió esta frase?" tres meses después.
--
-- DOS TABLAS Y NO UNA. El documento es la unidad que se aprueba y se descarga;
-- el bloque es la unidad que se genera, se regenera y se edita. Cuarenta bloques
-- por documento, cada uno con su costo y sus fuentes. Meterlos en una columna
-- jsonb del documento haría que regenerar un bloque reescribiera los cuarenta.
--
-- POR QUÉ EL ESTADO ES text CON CHECK Y NO UN ENUM. Postgres no deja usar un
-- valor de enum en la misma transacción que lo crea, así que cada estado nuevo
-- costaría una migración suelta —ya pasó dos veces con `rol_usuario`—. Con CHECK,
-- agregar 'archivado' es un ALTER de una línea. El precio es que el valor no se
-- comparte entre tablas, y aquí no hace falta.
--
-- TRAZABILIDAD. `fuentes` guarda los ids que el bloque recibió (solicitudes,
-- capturas, registros, objetivos) y `pendientes` lo que quedó sin dato. Juntos
-- son el anexo de trazabilidad del Word y la respuesta a una auditoría.
-- =============================================================================

create table public.documentos_generados (
  id             uuid primary key default gen_random_uuid(),
  -- tenant_id explícito además del reporte: es la llave del aislamiento y evita
  -- que toda política tenga que saltar a `reportes` para averiguarlo.
  tenant_id      uuid not null references public.tenants(id)  on delete cascade,
  reporte_id     uuid not null references public.reportes(id) on delete cascade,

  tipo           text not null default 'suplemento_s1s2',
  -- Versión correlativa por reporte: la 2 no reemplaza a la 1, convive con ella.
  version        integer not null default 1,
  idioma         text not null default 'es',
  estado         text not null default 'borrador',

  -- Ruta del .docx en el bucket privado `documentos`, cuando ya se exportó.
  archivo_path   text,

  -- Régimen con el que se generó, congelado: si mañana cambian los alivios del
  -- reporte, este documento sigue explicándose con los que tenía.
  regimen        text,
  alivios        jsonb not null default '{}'::jsonb,

  -- Acumulados del documento. Se recalculan desde los bloques, pero se guardan
  -- para no sumar cuarenta filas cada vez que se lista el registro (§7.7).
  costo_usd      numeric(10,4) not null default 0,
  tokens_entrada integer not null default 0,
  tokens_salida  integer not null default 0,

  generado_por   uuid references public.perfiles_usuario(id) on delete set null,
  aprobado_por   uuid references public.perfiles_usuario(id) on delete set null,
  aprobado_en    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint documentos_generados_estado_chk
    check (estado in ('borrador', 'en_revision', 'aprobado')),
  constraint documentos_generados_idioma_chk
    check (idioma in ('es', 'en')),
  constraint documentos_generados_alivios_es_objeto
    check (jsonb_typeof(alivios) = 'object'),
  -- Una versión por (reporte, tipo, idioma): la versión en inglés es un
  -- documento propio, no una columna del español.
  constraint documentos_generados_version_unica
    unique (reporte_id, tipo, idioma, version)
);

comment on table public.documentos_generados is
  'Un suplemento generado: su versión, idioma, estado y costo. El Excel de taxonomía NO vive aquí — ese se reproduce a demanda.';
comment on column public.documentos_generados.regimen is
  'Régimen con el que se generó (primer_anio | subsecuentes), congelado al generar.';
comment on column public.documentos_generados.estado is
  'borrador → en_revision → aprobado. La versión en inglés solo se genera desde un documento aprobado.';

-- tenant_id es por donde filtra toda política y todo listado. `reporte_id` no
-- lleva índice propio: es el prefijo del UNIQUE de versión, que ya lo cubre.
create index documentos_generados_tenant_idx on public.documentos_generados(tenant_id);

-- -----------------------------------------------------------------------------
-- Un renglón por bloque del documento.
-- -----------------------------------------------------------------------------
create table public.documentos_bloques (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references public.documentos_generados(id) on delete cascade,

  -- Número del bloque en §3 de la especificación (1..40). Se guarda además la
  -- clave estable de `lib/suplemento/bloques.ts`: si algún día se renumeran los
  -- bloques, la clave sigue diciendo cuál era.
  numero         integer not null,
  clave          text not null,
  titulo         text not null,
  seccion        text,

  idioma         text not null default 'es',
  estado         text not null default 'borrador',
  texto          text,

  -- Trazabilidad: de qué salió y qué faltó.
  fuentes        jsonb not null default '[]'::jsonb,
  pendientes     jsonb not null default '[]'::jsonb,

  -- Costo y procedencia de ESTA generación del bloque.
  modelo         text,
  prompt_version text,
  tokens_entrada integer not null default 0,
  tokens_salida  integer not null default 0,
  costo_usd      numeric(10,4) not null default 0,

  -- Edición humana: si alguien tocó el texto, el bloque deja de ser lo que el
  -- modelo escribió y eso tiene que constar.
  editado_por    uuid references public.perfiles_usuario(id) on delete set null,
  editado_en     timestamptz,
  generado_en    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint documentos_bloques_estado_chk
    check (estado in ('borrador', 'en_revision', 'aprobado')),
  constraint documentos_bloques_idioma_chk
    check (idioma in ('es', 'en')),
  constraint documentos_bloques_fuentes_es_arreglo
    check (jsonb_typeof(fuentes) = 'array'),
  constraint documentos_bloques_pendientes_es_arreglo
    check (jsonb_typeof(pendientes) = 'array'),
  -- Un bloque por documento: regenerar reemplaza, no acumula.
  constraint documentos_bloques_unico
    unique (documento_id, numero)
);

comment on table public.documentos_bloques is
  'Un bloque del suplemento: su texto, de qué fuentes salió, qué quedó pendiente, y qué costó generarlo.';
comment on column public.documentos_bloques.fuentes is
  'Ids que alimentaron el bloque: [{tipo:"solicitud"|"captura"|"registro"|"objetivo"|"cuestionario"|"perfil", id, detalle}]. Es el anexo de trazabilidad.';
comment on column public.documentos_bloques.pendientes is
  'Lo que el bloque NO pudo decir por falta de dato: [{campo, motivo}]. Aparece en el texto como [Pendiente: …].';
comment on column public.documentos_bloques.clave is
  'Clave estable del bloque en lib/suplemento/bloques.ts. Sobrevive a una renumeración de §3.';

create index documentos_bloques_documento_idx on public.documentos_bloques(documento_id);

-- -----------------------------------------------------------------------------
-- RLS — el documento es del tenant; el bloque hereda por su documento.
-- -----------------------------------------------------------------------------
alter table public.documentos_generados enable row level security;
alter table public.documentos_bloques   enable row level security;

grant select, insert, update, delete on public.documentos_generados to authenticated;
grant select, insert, update, delete on public.documentos_bloques   to authenticated;
grant select on public.documentos_generados, public.documentos_bloques to service_role;

-- Staff: acceso total. Es quien acompaña la revisión y quien ve el registro de
-- costos de todas las emisoras (§7.7).
create policy documentos_generados_staff_all on public.documentos_generados
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

create policy documentos_bloques_staff_all on public.documentos_bloques
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- Administrador del cliente: genera, revisa y edita los documentos de SU emisora.
create policy documentos_generados_admin_cliente_select on public.documentos_generados
  for select to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

create policy documentos_generados_admin_cliente_insert on public.documentos_generados
  for insert to authenticated
  with check (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

create policy documentos_generados_admin_cliente_update on public.documentos_generados
  for update to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant())
  with check (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

-- Los bloques se acotan por su documento: una sola definición de quién ve qué.
create policy documentos_bloques_admin_cliente_select on public.documentos_bloques
  for select to authenticated
  using (
    public.fn_is_admin_cliente()
    and exists (
      select 1 from public.documentos_generados d
      where d.id = documento_id and d.tenant_id = public.fn_current_tenant()
    )
  );

create policy documentos_bloques_admin_cliente_insert on public.documentos_bloques
  for insert to authenticated
  with check (
    public.fn_is_admin_cliente()
    and exists (
      select 1 from public.documentos_generados d
      where d.id = documento_id and d.tenant_id = public.fn_current_tenant()
    )
  );

create policy documentos_bloques_admin_cliente_update on public.documentos_bloques
  for update to authenticated
  using (
    public.fn_is_admin_cliente()
    and exists (
      select 1 from public.documentos_generados d
      where d.id = documento_id and d.tenant_id = public.fn_current_tenant()
    )
  )
  with check (
    public.fn_is_admin_cliente()
    and exists (
      select 1 from public.documentos_generados d
      where d.id = documento_id and d.tenant_id = public.fn_current_tenant()
    )
  );

-- Resto de usuarios del tenant (área, jefe de área): SIN ACCESO, ni de lectura.
-- Un suplemento en borrador es texto redactado por un modelo, todavía sin
-- revisar, con marcadores de lo que falta y con la carta de la Dirección dentro.
-- Circula cuando alguien lo aprueba, no antes; y quien lo aprueba es staff o el
-- administrador del cliente, que son los únicos con política aquí.
--
-- Sin política que los cubra, RLS les devuelve cero filas. Si mañana hay que
-- abrirlo a un revisor de área, se agrega una política acotada a documentos
-- `aprobado` — no una que exponga los borradores.
--
-- Nadie fuera de staff borra: un documento aprobado es el rastro de lo que se
-- entregó.

-- -----------------------------------------------------------------------------
-- updated_at automático en ambas.
-- -----------------------------------------------------------------------------
create or replace function public.fn_documentos_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_documentos_generados_touch
  before update on public.documentos_generados
  for each row execute function public.fn_documentos_touch();

create trigger trg_documentos_bloques_touch
  before update on public.documentos_bloques
  for each row execute function public.fn_documentos_touch();
