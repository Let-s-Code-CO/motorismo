---
spec: "008"
actualizado: 2026-11-20
---

# Tareas — 008 Orden de trabajo

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`, `RN-xx`) y termina en algo verificable (→).
- Las pruebas se escriben antes que el código y se ven en **rojo**. Si una ya pasa al escribirla,
  se muta el código para verla fallar (Definición de terminado en `CLAUDE.md`).
- Todo va en la rama `feature/008-orden-de-trabajo`.
  - **Bloque A (P1)**: abrir y cerrar. La base de datos se hace completa aquí.
  - **Bloque B (P2)**: historial, lista completa y tiempos.
  - **Bloque C (P3)**: corregir y anular.

  Cada bloque deja la app desplegable; si el PR crece demasiado, uno por bloque.
- Rutas abreviadas: `sb/` = `packages/supabase/supabase/`, `web/` = `apps/web/`,
  `t/` = `web/__test__/`, `wo/` = `web/src/modules/work-orders/`.

---

## Bloque A — P1: abrir y cerrar una orden (HU-01, HU-02)

### Fase A1 — Base de datos (completa: también lo que usan B y C)

- [x] T001 Crear la rama desde `develop` y la migración vacía con
      `migration:new work_orders < /dev/null` → versión posterior a las de `origin/develop`.
- [x] T002 `sb/tests/10_work_orders.test.sql`, primera parte (rojo). Cubre:
      - **Forma**: tablas, enums, índice parcial, vista y `services.estimated_minutes` de 5 a 1.440.
      - **Acceso**: RLS, políticas y privilegios; nadie escribe directo ni borra (CA-14, CA-24); el cliente y `anon` no leen nada.
      - **`save_work_order` al abrir**:
        - número consecutivo, `opened_at`/`opened_by` (CA-07);
        - rechazos: cliente desactivado, vehículo retirado, vehículo de otro cliente, vehículo con otra orden abierta (CA-10);
        - servicio inactivo o sin valor para el tipo rechazado; copia de nombre, valor y tiempo (CA-03, RN-01);
        - «Otro» exige descripción (CA-05);
        - la participación debe sumar 100 (CA-06);
        - descuento de 0 hasta el subtotal (CA-25);
        - al menos una línea.
      - **`save_work_order` al editar** una abierta, que conserva una línea de un servicio ya desactivado (CA-08, RN-04).

      → `pnpm db:test` falla.
- [x] T003 `10_work_orders.test.sql`, segunda parte (rojo):
      - **`close_work_order`**:
        - cada línea con empleados (CA-12);
        - pagos que cuadran, con dos medios (CA-11);
        - total 0 sin pagos (CA-13);
        - cerrada → `work_order_not_open` al editar (CA-14).
      - **`correct_work_order`**: solo el administrador, con motivo; `corrected_*` (CA-22).
      - **`void_work_order`**: abierta por el personal, cerrada solo por el administrador, motivo obligatorio, anulada inmutable (CA-21, CA-23).
      - **Vista**: subtotal, descuento, total, estimado y `unestimated` (CA-29, CA-30).
      - Cambiar el tiempo del servicio no altera las líneas (CA-31).

      → falla.
- [x] T004 Migración `work_orders`:
      - `services.estimated_minutes`;
      - los enums, las cuatro tablas con sus `check`, el índice parcial y la vista `security_invoker`;
      - las funciones `save_work_order`, `close_work_order`, `correct_work_order` y `void_work_order` (`security definer` y pistas);
      - RLS de lectura para el personal; `revoke` de las escrituras.

      → `pnpm db:reset` + `pnpm db:test` en verde. (RF-01 a RF-07, RN-01 a RN-11)
- [x] T005 `sb/seeds/05_work_orders.sql`:
      - Abierta: una de Camila (`UIH-03D`) con dos servicios y un estimado.
      - Cerradas: una con dos medios de pago y otra con descuento.
      - Anulada: una con motivo.
      - Tiempos estimados en algunos servicios de `04_catalogs.sql`.

      → `db:reset` sin errores.
- [x] T006 `pnpm db:types` y `types:check` → en verde, con los tipos versionados.

### Fase A2 — Pruebas de la app (rojo)

- [x] T010 [P] `t/src/modules/work-orders/utils/order-totals.utils.test.ts`: subtotal, descuento,
      total; vacía → 0 (CA-04, CA-25) → rojo.
- [x] T011 [P] `t/…/utils/shares.utils.test.ts`: 1 → 100; 2 → 50/50; 3 → 34/33/33; 6 → 17/17/17/17/16/16;
      0 → [] (CA-06, RN-03) → rojo.
- [x] T012 [P] `t/src/modules/core/utils/selection.utils.test.ts`: `singleOption` con 0, 1 y
      varios elementos (RN-10) → rojo.
- [x] T013 [P] `t/…/schemas/work-order.schema.test.ts`:
      - valor entero de 0 a 10.000.000;
      - descripción de «Otro»;
      - participación que suma 100 (por línea);
      - descuento entre 0 y el subtotal;
      - al menos una línea;
      - observaciones de hasta 500 caracteres.

      (CA-05, CA-06, CA-09, CA-25) → rojo.
- [x] T014 [P] `t/…/schemas/payments.schema.test.ts`: medios, montos mayores que 0, suma = total;
      total 0 sin pagos (CA-11, CA-13) → rojo.
- [x] T015 [P] `t/…/actions/work-orders.actions.test.ts` (save y close):
      - sin personal activo → `forbidden`;
      - envía `p_lines` y los pagos como la función espera;
      - pistas → claves de error (cliente desactivado, vehículo ocupado, participación, pagos);
      - `saveWorkOrder` devuelve el id.

      (CA-07, CA-10, CA-11, CA-12) → rojo.
- [x] T016 [P] `t/…/components/customer-picker.component.test.tsx`:
      - busca por nombre o placa y lista los vehículos activos (CA-01);
      - con un vehículo, ya elegido (RN-10);
      - «Registrar vehículo» elige el nuevo (CA-02);
      - un cliente desactivado no se ofrece (CA-10).

      → rojo.
- [x] T017 [P] `t/…/components/order-editor.component.test.tsx`:
      - añadir servicios: solo los válidos para el tipo, con su valor, editable (CA-03, CA-04);
      - «Otro» (CA-05);
      - empleados repartidos y editables; con un único empleado activo, ya asignado al 100 % (CA-06, RN-10);
      - el total se actualiza al añadir, quitar o cambiar, y con el descuento (CA-04, CA-25);
      - los errores van junto al campo (CA-09).

      → rojo.
- [x] T018 [P] `t/…/components/close-order-dialog.component.test.tsx`:
      - el primer pago se propone por el total; se añade un segundo medio; «falta $ X» (CA-11);
      - una pista del servidor dice qué falta (CA-12);
      - total 0 cierra sin pagos (CA-13).

      → rojo.

### Fase A3 — Implementación (verde)

- [x] T020 Utilidades: `wo/utils/order-totals.utils.ts`, `wo/utils/shares.utils.ts` y
      `core/utils/selection.utils.ts` → T010 a T012 en verde.
- [x] T021 Esquemas, acciones y mensajes:
      - `wo/schemas/work-order.schema.ts` y `payments.schema.ts`;
      - `wo/utils/work-orders-errors.utils.ts`;
      - `wo/actions/work-orders.actions.ts` (`saveWorkOrder`, `closeWorkOrder`);
      - `wo/messages/es.json`, registrado.

      → T013 a T015 en verde.
- [x] T022 Vehículos: `saveVehicle` devuelve `{ ok: true, id }` y `vehicle-form` llama a
      `onSaved(id)` → las pruebas de vehículos siguen en verde. (CA-02)
- [x] T023 Lecturas:
      - `wo/api/work-orders.client.ts`, `wo/queries/*`: búsqueda de clientes, vehículos, servicios y empleados activos;
      - `wo/api/work-orders.server.ts`: `getOrder`, `listOpen`.

      → T016 y T017 pueden montar.
- [x] T024 `customer-picker`, `order-line`, `order-summary` y `order-editor` (`useFieldArray`,
      `useWatch`, resumen fijo abajo en el móvil) → T016 y T017 en verde.
- [x] T025 `close-order-dialog` → T018 en verde.
- [x] T026 Rutas:
      - `web/src/app/(app)/orders/new/page.tsx` y `orders/[id]/page.tsx` (detalle básico, editar si está abierta, cerrar);
      - `orders/page.tsx` con «En el lavadero» (mínimo, se completa en B).
      - Todas con `getStaffForPage`.

      → las páginas cargan con los seeds.
- [x] T027 Menú e inicio: «Órdenes» en `nav-links` (`LINKS`) y en la página de inicio; pruebas
      de `nav-links` y `auth-ui` actualizadas → en verde.

### Fase A4 — Sandbox y E2E

- [x] T028 `t/sandbox/work-orders-access.sandbox.test.ts`, contra la API real:
      - el operador no inserta, actualiza ni borra en las tablas (`42501`);
      - el cliente no lee nada;
      - el operador no corrige una cerrada.

      → verde. (CA-14, CA-24)
- [x] T029 `web/e2e/work-orders.spec.ts` (operador):
      - nueva orden: buscar a un cliente con un solo vehículo, que viene elegido;
      - añadir dos servicios y el total en vivo;
      - un empleado al 50/50 cambiado a 80/20;
      - guardar → «Orden #N» abierta;
      - cerrar con dos medios de pago → cerrada.

      Limpieza → verde. (CA-01, CA-03, CA-04, CA-06, CA-07, CA-11)
- [x] T030 E2E: registrar el vehículo desde la orden (CA-02); el cliente desactivado no aparece
      (CA-10) → verde.

---

## Bloque B — P2: historial, lista y tiempos (HU-03, HU-04, HU-06)

### Fase B1 — Pruebas (rojo)

- [x] T040 [P] `t/…/utils/duration.utils.test.ts`: 45 → «45 min», 150 → «2 h 30 min», 120 → «2 h»
      (CA-26) → rojo.
- [x] T041 [P] `t/…/utils/order-estimate.utils.test.ts` (reloj fijo):
      - todas estimadas → «≈ 2 h 15 min · lista hacia las 4:15 p. m.» (CA-29);
      - con faltantes → mínimo, sus nombres y «desde las…» (CA-30);
      - ninguna → «Sin tiempo estimado».

      → rojo.
- [x] T042 [P] Servicios (ampliar):
      - `service.schema` con `estimated_minutes` opcional de 5 a 1.440;
      - `service-form` con su campo;
      - `services-table` con la duración bajo el nombre.

      (CA-26) → rojo.
- [x] T043 [P] `order-editor` (ampliar):
      - la línea copia el tiempo, editable (CA-27);
      - «Sin estimar» editable (CA-28);
      - el resumen muestra el estimado y la hora (CA-29, CA-30).

      → rojo.
- [x] T044 [P] `t/…/components/customer-history.component.test.tsx`: visitas sin las anuladas, dos
      últimas (fecha, vehículo, servicios y total), «Primera visita» (CA-15, CA-17) → rojo.
- [x] T045 [P] `t/…/components/orders-screen.component.test.tsx`:
      - abiertas de la más antigua a la más reciente, con hace cuánto y la hora estimada (CA-18);
      - cerradas paginadas, anuladas marcadas (CA-19).

      → rojo.
- [x] T046 [P] `t/…/components/order-detail.component.test.tsx`: todo el detalle; acciones según
      estado y rol (CA-20) → rojo.

### Fase B2 — Implementación (verde)

- [x] T047 `wo/utils/duration.utils.ts` y `order-estimate.utils.ts` → T040 y T041 en verde.
- [x] T048 Servicios: esquema, formulario, tabla y mensajes con `estimated_minutes` → T042 en verde.
- [x] T049 `order-line` y `order-summary` con tiempos → T043 en verde.
- [x] T050 `customer-history`, montado en la nueva orden y en la ficha del cliente (sección
      «Órdenes» con todas las órdenes, CA-16); `customerHistory` en `work-orders.server.ts` →
      T044 en verde.
- [x] T051 `orders-screen` completo (`listClosed(page)`) y `order-detail` completo → T045 y T046 en
      verde.

### Fase B3 — E2E

- [x] T052 `work-orders.spec.ts` (ampliar):
      - al elegir un cliente con historial se ven sus visitas y las dos últimas (CA-15);
      - su ficha lista las órdenes (CA-16);
      - «Órdenes» muestra la abierta con la hora estimada y la cerrada (CA-18, CA-19);
      - el detalle (CA-20);
      - una línea «Otro» deja el estimado como mínimo (CA-30).

      → verde.

---

## Bloque C — P3: corregir y anular (HU-05)

### Fase C1 — Pruebas (rojo)

- [x] T060 [P] `work-orders.actions.test.ts` (ampliar), `correctWorkOrder` y `voidWorkOrder`:
      - solo el administrador corrige; el motivo es obligatorio;
      - anular una abierta: personal; una cerrada: administrador.

      (CA-21 a CA-23) → rojo.
- [x] T061 [P] `t/…/components/void-order-dialog.component.test.tsx` y `order-detail` (ampliar):
      - motivo obligatorio;
      - «Corregir» solo para el administrador en una cerrada;
      - la marca «Anulada» o «Corregida por…» (CA-21 a CA-23).

      → rojo.

### Fase C2 — Implementación (verde)

- [x] T062 Acciones `correctWorkOrder` y `voidWorkOrder`; `void-order-dialog`; modo corrección del
      editor (con pagos y motivo) en `order-detail` → T060 y T061 en verde.

### Fase C3 — E2E

- [x] T063 `web/e2e/work-orders-admin.spec.ts`:
      - el operador anula una abierta con motivo (CA-21);
      - el administrador corrige una cerrada (cambia un valor y los pagos) con motivo, y se ve
        «Corregida por…» (CA-22);
      - el administrador anula una cerrada, que deja de contar en el historial del cliente (CA-23);
      - el operador no ve «Corregir» en una cerrada.

      → verde.

---

## Cierre

- [x] T070 `web/e2e/a11y.spec.ts`: «Órdenes», la nueva orden (con errores), el detalle, cerrar y
      anular → verde.
- [x] T071 `web/e2e/ui.spec.ts`: la nueva orden y el detalle en 360 px, sin desplazamiento lateral,
      con el resumen visible → verde.
- [x] T072 `CLAUDE.md`:
      - RN-10 como estándar de la interfaz (opción única preseleccionada);
      - escrituras de órdenes solo por funciones;
      - seeds de órdenes.

      Y `packages/supabase/CLAUDE.md` (`05_work_orders.sql`).
- [x] T073 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` ·
      `pnpm --filter web test:sandbox` en verde.
- [x] T074 `pnpm db:reset` + `pnpm db:test` + `types:check` en verde.
- [x] T075 Mutación aplicada a cada prueba nueva que pasó al escribirla; fallo observado,
      revertida (`git diff` + grep sin marcas).
- [x] T076 Spec (`implementada`), plan, tareas y backlog actualizados.

## Bloque D — Enmienda: en cola, en proceso y ficha paginada (HU-07)

- [x] T080 pgTAP (rojo):
      - `start_work_order`: la empieza el operador, con `started_by` (CA-33);
      - dos veces → `work_order_already_started`, una cerrada → `work_order_not_open` (CA-36);
      - el cliente → `work_order_staff_only`;
      - se puede cerrar sin empezar (CA-35);
      - la vista da `started_at` y `started_by_name`.
- [x] T081 Migración: `started_at`/`started_by`, su `check`, `start_work_order` y la vista. Seeds:
      #4 empezada; una orden en cola para la bicicleta de Andrés. Tipos → `db:reset`, `db:test`
      y `types:check` en verde.
- [x] T082 [P] Pruebas de la app (rojo):
      - `order-status.utils` (cuatro estados);
      - `startWorkOrder`;
      - `order-estimate` / `order-editor` (sin inicio: solo duración);
      - `orders-screen`: tres secciones, turno, «Empezar» y «Página 1 de 3» (CA-18, CA-19);
      - `order-detail`: «Empezar» en cola, «Empezada por…» (CA-33);
      - `customer-history`: 10 y «Ver más» (CA-16).
- [x] T083 Implementación:
      - utils, acción, chip y estimado;
      - «Órdenes» con tres secciones y «Empezar»;
      - el detalle;
      - el historial paginado;
      - mensajes.

      → T082 en verde.
- [x] T084 E2E: `work-orders.spec.ts` (nueva orden → «En cola» → «Empezar» → «En proceso»;
      secciones de «Órdenes») y las existentes al día; accesibilidad de las tres secciones → verde.
- [x] T085 Definición de terminado completa; mutaciones revertidas; spec, plan, tareas y backlog.
- [x] T086 Ajustes de interfaz tras revisar con el usuario (escritorio y teléfono):
      - Detalle: tarjeta en tres franjas (vehículo con ícono de su tipo, cliente y placa dibujada
        como en el registro del cliente —la vista trae `plate_city_name`, pgTAP—; historial con
        íconos; «Observaciones» con su etiqueta).
      - «Anular orden» sale del encabezado a su propia sección «Anulación» al final, botón rojo
        sólido como «Desactivar cliente» (CA-21, CA-23).
      - El aviso «Instala Motorismo» (spec 006) pasa de `fixed` a `sticky`: ya no tapa lo último de
        la página (`pwa-install.spec.ts`).
- [x] T087 Verificación (`/verificar 008`): CA-29 alineado con RN-12/CA-34 en la spec; pruebas
      añadidas para el contenido de cada fila de «Órdenes» (CA-18, `orders-screen`, reloj fijo), el
      vehículo retirado que no se ofrece (CA-10, `work-orders.spec.ts`) y la etiqueta CA-35 en pgTAP.

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T016, T029 |
| CA-02 | T016, T030 |
| CA-03 | T002, T017, T029 |
| CA-04 | T010, T017, T029 |
| CA-05 | T002, T013, T017 |
| CA-06 | T002, T011, T013, T017, T029 |
| CA-07 | T002, T015, T029 |
| CA-08 | T002 |
| CA-09 | T013, T017 |
| CA-10 | T002, T015, T016, T030 |
| CA-11 | T003, T014, T015, T018, T029 |
| CA-12 | T003, T015, T018 |
| CA-13 | T003, T014, T018 |
| CA-14 | T002, T003, T028 |
| CA-15 | T044, T052 |
| CA-16 | T050, T052 |
| CA-17 | T044 |
| CA-18 | T045, T052 |
| CA-19 | T045, T052 |
| CA-20 | T046, T052 |
| CA-21 | T003, T060, T061, T063 |
| CA-22 | T003, T060, T061, T063 |
| CA-23 | T003, T060, T061, T063 |
| CA-24 | T002, T028 |
| CA-25 | T002, T010, T013, T017 |
| CA-26 | T002, T040, T042 |
| CA-27 | T043 |
| CA-28 | T043 |
| CA-29 | T003, T041, T043 |
| CA-30 | T003, T041, T043, T052 |
| CA-31 | T003 |
| RN-10 | T012, T016, T017 |
| CA-32 a CA-36 | T080, T082, T084 |
