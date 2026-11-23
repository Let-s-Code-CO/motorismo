---
spec: "016"
estado: aprobado
actualizado: 2026-11-23
---

# Plan técnico — 016 Liquidación de empleados

## Resumen

- **Empleado:** `employee_details.base_salary`, privado como la comisión, en el formulario y la
  ficha del empleado.
- **Días activos:** una tabla de periodos activos por empleado, que mantiene un *trigger* al
  registrar, desactivar o reactivar. Así se sabe cuántos días estuvo activo en cualquier mes.
- **Cálculo:** funciones de Postgres calculan la liquidación de un mes. Si el mes está cerrado,
  la leen de su copia guardada.
- **Cierre:** `close_payroll` y `regenerate_payroll` (`security definer`, solo administrador)
  guardan la copia fija.
- **Pantallas:** «Reportes» → «Liquidación» (`/reports/payroll?month=AAAA-MM`), el detalle de un
  empleado y la descarga en Excel, con la misma librería de la spec 015.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 016 aprobada. |
| II. Qué antes que cómo | ✅ | Tablas, funciones y rutas se deciden aquí. |
| III. Criterios verificables | ✅ | pgTAP para cuentas, días, cierre y permisos; unitarias para formulario, mes, Excel y pantallas; E2E del flujo. |
| IV. Ambigüedad explícita | ✅ | Sin preguntas abiertas; las suposiciones de la spec se concretan abajo. |
| V. Simplicidad y stack | ✅ | Sin dependencias nuevas (`write-excel-file` ya está). |
| VI. Seguridad y datos personales | ✅ | Salario y liquidación solo para el administrador, en RLS y en las funciones; las tablas nuevas, sin escritura directa. |
| VII. Trazabilidad | ✅ | Rama `feature/016-liquidacion-empleados`. |
| VIII. Incrementos pequeños | ✅ | Un PR: salario base, liquidación, cierre y Excel. |

## Base de datos (packages/supabase)

Una migración, `<ts>_payroll.sql`.

### Salario base (HU-01)

- `employee_details.base_salary integer not null default 0 check (base_salary >= 0)`. El
  `default 0` deja a los empleados existentes en 0 (CA-03).
- Se añade a los `grant insert/update` de columnas de `employee_details`. La RLS que ya existe
  (solo el administrador lee y escribe esa tabla, spec 007) lo protege del operador (CA-04).
- `save_employee` gana `p_base_salary integer`, al final y opcional: nulo registra 0 y, al
  corregir, conserva el que había. Así siguen valiendo las llamadas de la spec 007 (seeds y pgTAP).
  Se borra la firma anterior y se crea la nueva, para no dejar dos versiones que se confundan.

### Periodos activos (RN-04)

`public.employee_active_periods`:

| Columna | Qué es |
|---|---|
| `employee_id` | El empleado. |
| `started_at` | Cuándo empezó a estar activo. |
| `ended_at` | Cuándo dejó de estarlo (nulo si sigue activo). |

- **Cómo se llena:** un *trigger* `after insert or update of disabled_at` sobre `employees`
  (`security definer`):
  - al registrarse, abre un periodo desde `created_at`;
  - al desactivarse, cierra el abierto en `disabled_at`;
  - al reactivarse, abre uno nuevo.
- **Empleados existentes:** un periodo desde `created_at` hasta `disabled_at` (la suposición de la
  spec).
- **Permisos:** RLS con lectura solo para el administrador; nadie inserta, cambia ni borra
  directamente.
- **Qué día cuenta:** un día del mes cuenta como activo si el empleado lo estuvo en algún momento
  de ese día, en hora de Colombia. Ejemplo: registrado el 16 de noviembre a las 3:00 p. m. →
  activo del 16 al 30 = 15 de 30 días. Los días de varios periodos se cuentan una sola vez.

### Liquidaciones cerradas (HU-03)

- **`public.payrolls`**, una por mes:

  | Columna | Qué es |
  |---|---|
  | `month` | Primer día del mes; `unique`. |
  | `total` | Total del mes. |
  | `closed_by`, `closed_at` | Quién la cerró y cuándo. |
  | `regenerated_by`, `regenerated_at` | Quién la regeneró y cuándo. |
  | `previous_total` | El total antes de regenerarla (CA-16). |

- **`public.payroll_lines`**, una por empleado:

  | Columna | Qué es |
  |---|---|
  | `payroll_id`, `employee_id`, `employee_name` | A qué liquidación y empleado pertenece; el nombre se copia. |
  | `active_days`, `month_days` | Días activos y días del mes. |
  | `base_salary` | Salario base del empleado al calcular. |
  | `base_pay` | Salario base del mes, ya prorrateado. |
  | `commission_pct` | Su porcentaje de comisión al calcular. |
  | `commissions` | Suma de sus comisiones del mes. |
  | `total` | `base_pay` más `commissions`. |

