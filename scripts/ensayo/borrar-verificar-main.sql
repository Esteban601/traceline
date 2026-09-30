-- -----------------------------------------------------------------------------
-- Borra los comentarios que dejó verificar-main.mjs en Empresa Demo. SOLO contra
-- ensayo. Los archivos de prueba del bucket los retira
-- `node scripts/ensayo/verificar-main.mjs --limpiar`.
--
--   psql "$ENSAYO_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/ensayo/borrar-verificar-main.sql
--
-- Aborta si algún comentario con el marcador no es de Empresa Demo.
-- -----------------------------------------------------------------------------
begin;

do $$
declare n_fuera int;
begin
  select count(*) into n_fuera
  from public.comentarios c join public.solicitudes s on s.id = c.solicitud_id
  where c.contenido like '[verificar-main]%'
    and s.reporte_id <> '20000000-0000-0000-0000-000000000001';
  if n_fuera > 0 then
    raise exception '% comentarios con el marcador fuera de Empresa Demo; no se borra nada', n_fuera;
  end if;
end $$;

delete from public.comentarios c
using public.solicitudes s
where s.id = c.solicitud_id
  and c.contenido like '[verificar-main]%'
  and s.reporte_id = '20000000-0000-0000-0000-000000000001';

select count(*) as comentarios_con_marcador
from public.comentarios where contenido like '[verificar-main]%';

commit;
