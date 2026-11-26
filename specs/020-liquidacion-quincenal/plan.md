---
spec: "020"
estado: aprobado
actualizado: 2026-11-26
---

# Plan técnico — 020 Liquidación quincenal y por rango de fechas

## Resumen

La liquidación de la spec 016 deja de calcularse por mes. Ahora se calcula para un periodo `[desde, hasta]`
y un método de salario base: «Mes comercial» o «Días reales».

- **Base de datos:** las funciones de la spec 016 pasan a recibir ese periodo y ese método. El periodo se
  parte en quincenas o en trozos de quincena, y cada trozo aporta su salario base con el método elegido
  (RN-02). Las comisiones se calculan como hoy. El cierre guarda quincenas, no meses, junto con el
  método con que se cerró.
- **App:** «Liquidación» lee el periodo y el método de la dirección (`?fortnight=` o `?from=&to=`, y
  `&base=`). Reutiliza los campos de fechas del reporte de servicios, extraídos a un componente
  compartido.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 020 `aprobada`; cambia el periodo de la spec 016 y la enmienda al implementarla (HU-02, HU-03 y HU-04 de la 016, por quincena). |
| II. Qué antes que cómo | ✅ | La spec no nombra tablas ni componentes; este plan decide el cómo. |
| III. Criterios verificables | ✅ | Cada CA tiene su prueba (tabla de abajo); las cuentas de CA-14 y CA-15 se prueban con números en pgTAP. |
| IV. Ambigüedad explícita | ✅ | Los dos huecos se resolvieron con el usuario al aprobar el plan (CA-08 y CA-16 precisados). |
| V. Simplicidad y stack | ✅ | Sin dependencias nuevas. Las mismas funciones `security definer` de la 016, con periodo y método; los campos de fechas, compartidos con el reporte de servicios. |
| VI. Seguridad y datos personales | ✅ | Salario y comisión siguen solo para el admin: lo comprueban la página, la acción, la descarga y cada función (`payroll_admin_only`); las tablas siguen solo de lectura para el admin (RLS). |
| VII. Trazabilidad | ✅ | Pruebas y comentarios citan `spec 020, CA-xx`; enmiendas en la spec 016. |
| VIII. Incrementos pequeños | ✅ | La quincena (HU-01, HU-03, HU-04) sola ya sirve; el rango (HU-02) y el Excel (HU-05) se apoyan en lo mismo. |

## Base de datos (packages/supabase)

### Migración nueva: `<timestamp>_payroll_fortnight.sql`

**Cierres por quincena.** Según las Suposiciones de la spec, ningún cierre mensual es real, así que no
hay datos que conservar. La migración borra `payroll_items`, `payroll_lines` y `payrolls` y las crea de
nuevo, con las mismas RLS y los mismos privilegios: solo el admin lee, nadie escribe directamente.

- **`payrolls`:**
  - `period_start date unique`, con `check` de día 1 o 16;
  - `period_end date`, con `check` de que es el fin de esa quincena (el 15, o el último día del mes);
  - `base_method text`, con `check in ('commercial', 'actual')` (CA-16);
  - lo demás igual que en la 016: `total`, cerrado y regenerado por y cuándo, `previous_total`.
- **`payroll_lines`:** como en la 016, cambiando `month_days` por estas columnas:
  - `period_days`: los días de la quincena (13 a 16);
  - `paid_days`: los días que paga el método; en mes comercial, 15 o los días activos (como mucho 15);
    en días reales, los días activos;
  - `divisor`: 30 en mes comercial, o los días del mes en días reales.

  Así, el detalle de una quincena cerrada explica su salario con lo guardado (CA-04, CA-12).
- **`payroll_items`:** sin cambios de forma.

**Cálculo** (privado, `stable`, `search_path = ''`):

- **`private.payroll_base_parts_live(p_from, p_to, p_method)`:** por empleado, los trozos del periodo
  cortados por quincena. Cada trozo da `part_from` y `part_to`, `part_days`, `active_days` (RN-03, como
  `active_days` de la 016 pero entre dos fechas), `paid_days`, `divisor` y el `amount` sin redondear:
  - **Mes comercial:** si el trozo es la quincena entera y el empleado estuvo activo todos sus días,
    `paid_days = 15`; si no, `least(active_days, 15)`. El divisor es 30. Así, la 2.ª quincena de
    febrero o de un mes de 31 días completa paga la mitad (CA-14).
  - **Días reales:** `paid_days = active_days` y el divisor son los días del mes del trozo (CA-14, CA-15).
