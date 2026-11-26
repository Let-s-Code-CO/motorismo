---
spec: "020"
actualizado: 2026-11-26
---

# Tareas — 020 Liquidación quincenal y por rango de fechas

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `w/` = `apps/web/`, `t/` = `apps/web/__test__/`, `m/` = `w/src/modules/reports/`,
  `db/` = `packages/supabase/supabase/`.
- Rama `feature/020-liquidacion-quincenal` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 pgTAP en rojo: reescribir `db/tests/15_payroll.test.sql` por quincena, con el reloj fijo
  (`test.now`) (CA-02, CA-03, CA-04, CA-07, CA-08, CA-11, CA-12, CA-14 a CA-16, RN-04).
  - **Esquema:** tablas y columnas (`period_start`, `period_end`, `base_method`, `period_days`,
    `paid_days`, `divisor`), `check` del día 1 o 16 y del método, RLS, privilegios de tablas y
    funciones, y que las funciones de mes ya no existen.
  - **Cuentas con números:**
    - 2.ª quincena de un mes de 31: la mitad, o × 16 ÷ 31;
    - febrero completo: la mitad;
    - quincena parcial: ÷ 30 por día, como mucho 15, o × días ÷ días del mes;
    - un empleado desactivado y reactivado.
  - **Periodo:** el día de cierre (11:59 p. m. del 15 frente a 00:00 del 16); un rango del 3 al 20 da dos
    trozos con un redondeo único; un rango igual a una quincena es esa quincena; quién aparece (CA-04).
  - **Cierre:**
    - un rango no se cierra;
    - la quincena en curso no se cierra;
    - un día 2 responde `payroll_not_fortnight`;
    - cerrar dos veces responde `payroll_already_closed`;
    - cerrar guarda copia y método; un cambio posterior enciende «hubo cambios»;
    - regenerar con el otro método guarda el método nuevo y el total anterior.
  - **Permisos:** un operador y un cliente reciben `payroll_admin_only`; `anon`, sin `execute`.
  - Verificable: falla contra el esquema actual.
- [x] T002 Migración `db/migrations/<timestamp>_payroll_fortnight.sql` (RF-01, RF-02, RN-02, RN-04),
  creada con `migration:new`.
  - Borra y crea de nuevo `payrolls`, `payroll_lines` y `payroll_items` por quincena, con RLS y
    privilegios.
  - Privadas: `payroll_base_parts_live`, `payroll_items_live` y `payroll_lines_live` por periodo y
    método; `payroll_write` y `payroll_changed`, que leen la fila del cierre.
  - Públicas: `payroll_period`, `payroll_lines`, `payroll_items`, `payroll_base_parts`, `close_payroll`
    y `regenerate_payroll`. Sale la API de mes.
  - Línea `-- seeds: unchanged — no seed closes a payroll`.
  - Verificable: `pnpm db:reset` + `pnpm db:test` en verde (T001 en verde, el resto intacto).
