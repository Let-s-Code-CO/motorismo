---
spec: "009"
actualizado: 2026-11-20
---

# Tareas — 009 Experiencia móvil

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación) — ver la Definición de terminado.
- Rutas relativas a `apps/web/`; pruebas en `__test__/` espejo de `src/`.

## Fase 1 — Base de datos

Sin cambios de esquema (plan: el resumen cuenta `work_orders` con la sesión y su RLS de la spec 008).

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `auth/utils/open-orders-summary.utils.test.ts`: `{0,0}` → «Sin órdenes abiertas»;
      `{1,0}`, `{2,1}` → números y claves correctos (CA-07, RN-03) → rojo (no existe).
- [x] T011 [P] `auth/components/mobile-nav.component.test.tsx`: «Menú» abre el panel «Menú
      principal» con el logo y las secciones de cada rol, con ícono (admin con «Usuarios», operador
      sin él, cliente solo «Mi perfil»); la actual con `aria-current`; elegir una cierra el panel;
      Escape y «Cerrar» lo cierran y el foco vuelve a «Menú» (CA-02, CA-03, RN-01) → rojo.
- [x] T012 [P] `auth/components/account-menu.component.test.tsx`: el avatar («Tu cuenta») abre el
      menú con nombre y rol (o «Cliente»); «Instalar app» solo si `useInstallPrompt` da una opción
      (mock: `null`, `'prompt'`, `'ios'` abre los pasos); «Cerrar sesión» llama a `signOut` vía
      `callAction` (CA-04, RF-02) → rojo.
- [x] T013 [P] `auth/components/staff-home.component.test.tsx`: un enlace por sección del rol
      («Usuarios» solo admin), con su descripción (escritorio) y el resumen de «Órdenes» («2 en
      proceso · 1 en cola» / «Sin órdenes abiertas»); el mosaico entero es el enlace (CA-06,
      CA-07, CA-09) → rojo.
- [x] T014 [P] `core/components/brand-band.component.test.tsx`: lema visible, adornos
      `aria-hidden`, un solo nombre accesible «Motorismo Detailing» (región) y el logo con su
      texto alternativo (CA-10, CA-12) → rojo.
