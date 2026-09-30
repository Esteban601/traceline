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
# --agent yes: JSON siempre; en la terminal de una persona la CLI imprime la
# tabla con los valores entre comillas invertidas (el parser admite las dos).
lista="$(supabase migration list --db-url "$ENSAYO_DB_URL" --agent yes)"
echo "$lista"

# Filas con un lado vacío = local y remoto no coinciden. La CLI 2.109 imprime la
# lista como JSON; las anteriores, como tabla con «|». Se leen las dos, y una
# lista de la que no se leyó ninguna fila FALLA: el ensayo del 30/09/2026 mostró
# que el conteo sobre la tabla daba 0 desalineadas contra una salida JSON, sin
# haber comparado nada.
cuenta="$(echo "$lista" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    let filas = [];
    const json = s.slice(s.indexOf("{"));
    try { filas = JSON.parse(json).migrations.map((m) => [m.local ?? "", m.remote ?? ""]); }
    catch {
      filas = s.split("\n").map((l) => l.split("|").map((c) => c.replace(/`/g, "").trim()))
        .filter((c) => c.length >= 3 && /^\d+$/.test(c[0] || c[1]));
    }
    const mal = filas.filter(([l, r]) => l !== r).length;
    console.log(`${filas.length} ${mal}`);
  });')"
leidas="${cuenta% *}"; desalineadas="${cuenta#* }"
locales=$(ls "$RAIZ"/supabase/migrations/*.sql | wc -l | tr -d ' ')
[[ "$leidas" -gt 0 ]] || falla "no se leyó ninguna fila de migration list; no se comparó nada."
[[ "$leidas" == "$locales" ]] || falla "migration list trae $leidas filas y hay $locales migraciones locales."
[[ "$desalineadas" == "0" ]] || falla "$desalineadas migraciones no coinciden entre local y ensayo."
echo "migration list local == ensayo ✓ ($leidas de $locales)"
