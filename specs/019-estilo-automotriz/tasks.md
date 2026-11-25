---
spec: "019"
actualizado: 2026-11-25
---

# Tareas — 019 Estilo automotriz premium con acento plata

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `w/` = `apps/web/`, `t/` = `apps/web/__test__/`, `s/` = `w/src/`.
- Rama `feature/019-estilo-automotriz` desde `develop`. La rama `explore/automotriz` sirve de
  referencia; no se fusiona.

## Fase 1 — Base de datos

Sin tareas: la spec no toca datos.

## Fase 2 — Pruebas en rojo

- [x] T001 `w/e2e/style.spec.ts`, primera parte (rojo), en claro y en oscuro.
  - **Acento:** botón principal y sección actual del menú en acero (claro) o plata (oscuro), con
    contraste tinta/fondo ≥ 4,5; las cifras de «Órdenes» en plata en los dos modos, ≥ 3 sobre su
    bloque (CA-01).
  - **Fondo:** de `<html>` en `#e9ebef` / `#050506`; tarjetas blancas / `#0d0d10` (CA-10, CA-11).
  - **Capa de fondo:** detrás (`z-index` −1), sin eventos de puntero y sin animaciones (CA-02,
    RN-02).
- [x] T002 `style.spec.ts`, segunda parte (rojo).
  - **Títulos:** degradado con `background-clip: text` y paradas con contraste ≥ 4,5 contra el
    fondo, en el inicio, «Órdenes», «Clientes» y el área del cliente (CA-03, RN-01).
  - **Tablero:** precios y celulares en `Geist Mono`; los `th` en mayúsculas y mono (CA-04).
  - **Tarjetas:** radio de 22 px; una tarjeta pulsable se ilumina con el acento al pasar el ratón
    (CA-05).
  - **Botón principal:** radio de píldora (CA-06).
- [x] T003 `style.spec.ts`, tercera parte (rojo).
  - **Encabezado:** flotante (top > 0, separado de los bordes, `rounded-full`) y con la sección
    actual en el acento; en el teléfono, «Menú», logo y avatar (CA-07).
  - **Bento:** admin y operador a 1280 px, con «Órdenes» de dos columnas por dos filas y las demás
    llenando las filas sin huecos (CA-08).
- [x] T004 `style.spec.ts`, cuarta parte (rojo).
  - **Placa:** `text-shadow` en relieve y sus dos destellos (CA-12).
  - **Destello:** cruza al pasar el ratón por su fila; con «reducir movimiento», sin `transition`
    (CA-13).
- [x] T005 [P] `t/src/modules/core/components/spotlight.component.test.tsx` (rojo).
  - Un `pointermove` sobre una tarjeta escribe `--mx` y `--my` relativos a ella.
  - Fuera de una tarjeta no escribe nada.
  - Al desmontarse deja de escuchar (CA-05).
- [x] T006 [P] Prueba unitaria de RF-02: en `s/` no hay ningún selector de acento (búsqueda en el
  código, como `call-action-coverage`).

## Fase 3 — Implementación (verde)

- [x] T010 Tema, en `s/app/hero.ts`.
  - **Radios:** 10, 14 y 22 px.
  - **Sombras:** `boxShadow` con canto de luz por modo.
  - **Claro:** `background` `#e9ebef`, `primary` acero con tinta blanca, `focus` y `divider`.
  - **Oscuro:** `background` `#050506`, `content1` `#0d0d10`, `primary` plata con tinta `#0a0a0a`,
    `divider`.
  - **Aparte:** `s/modules/theme/constants/theme.constants.ts` (`THEME_COLORS`) (CA-01, CA-05,
    CA-10, CA-11).
- [x] T011 Fondo y capas.
  - En `s/app/layout.tsx`: `<html>` con `bg-background`, `<body>` transparente, `Geist_Mono`
    (`--font-geist-mono`), `<div aria-hidden className="garage">` y `<Spotlight />`.
  - En `globals.css`: `--font-mono` y la capa `garage`, clara y oscura, quieta (CA-02).
- [x] T012 `globals.css`, sección «Estilo automotriz (spec 019)», documentada y sin capa.
  - Variables `--accent*` por modo.
  - Títulos `main h1` cromados.
  - `.tabular-nums` y `thead th` tipo tablero.
  - Foco de luz en `.bg-content1` y borde con el acento al pasar el ratón.
  - Botón principal en píldora.
  - En verde: T001 (acento y fondos) y T002 (CA-01 a CA-06).