- **`private.payroll_items_live(p_from, p_to)`:** el de la 016, con el día de cierre en Colombia entre
  las dos fechas, ambas incluidas (CA-02, CA-07).
- **`private.payroll_lines_live(p_from, p_to, p_method)`:** el de la 016.
  - Suma los `amount` de los trozos y redondea una vez por empleado (RN-05 de la 016).
  - Aparecen los empleados con algún día activo en el periodo o con comisiones en él (CA-04).
- **`private.payroll_write(p_payroll)`** y **`private.payroll_changed(p_payroll)`:** leen periodo y
  método de la fila de `payrolls`. «Hubo cambios» compara la copia con el cálculo de ahora hecho con el
  método con que se cerró (CA-12).

**API pública** (`security definer`, admin, `payroll_admin_only`):

- **Lectura:**
  - `payroll_period(p_from, p_to, p_method)` responde:
    - `kind`: `fortnight` si `[desde, hasta]` es una quincena exacta; si no, `range`;
    - `status`: `provisional`, `closed` o `query` (un rango, CA-08);
    - `method`: el guardado si está cerrada; si no, el pedido;
    - `total`, quién cerró o regeneró y cuándo, `previous_total`, `changed_since_close`;
    - `can_close`: una quincena terminada y sin cerrar (RN-04).
  - `payroll_lines(p_from, p_to, p_method)` y `payroll_items(p_from, p_to, p_employee)` devuelven la copia
    si la quincena está cerrada; si no, el cálculo de ahora.
  - `payroll_base_parts(p_from, p_to, p_method, p_employee)`: cómo se llegó al salario base. Una
    quincena cerrada da su único trozo guardado.
- **Escritura:**
  - `close_payroll(p_start, p_method)` (CA-11) responde `payroll_not_fortnight` si el día no es 1 ni 16,
    `payroll_period_open` si la quincena no ha terminado (`private.business_today()`) y
    `payroll_already_closed` si ya está cerrada. Usa el mismo `pg_advisory_xact_lock` de la 016.
  - `regenerate_payroll(p_start, p_method)` vuelve a calcular con el método que recibe y lo guarda
    (CA-16). Si la quincena no está cerrada, responde `payroll_not_closed`.
- **Validación:**
  - un método distinto de los dos responde `payroll_method_invalid`;
  - `desde` > `hasta` responde `payroll_period_invalid` (la app nunca lo envía: CA-09 se resuelve
    antes).
- **Lo que sale:** las funciones de mes (`payroll_month`, `payroll_lines(date)`, `payroll_items(date,
  uuid)`, `close_payroll(date)`, `regenerate_payroll(date)` y las privadas de mes).
- **Privilegios:** `revoke … from public, anon`; `grant … to authenticated, service_role`.

**Seeds:** sin cambios (`-- seeds: unchanged — no seed closes a payroll`). `09_catalogs.test.sql` ya
vacía los periodos activos y sigue igual.

### pgTAP: `15_payroll.test.sql`, reescrito por quincena

El reloj se fija con `test.now`.

- **Esquema, RLS y privilegios:** tablas y columnas nuevas, `check` del día 1 o 16 y del método, RLS,
  privilegios de tablas y funciones, y que las funciones de mes ya no existen.
- **CA-02:** una orden cerrada el 15 a las 11:59 p. m. de Colombia cuenta en la 1.ª quincena, y una
  del 16 a las 00:00, en la 2.ª.
- **CA-03 y CA-15:** un empleado activo toda la quincena; otro que empezó a mitad; otro desactivado y
  reactivado. Se comprueban días activos y salario, con su cuenta en la descripción.
- **CA-14:** 2.ª quincena de un mes de 31 días: la mitad, o salario × 16 ÷ 31. 2.ª quincena de
  febrero completa: la mitad. 1.ª quincena completa por días reales: salario × 15 ÷ días del mes.