- [x] T003 `pnpm db:types` y `types:check` en verde.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/src/modules/reports/utils/payroll-period.utils.test.ts`, que reemplaza a la de
  `payroll-month` (CA-01, CA-10).
  - La quincena de un día (el 15 y el 16, el 31, el 28 y el 29 de febrero); anterior y siguiente, con
    cambio de mes y de año; la siguiente se detiene en la de hoy.
  - Límites y días de cada periodo; los nombres («1.ª quincena de noviembre de 2026», «Del 3 al 20 de
    noviembre de 2026», un rango entre dos meses).
  - Los enlaces (pantalla, detalle, Excel) llevan el periodo, y el método solo si no es el de por
    defecto.
- [x] T011 [P] `t/src/modules/reports/schemas/reports.schema.test.ts`, casos de `payrollQuerySchema`
  (CA-06, CA-08, CA-09, CA-13).
  - Rango válido; rango al revés, fecha inexistente, solo un extremo, quincena futura o mal escrita, y
    `?month=` viejo → la quincena en curso.
  - Un rango igual a una quincena → esa quincena.
  - `base`: por defecto `commercial`; un valor desconocido → `commercial`; un parámetro repetido cuenta
    una vez.
- [x] T012 [P] `t/src/modules/reports/components/date-range-fields.component.test.tsx` (CA-06).
  - Muestra «Desde» y «Hasta».
  - Elegir un «Desde» después de «Hasta» mueve el otro extremo (nunca al revés), y al contrario.
  - Una fecha borrada no navega.
  - `services-report-screen.component.test` sigue en verde con el componente extraído.
- [x] T013 [P] `t/src/modules/reports/components/payroll-screen.component.test.tsx`, reescrito (CA-01,
  CA-05, CA-06, CA-08, CA-12, CA-13, CA-16).
  - **Quincena:** su nombre, «‹ Quincena anterior» y «Quincena siguiente ›» (no después de la de hoy);
    columnas «12 de 15»; total; «Provisional»; la lista vacía lo dice.
  - **Rango:** «Consulta», sin «Cerrar liquidación», «Volver a la quincena en curso», mismas columnas
    y total.
  - **Método:** las dos opciones, la elegida marcada; cambiarla navega con `base`.
  - **Cerrada:** «Cerrada el … por …», el método del cierre, «hubo cambios»; con el otro método
    elegido, «Al regenerar se calculará por …».
  - Cerrar y regenerar envían `{ start, method }` con `callAction` y avisan con `notify`.
- [x] T014 [P] `t/src/modules/reports/components/payroll-employee-detail.component.test.tsx` (CA-04).
  - Mes comercial: «15 días de 30» y parcial «10 días × $ … ÷ 30».
  - Días reales: «16 de 31 días».
  - Un rango: una línea por quincena que toca.
  - Servicios y total como hoy; «Volver» conserva periodo y método.
- [x] T015 [P] Acción, errores, Excel y ruta (CA-11, CA-17).
  - `payroll.actions.test`:
    - `{ start, method }` válidos;
    - un `start` que no es día 1 ni 16, o un método desconocido → `invalidInput`;
    - hints nuevos → `notFortnight`, `periodOpen`, `methodInvalid`;
    - solo el admin.
  - `payroll-workbook.lib.test`: el encabezado de «Resumen» (periodo, estado, método), «Días del
    periodo»; los nombres de archivo de quincena (cerrada y provisional) y de rango.
  - `payroll-export.route.test`: lee periodo y método de la dirección, 403 a quien no es admin, y el
    nombre del archivo en `Content-Disposition`.

## Fase 3 — Implementación (verde)

- [x] T020 `m/utils/payroll-period.utils.ts`; se borra `payroll-month.utils.ts` (verde T010).
- [x] T021 `payrollQuerySchema(hoy)` en `m/schemas/reports.schema.ts`; tipos `PayrollPeriod`,
  `PayrollMethod`, `PayrollState`, `PayrollLine`, `PayrollItem` y `PayrollBasePart` en
  `m/types/reports.types.ts`, derivados de `Functions` (verde T011).
- [x] T022 `m/api/payroll.server.ts`: `getPayrollPeriod`, `getPayrollLines`, `getPayrollItems` y
  `getPayrollBaseParts`, sobre las funciones nuevas.
- [x] T023 `m/components/molecules/date-range-fields.component.tsx`, extraído de `report-filters`, que
  pasa a usarlo (verde T012).
- [x] T024 `m/components/molecules/payroll-period-bar.component.tsx` y `payroll-screen` reescrito; textos
  en `m/messages/es.json` (verde T013).
- [x] T025 Detalle del empleado con los trozos del salario base (verde T014).
- [x] T026 Acciones, traductor de errores, libro de Excel y ruta de exportación (verde T015).
- [x] T027 Rutas `w/src/app/(app)/reports/payroll/page.tsx`, `[employeeId]/page.tsx` y `export/route.ts`
  con `payrollQuerySchema`.
  - Verificable: `pnpm ts:check` y `pnpm test` en verde; se mira en el navegador, en claro y oscuro,
    en escritorio y en el teléfono.

## Fase 4 — E2E y regresión

- [x] T030 `w/e2e/payroll.spec.ts`, reescrito (CA-01, CA-05, CA-06, CA-08, CA-10 a CA-13, CA-17).
  - Antes y después borra el cierre de la quincena anterior (`adminClient`).
  - **Quincena en curso:** provisional, sin «Cerrar»; ir a la anterior y entrar al detalle.
  - **Cierre:** cerrar la anterior, preguntado antes; recargar la mantiene; cambiar a «Días reales»
    avisa; regenerar guarda el método nuevo.
  - **Rango:** elegir «Desde» y «Hasta» da «Consulta» sin «Cerrar»; «Volver a la quincena en curso».
  - **Excel:** se descarga con el nombre del periodo.
  - **Permisos:** un operador no tiene liquidación ni archivo (como hoy).
- [x] T031 [P] `a11y.spec.ts`: la liquidación de una quincena con su barra (fechas y método), un rango
  y el diálogo de cierre, en claro y oscuro (RNF).
- [x] T032 [P] `ui.spec.ts`: quincena y rango en el teléfono (360 px e iPhone de 440), sin
  desplazamiento lateral; capturas revisadas (RNF).
- [x] T033 [P] Regresión del reporte de servicios con `DateRangeFields`: `reports.spec.ts` sigue en
  verde.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 `pnpm db:reset` + `pnpm db:test` + `types:check` + `test:sandbox` en verde.
- [x] T092 Mutación aplicada a cada prueba nueva que no se escribió en rojo, fallo observado y revertida
  (`git diff` limpio); tabla de mutaciones aquí.
- [x] T093 Documentación.
  - Spec 016 enmendada: HU-02, HU-03 y HU-04 por quincena; CA-18, el nombre del archivo.
  - `CLAUDE.md`: la sección de liquidación por quincena, rango y método.
  - Spec en `implementada`, plan y backlog al día.

## Cobertura

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T010, T013, T030 |
| CA-02 | T001 |
| CA-03 | T001 |
| CA-04 | T001, T014 |
| CA-05 | T013, T030 |
| CA-06 | T011, T012, T013, T030 |
| CA-07 | T001 |
| CA-08 | T001, T011, T013, T030 |
| CA-09 | T011 |
| CA-10 | T010, T030 |
| CA-11 | T001, T015, T030 |
| CA-12 | T001, T013, T030 |
| CA-13 | T011, T013, T030 |
| CA-14 | T001 |
| CA-15 | T001 |
| CA-16 | T001, T013 |
| CA-17 | T015, T030 |
| RF-01 | T001, T010 |
| RF-02 | T001, T013 |
| RN-01 | T001 (comisiones como la 016) |
| RN-02 | T001 |
| RN-03 | T001 |
| RN-04 | T001 |
| RNF (móvil, accesibilidad, privacidad) | T031, T032, T001 (permisos), T015 (403) |

## Registro de la implementación

- **Migración** `20261126142141_payroll_fortnight.sql`: borra y crea de nuevo los cierres por quincena;
  cálculo por periodo y método (trozos de quincena, un redondeo por empleado); API pública
  `payroll_period`, `payroll_lines`, `payroll_items`, `payroll_base_parts`, `close_payroll` y
  `regenerate_payroll`. pgTAP: 69 aserciones con las cuentas de CA-14 y CA-15.
- **Ajustes al plan:**
  - el libro no suma la columna «Días pagados»: los días pagados de cada trozo se explican en el
    detalle del empleado;
  - el método elegido se ve al instante, mientras llega la página con sus cifras (la E2E lo detectó:
    el botón no se marcaba hasta que respondía el servidor);
  - en la pantalla, el estado y los botones van en una sola fila (columna en el teléfono).
- **E2E con procesos en paralelo** (`fullyParallel`): en la suite completa, otro proceso ejecutaba el
  `beforeAll`/`afterAll` del archivo y borraba el cierre a mitad de la prueba («Esa quincena no está
  cerrada»). `payroll.spec.ts` corre en serie (`describe.configure`, como `work-orders-admin`), y espera
  a que la página termine de cargar antes de escribir una fecha o elegir el método: contra el build, un
  valor escrito antes de hidratar no llegaba a ningún manejador. Comprobado tres veces con 4 procesos.
- **Revisión en el navegador:** quincena, rango por días reales, cerrada con otro método y detalle, en
  escritorio, oscuro y 360 px, sin desplazamiento lateral. Cifras de los seeds comprobadas a mano
  (p. ej. Elkin, del 3 al 20 por días reales: $ 1.423.500 × 18 ÷ 30 = $ 854.100).

## Mutaciones (T092)

Escritas antes del código y vistas en rojo: pgTAP (T001), utilidades del periodo, esquema de la
dirección, campos de fechas, libro de Excel y acciones. Mutaciones aplicadas al código, cada una vista
fallar y revertida (`git diff` limpio; las de SQL con `create or replace`, restauradas y pgTAP en
verde):

| Mutación | Prueba que falla |
|---|---|
| Una quincena cerrada no toma su propio método | `payroll-screen.component.test` (CA-16) |
| Unas fechas que son una quincena quedan como rango | `payroll-screen.component.test` (CA-08) |
| Sin la nota de «Quincena completa» | `payroll-employee-detail.component.test` (CA-14) |
| Cerrar acepta cualquier día | `payroll.actions.test` (día que no es 1 ni 16) |
| La descarga ignora el método | `payroll-export.route.test` (CA-17) |
| Todo archivo se nombra como rango | `payroll-workbook.lib.test` (2 pruebas, CA-17) |
| La quincena completa no vale 15 días por mes comercial | `15_payroll.test.sql` (febrero, CA-14) |
| «Hubo cambios» con el método comercial y no el del cierre | `15_payroll.test.sql` (CA-16) |
| El método elegido solo se marca al responder el servidor (código previo) | `payroll.spec.ts` (`toBeChecked`) |

