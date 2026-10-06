#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Migraciones del despliegue contra un proyecto REMOTO (paso 5 del encargo rol
# auditor). Lo ejecuta una persona; Claude Code solo lo corre contra ensayo.
#
#   bash scripts/despliegue/migrar-remoto.sh <ensayo|staging>             revisar
#   bash scripts/despliegue/migrar-remoto.sh <ensayo|staging> --aplicar   aplicar
#
# Sin --aplicar solo lee: lista lo pendiente con --dry-run y exige que sea
# exactamente ESPERADAS (o nada). Si no hay nada pendiente, además verifica.
# Con --aplicar: pide escribir el ref del destino, aplica, y verifica que
#   · un segundo --dry-run ya no tenga nada pendiente,
#   · `migration list` traiga tantas filas como migraciones locales y todas
#     alineadas (se lee JSON o tabla; 0 filas leídas es falla),
#   · fn_aplicar_barrera_auditor() devuelva BARRERA_ESPERADA.
#
# La URL de la base: ensayo la lee de .env.ensayo.local; staging la toma de
# STAGING_DB_URL (cargada con `read -rs`) o la PIDE sin eco: no se escribe en
# archivos ni queda en el historial del shell. Nunca se imprime. Nunca toca supabase/.temp/project-ref: usa --db-url.
# Sin --include-all: una migración local más vieja que la última remota hace
# fallar el push en vez de aplicarse fuera de orden.
# -----------------------------------------------------------------------------
set -euo pipefail

REF_STAGING="ewgnvjtjhvdltvkopptn"
REF_ENSAYO="sqpxcxewoznhpwvhxamy"
# Lo que este despliegue debe aplicar, en orden. Cambia con cada despliegue.
# v39 (encargo 2026-10-06-sistema-de-alertas): el interruptor del resumen diario
# y la tabla de avisos retenidos por el tope.
# Anteriores: v33, las 30 de 20261005120000 a 20261005130100; v32.1,
# 20261004170000_jefe_area_sube_evidencia; v31, 20261001140000; v30,
# 20261001120000; v29, las 20260929*.
ESPERADAS=(
  20261006120000_perfiles_recibe_resumen_diario.sql
  20261006130000_correos_retenidos.sql
)
# Medido en ensayo el 30/09/2026 (dos pasadas): 24 tablas de public con RLS,
# menos comentarios_auditor y auditor_actividad, que la función excluye = 22 × 3
# (insert, update, delete) + 3 de storage.objects.
# v33: 69 de antes + 12 de las cuatro tablas del generador + 6 de las dos de
# captura sugerida = 87 (medido en local y en dev).
# v39: 87 + 3 de correos_retenidos = 90 (medido en local y en dev).
BARRERA_ESPERADA="${BARRERA_ESPERADA:-90}"

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
falla() { echo "✗ $*" >&2; exit 1; }
paso() { echo; echo "── $* ($(date +%H:%M:%S))"; }

DESTINO="${1:-}"; MODO="${2:-revisar}"
[[ "$DESTINO" == "ensayo" || "$DESTINO" == "staging" ]] || falla "Uso: $0 <ensayo|staging> [--aplicar]"
[[ "$MODO" == "revisar" || "$MODO" == "--aplicar" ]] || falla "Segundo argumento: --aplicar o nada."

PSQL="${PSQL:-/opt/homebrew/opt/postgresql@17/bin/psql}"
[[ -x "$PSQL" ]] || PSQL="$(command -v psql)" || falla "No hay psql."

cd "$RAIZ"
if [[ "$DESTINO" == "ensayo" ]]; then
  REF="$REF_ENSAYO"; OTRO="$REF_STAGING"
  DB_URL="$(grep -E '^ENSAYO_DB_URL=' .env.ensayo.local 2>/dev/null | tail -n1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']$//g")"
else
  REF="$REF_STAGING"; OTRO="$REF_ENSAYO"
  # Staging se migra desde lo que se va a desplegar: main, al día con origin, y
  # sin cambios locales en las migraciones.
  git fetch -q origin main
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] \
    || falla "HEAD no es origin/main. Haz checkout de main y git pull antes de migrar staging."
  [[ -z "$(git status --porcelain -- supabase/migrations)" ]] || falla "Hay cambios sin commitear en supabase/migrations."
  # STAGING_DB_URL si ya está en el entorno (cargada con `read -rs`); si no, se pide.
  DB_URL="${STAGING_DB_URL:-}"
  if [[ -z "$DB_URL" ]]; then read -rsp "Pega la URL de la base de staging (no se muestra): " DB_URL; echo; fi
fi

