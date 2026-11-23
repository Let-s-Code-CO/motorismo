---
spec: "015"
estado: aprobado
actualizado: 2026-11-23
---

# Plan técnico — 015 Reporte de servicios

## Resumen

- **Base:** dos funciones `security definer`, solo para el administrador, sobre los servicios de las
  órdenes cerradas:
  - `service_report`, las filas, paginadas;
  - `service_report_totals`, los totales del filtro entero.

  Comparten un mismo conjunto filtrado (`private.report_lines`), así las filas, los totales y el
  Excel nunca difieren (RF-02).
- **Pantalla:** «Reportes» → «Servicios» (`/reports/services`), con los filtros en la dirección.
- **Exportar:** un *route handler* arma el Excel en el servidor con `write-excel-file`.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 015 aprobada. |
| II. Qué antes que cómo | ✅ | Funciones, rutas y librería se deciden aquí. |
| III. Criterios verificables | ✅ | pgTAP para filtros, totales y permisos; unitarias para filtros, libro de Excel y pantalla; E2E del flujo y la descarga. |
| IV. Ambigüedad explícita | ✅ | Sin preguntas abiertas. |
| V. Simplicidad y stack | ✅ | Una dependencia nueva, justificada abajo. |
| VI. Seguridad y datos personales | ✅ | Solo el administrador, comprobado en la base (las funciones) y en el servidor (página y descarga). |
| VII. Trazabilidad | ✅ | Rama `feature/015-reporte-servicios`. |
| VIII. Incrementos pequeños | ✅ | Consultar (HU-01) y exportar (HU-02) en un PR pequeño. |

## Base de datos (packages/supabase)

Una migración: `<ts>_service_report.sql`. No crea tablas.

### `private.report_lines`

`private.report_lines(p_from date, p_to date, p_employee uuid, p_plate text)` devuelve el conjunto
filtrado:

- **Qué entra:** una fila por línea de orden cerrada (`status = 'closed'`), ni abiertas ni
  anuladas (CA-07, RN-01).
- **Rango:** `(closed_at at time zone 'America/Bogota')::date between p_from and p_to`, con los dos
  extremos incluidos (CA-02).
- **Empleado:** `p_employee`, opcional, exige que exista su participación en la línea (CA-03).
- **Placa:** `p_plate`, opcional, se normaliza a mayúsculas sin guiones ni espacios y se compara
  entera con la placa del vehículo (CA-04).

### `public.service_report`

`public.service_report(p_from, p_to, p_employee, p_plate, p_limit integer default null,
p_offset integer default 0)` devuelve las filas (CA-01, CA-11):

- **Columnas:** `line_id`, `order_id`, `order_number`, `closed_at`, `customer_name`,
  `vehicle_type`, `brand_name`, `line_name`, `plate`, `service_name`, `price` y `employees`
  (`jsonb` `[{ name, share }]`, ordenado por participación).
- **Orden:** por `closed_at` descendente, luego `order_number` y la posición de la línea.
- **Sin límite:** sin `p_limit` (nulo por defecto) devuelve todas las filas, para el Excel; la
  pantalla pasa 50. Así los tipos generados no necesitan aceptar un `null` explícito.

### `public.service_report_totals`

`public.service_report_totals(mismos filtros)` devuelve:

- `services` (cuántas filas) y `subtotal` (suma de valores);
- `discounts`: la suma de los descuentos de las órdenes distintas que aparecen;
- `total`: `subtotal − discounts`.

Con `p_employee`, `discounts` y `total` son nulos (CA-06, RN-03).

### Permisos y pruebas

- **Permisos:** las dos funciones exigen `is_admin()` (`report_admin_only`, `42501`), con
  `revoke` de `public` y `anon` y `grant` a `authenticated` (RN-04, CA-09, CA-14).
- **Índice:** sobre `work_orders (status, closed_at)` para el rango.
- **Seeds:** sin cambios. Las órdenes cerradas de la spec 008 bastan, y la migración lleva
  `-- seeds: unchanged`.
- **pgTAP `14_service_report.test.sql`**, con datos propios:
  - el rango con extremos en hora de Colombia (una orden cerrada a las 11:30 p. m. del último día
    entra, una de las 12:10 a. m. siguiente no);
  - abiertas y anuladas fuera, la corregida con sus valores;
  - el filtro de empleado, con y sin participación;
  - la placa con guion y minúsculas;
  - la combinación de filtros, el orden y la paginación;
  - los totales con y sin empleado y la cuenta de cada uno;
  - el operador y el cliente rechazados, y `anon` sin privilegios.