- **`public.payroll_items`**, una por servicio y empleado:

  | Columna | Qué es |
  |---|---|
  | `payroll_line_id` | La línea del empleado. |
  | `order_id`, `order_number`, `closed_at` | La orden y su cierre. |
  | `service_name`, `price` | El servicio y su valor en la orden. |
  | `share_pct` | La participación del empleado. |
  | `commission` | `numeric(14,4)`, sin redondear. |

- **Permisos:** RLS con lectura para el administrador. Sin `insert/update/delete` para
  `authenticated`: solo escriben las funciones (RN-07).

### Cálculo (RN-01 a RN-05, RN-09)

- **Funciones (`stable`, privadas):**
  - `private.payroll_items_live(p_month date)`: cada servicio de las órdenes cerradas en el mes
    (fecha de cierre en Colombia, como `private.report_lines` de la 015), con la participación de
    cada empleado. La comisión es `price × share_pct × commission_pct ÷ 10 000` con la comisión
    actual del empleado; el descuento no cuenta (RN-03).
  - `private.payroll_lines_live(p_month date)`: por empleado, días activos (de los periodos),
    `month_days`, `base_pay = round(base_salary × active_days ÷ month_days)`,
    `commissions = round(sum(commission))` y el total.
- **Quién entra (CA-10):** quien tenga días activos o comisiones en el mes.
- **Redondeo:** cada valor al peso más cercano, una sola vez por empleado (suposición de la spec).

### Funciones públicas (todas `security definer`, solo administrador)

Todas rechazan a cualquier otro con `payroll_admin_only` (`42501`), con `revoke` de `public` y
`anon` y `grant` a `authenticated`.

| Función | Qué hace |
|---|---|
| `payroll_month(p_month)` | El estado del mes: `provisional` o `closed`; quién la cerró o regeneró y cuándo; `previous_total`; `changed_since_close`; `can_close`. |
| `payroll_lines(p_month)` | Las líneas: de la copia si está cerrada, calculadas si no (CA-05, CA-12, CA-15). |
| `payroll_items(p_month, p_employee)` | El detalle de un empleado, de la misma forma (CA-11). |
| `close_payroll(p_month)` | Cierra el mes. |
| `regenerate_payroll(p_month)` | Regenera un mes cerrado. |

- **Hubo cambios (CA-17):** `changed_since_close` compara la copia con el cálculo de ahora, en
  líneas y en detalle, en las dos direcciones (`except`). Es verdadero exactamente cuando
  regenerar daría otro resultado: una orden corregida o anulada, o un salario base o una comisión
  distintos.
- **`can_close`:** el mes ya terminó, según `private.agenda_now()` en Colombia (RN-06), y no está
  cerrado.
- **`close_payroll`:**
  - bloquea por mes con `pg_advisory_xact_lock`, para que dos cierres a la vez no se pisen;
  - rechaza un mes no terminado (`payroll_month_open`) o ya cerrado (`payroll_already_closed`);
  - guarda la cabecera, las líneas y el detalle desde las funciones `live`.
- **`regenerate_payroll`:** solo para un mes cerrado (`payroll_not_closed`). Borra y vuelve a
  escribir líneas y detalle, y guarda `previous_total`, `regenerated_by` y `regenerated_at`
  (CA-16).
- **El reloj:** `private.agenda_now()` (spec 012), que pgTAP sustituye por una hora fija.

### Seeds

- `seeds/04_catalogs.sql`:
  - salario base de ejemplo: Elkin $ 1.423.500, Paula $ 1.300.000, Diego 0;
  - `created_at` y el periodo de los tres se adelantan 90 días;
  - Diego, desactivado hace 20 días, para que el mes anterior tenga un salario parcial.
- No hay liquidaciones cerradas en los seeds (las E2E cierran la suya).

### pgTAP `15_payroll.test.sql`, con datos propios y reloj fijo

- **Esquema:** columna `base_salary` (check, default 0) y privilegios; RLS de las tablas nuevas;
  sin escritura directa; `anon` sin funciones.
- **Periodos:** el *trigger* al registrar, desactivar y reactivar; el relleno de los existentes.
- **Cuentas:**
  - comisión `100 000 × 50 % × 30 % = 15 000`;
  - el descuento no cuenta;
  - fuera las abiertas y las anuladas, y la corregida con sus valores;
  - extremos del mes en Colombia.
- **Días:** mes completo; registrado a mitad de mes; desactivado a mitad; reactivado (dos
  periodos); los días del mes (28, 30, 31); redondeo.