- **CA-07 y RN-02:** un rango del 3 al 20 da dos trozos (13 y 5 días), comisiones entre las dos fechas
  y un redondeo único.
- **CA-04:** aparece un empleado sin días activos pero con comisiones, y no aparece uno sin ninguna de
  las dos cosas.
- **CA-08 y RN-04:**
  - un rango responde `query` y no se puede cerrar;
  - la quincena en curso, tampoco (`payroll_period_open`);
  - un día 2 responde `payroll_not_fortnight`;
  - cerrar dos veces, `payroll_already_closed`.
- **CA-11, CA-12 y CA-16:**
  - cerrar guarda la copia con su método;
  - un cambio posterior enciende «hubo cambios»;
  - regenerar con el otro método guarda el método nuevo y el total anterior.
- **Permisos:** un operador y un cliente reciben `payroll_admin_only` en cada función; `anon` no tiene
  `execute`.

## Aplicación (apps/web)

**Módulo `reports`**:

- **Periodo** (`utils/payroll-period.utils.ts`, reemplaza a `payroll-month.utils`):
  - tipo `PayrollPeriod = { kind: 'fortnight'; start } | { kind: 'range'; from; to }` y
    `PayrollMethod = 'commercial' | 'actual'`;
  - `fortnightOf(hoy)`, `fortnightEnd`, `previousFortnight`, `nextFortnight` (se detiene en la de hoy) y
    `periodBounds` (las dos fechas del periodo);
  - `periodLabel`: «1.ª quincena de noviembre de 2026» o «Del 3 al 20 de noviembre de 2026»;
  - los enlaces: `payrollHref`, `payrollEmployeeHref` y `payrollExportHref`. El periodo va siempre en la
    dirección; el método, solo si no es el de por defecto (CA-10, CA-13).
- **Dirección** (`schemas/reports.schema.ts`, `payrollQuerySchema(hoy)`, Zod):
  - si `from` y `to` son válidos y en orden, es un rango (CA-06);
  - si no, una `fortnight` válida (`AAAA-MM-1` o `AAAA-MM-2`) que no esté en el futuro;
  - si no, la quincena en curso (CA-09). Un `?month=` viejo de la spec 016 cae ahí;
  - `base`: `actual` o, por defecto, `commercial`.
- **Servidor** (`api/payroll.server.ts`): `getPayrollPeriod`, `getPayrollLines`, `getPayrollItems` y
  `getPayrollBaseParts`, sobre las funciones nuevas.
- **Acciones** (`actions/payroll.actions.ts`):
  - `closePayroll` y `regeneratePayroll` reciben `{ start, method }`, validados con Zod;
  - siguen con `getActiveAdmin`, `callAction`, `notify` y `revalidatePath`;
  - el traductor de errores suma `notFortnight`, `periodOpen` y `methodInvalid`.
- **Componentes:**
  - `molecules/date-range-fields.component.tsx` (nuevo): los dos campos «Desde» y «Hasta» con la regla
    de que el rango nunca queda al revés. Se extraen de `report-filters` y los usan el reporte de
    servicios y la liquidación (Suposiciones de la spec).
  - `molecules/payroll-period-bar.component.tsx` (nuevo): el periodo y cómo cambiarlo, en este orden:
    1. en una quincena, «‹ Quincena anterior» y «Quincena siguiente ›» alrededor de su nombre (CA-01);
    2. en un rango, «Consulta» y el enlace «Volver a la quincena en curso» (CA-08);
    3. los campos de fechas, que en una quincena muestran sus dos fechas: al cambiar una, se pasa a
       rango (CA-06);
    4. el método: un `RadioGroup` horizontal, «Mes comercial» o «Días reales» (CA-13).

    Navega con `useUrlFilters`, como el reporte de servicios.
  - `organisms/payroll-screen.component.tsx`:
    - la barra de periodo y el estado: «Provisional», «Cerrada el … por …», «Consulta» y el método con
      que se calculó;
    - si está cerrada con un método y se elige el otro, el aviso «Al regenerar se calculará por …»
      (CA-16);
    - la columna «Días activos» como «12 de 15», sobre los días del periodo;
    - «Cerrar liquidación» solo con `can_close`; «Regenerar» en una quincena cerrada;
    - el texto de «no hay a quién liquidar» (CA-05).
  - `organisms/payroll-employee-detail.component.tsx`: «Cómo se llegó al salario base» lista los trozos
    (CA-04):
    - mes comercial: «15 días de 30 · $ 711.750» o «10 días × $ 1.423.500 ÷ 30»;
    - días reales: «16 de 31 días · …»;
    - un rango, una línea por quincena que toca.
