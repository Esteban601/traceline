-- =============================================================================
-- SOLICITUDES MULTI-ÁREA POR DIFUSIÓN.
--
-- El caso real: quien pide la información no sabe qué área la tiene. Hoy tenía
-- que adivinar —y una solicitud mal dirigida se queda semanas en el limbo, con el
-- área mirándola sin saber que no era suya—. La difusión pregunta a varias áreas
-- a la vez y deja que las que no aplican lo DECLAREN.
--
-- EL MODELO DE UN-ÁREA-POR-SOLICITUD NO CAMBIA. Difundir crea UNA COPIA POR ÁREA,
-- ligadas por `grupo_difusion_id`. Cada copia sigue siendo una solicitud normal:
-- su área, su responsable, su evidencia, su visto bueno de área, su validación por
-- origen y sus candados, sin una sola excepción. Lo único nuevo es el hilo que las
-- une y dos marcas paralelas.
--
-- POR QUÉ NO HAY TABLA DE GRUPOS. Un grupo no tiene atributos propios: el
-- enunciado, la fecha límite y los recordatorios viven en cada copia porque cada
-- copia es una solicitud de verdad. Una tabla `grupos_difusion` con un id y nada
-- más solo añadiría un JOIN a cada consulta y un lugar donde desincronizarse. El
-- `uuid` compartido ES el grupo, y quién difundió y cuándo ya está en la bitácora.
--
-- DOS MARCAS PARALELAS, NO ESTADOS. Igual que el visto bueno del área: la máquina
-- de estados no se toca.
--   · `declinada`   — acto del ÁREA: "esto no me corresponde".
--   · `desactivada` — acto de QUIEN DIFUNDIÓ: "ya sé quién la tenía; estas copias
--                     sobran". Son dos hechos distintos, de dos actores distintos,
--                     y en la vista de grupo y en el entregable se leen distinto:
--                     por eso son dos columnas y no un enum de "cerrada".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnas
-- -----------------------------------------------------------------------------
alter table public.solicitudes
  add column grupo_difusion_id uuid,
  add column declinada         boolean not null default false,
  add column desactivada       boolean not null default false;

comment on column public.solicitudes.grupo_difusion_id is
  'Mismo valor = misma difusión (una copia por área del mismo enunciado). NULL = solicitud dirigida a un área concreta, el caso normal. No hay tabla de grupos: el grupo no tiene atributos propios y quién difundió está en la bitácora.';
comment on column public.solicitudes.declinada is
  'El ÁREA declaró que la información no le corresponde. Marca paralela, no estado: sale de sus pendientes, de su avance y de los recordatorios, pero conserva su expediente y es reversible. Quién la declinó y cuándo están en el comentario que se publica y en la bitácora — duplicarlos aquí sería una segunda versión del mismo hecho.';
comment on column public.solicitudes.desactivada is
  'QUIEN DIFUNDIÓ retiró esta copia del juego (ya se sabe qué área tenía la información). Distinta de `declinada`: otro actor, otra lectura en el entregable.';

create index solicitudes_grupo_difusion_idx
  on public.solicitudes (grupo_difusion_id) where grupo_difusion_id is not null;

-- Declinar solo tiene sentido cuando se preguntó a VARIAS áreas: una solicitud
-- dirigida a un área concreta no se declina, se responde o se reasigna.
alter table public.solicitudes
  add constraint solicitudes_declinada_solo_difusion
  check (not declinada or grupo_difusion_id is not null);

alter table public.solicitudes
  add constraint solicitudes_desactivada_solo_difusion
  check (not desactivada or grupo_difusion_id is not null);