[[ -n "$DB_URL" ]] || falla "Falta la URL de la base de $DESTINO."
[[ "$DB_URL" != *"PEGAR_"* ]] || falla "La URL conserva el marcador PEGAR_."
[[ "$DB_URL" == *"$REF"* ]] || falla "La URL no apunta a $REF ($DESTINO)."
[[ "$DB_URL" != *"$OTRO"* ]] || falla "La URL contiene el ref del otro proyecto ($OTRO)."
echo "destino: $DESTINO ($REF) ✓ · $(git rev-parse --short HEAD) · psql $("$PSQL" --version | awk '{print $3}')"

# Lista lo pendiente. Una conexión fallida también deja la lista vacía, así que
# «nada pendiente» se acepta solo si la CLI salió bien Y lo dijo con todas sus
# letras; si no, falla.
pendientes() {
  local salida
  salida="$(supabase db push --db-url "$DB_URL" --dry-run 2>&1)" || falla "--dry-run falló contra $DESTINO."
  local lista; lista="$(echo "$salida" | grep -oE '[0-9]{14}_[A-Za-z0-9_]+\.sql' || true)"
  if [[ -z "$lista" ]] && ! echo "$salida" | grep -q "Remote database is up to date"; then
    falla "--dry-run no listó migraciones ni dijo «up to date»; no se sabe qué hay pendiente."
  fi
  echo "$lista"
}

verificar() {
  paso "Nada pendiente"
  local p; p="$(pendientes)" || exit 1
  [[ -z "$p" ]] || falla "Tras aplicar sigue habiendo pendientes: $(echo $p)"
  echo "--dry-run: nada pendiente ✓"

  paso "migration list local == $DESTINO"
  local cuenta leidas mal locales
  # --agent yes: salida JSON siempre, la ejecute una persona o Claude Code. Sin
  # él, la CLI elige el formato según quién la corre (ver contar-migraciones.mjs).
  cuenta="$(supabase migration list --db-url "$DB_URL" --agent yes 2>/dev/null | node scripts/despliegue/contar-migraciones.mjs)"
  leidas="${cuenta% *}"; mal="${cuenta#* }"
  locales=$(ls supabase/migrations/*.sql | wc -l | tr -d ' ')
  [[ "$leidas" -gt 0 ]] || falla "No se leyó ninguna fila de migration list; no se comparó nada."
  [[ "$leidas" == "$locales" ]] || falla "migration list trae $leidas filas y hay $locales migraciones locales."
  [[ "$mal" == "0" ]] || falla "$mal migraciones no coinciden entre local y $DESTINO."
  echo "migration list: $leidas de $locales, 0 desalineadas ✓"

  paso "Barrera del auditor"
  local n
  n="$("$PSQL" "$DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c 'select public.fn_aplicar_barrera_auditor()')"
  [[ "$n" == "$BARRERA_ESPERADA" ]] || falla "fn_aplicar_barrera_auditor() = $n; se esperaba $BARRERA_ESPERADA."
  echo "fn_aplicar_barrera_auditor() = $n ✓"
}

paso "Pendientes en $DESTINO (--dry-run)"
# Por separado: una falla dentro de $(…) no corta el script si va dentro de la
# asignación de un arreglo.
LISTA="$(pendientes)" || exit 1
PEND=($LISTA)
if [[ ${#PEND[@]} -eq 0 ]]; then
  echo "nada pendiente"
  verificar
  echo; echo "✓ $DESTINO al día y verificado."
  exit 0
fi
printf '  • %s\n' "${PEND[@]}"
[[ "${PEND[*]}" == "${ESPERADAS[*]}" ]] \
  || falla "Lo pendiente no es exactamente lo esperado (${#ESPERADAS[@]}: ${ESPERADAS[*]}). No se aplica nada."
echo "pendientes == esperadas (${#PEND[@]}) ✓"

if [[ "$MODO" != "--aplicar" ]]; then
  echo; echo "Revisión terminada. Para aplicar: bash scripts/despliegue/migrar-remoto.sh $DESTINO --aplicar"
  exit 0
fi

paso "Aplicar"
read -rp "Escribe el ref de $DESTINO para aplicar ${#PEND[@]} migraciones: " CONFIRMA
[[ "$CONFIRMA" == "$REF" ]] || falla "Ref distinto; no se aplica nada."
# Se imprime la salida sin los NOTICE de «does not exist, skipping» (cientos, de
# los drop if exists) ni el aviso de caché de pg-delta; la URL no aparece en ella.
if ! SALIDA="$(supabase db push --db-url "$DB_URL" --yes 2>&1)"; then
  echo "$SALIDA" | grep -v -E 'does not exist, skipping|pgdelta|pg-delta|^ +at |event loop|main worker' >&2
  falla "supabase db push falló. No sigas con heroku; revisa lo aplicado con: bash $0 $DESTINO"
fi
echo "$SALIDA" | grep -v -E 'does not exist, skipping|pgdelta|pg-delta|^ +at |event loop|main worker|^$|Supabase CLI|recommend'

verificar
echo; echo "✓ $DESTINO migrado y verificado. Siguiente paso: git push heroku main (una persona)."