- **Quién entra:** sin días ni comisiones no aparece; desactivado con comisiones sí.
- **Cierre:**
  - un mes en curso se rechaza; el cerrado queda fijo aunque cambie una orden, el salario o la
    comisión;
  - `changed_since_close` se enciende;
  - cerrar dos veces se rechaza;
  - regenerar recalcula y guarda `previous_total`.
- **Permisos:** el operador y el cliente reciben `payroll_admin_only`; el operador no lee
  `base_salary`.

## Aplicación (apps/web)

### Empleados (HU-01)

- **Esquema:** `employee.schema.ts` gana `base_salary`, en pesos como el precio de un servicio
  (`parsePesos`: «1.300.000» → 1300000), obligatorio, entero y de 0 o más (CA-01, CA-02).
- **Formulario:** `employee-form` gana el campo «Salario base», con formato de miles como el
  precio de los servicios.
- **Acción:** `saveEmployee` envía `p_base_salary`.
- **Ficha y listado:** `employees.server` lo lee en `details`. La ficha y la tabla del
  administrador lo muestran junto a la comisión (el operador no recibe `details`, spec 007).

### Módulo `reports` (se amplía)

- **`utils/payroll-month.utils.ts`:**
  - lee `?month=AAAA-MM`; lo inválido es el mes en curso;
  - mes anterior y siguiente, sin pasar del mes en curso;
  - el nombre («Noviembre de 2026»).
- **`api/payroll.server.ts`:** `getPayrollMonth`, `getPayrollLines` y `getPayrollItems`, con la
  sesión del administrador.
- **`actions/payroll.actions.ts`:** `closePayroll` y `regeneratePayroll`, con
  `getActiveAdmin()`. Los errores se traducen (`payroll_month_open`, `payroll_already_closed`,
  `payroll_not_closed`, `payroll_admin_only`). Se llaman con `callAction` y avisan con `notify`.
- **`utils/payroll-workbook.lib.ts`:** `buildPayrollWorkbook(lines, items, labels)` arma dos hojas,
  «Resumen» y «Detalle». `payrollFileName(month, provisional)` da
  `liquidacion-2026-11.xlsx` o `liquidacion-2026-11-provisional.xlsx` (CA-18, CA-19).
- **Componentes:**
  - **`reports-tabs` (molécula):** «Servicios» | «Liquidación», enlaces con `aria-current`, en las
    dos pantallas de «Reportes» (RF-02).
  - **`payroll-screen` (organismo):**
    - el mes con «Mes anterior» y «Mes siguiente» (enlaces);
    - el estado: «Provisional», o «Cerrada el … por …» y, si la hubo, la regeneración;
    - el aviso «Hubo cambios después del cierre» (CA-17);
    - la tabla en escritorio y una tarjeta por empleado en el teléfono: días, base del mes,
      comisiones y total, y cada fila abre el detalle;
    - el total del mes y el estado vacío (CA-13);
    - «Cerrar liquidación» o «Regenerar», con `ConfirmDialog`, y «Exportar a Excel».
  - **`payroll-employee-detail` (organismo):** cómo se llegó a la base («15 de 30 días de
    $ 1.300.000 = $ 650.000») y la lista de servicios con su comisión, con el mismo cálculo
    a la vista (CA-11).
- **Mensajes:** `reports.payroll.*` en `messages/es.json`.

### Rutas

- `src/app/(app)/reports/payroll/page.tsx`, con `loading.tsx` (`list`). El administrador la ve; los
  demás, `NoPermission` (CA-20).
- `src/app/(app)/reports/payroll/[employeeId]/page.tsx`, con `loading.tsx` (`detail`).
- `src/app/(app)/reports/payroll/export/route.ts`: `getActiveAdmin()` o 403, y el Excel del mes.
- `/reports` sigue llevando a «Servicios»; las pestañas llevan a «Liquidación».

### Inicio

En el mosaico «Reportes» cambia el texto («Servicios hechos y liquidación de los empleados…»).
«Muy pronto» pasa a decir «Reporte de clientes.», lo siguiente del backlog.

## Estrategia de pruebas