-- -----------------------------------------------------------------------------
-- 2. GRANTS: ninguno nuevo (grant de tabla de la migración inicial; lo que exige
--    grant explícito son las tablas nuevas). Quién puede escribir estas columnas
--    lo deciden las políticas que ya existen sobre `solicitudes` más el trigger
--    del punto 4, que es el que acota QUÉ puede cambiar cada actor.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 3. ¿Quién puede declinar esta solicitud? El ÁREA a la que se le preguntó
-- -----------------------------------------------------------------------------
-- El responsable de área y su jefe: los dos son "el área". El coordinador y el
-- administrador del cliente NO declinan por ellos — declarar que algo no te
-- corresponde es del que hace el trabajo, y firmarlo desde arriba sería poner en
-- su boca algo que no dijo.
create or replace function public.fn_es_de_su_area(p_solicitud_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_area   text;
begin
  select r.tenant_id, s.area_asignada
    into v_tenant, v_area
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.id = p_solicitud_id;

  if v_tenant is null or v_area is null then
    return false;
  end if;

  return exists (
    select 1
    from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol in ('cliente', 'jefe_area')
      and p.activo
      and p.tenant_id = v_tenant
      and p.area is not distinct from v_area
  );
end;
$$;

comment on function public.fn_es_de_su_area is
  'true si la sesión pertenece al ÁREA de la solicitud (responsable o jefe, activo, mismo tenant). Autoriza el "no aplica a mi área": lo declara quien hace el trabajo, no quien lo coordina.';

grant execute on function public.fn_es_de_su_area(uuid) to authenticated, service_role;

-- El área necesita poder ESCRIBIR su marca. RLS no distingue columnas: esta
-- política abre el UPDATE de su propia fila y el trigger de abajo lo acota a las
-- dos columnas de la difusión.
create policy solicitudes_area_declina on public.solicitudes
  for update to authenticated
  using (public.fn_es_de_su_area(id) and grupo_difusion_id is not null)
  with check (public.fn_es_de_su_area(id) and grupo_difusion_id is not null);

-- -----------------------------------------------------------------------------
-- 4. Reglas duras de las dos marcas (BEFORE UPDATE)
-- -----------------------------------------------------------------------------
create or replace function public.fn_valida_difusion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambia_declinada   boolean;
  v_cambia_desactivada boolean;
  v_rol                text;
  v_tiene_evidencia    boolean;
begin
  v_cambia_declinada   := new.declinada   is distinct from old.declinada;
  v_cambia_desactivada := new.desactivada is distinct from old.desactivada;

  -- El grupo no se reasigna a mano: se pone al difundir y no se mueve. Cambiarlo
  -- después rompería la correspondencia entre las copias.
  if new.grupo_difusion_id is distinct from old.grupo_difusion_id
     and auth.uid() is not null then
    raise exception 'El grupo de difusión de una solicitud no se cambia después de crearla.'
      using errcode = 'check_violation';
  end if;

  if not (v_cambia_declinada or v_cambia_desactivada) then
    return new;
  end if;

  -- Sin sesión (seed, service_role, migraciones): no se gatea.
  if auth.uid() is null then
    return new;
  end if;

  v_rol := public.fn_current_rol();

  -- 4.a Si quien escribe es del ÁREA (no staff ni administrador del cliente), lo
  --     ÚNICO que puede cambiar de la fila es `declinada`. Su política de UPDATE
  --     le abre la fila; esto la cierra a una columna. Se compara el resto en
  --     bloque para que una columna futura quede protegida sin tocar el trigger.
  if v_rol in ('cliente', 'jefe_area') then
    if (to_jsonb(new) - 'declinada') is distinct from (to_jsonb(old) - 'declinada') then
      raise exception 'El área solo puede declarar si la solicitud le corresponde o no.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- 4.b Declinar / retomar: solo el área de la solicitud.
  if v_cambia_declinada then
    if not public.fn_es_de_su_area(new.id) then
      raise exception 'Solo el área a la que se preguntó puede declarar que no le corresponde.'
        using errcode = 'check_violation';
    end if;
    if old.estado in ('validado', 'congelado') then
      raise exception 'La solicitud ya está validada: su expediente queda fijo.'
        using errcode = 'check_violation';
    end if;
    -- No se declina lo ya entregado: si el área subió evidencia, la información
    -- SÍ le correspondía, y dejar las dos cosas juntas volvería el expediente
    -- contradictorio. Para corregir una carga por error está el reemplazo de
    -- versión, no esta marca.
    if new.declinada then
      select exists (select 1 from public.evidencias where solicitud_id = new.id)
        into v_tiene_evidencia;
      if v_tiene_evidencia then
        raise exception 'Esta solicitud ya tiene evidencia entregada: no puede declararse como no aplicable.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  -- 4.c Desactivar copias: acto de QUIEN DIFUNDIÓ, con la regla de origen de
  --     siempre (IRStrat lo suyo, el administrador del cliente lo suyo).
  if v_cambia_desactivada then
    if old.origen = 'irstrat' and not public.fn_is_staff() then
      raise exception 'Las copias de una difusión de IRStrat las retira IRStrat.'
        using errcode = 'check_violation';
    end if;
    if old.origen = 'cliente' and not public.fn_is_admin_cliente() then
      raise exception 'Las copias de una difusión interna las retira el administrador del cliente.'
        using errcode = 'check_violation';
    end if;
    -- Solo se retiran copias sin entrega (o ya declinadas): desactivar una copia
    -- con evidencia esconderría trabajo entregado.
    if new.desactivada and not new.declinada then
      select exists (select 1 from public.evidencias where solicitud_id = new.id)
        into v_tiene_evidencia;
      if v_tiene_evidencia then
        raise exception 'Esta copia tiene evidencia entregada: no se puede desactivar.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_solicitud_difusion
  before update on public.solicitudes
  for each row execute function public.fn_valida_difusion();

-- -----------------------------------------------------------------------------
-- 5. Una copia declinada o desactivada no recibe evidencia
-- -----------------------------------------------------------------------------
-- Si el área dijo "no me corresponde", el portal ya no le ofrece cargar; esto lo
-- impide también por si la carga llega por otra vía. Retomar la solicitud la
-- vuelve a abrir.
create or replace function public.fn_bloquea_evidencia_si_fuera()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_declinada   boolean;
  v_desactivada boolean;
begin
  select declinada, desactivada into v_declinada, v_desactivada
  from public.solicitudes where id = new.solicitud_id;

  if v_declinada then
    raise exception 'Esta solicitud está declarada como no aplicable a su área: retómala antes de cargar evidencia.'
      using errcode = 'check_violation';
  end if;
  if v_desactivada then
    raise exception 'Esta copia de la difusión fue retirada: la información se recabó por otra área.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_evidencia_no_si_fuera_difusion
  before insert on public.evidencias
  for each row execute function public.fn_bloquea_evidencia_si_fuera();

-- -----------------------------------------------------------------------------
-- 6. El trigger del VISTO BUENO tenía que enterarse de esto
-- -----------------------------------------------------------------------------
-- `fn_valida_vb_area` (migración 20260824130000) acotaba al jefe de área a UNA
-- cosa: mover el visto bueno. Con la difusión, el jefe también puede declarar que
-- la solicitud no le corresponde —es "el área" tanto como su responsable—, y el
-- trigger viejo lo rechazaba antes de que el nuevo pudiera autorizarlo. Se
-- reescribe con la lista de columnas que el jefe SÍ puede mover; el resto de la
-- regla queda igual.
--
-- Se corrige aquí y no editando la migración anterior: una migración aplicada no
-- se edita, se corrige con otra.
create or replace function public.fn_valida_vb_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambia_vb boolean;
  v_es_jefe   boolean;
begin
  v_cambia_vb := (new.vb_area_por, new.vb_area_fecha)
                 is distinct from (old.vb_area_por, old.vb_area_fecha);

  -- Lo que un JEFE DE ÁREA puede cambiar de la fila: el visto bueno (este sprint)
  -- y la declaración de "no aplica a mi área" (difusión). Nada más. Se compara el
  -- resto en bloque para que una columna futura quede protegida sin tocar esto.
  if auth.uid() is not null and public.fn_current_rol() = 'jefe_area' then
    if (to_jsonb(new) - 'vb_area_por' - 'vb_area_fecha' - 'declinada')
       is distinct from (to_jsonb(old) - 'vb_area_por' - 'vb_area_fecha' - 'declinada') then
      raise exception 'El jefe de área solo puede dar o retirar el visto bueno de su área, o declarar que la solicitud no le corresponde.'
        using errcode = 'check_violation';
    end if;
  end if;

  if not v_cambia_vb then
    return new;
  end if;

  -- Revocación automática por evidencia nueva (trg_evidencia_revoca_vb).
  if coalesce(current_setting('app.vb_automatico', true), '0') = '1' then
    return new;
  end if;

  -- Sin sesión (seed, import con service_role, migraciones): no se gatea.
  if auth.uid() is null then
    return new;
  end if;

  -- Una vez validada, la marca queda fija.
  if old.estado in ('validado', 'congelado') then
    raise exception 'La solicitud ya está validada: el visto bueno del área queda fijo.'
      using errcode = 'check_violation';
  end if;

  v_es_jefe := public.fn_es_jefe_de_area(new.id);
  if not v_es_jefe then
    raise exception 'El visto bueno del área solo lo da o retira el jefe de esa área.'
      using errcode = 'check_violation';
  end if;

  if new.vb_area_por is not null then
    if not exists (select 1 from public.evidencias where solicitud_id = new.id) then
      raise exception 'No hay evidencia cargada: no se puede dar visto bueno a una solicitud vacía.'
        using errcode = 'check_violation';
    end if;
    new.vb_area_por   := auth.uid();
    new.vb_area_fecha := now();
  else
    new.vb_area_fecha := null;
  end if;

  return new;
end;
$$;
