-- =============================================================================
-- perfil_emisor — lo institucional del emisor, 1:1 con `tenants`.
--
-- QUÉ PROBLEMA RESUELVE. Cerca de un tercio del suplemento S1/S2 no sale de la
-- evidencia recabada: carta de la Dirección, historia, modelo de negocio y
-- cadena de valor, estructura de gobierno, horizontes temporales, matriz de
-- riesgos. Hoy nada de eso existe en la plataforma, así que el generador solo
-- podría inventarlo — y la regla del generador es que no inventa. Con el perfil
-- capturado, lo escribe; sin él, lo marca como pendiente y sigue.
--
-- POR QUÉ CUELGA DE `tenants` Y NO DE `reportes`. Es de la EMISORA y persiste
-- entre ejercicios: su historia y su modelo de negocio no cambian porque pase el
-- año. Lo que sí cambia por ejercicio —año de adopción, alivios— vive en
-- `reportes`. Colgarlo del reporte habría obligado a recapturarlo cada año.
--
-- POR QUÉ LAS LISTAS SON jsonb. Hitos, horizontes y cadena de valor son listas
-- cortas, ordenadas y sin vida propia: nadie va a consultar "todos los hitos de
-- todas las emisoras". Una tabla por cada una serían tres tablas, tres RLS y
-- tres formularios para algo que siempre se lee entero junto a su perfil. Se
-- editan como filas en la UI (§4), no como JSON a mano.
--
-- QUIÉN LO CAPTURA. El administrador del cliente desde el portal y el staff de
-- IRStrat desde el panel, sobre el mismo formulario. Cada guardado deja quién y
-- cuándo, porque el texto acaba firmado en un documento oficial.
-- =============================================================================