- **Rutas:**
  - `/reports/payroll` y `/reports/payroll/[employeeId]` leen `payrollQuerySchema` y siguen con su
    `loading.tsx`;
  - `/reports/payroll/export` (CA-17) arma el mismo libro y le pone encima de «Resumen» tres líneas:
    el periodo, el estado (provisional, cerrada o consulta) y el método. El nombre del archivo:
    - `liquidacion-2026-11-1a-quincena.xlsx`, y `…-provisional` si no está cerrada;
    - `liquidacion-2026-11-03-a-2026-11-20.xlsx` en un rango;
  - la columna «Días del mes» del libro pasa a «Días del periodo» (los días pagados de cada trozo se
    explican en el detalle del empleado, no en el libro).
- **Mensajes** (`messages/es.json`, `reports.payroll`):
  - quincena anterior y siguiente, «Consulta», «Volver a la quincena en curso»;
  - el método y su aviso, los trozos del salario base;
  - los errores nuevos y los textos del libro.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | unit + componente + e2e | `payroll-period.utils.test` (quincena de hoy, anterior y siguiente, nombres); `payroll-screen.component.test` (navegación, columnas, total); `payroll.spec.ts` |
| CA-02 | pgTAP | `15_payroll.test.sql` (11:59 p. m. del 15 frente a 00:00 del 16, en Colombia) |
| CA-03 | pgTAP | `15_payroll.test.sql` (toda la quincena; empezó, se desactivó y se reactivó a mitad) |
| CA-04 | pgTAP + componente | `15_payroll.test.sql` (quién aparece); `payroll-employee-detail.component.test` (trozos del salario base, servicios) |
| CA-05 | componente + e2e | `payroll-screen.component.test` («Provisional», sin empleados); `payroll.spec.ts` |
| CA-06 | componente + e2e | `date-range-fields.component.test`; `payroll-screen.component.test` (rango: mismas columnas y total); `payroll.spec.ts` (elegir fechas) |
| CA-07 | pgTAP | `15_payroll.test.sql` (rango del 3 al 20: dos trozos, ambos extremos incluidos) |
| CA-08 | pgTAP + componente + e2e | `15_payroll.test.sql` (`query`, sin cierre); `payroll-screen.component.test` («Consulta», sin «Cerrar», «Volver a la quincena en curso»); `payroll.spec.ts` |
| CA-09 | unit | `reports.schema.test` (`payrollQuerySchema`: rango al revés, fecha inexistente, quincena futura, `?month=` viejo → quincena en curso) |
| CA-10 | unit + e2e | `payroll-period.utils.test` (los enlaces llevan periodo y método); `payroll.spec.ts` (recargar mantiene el periodo) |
| CA-11 | pgTAP + unit + e2e | `15_payroll.test.sql`; `payroll.actions.test` (`{ start, method }`, errores); `payroll.spec.ts` (cerrar la quincena anterior) |
| CA-12 | pgTAP + componente + e2e | `15_payroll.test.sql` (copia, «hubo cambios» con el método guardado); `payroll-screen.component.test`; `payroll.spec.ts` (regenerar) |
| CA-13 | unit + componente + e2e | `reports.schema.test` (por defecto, comercial); `payroll-screen.component.test` (el método se ve y viaja en los enlaces); `payroll.spec.ts` |
| CA-14 | pgTAP | `15_payroll.test.sql` (mes de 31: mitad y × 16 ÷ 31; febrero completo: mitad) |
| CA-15 | pgTAP | `15_payroll.test.sql` (parte de la quincena: ÷ 30 por día, como mucho 15; días reales: × días ÷ días del mes) |
| CA-16 | pgTAP + componente | `15_payroll.test.sql` (guarda el método; regenerar con el otro); `payroll-screen.component.test` (lo muestra, avisa del cambio) |
| CA-17 | unit + ruta + e2e | `payroll-workbook.lib.test` (encabezado del periodo, estado, método, nombres de archivo); `payroll-export.route.test`; `payroll.spec.ts` (descarga) |
| RNF | e2e | `a11y.spec.ts` (barra de periodo, método y diálogos, en claro y oscuro); `ui.spec.ts` «on an iPhone» y 360 px (quincena y rango sin desplazamiento lateral) |

