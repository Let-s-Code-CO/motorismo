---
spec: "016"
actualizado: 2026-11-23
---

# Tareas — 016 Liquidación de empleados

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `sb/` = `packages/supabase/supabase/`, `w/` = `apps/web/`, `t/` = `apps/web/__test__/`,
  `r/` = `w/src/modules/reports/`.
- Rama `feature/016-liquidacion-empleados` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 `sb/tests/15_payroll.test.sql`, primera parte (rojo), con datos propios y reloj fijo
  (`test.now`):
  - **Salario base:** columna `base_salary` (entero, `default 0`, check ≥ 0); los existentes en 0
    (CA-03); `save_employee` la guarda; el operador no la lee ni la escribe (CA-04).
  - **Periodos activos:** el *trigger* abre un periodo al registrar, lo cierra al desactivar y abre
    otro al reactivar; RLS de lectura solo para el administrador y sin escritura directa (RN-04).
- [x] T002 `15_payroll.test.sql`, segunda parte (rojo): el cálculo de un mes provisional.
  - **Comisión:** `100 000 × 50 % × 30 % = 15 000`, sumada por empleado (CA-06, RN-01).
  - **Descuento:** no reduce la comisión (CA-07, RN-03).
  - **Qué entra:** fuera las abiertas y las anuladas; la corregida con sus valores; extremos del
    mes en hora de Colombia (CA-08, RN-02).
  - **Días:**
    - mes completo;
    - registrado el 16 a las 3:00 p. m. → 15 de 30;
    - desactivado a mitad de mes;
    - reactivado, con dos periodos sin contar dos veces un día;
    - meses de 28, 30 y 31 días;
    - redondeo al peso (CA-09, RN-04, RN-05).
  - **Quién entra:** sin días ni comisiones no aparece; desactivado con comisiones sí (CA-10).
- [x] T003 `15_payroll.test.sql`, tercera parte (rojo): cierre, regeneración y permisos.
  - **Cerrar:** un mes en curso se rechaza (`payroll_month_open`); cerrar guarda líneas, detalle,
    quién y cuándo; dos veces se rechaza (`payroll_already_closed`) (CA-14, RN-06).
  - **Queda fijo:** corregir una orden, el salario o la comisión no cambia la copia (CA-15, RN-07),
    pero enciende `changed_since_close` (CA-17).
  - **Regenerar:** recalcula, guarda `previous_total`, quién y cuándo; en un mes sin cerrar se
    rechaza (`payroll_not_closed`) (CA-16).
  - **Permisos:** el operador y el cliente reciben `payroll_admin_only` en cada función; `anon` sin
    privilegios; nadie escribe las tablas directamente (CA-20, RN-08).
- [x] T004 Migración `<ts>_payroll.sql` (con `migration:new`): `base_salary`, `save_employee` nueva,
  `employee_active_periods` con su *trigger* y relleno, `payrolls`, `payroll_lines`,
  `payroll_items`, funciones `live`, `payroll_month`, `payroll_lines`, `payroll_items`,
  `close_payroll` y `regenerate_payroll` → T001 a T003 en verde.
