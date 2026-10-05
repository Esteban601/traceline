#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Reconcilia el HISTORIAL de migraciones de un proyecto dev con la renumeración
# del 5 de octubre de 2026 (encargo 2026-10-05-generador-a-produccion, Paso 1).
#
#   bash scripts/despliegue/renumerar-historial.sh             revisar (no cambia nada)
#   bash scripts/despliegue/renumerar-historial.sh --aplicar   aplicar
#
# Las 26 migraciones que dev tenía y staging no se renombraron a
# 20261005120000 + n minutos, con el mismo orden y el mismo contenido. Un
# proyecto que ya las aplicó con su número viejo no necesita volver a
# ejecutarlas: solo hay que cambiar su historial con `supabase migration repair`
# (las viejas, «reverted»; las nuevas, «applied»). No ejecuta SQL de esquema.
#
# Para el proyecto dev de Esteban y para el de cualquier colaborador que haya
# aplicado las migraciones con su número viejo. NUNCA contra staging: staging
# nunca tuvo los números viejos y recibe las nuevas por `migrar-remoto.sh`.
# Usa el proyecto enlazado (`supabase/.temp/project-ref`) y aborta si es
# staging o si no está enlazado.
# -----------------------------------------------------------------------------
set -euo pipefail

REF_STAGING="ewgnvjtjhvdltvkopptn"
APLICAR=0; [[ "${1:-}" == "--aplicar" ]] && APLICAR=1
falla() { echo "✗ $*" >&2; exit 1; }

[[ -f supabase/.temp/project-ref ]] || falla "No hay proyecto enlazado (supabase/.temp/project-ref)."
REF=$(cat supabase/.temp/project-ref)
[[ "$REF" != "$REF_STAGING" ]] || falla "El proyecto enlazado es STAGING. Este script no corre contra staging."

# viejo nuevo (en el orden de aplicación)
PARES=(
  "20260910120000 20261005120000"   # registros_clima_severidad
  "20260910130000 20261005120100"   # reportes_regimen_adopcion
  "20260910140000 20261005120200"   # perfil_emisor
  "20260910150000 20261005120300"   # documentos_generados
  "20260910160000 20261005120400"   # tenants_limite_generaciones
  "20260910170000 20261005120500"   # storage_documentos
  "20260911120000 20261005120600"   # perfil_emisor_adjuntos
  "20260912120000 20261005120700"   # catalogo_niif_correcciones
  "20260913120000 20261005120800"   # bloques_cache_y_duracion
  "20260914120000 20261005120900"   # bloques_estado_generando
  "20260915120000 20261005121000"   # catalogo_codigos_malformados
  "20260916120000 20261005121100"   # mapeo_export_hoja_taxonomia
  "20260917120000 20261005121200"   # mapeo_export_hojas_riesgo
  "20260918120000 20261005121300"   # bloques_estados_a5
  "20260919120000 20261005121400"   # bloques_en_cola
  "20260920120000 20261005121500"   # bloques_intentos
  "20260921120000 20261005121600"   # registros_clima_narrativa
  "20261001130000 20261005121700"   # barrera_auditor_reparacion
  "20261004120000 20261005121800"   # evidencias_contenido
  "20261004130000 20261005121900"   # sugerencias_captura
  "20261004140000 20261005122000"   # sugerencias_regenerada
  "20261004150000 20261005122100"   # estado_sin_hallazgo
  "20261004150100 20261005122200"   # decidir_sugerencia
  "20261004160000 20261005122300"   # evidencias_limite_bucket
  "20261004160100 20261005122400"   # obsoletar_sugerencias_al_subir
  "20261004160200 20261005122500"   # decidir_sugerencia_correccion
)

lista() {
  supabase migration list --linked --agent yes 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const a = JSON.parse(s); const x = Array.isArray(a) ? a : Object.values(a)[0];
      // Separador «|»: con espacios, una fila sin versión local corre la remota al primer campo.
      for (const r of x) console.log(String(r.local ?? "").replace(/`/g, "") + "|" + String(r.remote ?? "").replace(/`/g, ""));
    });'
}

echo "Proyecto enlazado: $REF"
REMOTAS=$(lista | awk -F'|' '{print $2}' | grep -v '^$' || true)
[[ -n "$REMOTAS" ]] || falla "No se leyó ninguna migración remota."
VIEJAS=(); NUEVAS=(); YA=0
for par in "${PARES[@]}"; do
  v=${par%% *}; n=${par##* }
  tiene_v=$(grep -cx "$v" <<<"$REMOTAS" || true); tiene_n=$(grep -cx "$n" <<<"$REMOTAS" || true)
  if [[ $tiene_v == 1 && $tiene_n == 0 ]]; then VIEJAS+=("$v"); NUEVAS+=("$n")
  elif [[ $tiene_v == 0 && $tiene_n == 1 ]]; then YA=$((YA + 1))
  else falla "Estado inesperado para $v → $n (viejo en remoto: $tiene_v, nuevo: $tiene_n)."
  fi
done
echo "Por reconciliar: ${#VIEJAS[@]} · ya reconciliadas: $YA · total: ${#PARES[@]}"
(( ${#VIEJAS[@]} > 0 )) || { echo "✓ Nada que hacer: el historial ya tiene los números nuevos."; exit 0; }

if (( APLICAR == 0 )); then
  echo
  echo "Se ejecutaría:"
  echo "  supabase migration repair --linked --status reverted ${VIEJAS[*]}"
  echo "  supabase migration repair --linked --status applied  ${NUEVAS[*]}"
  echo
  echo "Revisa y vuelve a correr con --aplicar."
  exit 0
fi

read -r -p "Escribe el ref del proyecto para confirmar ($REF): " CONF
[[ "$CONF" == "$REF" ]] || falla "El ref no coincide; no se aplicó nada."
supabase migration repair --linked --status reverted "${VIEJAS[@]}"
supabase migration repair --linked --status applied "${NUEVAS[@]}"

# Verificación: local == remoto en todo lo que el repositorio tiene.
DESAL=$(lista | awk -F'|' '$1 != $2 {print}' | wc -l | tr -d ' ')
echo "Desalineadas tras el repair (local vs remoto): $DESAL"
echo "Las migraciones posteriores a la renumeración se aplican como siempre con «supabase db push --linked»."
