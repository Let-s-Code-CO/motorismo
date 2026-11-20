---
spec: "010"
actualizado: 2026-11-20
---

# Tareas — 010 Modo oscuro

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación) — ver la Definición de terminado.
- Rutas relativas a `apps/web/`; pruebas en `__test__/` espejo de `src/`.

## Fase 1 — Base de datos

Sin cambios (RN-02: la elección vive en el dispositivo).

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `theme/utils/theme.utils.test.ts`:
      - `parseThemeChoice`: valores válidos; vacío o desconocido da `system` (CA-12);
      - `resolveTheme`: claro u oscuro según la elección y `prefersDark` (CA-01);
      - `themeCookie`: nombre, un año, `SameSite=Lax` y `Path=/` (CA-11).
      → rojo.
- [x] T011 [P] `theme/providers/theme.provider.test.tsx`:
      - `setChoice` cambia la clase `dark`, `color-scheme`, el `theme-color` y la cookie
        (CA-07, CA-11);
      - con «Sistema» reacciona al cambio de `matchMedia` y con «Claro» no (CA-02).
      → rojo.
- [x] T012 [P] `theme/components/theme-menu.component.test.tsx`:
      - el botón muestra el ícono de la elección y se llama «Tema: Oscuro», etc. (CA-10);
      - abre tres opciones con ícono, con la actual en `aria-checked` (CA-10, CA-13);
      - elegir con el teclado (Enter y flechas) llama a `setChoice` (CA-13).
      → rojo.
- [x] T013 [P] `auth/components/account-menu.component.test.tsx`: una sección «Tema» con Claro,
      Oscuro y Sistema y la actual marcada; elegir llama a `setChoice` (CA-09) → rojo.

## Fase 3 — Implementación (verde)

- [x] T020 Módulo `theme`: `constants/theme.constants.ts`, `utils/theme.utils.ts` y
      `messages/es.json`, registrado en `src/i18n/messages.ts` → T010 en verde (CA-01, CA-11,
      CA-12).
- [x] T021 `theme/utils/theme-script.utils.ts` (el script de `<head>`) y
      `theme/providers/theme.provider.tsx` con `useTheme()` → T011 en verde (CA-01, CA-02, CA-07).
- [x] T022 `src/app/layout.tsx` (RF-01, RF-03, CA-01, CA-07):
      - lee la cookie y pinta la clase, `data-theme-choice` y `color-scheme`;
      - pone el script en `<head>`, el proveedor y `suppressHydrationWarning` en `<html>`;
      - `viewport.themeColor` con sus dos `media`.
- [x] T023 `hero.ts`: tema `dark` (base, `content1..4`, `foreground` con AA, `primary` claro,
      `danger` sin invertir con `DEFAULT` AA y `focus`) (CA-03, CA-05, RN-01, RN-03).
- [x] T024 Colores fijos, a tokens o con su `dark:` (CA-03, CA-06):
      - cuadros de ícono del inicio, avatar y `RoleChip` a `bg-primary text-primary-foreground`;
      - panel y franja de marca y tarjeta «Órdenes» con su borde en oscuro;
      - revisar `site-footer`, `customer-detail`, `profile/page.tsx`, `mobile-nav` y `user-menu`.
- [x] T025 `theme/components/theme-icon.component.tsx` y `theme-menu.component.tsx`; `ThemeMenu` en
      el encabezado de escritorio (`app-header`) → T012 en verde (CA-10, CA-13).
- [x] T026 `account-menu`: sección «Tema» → T013 en verde (CA-09).
- [x] T027 «Sin conexión»: `src/app/offline/route.ts` con su versión oscura y la lectura de la
      cookie; `public/sw.js` → `motorismo-offline-v2` (CA-08).

## Fase 4 — E2E

- [x] T030 `e2e/theme.spec.ts`:
      - con el sistema en oscuro, `<html>` es oscuro ya en `domcontentloaded` (login, inicio,
        órdenes) y con la cookie `dark` lo trae el HTML del servidor (CA-01);
      - con un campo escrito, `emulateMedia` cambia el tema y el texto sigue (CA-02);
      - la placa es igual en los dos temas (CA-04);
      - los chips de los tres estados tienen colores distintos (CA-05);
      - el panel de marca y «Órdenes» tienen un fondo distinto al de la página y un borde
        (CA-06);
      - el `theme-color` es `#09090b` (CA-07);
      - sin cookie, sigue al sistema (CA-12).
- [x] T031 `e2e/theme.spec.ts`:
      - en un iPhone, elegir «Oscuro» en el menú de la cuenta, recargar y cerrar sesión: el login
        sigue oscuro; otro contexto sigue en «Sistema» (CA-09, CA-11);
      - en escritorio, el botón «Tema: …» con su ícono (CA-10).
- [x] T032 `e2e/a11y.spec.ts`: toda la auditoría en claro y en oscuro (`colorScheme`), con los
      menús de tema abiertos y órdenes en sus tres estados → verde, ajustando la paleta en
      `hero.ts` si hace falta (CA-03, CA-05, CA-13).
- [x] T033 `e2e/pwa-offline.spec.ts`: «Sin conexión» con fondo oscuro con el sistema en oscuro y
      con la cookie `dark` (CA-08).

- [x] T034 Ajustes tras revisar con el usuario y con la auditoría en oscuro:
      - «Órdenes» oscura con relieve, borde plateado y resplandor (la versión plateada clara se
        descartó);
      - el rojo de error y los botones destructivos en oscuro;
      - la opacidad de los disparadores de menú;
      - el proyecto `chromium-dark` para axe;
      - la prueba de teclado pasa al E2E.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
      `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 Sin migraciones: `db:reset`/`db:test` no aplican.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` + grep
      limpio).
- [x] T093 Capturas en oscuro y en claro (360 px, iPhone 440 px y 390 × 844, escritorio) de
      acceso, inicio, órdenes, fichas, formularios con errores y menús, revisadas.
- [x] T094 `CLAUDE.md` (colores siempre por tokens o con su `dark:`; cookie del tema; caché v2),
      spec, plan, tareas y backlog al día; nota en el historial de las specs 003, 006 y 009.

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T010, T030 |
| CA-02 | T011, T030 |
| CA-03 | T032 |
| CA-04 | T030 |
| CA-05 | T030, T032 |
| CA-06 | T030 |
| CA-07 | T011, T030 |
| CA-08 | T033 |
| CA-09 | T013, T031 |
| CA-10 | T012, T031 |
| CA-11 | T010, T011, T031 |
| CA-12 | T010, T030 |
| CA-13 | T012, T032 |