- [x] T005 Seeds (`sb/seeds/04_catalogs.sql`):
  - salarios base de ejemplo;
  - empleados con `created_at` y periodo de hace 90 días;
  - Diego desactivado hace 20 días.

  Luego `pnpm db:reset`, `pnpm db:test` y `pnpm db:types`; mutaciones de la migración.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/…/employees/schemas/employee.schema.test.ts`: el salario base en pesos («1.300.000»
  → 1300000), obligatorio, entero y de 0 o más; «0» vale (CA-01, CA-02).
- [x] T011 [P] `t/…/employees/components/employee-form.component.test.tsx` y la ficha o tabla: el
  campo «Salario base» con su error; la ficha del administrador lo muestra con la comisión (CA-01,
  CA-02). `employees.actions.test.ts`: envía `p_base_salary`.
- [x] T012 [P] `t/…/reports/utils/payroll-month.utils.test.ts`: `?month=` válido o el mes en curso;
  anterior y siguiente, sin pasar del mes en curso; «Noviembre de 2026» (CA-05).
- [x] T013 [P] `t/…/reports/utils/payroll-workbook.lib.test.ts`: hoja «Resumen» (columnas, números,
  total del mes) y hoja «Detalle» (fechas y valores con su tipo); el nombre del archivo, también
  provisional (CA-18, CA-19).
- [x] T014 [P] `t/…/reports/actions/payroll.actions.test.ts`: solo un administrador activo; envía el
  mes; traduce `payroll_month_open`, `payroll_already_closed` y `payroll_not_closed` (CA-14, CA-16,
  CA-20).
- [x] T015 [P] `t/…/reports/components/payroll-screen.component.test.tsx`:
  - cada empleado con días, base del mes, comisiones y total, y el total del mes (CA-05);
  - «Provisional» y «Cerrar liquidación» solo si el mes terminó (CA-12, CA-14);
  - «Cerrada el … por …», «Regenerar» con confirmación y aviso (CA-15, CA-16);
  - «Hubo cambios después del cierre» (CA-17);
  - mes vacío (CA-13);
  - meses anterior y siguiente;
  - «Exportar a Excel» con el mes (CA-18).
- [x] T016 [P] `t/…/reports/components/payroll-employee-detail.component.test.tsx`: «15 de 30 días de
  $ 1.300.000 = $ 650.000»; cada servicio con orden, fecha, valor, participación y comisión
  (CA-09, CA-11, CA-06).
- [x] T017 [P] `t/…/reports/components/reports-tabs.component.test.tsx`: «Servicios» y «Liquidación»,
  la actual marcada (RF-02).
- [x] T018 [P] `t/src/app/reports/payroll-export.route.test.ts`: 403 a quien no es administrador; el
  `.xlsx` del mes con su nombre (CA-18, CA-20).

## Fase 3 — Implementación (verde)

- [x] T030 Empleados: esquema, formulario, acción, `employees.server`, ficha y tabla con el
  salario base → T010 y T011 en verde.
- [x] T031 `r/`: tipos (`WithNulls`), `payroll-month.utils`, `payroll-workbook.lib`,
  `api/payroll.server.ts` y mensajes `reports.payroll` → T012 y T013 en verde.
- [x] T032 `r/actions/payroll.actions.ts` con `getActiveAdmin()` y sus errores → T014 en verde.
- [x] T033 Componentes `reports-tabs`, `payroll-screen` (con `ConfirmDialog`, `callAction` y
  `notify`) y `payroll-employee-detail`; las pestañas también en `services-report-screen`
  → T015 a T017 en verde.
- [x] T034 Rutas:
  - `/reports/payroll` y `/reports/payroll/[employeeId]`, con su `loading.tsx` y la guarda del
    administrador;
  - `/reports/payroll/export`.

  Luego `loading-coverage.test.ts` con las rutas nuevas → T018 en verde.
- [x] T035 Inicio: textos del mosaico «Reportes» y de «Muy pronto» («Reporte de clientes.»);
  `staff-home` sigue en verde.

## Fase 4 — E2E

- [x] T040 `w/e2e/payroll.spec.ts`:
  - el administrador fija un salario base en la ficha de un empleado (CA-01);
  - abre «Reportes» → «Liquidación»: el mes en curso, «Provisional», sin «Cerrar» (CA-05, CA-12);
  - va al mes anterior, abre un empleado y ve su detalle (CA-11);
  - cierra el mes y ve «Cerrada el … por …» (CA-14);
  - lo regenera (CA-16);
  - descarga `liquidacion-AAAA-MM.xlsx`, no vacío (CA-18);
  - al terminar, borra su liquidación con la clave secreta;
  - el operador no ve «Liquidación», recibe «No tienes permiso» y la descarga le responde 403
    (CA-20).
- [x] T041 `w/e2e/a11y.spec.ts` (liquidación, detalle y diálogo de cierre, en claro y oscuro) y
  `w/e2e/ui.spec.ts` (liquidación y detalle en el iPhone, sin desplazamiento lateral).

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
  `pnpm build` · `pnpm test:e2e`, también contra el build de producción construido sin cachés.
- [x] T091 `pnpm db:reset` · `pnpm db:test` · `pnpm --filter @motorismo/supabase types:check` en
  verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado y revertida (`git diff` + grep);
  tabla de mutaciones en este archivo.
- [x] T093 Revisión en el teléfono: capturas a 360 px y en iPhone de 440 px táctil, en claro y
  oscuro.
- [x] T094 `CLAUDE.md` (sección de la liquidación), spec, plan, tareas y backlog al día.

## Cobertura de criterios

| Criterio | Tareas |
|---|---|
| CA-01 | T010, T011, T040 |
| CA-02 | T010, T011 |
| CA-03 | T001 |
| CA-04 | T001 |
| CA-05 | T002, T012, T015, T040 |
| CA-06 | T002, T016 |
| CA-07 | T002 |
| CA-08 | T002 |
| CA-09 | T002, T016 |
| CA-10 | T002 |
| CA-11 | T016, T040 |
| CA-12 | T015, T040 |
| CA-13 | T015 |
| CA-14 | T003, T014, T015, T040 |
| CA-15 | T003, T015 |
| CA-16 | T003, T014, T015, T040 |
| CA-17 | T003, T015 |
| CA-18 | T013, T015, T018, T040 |
| CA-19 | T013 |
| CA-20 | T003, T014, T018, T040 |

## Mutaciones aplicadas (T092)

Cada una se aplicó, se vio fallar la prueba indicada y se revirtió; `git diff` y `grep` confirman
que no quedó ninguna, y la base local tiene las funciones originales.

| Código mutado | Prueba que falló |
|---|---|
| Comisión sobre el valor menos el descuento | pgTAP 12–14, 18, 22, 24 |
| Mes por día UTC | pgTAP 12, 15, 18, 22, 24, 29 |
| Anuladas incluidas | pgTAP 12–14, 18, 22, 24 |
| Redondeo por servicio | pgTAP 12, 14, 18, 22, 24, 30 |
| Salario base completo siempre | pgTAP 12, 18, 22, 24, 29, 30 |
| Días por fecha UTC (inicio y fin de periodo) | pgTAP 12, 18, 22, 24, 29, 30 |
| Todos los empleados aparecen | pgTAP 12 |
| Cerrar el mes en curso | pgTAP 20 |
| Mes cerrado recalculado | pgTAP 24 |
| «Hubo cambios» nunca, o solo por líneas | pgTAP 26 y 32 |
| Sin `previous_total` | pgTAP 30 |
| Sin la guarda del administrador | pgTAP 33–35, 37, 38 |
| Reactivar no abre periodo | pgTAP 9, 12, 18, 22, 30 |
| Corregir sin salario lo pone en 0 | pgTAP 5 |
| Esquema: salario no obligatorio; sin `parsePesos` | `employee.schema` (1 y 7) |
| Acción sin `p_base_salary` | `employees.actions` (2) |
| Formulario sin el salario actual; tabla sin salario | `employee-form` (1), `employees-screen` (1) |
| Mes futuro aceptado; «siguiente» pasa del mes en curso | `payroll-month.utils` (1 y 1) |
| Libro: sin total del mes; comisión redondeada; fecha UTC; sin «provisional» | `payroll-workbook.lib` (1 cada una) |
| Acciones: sin guarda; mes sin su primer día; «mes abierto» como genérico | `payroll.actions` (2, 2, 1) |
| Pantalla: «Cerrar» siempre; sin confirmar; sin aviso de cambios; total anterior equivocado | `payroll-screen` (2, 2, 1, 1) |
| Detalle: comisión redondeada; día UTC | `payroll-employee-detail` (1 y 1) |
| Pestañas sin la actual | `reports-tabs` (2) |
| Descarga sin guarda; sin detalle | `payroll-export.route` (1 y 1) |
| Esqueleto `list` en el detalle | `loading-coverage` (1) |
| Textos del inicio | `staff-home` (vista en rojo antes de cambiarlos) |