| Criterio | Tipo | Prueba |
|---|---|---|
| CA-01, CA-02 | unit + comp. + e2e | `employee.schema` (salario base); `employee-form` (campo y error); E2E: el administrador lo fija. |
| CA-03 | pgTAP | `default 0` de los existentes. |
| CA-04 | pgTAP | El operador no lee ni escribe `base_salary`. |
| CA-05 | pgTAP + comp. + e2e | `payroll_lines`; `payroll-screen` (columnas, total del mes); E2E. |
| CA-06, CA-07 | pgTAP + comp. | Cuenta de la comisión sin descuento; el detalle muestra la cuenta. |
| CA-08 | pgTAP | Extremos del mes en Colombia, abiertas y anuladas fuera, corregida. |
| CA-09 | pgTAP + comp. | Días proporcionales (registro, desactivación, reactivación); «15 de 30 días». |
| CA-10 | pgTAP | Quién entra y quién no. |
| CA-11 | comp. + e2e | `payroll-employee-detail`; E2E abre un empleado. |
| CA-12 | comp. | «Provisional» mientras no se cierra. |
| CA-13 | comp. | Mes vacío. |
| CA-14 | pgTAP + unit + e2e | `close_payroll` (mes en curso rechazado, copia guardada); acción; E2E cierra un mes. |
| CA-15 | pgTAP | La copia no cambia al corregir una orden, el salario o la comisión. |
| CA-16 | pgTAP + unit + e2e | `regenerate_payroll` y `previous_total`; acción; E2E regenera. |
| CA-17 | pgTAP + comp. | `changed_since_close`; el aviso en la pantalla. |
| CA-18, CA-19 | unit + e2e | `payroll-workbook.lib` (hojas, tipos, nombre); route handler; E2E descarga. |
| CA-20 | pgTAP + unit + e2e | `payroll_admin_only`; las acciones y la descarga rechazan; el operador ve «No tienes permiso». |

Además:

- **`payroll-month.utils`:** mes por defecto, anterior y siguiente, nombre.
- **Accesibilidad:** `a11y.spec.ts` (liquidación, detalle y diálogo de cierre, en claro y oscuro).
- **Móvil:** `ui.spec.ts`, la liquidación en el iPhone.
- **Esqueletos:** `loading-coverage.test.ts` con las dos rutas.
- **E2E:** cierra el mes anterior y luego lo regenera. Al terminar borra su liquidación con la
  clave secreta, para poder repetirse.

Cada prueba nueva se ve fallar con una mutación, que se anota en `tasks.md`.

## Archivos afectados

- **Nuevos:**
  - la migración y `15_payroll.test.sql`;
  - en `reports`: `payroll.server`, `payroll.actions`, `payroll-month.utils`,
    `payroll-workbook.lib`, `reports-tabs`, `payroll-screen` y `payroll-employee-detail`;
  - las rutas `/reports/payroll`, `/reports/payroll/[employeeId]` y `/reports/payroll/export`,
    cada pantalla con su `loading.tsx`;
  - sus pruebas y `e2e/payroll.spec.ts`.
- **Modificados:**
  - `database.types.ts` y `seeds/04_catalogs.sql`;
  - en `employees`: el esquema, el formulario, la ficha y la tabla, la acción y
    `employees.server`;
  - `services-report-screen` (pestañas) y los mensajes de `reports` y `auth`;
  - `a11y.spec.ts`, `ui.spec.ts` y `loading-coverage.test.ts`;
  - `CLAUDE.md`.
- **Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Detalles de la implementación

- La prueba pgTAP de catálogos (`09_catalogs`) borra también los periodos activos antes de vaciar
  `employees`.
- En el teléfono, el nombre del mes va arriba y «Mes anterior» y «Mes siguiente» debajo, uno a
  cada lado; desde `sm`, todo en una fila.
- «Exportar a Excel» solo aparece si hay empleados que liquidar; el detalle de un empleado que no
  está en la liquidación de ese mes responde «no encontrado».
- La E2E de empleados fija y corrige el salario base (CA-01) y comprueba que el operador no lo ve
  (CA-04).

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Periodos activos mantenidos por un *trigger*. | Contar desde `created_at` hasta `disabled_at`. | Un empleado reactivado tendría mal sus días; el *trigger* no depende de qué pantalla lo cambie. |
| Copia fija de líneas y detalle al cerrar. | Guardar solo totales. | El detalle de un mes cerrado debe seguir igual (CA-15) y explicar el total. |
| «Hubo cambios» comparando la copia con el cálculo de ahora. | Marcar cambios desde los *triggers* de órdenes y empleados. | Es exacto (avisa solo si regenerar cambiaría algo) y no toca las funciones de la spec 008. |
| Comisión con el porcentaje actual al calcular (RN-09). | Copiar el porcentaje en cada orden. | Lo aprobó la spec; el cierre fija el valor usado. |
| Mes elegido con «anterior» y «siguiente». | Un selector de mes del navegador. | Safari de escritorio no tiene `type="month"`; los enlaces son accesibles y van en la dirección. |

## Despliegue

Primero la migración, que llega con `db-deploy` al entrar en `develop`, y después la app. En
producción, el administrador fija los salarios base, que empiezan en 0. Sin variables nuevas.
