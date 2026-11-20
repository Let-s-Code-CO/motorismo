---
spec: "007"
actualizado: 2026-11-20
---

# Tareas — 007 Catálogos de servicios y empleados

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`, `RN-xx`) y termina en algo verificable (→).
- Las pruebas se escriben antes que el código y se ven en **rojo**. Si una ya pasa al escribirla,
  se muta el código para verla fallar (Definición de terminado en `CLAUDE.md`).
- Todo va en la rama `feature/007-catalogos-servicios-empleados`.
  - **Bloque A**: servicios, menú y tarjetas de inicio. Deja la app desplegable.
  - **Bloque B**: empleados.

  La base de datos se hace completa en el bloque A, como en la spec 005.
- Rutas abreviadas: `sb/` = `packages/supabase/supabase/`, `web/` = `apps/web/`,
  `t/` = `web/__test__/`, `srv/` = `web/src/modules/services/`, `emp/` = `web/src/modules/employees/`.

---

## Bloque A — Servicios, menú y permisos (HU-01, HU-03 y HU-04 para servicios; CA-19)

### Fase A1 — Base de datos

- [x] T001 Crear la rama desde `develop` y la migración vacía con
      `pnpm --filter @motorismo/supabase migration:new catalogs < /dev/null` → existe el archivo
      con versión posterior a las de `origin/develop`.
- [x] T002 `sb/tests/09_catalogs.test.sql` (rojo). Cubre:
      - **Forma**: tablas, enum `document_type` y la clave de nombre.
      - **Restricciones**: precios de 1 a 10.000.000, al menos un precio, comisión de 0 a 100,
        documento por tipo y celular.
      - **Acceso**:
        - RLS activada, `policies_are` y `table_privs_are`; nadie tiene `DELETE`;
        - el administrador lee y escribe todo;
        - el operador lee solo los activos de `services` y `employees`, y nada de
          `employee_details`; no escribe;
        - el cliente y `anon` no tienen nada.
      - **Guardas**: pista de duplicado activo o desactivado (nombre sin mayúsculas ni espacios
        de más; documento sin puntos ni espacios), y normalización.
      - **`save_employee`**: crea y corrige las dos tablas a la vez; con el operador, `42501`.

      → `pnpm db:test` falla. (CA-03, CA-04, CA-08, CA-09, CA-14, CA-16, CA-17, CA-18, RN-01 a RN-07)
- [x] T003 Migración `catalogs`:
      - `private.service_name_key`;
      - las tablas `services`, `employees` y `employee_details`, y el enum `document_type`;
      - las guardas `services_guard` y `employee_details_guard` con sus pistas;
      - `save_employee` (`security invoker`);
      - RLS, políticas y `grant` por columnas; nadie tiene `DELETE`.

      → `pnpm db:reset` + `pnpm db:test` en verde. (RF-01 a RF-03)
- [x] T004 `sb/seeds/04_catalogs.sql`:
      - Servicios: «Lavado sencillo», «Lavado detallado», «Micropulido» y «Recubrimiento
        cerámico», más «Polichado» desactivado.
      - Empleados: dos activos (uno con celular) y uno desactivado, creados con `save_employee`.

      → `pnpm db:reset` sin errores.
- [x] T005 `pnpm db:types` y `pnpm --filter @motorismo/supabase types:check` → en verde, con los
      tipos versionados.

### Fase A2 — Pruebas de la app (rojo)

- [x] T010 [P] `t/src/modules/core/utils/money.utils.test.ts`:
      - `formatPesos(25000)` → «$ 25.000»;
      - `parsePesos` acepta «25.000», «25000» y « 25 000 », y rechaza «25,5», «-1» y «abc».

      → rojo. (CA-01, CA-03)
- [x] T011 [P] `t/src/modules/services/schemas/service.schema.test.ts`: nombre obligatorio (de 1 a
      80), precios opcionales y enteros de 1 a 10.000.000, al menos uno, normalización «25.000» →
      25000 → rojo. (CA-03, RN-05)
- [x] T012 [P] `t/src/modules/services/actions/services.actions.test.ts`:
      - sin admin activo → `forbidden`, sin llamar a Supabase (CA-17);
      - crear y corregir envían los datos normalizados (CA-01, CA-05);
      - pista de duplicado → `nameTaken` o `nameTakenDisabled` (CA-04);
      - desactivar y reactivar escriben `disabled_at` (CA-12, CA-13).

      → rojo.
- [x] T013 [P] `t/src/modules/services/components/services-table.component.test.tsx`:
      - valores en pesos, y «No disponible» en un tipo sin valor (CA-01, CA-02);
      - menú «⋯» con «Editar» y «Desactivar» solo con `isAdmin` (CA-15).

      → rojo.
- [x] T014 [P] `t/src/modules/services/components/service-form.component.test.tsx`:
      - errores junto a cada campo sin enviar (CA-03);
      - alta y edición envían los valores (CA-01, CA-05);
      - el error de duplicado desactivado sugiere reactivar (CA-04).

      → rojo.
- [x] T015 [P] `t/src/modules/services/components/services-screen.component.test.tsx`:
      - estado vacío para el admin (CA-06);
      - desactivar pide confirmación y anuncia el resultado; «Desactivados» muestra la fecha y
        permite reactivar (CA-12, CA-13);
      - con `isAdmin=false` no hay botón de registrar ni acciones (CA-15).

      → rojo.
- [x] T016 [P] `t/src/modules/core/components/confirm-dialog.component.test.tsx`: título, texto,
      confirmar y cancelar; el botón de confirmar es destructivo → rojo. (CA-12)
- [x] T017 [P] Pruebas del encabezado (ampliar `auth-ui.component.test.tsx`):
      - el personal ve «Servicios» y «Empleados»; el cliente no (CA-19, CA-18);
      - en pantalla estrecha hay un botón «Menú» con los mismos enlaces y la sección actual marcada.

      → rojo.

### Fase A3 — Implementación (verde)

- [x] T020 `core/utils/money.utils.ts` y `core/components/confirm-dialog.component.tsx` → T010 y
      T016 en verde.
- [x] T021 `srv/schemas/service.schema.ts`, `srv/utils/services-errors.utils.ts`,
      `srv/api/services.server.ts` (`listServices`), `srv/actions/services.actions.ts` y
      `srv/messages/es.json`, registrado en `src/i18n/messages.ts` → T011 y T012 en verde.
- [x] T022 `srv/components/organisms/`: `services-table`, `service-form` (modal con
      `scrollBehavior="outside"`) y `services-screen` (aviso, «Desactivados» plegable y
      `callAction`) → T013 a T015 en verde.
- [x] T023 `web/src/app/(app)/services/page.tsx`: `getStaffForPage`, `isAdmin` y «No tienes
      permiso» para el cliente → la página carga con los seeds. (CA-15, CA-18)
- [x] T024 Menú:
      - `nav-links.component.tsx` gana «Servicios» y «Empleados», en línea desde `md` y con
        botón «Menú» por debajo;
      - `auth/messages/es.json` gana sus textos;
      - tarjetas «Servicios» y «Empleados» en `web/src/app/(app)/page.tsx`.

      → T017 en verde. (CA-19)

### Fase A4 — Sandbox y E2E

- [x] T025 `t/sandbox/catalogs-access.sandbox.test.ts` (parte de servicios), contra la API real:
      - el operador lee solo los activos y no escribe (`42501`);
      - el cliente no lee nada;
      - un `delete` del admin no borra nada.

      → verde. (CA-14, CA-15, CA-17, CA-18)
- [x] T026 `web/e2e/services.spec.ts`:
      - el admin registra un servicio con dos valores y «No disponible» en el tercero (CA-01, CA-02);
      - un duplicado con otras mayúsculas se rechaza (CA-04);
      - corregir un valor (CA-05);
      - desactivar con confirmación y reactivar desde «Desactivados» (CA-12, CA-13);
      - el operador ve la lista sin acciones (CA-15).

      Limpieza en `afterAll` → verde.
- [x] T027 E2E existentes ampliadas:
      - `roles.spec.ts`: un cliente en `/services` ve «No tienes permiso»; las tarjetas de inicio
        por rol (CA-18, CA-19);
      - `ui.spec.ts`: el admin en 360 px, sin desplazamiento horizontal y con el botón «Menú»
        (CA-19; spec 003, CA-02).

      → verde.

---

## Bloque B — Empleados (HU-02, HU-03 y HU-04 para empleados)

### Fase B1 — Pruebas (rojo)

- [x] T030 [P] `t/src/modules/employees/schemas/employee.schema.test.ts`:
      - nombre (de 1 a 120);
      - tipo de documento; número por tipo, sin puntos ni espacios: CC, CE y PPT solo dígitos
        de 3 a 15, y el pasaporte alfanumérico de 5 a 20 en mayúsculas;
      - celular opcional válido;
      - comisión entera de 0 a 100, que rechaza -1, 101 y 12,5.

      → rojo. (CA-08, RN-04, RN-06)
- [x] T031 [P] `t/src/modules/employees/actions/employees.actions.test.ts`:
      - sin admin activo → `forbidden` (CA-17);
      - `saveEmployee` llama a `save_employee` con los datos normalizados, al crear y al
        corregir (CA-07, CA-10);
      - pista de duplicado → `documentTaken` o `documentTakenDisabled` (CA-09);
      - desactivar y reactivar (CA-12, CA-13).

      → rojo.
- [x] T032 [P] `t/src/modules/employees/components/employee-form.component.test.tsx`:
      - errores por campo (CA-08);
      - alta y edición envían los datos (CA-07, CA-10);
      - un duplicado desactivado sugiere reactivar (CA-09).

      → rojo.
- [x] T033 [P] `t/src/modules/employees/components/employees-screen.component.test.tsx` y
      `employees-table.component.test.tsx`:
      - el admin ve el documento, el celular y la comisión, y tiene acciones;
      - con `isAdmin=false`, solo nombres y sin acciones (CA-16);
      - estado vacío (CA-11);
      - desactivar con confirmación, y «Desactivados» con reactivar (CA-12, CA-13).

      → rojo.

### Fase B2 — Implementación (verde)

- [x] T034 `emp/schemas/employee.schema.ts`, `emp/utils/employees-errors.utils.ts`,
      `emp/api/employees.server.ts` (`listEmployees(isAdmin)`), `emp/actions/employees.actions.ts`
      y `emp/messages/es.json`, registrado → T030 y T031 en verde.
- [x] T035 `emp/components/organisms/`: `employees-table`, `employee-form` (`Select` del tipo de
      documento con `popoverProps.portalContainer`) y `employees-screen` → T032 y T033 en verde.
- [x] T036 `web/src/app/(app)/employees/page.tsx` → la página carga con los seeds, para el admin
      y para el operador. (CA-16, CA-18)

### Fase B3 — Sandbox y E2E

- [x] T037 `catalogs-access.sandbox.test.ts` (parte de empleados):
      - el operador lee solo los nombres de los activos, nada de `employee_details`, y su
        `save_employee` da `42501`;
      - el cliente no lee nada.

      → verde. (CA-16, CA-17, CA-18)
- [x] T038 `web/e2e/employees.spec.ts`:
      - el admin registra un empleado (CA-07);
      - un documento repetido con puntos se rechaza (CA-09);
      - corregir la comisión (CA-10);
      - desactivar y reactivar (CA-12, CA-13);
      - el operador solo ve los nombres de los activos (CA-16).

      → verde.

---

## Cierre

- [x] T050 `web/e2e/a11y.spec.ts`: Servicios y Empleados (admin), los dos formularios, la
      confirmación de desactivar y el «Menú» móvil → verde. (RNF accesibilidad)
- [x] T051 `CLAUDE.md` (usuarios y datos locales: los servicios y empleados de los seeds) y
      `packages/supabase/CLAUDE.md` (`04_catalogs.sql`).
- [x] T052 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` ·
      `pnpm --filter web test:sandbox` en verde.
- [x] T053 `pnpm db:reset` + `pnpm db:test` + `types:check` en verde.
- [x] T054 Mutación aplicada a cada prueba nueva que pasó al escribirla; fallo observado,
      revertida (`git diff` + grep sin marcas).
- [x] T055 Spec (`implementada`), plan, tareas y backlog actualizados.

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T010, T012, T013, T014, T026 |
| CA-02 | T013, T026 |
| CA-03 | T002, T010, T011, T014 |
| CA-04 | T002, T012, T014, T026 |
| CA-05 | T012, T014, T026 |
| CA-06 | T015 |
| CA-07 | T031, T032, T038 |
| CA-08 | T002, T030, T032 |
| CA-09 | T002, T031, T032, T038 |
| CA-10 | T031, T032, T038 |
| CA-11 | T033 |
| CA-12 | T012, T015, T016, T026, T031, T033, T038 |
| CA-13 | T012, T015, T026, T031, T033, T038 |
| CA-14 | T002, T025 |
| CA-15 | T013, T015, T025, T026 |
| CA-16 | T002, T033, T037, T038 |
| CA-17 | T002, T012, T025, T031, T037 |
| CA-18 | T002, T017, T025, T027, T037 |
| CA-19 | T017, T027 |