## Archivos afectados

- **Nuevos:**
  - `packages/supabase/supabase/migrations/<timestamp>_payroll_fortnight.sql`;
  - `apps/web/src/modules/reports/utils/payroll-period.utils.ts` y su prueba;
  - `apps/web/src/modules/reports/components/molecules/date-range-fields.component.tsx` y su prueba;
  - `apps/web/src/modules/reports/components/molecules/payroll-period-bar.component.tsx`.
- **Modificados:**
  - base de datos: `15_payroll.test.sql`, `types/database.types.ts` (generado);
  - módulo `reports`:
    - `reports.schema.ts`, `reports.types.ts`, `payroll.server.ts`;
    - `payroll.actions.ts`, `payroll-errors.utils.ts`, `payroll-workbook.lib.ts`;
    - `report-filters.component.tsx` (usa `DateRangeFields`), `payroll-screen.component.tsx` y
      `payroll-employee-detail.component.tsx`;
    - `messages/es.json`;
  - rutas: las tres de `/reports/payroll`;
  - sus pruebas unitarias, `e2e/payroll.spec.ts`, `a11y.spec.ts` y `ui.spec.ts`;
  - documentación: CLAUDE.md (sección de liquidación) y la spec 016 (enmiendas).
- **Eliminados:** `payroll-month.utils.ts` y su prueba.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Un periodo `[desde, hasta]` con un método para todas las funciones; la quincena es un caso del rango. | Funciones aparte para quincena y para rango. | Una sola cuenta: el rango (CA-07) y la quincena (CA-02) no pueden dar números distintos para los mismos días. |
| Salario base por trozos de quincena, con un único redondeo por empleado. | Calcular el rango como un todo (días ÷ 30). | RN-02 lo pide («cada quincena o parte que toca aporta lo suyo»), y así un rango que cubre quincenas completas suma lo mismo que esas quincenas. |
| Borrar y crear de nuevo las tablas de cierre. | `alter table` con conversión de meses. | Según las Suposiciones de la spec no hay cierres reales; convertir un mes en dos quincenas inventaría datos. El entorno remoto de `develop` aún no existe. |
| `paid_days` y `divisor` guardados en cada línea cerrada. | Guardar solo el monto. | El detalle de una quincena cerrada explica su salario con lo que se guardó, aunque el método o los días cambien después (CA-04, CA-12). |
| «Hubo cambios» compara con el método con que se cerró. | Compararla con el método elegido en pantalla. | Cambiar de método no es un cambio de datos; la pantalla lo dice aparte (CA-16). |
| Las fechas del rango con los campos de fecha del reporte de servicios, extraídos a `DateRangeFields`. | Un `DateRangePicker` de HeroUI. | Lo pide la spec («como en el reporte de servicios»); los campos nativos ya están probados en el teléfono y en la auditoría. |
| El método, en un `RadioGroup` dentro de la barra del periodo. | Un `Select`, un interruptor. | Dos opciones a la vista, con nombre propio y accesibles con el teclado. |

### Cambios a la spec (aprobados con el plan, ya en CA-08 y CA-16)

1. **Un rango que coincide exactamente con una quincena** (p. ej. del 1 al 15) se trata como esa
   quincena: provisional o cerrada, y se puede cerrar si terminó. Si no, los mismos días se verían
   como «Consulta» con cifras distintas de las de la quincena cerrada.
2. **Una quincena cerrada con otro método.** Cuando la dirección no dice el método, el selector
   empieza en el método con que se cerró. Así, lo que muestra el selector coincide con las cifras
   guardadas (CA-16).

## Despliegue

- Migración, después la app, en el mismo PR. La migración borra los cierres mensuales: el entorno
  remoto de `develop` aún no existe (CLAUDE.md de `packages/supabase`), así que no se pierde nada real.
- Sin variables de entorno nuevas ni flags.
