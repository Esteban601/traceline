#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Copia de staging al proyecto de ensayo (paso 4 del encargo rol auditor).
#
# Lo ejecuta UNA PERSONA en su terminal; Claude Code no lo corre. Las dos URL
# llegan como variables de entorno de esta ejecución y no se escriben en ningún
# archivo ni se imprimen:
#
#   STAGING_DB_URL='…' ENSAYO_DB_URL='…' bash scripts/ensayo/copiar-staging.sh
#
# Qué copia (pg_dump/pg_restore, sin owners ni privilegios):
#   - schema public: esquema y datos;
#   - supabase_migrations: para que `migration list` compare contra staging;
#   - auth.users y auth.identities: solo filas;
#   - storage.buckets y storage.objects: solo filas (sin bytes: los archivos
#     viven fuera de la base) y las políticas de storage.objects.
#
# Orden: pre-data de public → filas de auth y storage → datos de public →
# post-data (índices, FK, triggers, políticas). Así las FK a auth.users se
# validan al final y ningún trigger dispara durante la carga.
#
# Barreras: la URL de origen debe ser la de staging y la de destino la de
# ensayo; el destino debe tener public vacío; pg_dump no puede ser de una
# versión menor que el servidor. Al final compara conteos tabla por tabla y
# sale con código 1 si alguno difiere.
# -----------------------------------------------------------------------------
set -euo pipefail

REF_STAGING="ewgnvjtjhvdltvkopptn"
REF_ENSAYO="ndodorukqqyzhinahmrm"

falla() { echo "✗ $*" >&2; exit 1; }

[[ -n "${STAGING_DB_URL:-}" ]] || falla "Falta STAGING_DB_URL en el entorno de la ejecución."
[[ -n "${ENSAYO_DB_URL:-}" ]] || falla "Falta ENSAYO_DB_URL en el entorno de la ejecución."
[[ "$STAGING_DB_URL" == *"$REF_STAGING"* ]] || falla "STAGING_DB_URL no es la de staging ($REF_STAGING)."
[[ "$ENSAYO_DB_URL" == *"$REF_ENSAYO"* ]] || falla "ENSAYO_DB_URL no es la de ensayo ($REF_ENSAYO)."
[[ "$ENSAYO_DB_URL" != *"$REF_STAGING"* ]] || falla "ENSAYO_DB_URL contiene el ref de staging."
[[ "$STAGING_DB_URL" != *"PEGAR_"* && "$ENSAYO_DB_URL" != *"PEGAR_"* ]] || falla "Una URL conserva el marcador PEGAR_."

for bin in pg_dump pg_restore psql; do
  command -v "$bin" >/dev/null || falla "No encuentro $bin en el PATH."
done

export PGCONNECT_TIMEOUT=15
q_origen()  { psql "$STAGING_DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 -c "$1"; }
q_destino() { psql "$ENSAYO_DB_URL"  -X -q -A -t -v ON_ERROR_STOP=1 -c "$1"; }

inicio=$(date +%s)
paso() { echo "[$(( $(date +%s) - inicio ))s] $*"; }

# --- versiones -----------------------------------------------------------------
cliente=$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
serv_origen=$(q_origen "show server_version_num" | cut -c1-2)
serv_destino=$(q_destino "show server_version_num" | cut -c1-2)
paso "pg_dump $cliente · staging $serv_origen · ensayo $serv_destino"
(( cliente >= serv_origen )) || falla "pg_dump $cliente no puede volcar un servidor $serv_origen: instala postgresql@$serv_origen."
(( serv_destino >= serv_origen )) || falla "Ensayo ($serv_destino) es de versión menor que staging ($serv_origen)."

# --- destino vacío -------------------------------------------------------------
tablas_destino=$(q_destino "select count(*) from information_schema.tables where table_schema='public'")
[[ "$tablas_destino" == "0" ]] || falla "Ensayo ya tiene $tablas_destino tablas en public; este script solo copia sobre un proyecto vacío."
paso "ensayo vacío de tablas públicas ✓"

# --- volcado -------------------------------------------------------------------
tmp=$(mktemp -d)
chmod 700 "$tmp"
trap 'rm -rf "$tmp"' EXIT   # los volcados llevan datos reales: no sobreviven a la ejecución

comunes=(--no-owner --no-privileges --format=custom)
pg_dump "$STAGING_DB_URL" "${comunes[@]}" --schema=public            -f "$tmp/public.dump"
pg_dump "$STAGING_DB_URL" "${comunes[@]}" --schema=supabase_migrations -f "$tmp/migraciones.dump"
pg_dump "$STAGING_DB_URL" "${comunes[@]}" --data-only \
  -t auth.users -t auth.identities -t storage.buckets -t storage.objects  -f "$tmp/auth_storage.dump"
pg_dump "$STAGING_DB_URL" "${comunes[@]}" --schema-only -t storage.objects -f "$tmp/storage_politicas.dump"
paso "volcado de staging listo"

# --- restauración --------------------------------------------------------------
restaura() { pg_restore --no-owner --no-privileges --exit-on-error --single-transaction -d "$ENSAYO_DB_URL" "$@"; }

# public ya existe en todo proyecto Supabase: se omite su CREATE SCHEMA/COMMENT.
pg_restore -l "$tmp/public.dump" | grep -v -E ' SCHEMA - public | COMMENT - SCHEMA public ' > "$tmp/public.lista"

restaura --section=pre-data -L "$tmp/public.lista" "$tmp/public.dump"
paso "esquema de public (pre-data) ✓"
restaura "$tmp/migraciones.dump"
paso "supabase_migrations ✓"
restaura "$tmp/auth_storage.dump"
paso "filas de auth y storage ✓"
restaura --section=data -L "$tmp/public.lista" "$tmp/public.dump"
paso "datos de public ✓"
restaura --section=post-data -L "$tmp/public.lista" "$tmp/public.dump"
paso "índices, llaves, triggers y políticas de public ✓"

# Solo las políticas de storage.objects: la tabla la administra Supabase.
pg_restore -l "$tmp/storage_politicas.dump" | grep -E ' POLICY ' > "$tmp/storage.lista" || true
if [[ -s "$tmp/storage.lista" ]]; then
  restaura -L "$tmp/storage.lista" "$tmp/storage_politicas.dump"
fi
paso "políticas de storage.objects: $(wc -l < "$tmp/storage.lista" | tr -d ' ') ✓"

# --- conteos -------------------------------------------------------------------
# Solo lectura en ambos lados: count(*) por tabla vía query_to_xml.
CONTEOS="
select format('%s.%s', s, t) || '=' ||
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', s, t), false, true, '')))[1]::text
from (
  select table_schema s, table_name t from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  union all values ('auth','users'), ('auth','identities'), ('storage','buckets'), ('storage','objects'),
                   ('supabase_migrations','schema_migrations')
) x order by 1"

q_origen  "$CONTEOS" > "$tmp/conteos_staging"
q_destino "$CONTEOS" > "$tmp/conteos_ensayo"
tablas=$(wc -l < "$tmp/conteos_staging" | tr -d ' ')

if diff "$tmp/conteos_staging" "$tmp/conteos_ensayo" > "$tmp/diferencias"; then
  paso "conteos idénticos en $tablas tablas ✓"
  # Nombres de tabla y números, sin datos.
  column -t -s '=' < "$tmp/conteos_ensayo"
else
  echo "✗ Conteos distintos (< staging, > ensayo):" >&2
  cat "$tmp/diferencias" >&2
  exit 1
fi
paso "copia terminada"
