#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Barrera de migraciones del ensayo (paso 4b del encargo rol auditor).
#
#   bash scripts/ensayo/migrar-ensayo.sh
#
# Aplica las migraciones pendientes al proyecto de ensayo y compara
# `migration list` local contra remoto. Solo corre si:
#   - ENSAYO_REF en .env.local es el ref del proyecto de ensayo;
#   - ENSAYO_DB_URL en .env.ensayo.local apunta a ese mismo ref y ya no lleva
#     el marcador PEGAR_;
#   - ninguna de las dos es staging.
# Nunca toca supabase/.temp/project-ref: usa --db-url, así el enlace del
# repositorio sigue apuntando al dev propio.
# Ni la URL ni la contraseña se imprimen.
# -----------------------------------------------------------------------------
set -euo pipefail

REF_STAGING="ewgnvjtjhvdltvkopptn"
REF_ENSAYO="ndodorukqqyzhinahmrm"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"

falla() { echo "✗ $*" >&2; exit 1; }

# Lee una sola variable de un archivo .env sin cargar el resto ni imprimirlo.
leer() { grep -E "^$1=" "$2" 2>/dev/null | tail -n 1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']$//g"; }

ENSAYO_REF="$(leer ENSAYO_REF "$RAIZ/.env.local")"
ENSAYO_DB_URL="$(leer ENSAYO_DB_URL "$RAIZ/.env.ensayo.local")"

[[ "$ENSAYO_REF" == "$REF_ENSAYO" ]] || falla "ENSAYO_REF en .env.local no es $REF_ENSAYO."
[[ -n "$ENSAYO_DB_URL" ]] || falla "Falta ENSAYO_DB_URL en .env.ensayo.local."
[[ "$ENSAYO_DB_URL" != *"PEGAR_"* ]] || falla "ENSAYO_DB_URL conserva el marcador PEGAR_."
[[ "$ENSAYO_DB_URL" == *"$ENSAYO_REF"* ]] || falla "ENSAYO_DB_URL no apunta a $ENSAYO_REF."
[[ "$ENSAYO_DB_URL" != *"$REF_STAGING"* ]] || falla "ENSAYO_DB_URL contiene el ref de staging."
echo "barrera: destino $ENSAYO_REF = traceline-ensayo ✓"

cd "$RAIZ"
# Sin --include-all: si una migración local es más vieja que la última de
# ensayo (que es la de staging), el push falla en vez de aplicarla fuera de orden.
supabase db push --db-url "$ENSAYO_DB_URL" --yes
lista="$(supabase migration list --db-url "$ENSAYO_DB_URL")"
echo "$lista"

# Filas con un lado vacío = local y remoto no coinciden.
desalineadas=$(echo "$lista" | awk -F'|' 'NF>=3 && $1 ~ /[0-9]/ || NF>=3 && $2 ~ /[0-9]/ { l=$1; r=$2; gsub(/ /,"",l); gsub(/ /,"",r); if (l!=r) n++ } END { print n+0 }')
[[ "$desalineadas" == "0" ]] || falla "$desalineadas migraciones no coinciden entre local y ensayo."
echo "migration list local == ensayo ✓"