- [x] T013 [P] `s/modules/core/components/spotlight.component.tsx` (verde T005).
- [x] T014 Encabezado y menú.
  - `s/modules/auth/components/organisms/app-header.component.tsx`: píldora flotante.
  - `molecules/nav-links.component.tsx`: la sección actual y los menús marcados con el acento.
  - En verde: la parte de CA-07 de T003.
- [x] T015 Inicio bento.
  - `s/modules/auth/components/organisms/staff-home.component.tsx`, con «Órdenes» 2 × 2 en
    escritorio.
  - Cifras grandes y etiquetas mono, con `--accent-on-dark`; el teléfono como hoy.
  - En verde: la parte de CA-08 de T003.
- [x] T016 Placas.
  - `s/modules/vehicles/components/atoms/plate-label.component.tsx` (`data-plate`).
  - En `globals.css`: el metal, el relieve, el destello quieto y el que cruza con «movimiento
    permitido».
  - En verde: T004 (CA-12, CA-13).

## Fase 4 — E2E y regresión

- [x] T020 Ajustar las pruebas que cambian a propósito.
  - `w/e2e/theme.spec.ts`: el fondo se lee en `<html>`; `theme-color` y la barra de estado
    pasan a `#050506` y `#e9ebef`.
  - `summary-hover.spec.ts`, si el reposo cambia con `content1`.
  - Cada ajuste, con su motivo en la prueba.
- [x] T021 `w/e2e/ui.spec.ts`: ninguna animación infinita también en «Órdenes» y en el área del
  cliente (RN-02).
- [x] T022 Suite E2E completa contra producción, con los proyectos `chromium` y `chromium-dark`.
  - Comportamiento de todas las secciones.
  - Auditoría axe de todas las pantallas, con formularios con errores.
  - Teléfono a 360 px y en iPhone sin desplazamiento lateral.
  - «Lo que se ilumina lleva la mano», tarjetas-filtro, avisos, esqueletos y «Sin conexión».
  - Lo que falle por el estilo se corrige en el estilo, no en la prueba, salvo lo de T020.
- [x] T023 Revisión con capturas, en claro y en oscuro, a 1280, 360 y 440 px (táctil).
  - **Personal:** inicio, «Órdenes», una orden, «Agenda», «Horario», «Clientes», una ficha,
    «Servicios», «Empleados», reportes, liquidación, solicitudes de datos, «Marcas y líneas»,
    «Usuarios».
  - **Cliente:** inicio, reservas, historial, perfil, «Mis datos».
  - **Fuera de sesión:** acceso, registro y «Sin conexión».
  - Lo que se vea roto se corrige, y la revisión queda anotada aquí.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` (contra
  producción) en verde.
- [x] T091 Sin base de datos: `pnpm db:test` y `test:sandbox` siguen en verde (no deben cambiar).
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` limpio);
  tabla de mutaciones aquí.
- [x] T093 Documentación.
  - `CLAUDE.md`: el sistema visual (acero y plata, radios, mono, fondo, foco, placa, encabezado y
    bento).
  - Enmiendas e historial de las specs 003, 009 y 010.
  - Spec en `implementada`, plan y backlog al día.

## Registro de la regresión (T020–T023)

- **T020, pruebas ajustadas a propósito:** `theme.spec` (fondo en `<html>`, `#050506`/`#e9ebef`,
  anillo plata de «Órdenes»), `summary-hover.spec` (borde con el acento, calculado en el navegador),
  `pwa-install.spec` y `pwa-offline.spec` (colores), `ui.spec` (bento 2 × 2 y color del marcador de
  posición). Cada una dice su motivo.
- **T022, suite completa contra producción:** la primera corrida dio 28 fallos. Fueron 24 auditorías
  axe en claro, por el texto secundario: zinc-500 da 4,0:1 sobre `#e9ebef`. Se corrigió en el tema
  con `#63636b`. Los otros 4 eran colores y forma del inicio cambiados a propósito. Luego, «Marcas
  y líneas» falló de forma intermitente: axe medía «Ver todos» a medio desvanecer. Ahora la
  auditoría espera las animaciones finitas, y pasó 8 de 8. Corridas finales: 248/248 y luego
  249/250. El fallo fue `reservations.spec` «mover a otra franja», intermitente y ajeno al estilo:
  desde la base reiniciada, ese archivo pasó 11/11 tres veces seguidas.