## Aplicación (apps/web)

### Módulo `src/modules/reports/`

- **`schemas/reports.schema.ts`:** `reportFiltersSchema`, que lee la dirección (`from`, `to`,
  `employee`, `plate`, `page`).
  - Por defecto, el mes en curso hasta hoy (`todayIn`).
  - Fechas inválidas, o `from` después de `to`, vuelven a los valores por defecto.
  - La placa se normaliza.
- **`api/reports.server.ts`:** `getServiceReport(filters)` (filas y totales en paralelo) y
  `listReportEmployees()` (todos los empleados, también desactivados, para el filtro). Los tipos se
  derivan de `Database['public']['Functions']…`, con `WithNulls` para las columnas que pueden ser
  nulas (`line_name`, `plate`), como en la 014.
- **`utils/services-workbook.lib.ts`:**
  - `buildServicesWorkbook(rows, totals, labels)`, una función pura que arma las celdas: fecha
    como `Date` con formato, valores como `Number` con formato de pesos, empleados como texto
    «Elkin Estrada 50 % · Paula Pineda 50 %» (CA-13), y los totales al final;
  - `workbookFileName(from, to)`.
- **`utils/report-query.utils.ts`:** arma la dirección de los filtros, de las páginas y de la
  descarga desde los mismos valores.
- **Componentes:**
  - `report-filters` (molécula): fechas, empleado con `Select` (los desactivados aparte, al final, en
    una sección «Desactivados»; `id` fijo porque se pinta en el servidor) y placa. Los cambios van a la
    dirección con `router.replace` y la placa espera 300 ms, como la búsqueda de Clientes.
  - `services-report-screen` (organismo): título, filtros, «Exportar a Excel» (un enlace al route
    handler con los filtros), la tabla en escritorio y tarjetas en el teléfono (cada fila lleva a
    `/orders/{id}`, CA-10), totales, paginación y el estado vacío con «Quitar filtros» (CA-08).
- **Mensajes:** `messages/es.json`, con el namespace `reports`.

### Rutas

- `src/app/(app)/reports/page.tsx` redirige a `/reports/services`.
- `src/app/(app)/reports/services/page.tsx`, con su `loading.tsx` (`list`):
  - un cliente o un operador ven `NoPermission` (CA-09);
  - para el administrador, `reportFiltersSchema.parse(searchParams)`, luego `getServiceReport` y
    `listReportEmployees`.
- `src/app/(app)/reports/services/export/route.ts` (GET):
  - `getActiveAdmin()`; si no lo es, responde 403 (CA-14);
  - lee los filtros con el mismo esquema y llama a `service_report` sin límite y a
    `service_report_totals`;
  - responde con `write-excel-file/node`, en un *buffer*, con el tipo de Excel y
    `Content-Disposition` con el nombre del periodo (CA-12).

### Navegación

`NAV_LINKS` añade `{ href: '/reports', key: 'reports', icon: FileSpreadsheet, audiences:
['admin'] }`, con sus textos en `auth.header` y `auth.home`. El inicio del personal también lleva
su mosaico.

## Estrategia de pruebas

| Criterio | Tipo | Prueba |
|---|---|---|
| CA-01 | pgTAP + comp. + e2e | Columnas y orden; la pantalla muestra cada campo; E2E del administrador. |
| CA-02 | pgTAP + unit | Extremos del rango en hora de Colombia; `reportFiltersSchema` (por defecto el mes, fechas inválidas). |
| CA-03 | pgTAP + comp. | Filtro de empleado (incluido uno desactivado en la lista). |
| CA-04 | pgTAP + unit | Placa con guion y minúsculas; normalización. |
| CA-05 | unit + e2e | `report-query.utils` (ida y vuelta de la dirección); E2E: recargar conserva los filtros. |
| CA-06 | pgTAP + comp. | Totales con y sin empleado; la pantalla sin descuentos con filtro de empleado. |
| CA-07 | pgTAP | Abiertas y anuladas fuera; corregida con sus valores. |
| CA-08 | comp. | Vacío con «Quitar filtros». |
| CA-09 | pgTAP + e2e | `report_admin_only` para el operador y el cliente; el operador no ve «Reportes» y la dirección responde «No tienes permiso». |
| CA-10 | comp. | Cada fila enlaza a `/orders/{id}`. |
| CA-11 | pgTAP + comp. | Paginación con `p_offset`; totales del filtro entero; enlaces de página. |
| CA-12 | unit + e2e | `buildServicesWorkbook` (columnas y totales), `workbookFileName`; E2E: la descarga se llama por el periodo y no está vacía. |
| CA-13 | unit | Las celdas tienen tipo `Date` y `Number` con su formato. |
| CA-14 | unit + e2e | El route handler responde 403 a quien no es administrador; E2E del operador pidiendo la descarga. |