- [x] T015 [P] `__test__/sandbox/work-orders-access.sandbox.test.ts`: `countOpenOrders` como
      operador contra los seeds → `{ inProgress: 1, queued: 1 }` (#4 empezada, #5 en cola); un
      cliente no cuenta nada (CA-07, RN-03) → rojo.

## Fase 3 — Implementación (verde)

- [x] T020 `auth/constants/nav.constants.ts`: `NAV_LINKS` (href, clave, ícono, audiencias) y
      `navLinksFor(audience)`; `nav-links` pasa a usarla y queda solo con los enlaces en línea de
      escritorio (sin el desplegable); `nav-links.component.test.tsx` al día (RN-01, RF-01).
- [x] T021 `auth/utils/open-orders-summary.utils.ts` + mensajes `auth.home.ordersSummary`
      (plural ICU) y `ordersNone` → T010 en verde (CA-07).
- [x] T022 `work-orders/api/work-orders.server.ts`: `countOpenOrders()` con dos conteos
      `head: true` → T015 en verde (CA-07).
- [x] T023 `auth/components/organisms/mobile-nav.component.tsx` (`Drawer` izquierda, 44 px de
      toque, cierra al navegar) + mensajes `mainMenu`, `closeMenu` → T011 en verde (CA-02, CA-03).
- [x] T024 `auth/components/molecules/account-menu.component.tsx` (`Dropdown` en el avatar,
      cabecera nombre/rol, «Instalar app» con `promptInstall`/`IosInstallSteps`, «Cerrar sesión»
      con `callAction`) + mensaje `accountMenu`; `call-action-coverage` en verde → T012 en verde
      (CA-04, RF-02).
- [x] T025 `app-header.component.tsx`: rejilla de tres columnas por debajo de `md` (menú · logo
      centrado · avatar) y el encabezado actual desde `md` (CA-01, CA-05).
- [x] T026 `auth/components/organisms/staff-home.component.tsx` (mosaicos en dos columnas por
      debajo de `md` con ícono grande de marca; tarjetas actuales desde `md`; «Próximamente» solo
      desde `md`) y `src/app/(app)/page.tsx` que pide `countOpenOrders()` → T013 en verde (CA-06
      a CA-09).
- [x] T027 `core/components/brand-ornaments.component.tsx` extraído de `brand-panel` (se ve igual)
      y `core/components/brand-band.component.tsx` → T014 en verde (CA-10, CA-12, CA-13).
- [x] T028 `src/app/auth/layout.tsx`: la franja arriba por debajo de `lg`, sin el logo pequeño
      sobre el formulario y con menos aire arriba (CA-10, CA-11).

## Fase 4 — E2E

- [x] T030 `e2e/ui.spec.ts`, en iPhone 390 × 844 y 360 px:
      - encabezado con solo «Menú», logo centrado (±2 px) y avatar (CA-01);
      - inicio en dos columnas, con el resumen de «Órdenes» y sin «Próximamente» (CA-06 a CA-08);
      - login, registro y recuperar con la franja, «Entrar» en pantalla y sin desplazamiento
        lateral (CA-10, CA-11);
      - con `reducedMotion: 'reduce'`, el brillo sin animación (CA-12);
      - la prueba de la spec 003 CA-03 en teléfono pasa a comprobar la franja;
      - la de «Menú» de la spec 007 pasa al panel;
      - el panel y el menú de la cuenta abiertos entran en «on an iPhone».
- [x] T031 `e2e/ui.spec.ts` escritorio: enlaces en línea, nombre y «Cerrar sesión» visibles, sin
      «Menú»; tarjetas con descripción y «Próximamente»; panel de marca sin franja (CA-05, CA-09,
      CA-13).
- [x] T032 `e2e/roles.spec.ts`: en un iPhone, el operador no ve «Usuarios» en el panel y el
      administrador sí; navegar desde el panel (CA-02, RN-01). `e2e/auth-logout.spec.ts`: cerrar
      sesión desde el avatar en un iPhone (CA-04).
- [x] T033 `e2e/a11y.spec.ts`: axe en teléfono con el panel abierto, el menú de la cuenta abierto,
      el inicio y el login con la franja; tocar fuera cierra el panel (CA-03) → verde.

- [x] T034 Ajustes pedidos por el usuario:
      - franja del acceso que crece y formulario centrado;
      - «Órdenes» destacada y oscura con números grandes (también en escritorio);
      - mosaicos parejos con el nombre corto e inicio centrado en el teléfono;
      - nombre y rol como cabecera del menú de la cuenta, y el avatar anunciado con sus iniciales
        (`initials.utils`, prueba nueva).
      Pruebas al día y vistas fallar con una mutación (CA-04, CA-06, CA-07, CA-09 a CA-11).

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
      `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 Sin migraciones: `db:reset`/`db:test` no aplican (sí el sandbox de T015).
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` + grep
      limpio).
- [x] T093 Capturas en 360 px, iPhone 440 px y 390 × 844 de encabezado, panel, menú de la cuenta,
      inicio y acceso, revisadas.
- [x] T094 `CLAUDE.md` (menú móvil = panel lateral; cuenta en el avatar; franja de marca en el
      acceso), spec, plan, tareas y backlog al día; nota en el historial de las specs 003, 006 y
      007 de lo que cambia la 009.

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T030 |
| CA-02 | T011, T032 |
| CA-03 | T011, T033 |
| CA-04 | T012, T032 |
| CA-05 | T031 |
| CA-06 | T013, T030 |
| CA-07 | T010, T013, T015, T030 |
| CA-08 | T030, T031 |
| CA-09 | T013, T031 |
| CA-10 | T014, T030 |
| CA-11 | T030 |
| CA-12 | T014, T030 |
| CA-13 | T031 |