- **T023, capturas:** 30 pantallas × claro/oscuro × 1280, 360 y 440 px táctil (180 capturas):
  inicio del admin y del operador, «Órdenes», una orden, nueva orden, «Agenda», una reserva,
  «Horario», «Clientes», una ficha, «Servicios», «Empleados», reporte, liquidación y su detalle,
  solicitudes y una solicitud, «Marcas y líneas», «Usuarios», perfiles, el área del cliente
  (inicio, reservas, reservar, historial, «Mis datos»), acceso, registro, recuperar contraseña y
  «Sin conexión». Hallazgos corregidos:
  - la mono en líneas que mezclan palabras y cifras («CC 1020304050 · Sin celular», «Sin
    vehículos», «31 de 31 días de $ …») y en la placa: pasan a `tabular-figures` (cifras alineadas
    en Geist);
  - «Reintentar» de «Sin conexión», en píldora;
  - el esqueleto del inicio, con la forma del bento.

  Medido en «Empleados» a 360 px: el nombre ya ocupaba dos renglones antes del cambio (misma
  altura), así que no hay regresión.

## Mutaciones (T092)

Cada mutación se aplicó, se vio fallar la prueba indicada y se revirtió. Las E2E se probaron en
dos tandas, construyendo la app con cada una. Al final se comprobó con `grep` que no quedaba
ninguna.

| Prueba | Mutación | Resultado |
|---|---|---|
| `spotlight` · escribe relativo a la tarjeta | `--mx` sin restar `box.left` | falla |
| `spotlight` · nada fuera de una tarjeta | escribir en el elemento que no es tarjeta / en la primera tarjeta del documento | falla (la prueba se reforzó: la primera mutación pasaba) |
| `spotlight` · deja de escuchar | sin `removeEventListener` | falla |
| `no-accent-picker` | un componente `AccentPicker` en `src` | falla |
| `offline/route` · píldora | radio de 12 px | falla |
| `style` · acento y contraste (CA-01) | `primary` `#71717a` / `#a1a1aa` | falla en claro y oscuro |
| `style` · cifras plata | `--accent-on-dark` `#a1a1aa` | falla (también `theme.spec` CA-06) |
| `style` · fondos (CA-10, CA-11) | `background` `#fafafa` / `#09090b` | falla (también `theme.spec`, `pwa-install`, `pwa-offline` con sus colores) |
| `style` · capa de fondo (CA-02) | `z-index: 0` | falla |
| `style` · títulos cromados (CA-03) | sin `background-clip: text` | falla |
| `style` · cifras mono (CA-04) | `.tabular-nums` sin la mono | falla |
| `style` · línea mixta y placa en Geist | `tabular-figures` con la mono | falla |
| `style` · borde con el acento (CA-05) | sin la regla de borde al pasar el ratón | falla (también `summary-hover` claro y oscuro) |
| `style` · píldora (CA-06) | sin la regla de la píldora | falla |
| `style` · encabezado flotante (CA-07) | `rounded-medium` | falla |
| `style` · bento (CA-08) | `lg:grid-cols-3` | falla (el caso del admin pasaba: se añadió la fila de tres mosaicos) |
| `style` · placa en relieve (CA-12) | sin `text-shadow` | falla |
| `style` · destello al pasar (CA-13) | el destello no se mueve | falla |
| `style` · sin destello con «reducir movimiento» | `transition` fuera de la consulta de movimiento | falla |
| `ui` · nada sin fin en «Órdenes» y el cliente (RN-02) | animación infinita en la cola | falla |
| `ui` · marcador de posición / axe en claro | `SECONDARY_ON_SHOWROOM` `#71717a` | falla |

## Cobertura

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T001 |
| CA-02 | T001 |
| CA-03 | T002 |
| CA-04 | T002 |
| CA-05 | T002, T005 |
| CA-06 | T002 |
| CA-07 | T003 |
| CA-08 | T003 |
| CA-09 | T022 (prueba existente del inicio en iPhone, spec 009) |
| CA-10, CA-11 | T001 |
| CA-12 | T004 |
| CA-13 | T004 |
| RF-01 | T022, T023 |
| RF-02 | T006 |
| RF-03 | T093 |
| RN-01 | T002, T022 (axe) |
| RN-02 | T001, T021 |
| RN-03 | T022 (pruebas existentes de placa, peligro y estados) |
| RN-04 | T022 (toda la suite de comportamiento) |