Además:

- **Accesibilidad:** `a11y.spec.ts` añade el reporte con filtros, en claro y oscuro.
- **Móvil:** `ui.spec.ts` lo añade a la prueba del iPhone, sin desplazamiento lateral.
- **Esqueletos:** `loading-coverage.test.ts` incluye la ruta nueva.

Cada prueba nueva se ve fallar con una mutación, que se anota en `tasks.md`.

## Archivos afectados

- **Nuevos:**
  - la migración y `14_service_report.test.sql`;
  - el módulo `reports`;
  - las rutas `/reports`, `/reports/services` (con `loading.tsx`) y `/reports/services/export`;
  - sus pruebas y `e2e/reports.spec.ts`.
- **Modificados:**
  - `database.types.ts` (generado);
  - `nav.constants.ts`, los mensajes de `auth` y `src/i18n/messages.ts`;
  - las pruebas de navegación (el administrador ve «Reportes»);
  - `a11y.spec.ts`, `ui.spec.ts` y `loading-coverage.test.ts`;
  - `apps/web/package.json` (dependencia);
  - `CLAUDE.md` (sección del reporte).
- **Eliminados:** ninguno.

## Dependencias nuevas

- **`write-excel-file` (4.1.1, MIT)** escribe `.xlsx` con fechas y números con formato. Tiene una
  sola dependencia (`fflate`), está mantenida (junio de 2026) y funciona en Node. Solo se usa en el
  route handler.
- **Descartadas:**
  - `exceljs`: nueve dependencias (`archiver`, `jszip`, `tmp`…) y sin versión desde 2024;
  - SheetJS (`xlsx`): la versión de npm está abandonada y la nueva se instala desde su propio CDN;
  - escribir el XML de Excel a mano: hace falta comprimirlo igual y es frágil;
  - CSV: el usuario eligió Excel.

## Detalles de la implementación

- «Exportar a Excel» solo aparece si hay servicios (no hay nada que llevarse).
- Si se elige un «Desde» posterior a «Hasta» (o al revés), la otra fecha se mueve con ella: el
  periodo nunca queda al revés.
- La placa del filtro guarda como mucho 10 caracteres.
- `/reports` lleva a `/reports/services` (la liquidación llegará a la misma sección).
- Índice `work_orders (status, closed_at)` para el rango.
- El `Select` de empleados lleva un `id` fijo (se pinta en el servidor; sin él, la hidratación
  falla) y los desactivados aparte, al final.
- `reports.server.test.ts` prueba cómo llegan los filtros a las funciones (empleado, placa,
  `p_offset`, sin límite para el Excel).

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Funciones `security definer` solo para el administrador. | Leer `work_order_summaries` y las tablas con la sesión. | El operador ya lee las órdenes (spec 008), pero el reporte es del administrador (RN-04): la función lo exige en la base y el conjunto filtrado es uno solo para filas, totales y Excel. |
| El Excel se arma en el servidor (route handler). | Armarlo en el navegador. | Siempre trae todo el filtro (no solo la página), revisa el permiso en el servidor (CA-14) y no carga la librería en el navegador. |
| Paginación por `offset` de 50. | Por cursor. | Un mes son cientos de filas; `offset` permite ir a cualquier página y es lo que ya hace «Órdenes». |
| La placa se compara entera, normalizada. | Coincidencia parcial. | Suposición aprobada de la spec; evita mezclar vehículos. |

## Despliegue

Primero la migración, que llega con `db-deploy` al entrar en `develop`; después la app. Sin
variables nuevas.
