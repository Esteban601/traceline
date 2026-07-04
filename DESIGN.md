# DESIGN.md — Sistema de diseño

Guía viva del portal. **Todo lo que se construya (hoy y en adelante) respeta
estos tokens y patrones.** Look premium editorial (revista / informe anual), no
plantilla de administración genérica: espaciado generoso, jerarquía tipográfica
clara, microinteracciones sutiles. Tailwind v4 puro (tokens en
`app/globals.css` vía `@theme`), sin librerías de componentes pesadas.

> El nombre comercial de la app se toma **siempre** de `NEXT_PUBLIC_APP_NAME`
> (helper `lib/app.ts → APP_NAME`), nunca hardcodeado.

---

## Tipografía

| Uso | Fuente | Notas |
|-----|--------|-------|
| Headings / display | **Sora** (`--font-display`) | `letter-spacing: -0.02em`, pesos 500–700. |
| Cuerpo / UI | **Inter** (`--font-sans`) | Peso 400–600. |

Cargadas con `next/font/google` en `app/layout.tsx` (sin FOUT, `display: swap`).

Escala tipográfica (utilidades Tailwind):

- Display página: `text-3xl sm:text-4xl font-semibold` (Sora)
- Título sección: `text-xl font-semibold`
- Título tarjeta: `text-base font-semibold`
- Cuerpo: `text-sm` / `text-base` (Inter)
- Metadato / etiqueta: `text-xs uppercase tracking-wide text-muted`

---

## Color

Tokens en `@theme` (generan `bg-*`, `text-*`, `border-*`, y modificadores de
opacidad `bg-teal/10`).

| Token | Hex | Rol |
|-------|-----|-----|
| `crema` | `#F7F3EA` | Fondo de página |
| `surface` | `#FEFCF6` | Tarjetas y superficies elevadas |
| `line` | `#E7DECB` | Bordes cálidos |
| `ink` | `#1C2B28` | Texto principal |
| `muted` | `#5F6E6A` | Texto secundario |
| `teal` | `#0E4F47` | **Primario** (marca, botones, enlaces) |
| `teal-dark` | `#0A3A34` | Hover / activo del primario |
| `gold` | `#BE9130` | **Acento** (detalles, líneas, foco de atención) |

### Semáforo de estados

Cada estado de solicitud mapea a un color y a un bucket de KPI (ver
`lib/estados.ts`).

| Color | Token | Bucket KPI | Estados |
|-------|-------|-----------|---------|
| Ámbar | `ambar` `#B47A1C` | **Pendientes** | `pendiente`, `solicitado` |
| Azul | `azul` `#2E6CA6` | **Recibidas** | `recibido`, `en_revision` |
| Rojo | `rojo` `#B0402F` | **Con observaciones** | `observaciones` |
| Verde | `verde` `#2F7A55` | **Validadas** | `validado`, `congelado` |
| Gris | `gris` `#6B7975` | — | neutro / congelado (badge) |

Uso en badges/tints: texto `text-<tono>`, fondo `bg-<tono>/10`, borde
`border-<tono>/25`.

---

## Espaciado y layout

- Escala base Tailwind (múltiplos de 4px). **Generosidad**: secciones separadas
  por `space-y-8`/`space-y-10`; padding de tarjeta `p-5`/`p-6`.
- Ancho de contenido: `max-w-5xl` (tablero) / `max-w-3xl`–`max-w-4xl` (detalle),
  centrado con `mx-auto px-5 sm:px-8`.
- Header sticky de altura cómoda (`h-16`), con borde inferior `border-line`.
- Grid de KPIs: `grid-cols-2 lg:grid-cols-4 gap-4`.

## Radios

| Token | Valor | Uso |
|-------|-------|-----|
| `rounded-card` | 16px | Tarjetas, paneles |
| `rounded-xl` | 12px | Inputs, botones grandes |
| `rounded-lg` | 8px | Botones, badges rectangulares |
| `rounded-pill` | 9999px | Badges de estado, chips |

## Sombras

| Token | Uso |
|-------|-----|
| `shadow-soft` | Tarjetas en reposo |
| `shadow-card` | Tarjetas destacadas / hover de listas |
| `shadow-lift` | Popovers, dropzone activa |

## Motion

- Transiciones **150–200ms**, `ease-out`. Clase base: `transition duration-150`.
- Hover: elevación sutil (`hover:shadow-card`), desplazamiento leve
  (`hover:-translate-y-0.5`), o cambio de tono de borde.
- Entrada de página: reveal escalonado ligero (opacidad + `translate-y`) solo en
  momentos de alto impacto. Sin animaciones ruidosas.
- Respeta `prefers-reduced-motion` (deshabilitar transforms).

## Foco / accesibilidad

- `:focus-visible` con anillo teal (definido en `globals.css`).
- Contraste AA: `ink`/`muted` sobre `crema`/`surface`; tonos de estado usados
  como texto sobre fondo claro.
- Objetivos táctiles ≥ 40px en móvil.

---

## Componentes base (`components/ui/`)

- **`Button`** — variantes `primary` (teal), `secondary` (borde), `ghost`,
  `danger`. Estados hover/disabled/loading.
- **`Badge`** — estado con color de semáforo (pill).
- **`KpiCard`** — número grande (Sora), etiqueta, barra/acento de color de
  bucket. Interactivo opcional (filtro).
- **`Card`** — superficie con `bg-surface border border-line rounded-card
  shadow-soft`.
- **`Field`** — label + input/textarea con estilos consistentes.

## Patrones de estado (UI)

- **Loading**: `loading.tsx` con skeletons (bloques `bg-line/50 animate-pulse`).
  Nunca pantalla en blanco silenciosa.
- **Error**: `error.tsx` con mensaje claro y acción de reintento.
- **Vacío**: mensaje editorial centrado con ícono/acento, no tabla vacía.

## Responsive

- Mobile-first. El coordinador revisa avance desde el teléfono.
- KPIs 2×2 en móvil → 4 en desktop. Listas apilan metadatos en móvil.
- Header colapsa el detalle del usuario en pantallas pequeñas.
