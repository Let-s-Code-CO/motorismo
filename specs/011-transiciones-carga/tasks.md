---
spec: "011"
actualizado: 2026-11-20
---

# Tareas — 011 Transiciones y estados de carga

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación) — ver la Definición de terminado.
- Rutas relativas a `apps/web/`; pruebas en `__test__/` espejo de `src/`.

## Fase 1 — Base de datos

Sin cambios.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `core/components/page-skeleton.component.test.tsx`:
      - cada variante (`home`, `list`, `detail`, `form`, `profile`) dibuja su forma;
      - un solo `status` «Cargando…», `aria-busy` y las formas `aria-hidden` (CA-03);
      - el contenedor lleva la clase de aparición con retardo (CA-02).
      → rojo.
- [x] T011 [P] `core/components/navigation-progress.component.test.tsx` (CA-06, CA-07):
      - un clic en un enlace interno a otra dirección la arranca y el cambio de ruta (mock de
        `usePathname`) la termina;
      - no arrancan Ctrl o ⌘ + clic, el clic central, `target="_blank"`, un enlace externo ni la
        misma dirección;
      - `popstate` la arranca.
      → rojo.
- [x] T012 [P] `auth/actions/auth.actions.test.ts`: `signIn` con éxito devuelve `{ ok: true,
      destination }` con el destino limpio (`next` válido, inválido o externo) y ya no redirige;
      con error, igual que hoy (CA-12) → rojo.
- [x] T013 [P] `auth/components/login-form.component.test.tsx`: con `ok`, se ve «Entrando…» con el
      logo y se llama a `router.replace(destino)`; con error, sin logo y con el mensaje de siempre
      (CA-12) → rojo.

## Fase 3 — Implementación (verde)

- [x] T020 `globals.css`: animaciones `page-in` (200 ms, opacidad y 6 px), `skeleton-in` (aparece a
      los 300 ms; con «reducir movimiento», sin fundido) y `progress` (la barra avanza hasta el 80 %)
      (CA-02, CA-08, CA-09, CA-10).
- [x] T021 `core/components/skeleton.component.tsx` y `page-skeleton.component.tsx`, con sus
      variantes, y `core.loading.label` en los mensajes → T010 en verde (CA-01 a CA-05).
- [x] T022 Diez `loading.tsx`: inicio, `orders`, `orders/[id]`, `orders/new`, `customers`,
      `customers/[id]`, `services`, `employees`, `admin/users` y `profile`, con el mismo relleno
      que la página real (CA-01, CA-05, RF-01).
- [x] T023 `core/components/navigation-progress.component.tsx` en los layouts con sesión y del
      acceso → T011 en verde (CA-06 a CA-08, RF-02).
- [x] T024 `src/app/(app)/template.tsx` (`motion-safe:animate-page-in`) y `src/app/auth/template.tsx`
      (`motion-safe:animate-fade-in`) (CA-09, CA-10, CA-13, RF-03).
- [x] T025 `auth.actions.ts`: `signIn` devuelve el destino; `core/components/brand-moment.component.tsx`
      y `login-form` con `router.replace` dentro de una transición → T012 y T013 en verde (CA-12,
      CA-14, RN-01).

## Fase 4 — E2E

- [x] T030 `e2e/loading.spec.ts` con la red ralentizada (CDP):
      - «Órdenes», un detalle, «Clientes» y una ficha muestran «Cargando…» con su forma y luego el
        contenido (CA-01);
      - la barra se ve y luego desaparece (CA-06);
      - al iniciar sesión se ve «Entrando…» con el logo y luego el inicio (CA-12).
- [x] T031 `e2e/loading.spec.ts`:
      - con red normal, el esqueleto lleva su retardo de 300 ms (CA-02);
      - en oscuro, las formas usan el color del tema (CA-04);
      - el contenido entra con `page-in` y el encabezado queda fuera (CA-09);
      - «atrás» conserva la posición (CA-11);
      - tras cerrar sesión, el acceso entra con `fade-in` (CA-13).
- [x] T032 `e2e/loading.spec.ts` con «reducir movimiento»: esqueleto sin pulso, barra quieta, página
      sin `page-in` y logo sin brillo (CA-04, CA-08, CA-10, CA-14).
- [x] T033 `e2e/a11y.spec.ts`: axe con un esqueleto a la vista, en claro y en oscuro (CA-03).
      `e2e/ui.spec.ts`: en un iPhone con red lenta, sin desplazamiento lateral con el esqueleto ni con
      el contenido (CA-05). `e2e/auth-login.spec.ts` al día (el destino final no cambia).
- [x] T034 (de `/verificar`) `__test__/src/app/loading-coverage.test.ts`: toda `page.tsx` de `(app)`
      tiene su `loading.tsx` con la variante del plan (CA-01). `e2e/loading.spec.ts`: la barra va en
      el borde superior y aparece a los 120 ms (`animation-delay: 0.12s`) (CA-06, CA-07).

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
      `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 Sin migraciones: `db:reset`/`db:test` no aplican.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` + grep
      limpio).
- [ ] T093 (pendiente del usuario, a mano) Revisión (teléfono y escritorio, claro y oscuro, con red lenta en el navegador):
      esqueletos, barra, transición y logo.
- [x] T094 `CLAUDE.md` (toda pantalla nueva con datos lleva su `loading.tsx`; cómo funcionan la
      barra y la transición), spec, plan, tareas y backlog al día; nota en las specs 003 y 009.

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T030, T034 |
| CA-02 | T010, T031 |
| CA-03 | T010, T033 |
| CA-04 | T031, T032 |
| CA-05 | T033 |
| CA-06 | T011, T030, T034 |
| CA-07 | T011, T034 |
| CA-08 | T032 |
| CA-09 | T031 |
| CA-10 | T032 |
| CA-11 | T031 |
| CA-12 | T012, T013, T030 |
| CA-13 | T031 |
| CA-14 | T032 |