create table public.perfil_emisor (
  id                  uuid primary key default gen_random_uuid(),
  -- 1:1: un perfil por emisora. El UNIQUE es lo que lo hace 1:1, y el CASCADE
  -- evita perfiles huérfanos si algún día se retira un tenant de demostración.
  tenant_id           uuid not null unique references public.tenants(id) on delete cascade,

  -- Identidad y forma de nombrarla en el texto -------------------------------
  denominacion_formal text,
  nombre_corto        text,
  -- Cómo se refiere el documento a la entidad: "la Compañía", "la Emisora", "el
  -- Grupo". Es preferencia de redacción y va al prompt como restricción.
  forma_de_referencia text,

  -- Entidad que informa y perímetro (bloque 4) -------------------------------
  entidad_que_informa text,
  perimetro           text,

  -- Carta de la Dirección (bloque 1) -----------------------------------------
  carta_texto         text,
  carta_firmante      text,
  carta_cargo         text,

  -- Materialidad (bloque 7) --------------------------------------------------
  proceso_materialidad text,

  -- Horizontes temporales (bloques 8 y 20) -----------------------------------
  -- [{plazo, definicion, justificacion}] × 3 (corto, mediano, largo).
  horizontes          jsonb not null default '[]'::jsonb,

  -- Narrativa institucional (bloques 11, 12, 18, 19) --------------------------
  hitos_corporativos   jsonb not null default '[]'::jsonb,  -- [{anio, texto}]
  hitos_sostenibilidad jsonb not null default '[]'::jsonb,  -- [{anio, texto}]
  modelo_negocio       text,
  cadena_valor         jsonb not null default '[]'::jsonb,  -- [{etapa, descripcion}]
  gobierno_texto       text,
  -- Ruta en el bucket privado `documentos`: {tenant_id}/perfil/<archivo>.
  organigrama_path     text,

  -- Matriz de riesgos (bloques 9 y 21) ---------------------------------------
  -- {escala_max, niveles:[{nombre, min, max}]}. Es lo que traduce el puntaje de
  -- `registros_clima.severidad` a un nivel con nombre.
  matriz_riesgos      jsonb not null default '{}'::jsonb,

  -- Auditoría ----------------------------------------------------------------
  actualizado_por     uuid references public.perfiles_usuario(id) on delete set null,
  actualizado_en      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.perfil_emisor is
  'Información institucional de la emisora que el suplemento S1/S2 necesita y la evidencia no aporta. 1:1 con tenants; persiste entre ejercicios.';
comment on column public.perfil_emisor.forma_de_referencia is
  'Cómo nombra el documento a la entidad ("la Compañía", "el Grupo"). Restricción de redacción para el generador.';
comment on column public.perfil_emisor.horizontes is
  'Los tres horizontes temporales: [{plazo, definicion, justificacion}]. NIIF S2 10 pide la definición y por qué se eligió.';
comment on column public.perfil_emisor.matriz_riesgos is
  'Escala de priorización de la emisora: {escala_max, niveles:[{nombre, min, max}]}. Traduce registros_clima.severidad a nivel.';
comment on column public.perfil_emisor.organigrama_path is
  'Ruta del organigrama en el bucket privado ''documentos'': {tenant_id}/perfil/<archivo>.';

-- Las listas tienen que ser arreglos y la matriz un objeto. Barato de comprobar
-- aquí y caro de descubrir al renderizar el documento.
alter table public.perfil_emisor
  add constraint perfil_emisor_horizontes_es_arreglo   check (jsonb_typeof(horizontes) = 'array'),
  add constraint perfil_emisor_hitos_corp_es_arreglo   check (jsonb_typeof(hitos_corporativos) = 'array'),
  add constraint perfil_emisor_hitos_sost_es_arreglo   check (jsonb_typeof(hitos_sostenibilidad) = 'array'),
  add constraint perfil_emisor_cadena_es_arreglo       check (jsonb_typeof(cadena_valor) = 'array'),
  add constraint perfil_emisor_matriz_es_objeto        check (jsonb_typeof(matriz_riesgos) = 'object');

-- -----------------------------------------------------------------------------
-- RLS — mismo modelo de aislamiento que el resto: nada cruza de tenant.
-- -----------------------------------------------------------------------------
alter table public.perfil_emisor enable row level security;

grant select, insert, update, delete on public.perfil_emisor to authenticated;
grant select on public.perfil_emisor to service_role;

-- Staff de IRStrat: acceso total. Es quien acompaña al cliente y quien redacta
-- con él la carta y el modelo de negocio.
create policy perfil_emisor_staff_all on public.perfil_emisor
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- Administrador del cliente: escribe el perfil de SU emisora, y solo el suyo.
create policy perfil_emisor_admin_cliente_select on public.perfil_emisor
  for select to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

create policy perfil_emisor_admin_cliente_insert on public.perfil_emisor
  for insert to authenticated
  with check (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

create policy perfil_emisor_admin_cliente_update on public.perfil_emisor
  for update to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant())
  with check (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

-- Resto de usuarios del tenant (área, jefe de área): SIN ACCESO, ni de lectura.
-- El perfil contiene la carta de la Dirección sin firmar, la estructura de
-- gobierno y el modelo de negocio: material de dirección que se redacta antes de
-- ser público. Que el responsable de Operaciones pueda cargar su evidencia no
-- implica que deba leer el borrador de la carta del Director General.
--
-- Sin política que los cubra, RLS les devuelve cero filas. El GRANT de tabla
-- sigue estando —es a `authenticated` en bloque— pero no alcanza nada: en este
-- esquema quien decide es la política, no el grant.
--
-- Tampoco se otorga DELETE a nadie fuera de staff: un perfil borrado se lleva por
-- delante la carta y la historia, y eso no debe caber en un clic del cliente.

-- -----------------------------------------------------------------------------
-- updated_at: se mantiene solo, como en el resto del esquema.
-- -----------------------------------------------------------------------------
create or replace function public.fn_perfil_emisor_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_perfil_emisor_touch
  before update on public.perfil_emisor
  for each row execute function public.fn_perfil_emisor_touch();
