-- -----------------------------------------------------------------------------
-- Conteo de filas de TODAS las tablas de public, auth.users, auth.identities y
-- storage.objects (paso 4d del encargo rol auditor: antes y después del e2e,
-- para probar que la utilería se borró entera).
--
--   psql "$ENSAYO_DB_URL" -X -A -t -f scripts/ensayo/conteos.sql > conteos.txt
--
-- Solo lee. Una línea por tabla: «esquema.tabla|filas».
-- -----------------------------------------------------------------------------
select string_agg(format(
  'select %L || ''|'' || count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname
), ' union all ' order by n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and (n.nspname = 'public'
       or (n.nspname = 'auth' and c.relname in ('users', 'identities'))
       or (n.nspname = 'storage' and c.relname = 'objects'))
\gexec
