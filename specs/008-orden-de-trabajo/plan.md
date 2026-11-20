---
spec: "008"
estado: aprobado
actualizado: 2026-11-20
---

# Plan técnico — 008 Orden de trabajo

## Resumen

**Base de datos.** Cuatro tablas nuevas:
- `work_orders`, con número consecutivo, estado y descuento;
- `work_order_lines`, con nombre, valor y tiempo copiados al añadirse;
- `work_order_line_employees`, con la participación;
- `work_order_payments`.

Además, una columna nueva `services.estimated_minutes`.

**Escrituras.** Las tablas no admiten escrituras directas desde la API. Todo se escribe con cuatro
funciones `security definer` que comprueban en Postgres quién puede hacer qué en cada estado
(RN-05): `save_work_order`, `close_work_order`, `correct_work_order` y `void_work_order`. El
personal lee por RLS, y una vista `work_order_summaries` calcula subtotal, total, tiempo estimado y
lo que falta por estimar.

**App.** Un módulo `work-orders` con tres rutas: `/orders` (lista), `/orders/new` y
`/orders/[id]`. El editor usa `useFieldArray` de React Hook Form, con totales y estimado en vivo
calculados por utilidades puras y probadas. La ficha del cliente gana su historial.

No hay dependencias nuevas.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 008 `aprobada`, con las correcciones del usuario. |
| II. Qué antes que cómo | ✅ | La tecnología vive solo aquí. |
| III. Criterios verificables | ✅ | Cada CA tiene prueba (tabla). Las reglas de estado y permiso, también en pgTAP y sandbox. |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. |
| V. Simplicidad y stack | ✅ | Sin dependencias. Las funciones SQL concentran las reglas, en lugar de repartirlas entre políticas por tabla y la app. |
| VI. Seguridad y datos personales | ✅ | RLS en todas las tablas. Nadie escribe directo (sin `grant insert/update/delete`); las funciones comprueban rol y estado. Nadie borra una orden (RN-06). |
| VII. Trazabilidad | ✅ | Rama `feature/008-orden-de-trabajo`; pruebas con cabecera `spec 008, CA-xx`. |
| VIII. Incrementos pequeños | ✅ | Tres bloques, cada uno desplegable: A = P1 (abrir y cerrar), B = P2 (historial, lista completa, tiempos), C = P3 (corregir y anular). Si el PR resulta grande, cada bloque puede ir en su propio PR. |

## Base de datos (packages/supabase)

**Migración** `<ts>_work_orders.sql`, creada con `migration:new`. La 007 ya está aplicada en
remoto, así que no se edita.

### Catálogo (HU-06)

- `alter table services add column estimated_minutes smallint check (between 5 and 1440)`, nula
  por defecto (CA-26).
- `grant insert/update (estimated_minutes)` al rol `authenticated`. La RLS de la 007 ya limita la
  escritura al administrador.

### Enums

- `work_order_status`: `open`, `closed` y `voided`.
- `payment_method`: `cash`, `transfer`, `card` y `other`.

### Tablas

- **`work_orders`**:
  - `id uuid pk` y `number bigint generated always as identity unique`, que da «Orden #N» (RF-01);
  - `customer_id` y `vehicle_id`, con sus claves foráneas;
  - `status` (por defecto `open`);
  - `discount integer not null default 0 check (>= 0)`;
  - `notes text` (como mucho 500);
  - `opened_at`/`opened_by`, `closed_at`/`closed_by`, `voided_at`/`voided_by`/`void_reason` y
    `corrected_at`/`corrected_by`/`correction_reason`, que apuntan a `profiles`;
  - `check` de coherencia: `closed_*` solo si cerrada o anulada después de cerrar; `void_reason`
    obligatorio si está anulada.
  - **Índice único parcial** `(vehicle_id) where status = 'open'`: una orden abierta por vehículo (suposición de la spec).
- **`work_order_lines`**:
  - `id`, `work_order_id` y `position smallint`;
  - `service_id uuid null`: si es nulo, es «Otro»;
  - `name text` (de 1 a 120): el nombre del servicio copiado, o la descripción de «Otro»;
  - `price integer` de 0 a 10.000.000 (RN-02);
  - `estimated_minutes smallint null` de 5 a 1.440 (RN-11).
- **`work_order_line_employees`**:
  - `(line_id, employee_id)` como clave primaria;
  - `share_pct smallint` de 1 a 100.
  - La suma de 100 la comprueban las funciones (RN-03).
- **`work_order_payments`**: `id`, `work_order_id`, `method` y `amount integer` mayor que 0.

### Vista `work_order_summaries`

- Es `security_invoker`, así que hereda la RLS.
- Por orden da:
  - número, estado y fechas;
  - el cliente (nombre) y el vehículo (tipo, placa y marca/línea);
  - los nombres de los servicios;
  - `subtotal`, `discount` y `total`;
  - `estimated_minutes` (suma de las líneas estimadas) y `unestimated` (los nombres de las líneas sin tiempo, CA-30).
- La usan la lista, el historial y la ficha del cliente.

### Funciones

Todas son `security definer` con `set search_path = ''`, y comprueban `is_staff()` o `is_admin()` y
el estado. Los errores llevan una pista que la app traduce.

- **`save_work_order(p_customer_id, p_vehicle_id, p_lines jsonb, p_discount int default 0, p_notes text default null, p_id uuid default null) returns uuid`**:
  - **Sin `p_id`, abre una orden.** Rechaza:
    - un cliente desactivado o un vehículo retirado (`work_order_customer_disabled`, `work_order_vehicle_retired`, CA-10);
    - un vehículo de otro cliente;
    - un vehículo con otra orden abierta (`work_order_vehicle_busy`, con el número de esa orden).
  - **Con `p_id`, edita** una orden abierta (CA-08). Una cerrada da `work_order_not_open`.
  - **Líneas:** `[{id?, service_id?, name?, price, estimated_minutes?, employees: [{employee_id, share_pct}]}]`.
    - Una línea con `id` se conserva o se actualiza. Así, una línea de un servicio ya desactivado sigue valiendo (RN-04).
    - Una línea nueva exige un servicio activo con valor para ese tipo de vehículo, del que copia el nombre (CA-03, RN-01); o, si es «Otro», una descripción (CA-05).
    - Las líneas que no vienen se quitan.
  - **Empleados:** activos si son nuevos en la línea, y si hay, deben sumar 100 (CA-06).
  - **Descuento:** de 0 hasta el subtotal (CA-25).
  - **Al menos una línea** (CA-07).
- **`close_work_order(p_id, p_payments jsonb) returns void`** (personal; orden abierta):
  - cada línea tiene empleados que suman 100;
  - los pagos suman exactamente el total, y si el total es 0 no hace falta ninguno (CA-11 a CA-13);
  - fija `closed_at` y `closed_by`;
  - pistas: `work_order_line_without_employees`, `work_order_payments_mismatch`.
- **`correct_work_order(p_id, p_lines, p_discount, p_notes, p_payments, p_reason) returns void`**
  (solo administrador; orden cerrada; motivo obligatorio): reemplaza el contenido con las mismas
  reglas de guardar y cerrar, y fija `corrected_*` (CA-22).
- **`void_work_order(p_id, p_reason) returns void`**: una abierta la anula el personal y una cerrada
  solo el administrador; el motivo es obligatorio (CA-21, CA-23). Una anulada no se puede volver a
  tocar.

### RLS y privilegios

- `select` para el personal en las cuatro tablas y en la vista. El cliente y `anon` no tienen nada
  (fuera de alcance).
- Ninguna escritura directa: `revoke insert, update, delete`, de modo que una orden solo cambia por
  las funciones (CA-14, CA-24).

### pgTAP `10_work_orders.test.sql`

- **Forma**: tablas, enums, índice parcial y vista.
- **Acceso**: RLS, políticas y privilegios; nadie escribe directo ni borra.
- **Cada función**, en su camino feliz y en cada rechazo:
  - cliente desactivado, vehículo retirado, de otro cliente o con otra orden abierta;
  - servicio inactivo o no ofrecido para el tipo;
  - copia de nombre, valor y tiempo;
  - participación que no suma 100;
  - descuento mayor que el subtotal;
  - cierre sin empleados o con pagos que no cuadran; total 0 sin pagos;
  - el operador no corrige; el administrador corrige con motivo;
  - anular: abierta por el personal, cerrada solo por el administrador; anulada inmutable.
- **La vista**: totales, estimado y lo que falta por estimar.

La prueba vacía los datos que crean los seeds en su propia transacción.

### Seeds `05_work_orders.sql`

Algunas órdenes del cliente de prueba y de Valentina:
- una abierta;
- dos cerradas, una con dos medios de pago y otra con descuento;
- una anulada.

Así la lista y el historial tienen datos en local.

### Tipos

`pnpm db:types` y `types:check`.

## Aplicación (apps/web)

### Módulo `src/modules/work-orders/`

```
api/work-orders.server.ts       # listOpen, listClosed(page), getOrder(id), customerHistory(id)
api/work-orders.client.ts       # búsqueda de clientes, vehículos, servicios y empleados activos (TanStack Query)
actions/work-orders.actions.ts  # saveWorkOrder, closeWorkOrder, correctWorkOrder, voidWorkOrder
queries/work-orders.keys.ts, work-orders.queries.ts
schemas/work-order.schema.ts    # líneas, participación, descuento, observaciones
schemas/payments.schema.ts      # pagos que cuadran con el total
utils/order-totals.utils.ts     # subtotal, total (CA-04, CA-25)
utils/order-estimate.utils.ts   # suma, faltantes, mínimo, hora de entrega (CA-29, CA-30)
utils/shares.utils.ts           # reparto en partes iguales con el sobrante al primero (RN-03)
utils/duration.utils.ts         # «45 min», «2 h 30 min»
utils/work-orders-errors.utils.ts
components/
  organisms/order-editor.component.tsx      # líneas (useFieldArray), resumen fijo con totales y estimado
  molecules/order-line.component.tsx        # servicio, valor, tiempo, empleados y %
  molecules/order-summary.component.tsx     # subtotal, descuento, total, «≈ 2 h 15 min · lista hacia…»
  organisms/customer-picker.component.tsx   # buscar cliente → elegir vehículo (o registrar uno)
  organisms/customer-history.component.tsx  # visitas y dos últimas (CA-15, CA-17)
  organisms/close-order-dialog.component.tsx  # pagos (el primero por el total)
  organisms/void-order-dialog.component.tsx
  organisms/orders-screen.component.tsx     # «En el lavadero» + cerradas paginadas
  organisms/order-detail.component.tsx
messages/es.json                            # namespace `orders`
```

### Rutas

Todas usan `getStaffForPage`; un cliente recibe «No tienes permiso».
- `/orders`: lista (CA-18, CA-19).
- `/orders/new`: nueva orden (HU-01, HU-03).
- `/orders/[id]`: detalle, edición si está abierta, cerrar, anular y corregir si es administrador (CA-20 a CA-23).
- Ficha del cliente (`/customers/[id]`): sección «Órdenes» (CA-16).

### Lecturas

- Las páginas leen por servidor la vista y los detalles.
- El editor carga en el cliente, con el cliente de Supabase del navegador y TanStack Query, como
  el catálogo de vehículos:
  - la búsqueda de clientes (por `search_text`, que ya incluye las placas);
  - los vehículos activos del cliente elegido;
  - los servicios activos;
  - los empleados activos;
  - el historial.
- La RLS decide qué se ve.

### Escrituras

- Server Actions con `getActiveStaff()` o `getActiveAdmin()` y luego `rpc(...)`. Las pantallas las
  llaman con `callAction` (spec 006).
- `saveWorkOrder` devuelve el id para navegar al detalle.

### Editor en vivo

- `useWatch` sobre las líneas y el descuento → `orderTotals` y `orderEstimate`, sin guardar
  (CA-04, CA-29, CA-30).
- El resumen va fijo abajo en el móvil.
- La hora de entrega se calcula desde la hora de recepción: «ahora» en una orden nueva y
  `opened_at` en una abierta. Se formatea con next-intl en la zona de Bogotá.

### RN-10, opción única

- Un helper `singleOption(items)`, en `core/utils/selection.utils.ts`, preselecciona:
  - el vehículo, si el cliente tiene uno solo;
  - el empleado de cada línea nueva, si hay uno solo activo (al 100 %);
  - el primer pago, siempre por el total.
- `CLAUDE.md` lo deja como estándar para todo selector.

### Registrar vehículo en la orden (CA-02)

- El modal reutiliza `VehicleForm`.
- `saveVehicle` pasa a devolver `{ ok: true, id }` y `onSaved(id)`, que hoy no recibe argumentos.
  Es un cambio compatible para «Vehículos».

### Catálogo (HU-06)

- `service.schema` gana `estimated_minutes`: opcional, entero de 5 a 1.440.
- `service-form` gana el campo «Tiempo estimado (min)».
- `services-table` muestra la duración bajo el nombre («45 min»).

### Menú e inicio

«Órdenes» (`/orders`) para el personal, en `LINKS` y en las tarjetas de inicio. El menú del
administrador pasa a seis opciones (ya cabe en «Menú»).

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | componente + e2e | `customer-picker`: busca y lista los vehículos; con uno solo, ya elegido. `e2e/work-orders.spec.ts`. |
| CA-02 | componente + e2e | `customer-picker`: «Registrar vehículo» y el nuevo queda elegido (`onSaved(id)`). E2E. |
| CA-03 | pgTAP + componente | `10_work_orders`: servicio inactivo o sin valor para el tipo rechazado; copia del valor. `order-line`: solo ofrece los válidos y toma el de referencia, editable. |
| CA-04 | unit + componente | `order-totals.utils`; `order-editor`: el total cambia al añadir, quitar o cambiar una línea sin guardar. |
| CA-05 | componente + pgTAP | «Otro» exige descripción y valor. |
| CA-06 | unit + pgTAP + componente | `shares.utils` (2 → 50/50, 3 → 34/33/33); la suma ≠ 100 se rechaza; un solo empleado ya asignado. |
| CA-07 | pgTAP + e2e | Número consecutivo, `opened_at`/`opened_by`; aviso. |
| CA-08 | pgTAP + e2e | Editar una abierta; una cerrada → `work_order_not_open`. |
| CA-09 | unit | `work-order.schema`: valores, descripción. |
| CA-10 | pgTAP + componente | Cliente desactivado, vehículo retirado o de otro cliente; no se ofrecen en el selector. |
| CA-11 | pgTAP + componente + e2e | Pagos que cuadran, dos medios; `close-order-dialog` propone el total en el primero. |
| CA-12 | pgTAP + componente | Pistas de cierre → «qué falta». |
| CA-13 | pgTAP | Total 0 sin pagos. |
| CA-14 | pgTAP + sandbox | El operador no cambia una cerrada; nadie escribe directo (`42501`). |
| CA-15 | componente + e2e | `customer-history`: visitas (sin anuladas) y dos últimas. |
| CA-16 | componente + e2e | Sección «Órdenes» de la ficha. |
| CA-17 | componente | «Primera visita». |
| CA-18 | componente + e2e | `orders-screen`: abiertas de la más antigua a la más reciente, con la hora estimada. |
| CA-19 | componente + e2e | Cerradas paginadas, anuladas marcadas. |
| CA-20 | componente + e2e | `order-detail` completo; acciones según estado y rol. |
| CA-21 | pgTAP + e2e | Anular abierta con motivo (personal). |
| CA-22 | pgTAP + e2e | Corregir cerrada: solo el administrador, con motivo; «corregida por…». |
| CA-23 | pgTAP + componente | Anular cerrada: solo el administrador; deja de contar en el historial. |
| CA-24 | pgTAP + sandbox | Nadie borra (`42501`). |
| CA-25 | unit + pgTAP | Descuento entre 0 y el subtotal; total = subtotal − descuento. |
| CA-26 | unit + componente + pgTAP | `service.schema`, `service-form`, `services-table`; `check` de 5 a 1.440. |
| CA-27 | componente + pgTAP | La línea copia el tiempo, editable sin tocar el servicio. |
| CA-28 | componente | Vacío, «Sin estimar», editable. |
| CA-29 | unit + e2e | `order-estimate.utils`: suma y hora («lista hacia las 4:15 p. m.», reloj fijo). |
| CA-30 | unit + componente | Mínimo, «falta estimar: Otro», «desde las…», «Sin tiempo estimado». |
| CA-31 | pgTAP | Cambiar el tiempo del servicio no altera las líneas. |
| RN-10 | unit + componente | `singleOption`; vehículo y empleado ya elegidos. |
| RNF a11y | e2e | `a11y.spec.ts`: lista, nueva orden (con errores), detalle, cerrar y anular. |
| RNF 360 px | e2e | `ui.spec.ts`: la nueva orden y el detalle, sin desplazamiento lateral. |

## Archivos afectados

- **Nuevos**:
  - La migración `work_orders`, `tests/10_work_orders.test.sql` y `seeds/05_work_orders.sql`.
  - El módulo `work-orders`, con sus tres rutas.
  - `core/utils/selection.utils.ts`.
  - Pruebas unitarias, de componente y de sandbox, y las E2E `work-orders.spec.ts` y `work-orders-admin.spec.ts`.
- **Modificados**:
  - Servicios (`service.schema`, `service-form`, `services-table` y `messages`).
  - Vehículos (`saveVehicle` devuelve el id; `vehicle-form` llama a `onSaved(id)`).
  - Ficha del cliente.
  - `nav-links` y la página de inicio.
  - `src/i18n/messages.ts`.
  - E2E existentes (`a11y`, `ui` y `roles`).
  - `CLAUDE.md` (RN-10, órdenes) y `packages/supabase/CLAUDE.md` (seeds).
- **Eliminados**: ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Las escrituras solo por funciones `security definer` que comprueban rol y estado; tablas sin `insert/update/delete`. | RLS por tabla, con políticas que dependan del estado de la orden padre. Escrituras desde la Server Action en varias llamadas. | Una orden son cuatro tablas que cambian juntas. Las reglas (estado, rol, sumas que cuadran) son de la orden entera, y una función las aplica atómicamente y en un solo sitio. Las políticas por tabla serían frágiles y no atómicas. |
| Las líneas se reenvían enteras al guardar (con `id` las existentes). | Endpoints por línea. | El editor ya tiene la orden completa. Así una sola llamada valida todo (suma de participación, descuento ≤ subtotal) y la línea de un servicio ya desactivado se conserva (RN-04). |
| El número viene de `generated always as identity`. | Un contador propio con bloqueo. | Es único y creciente. Puede tener huecos si una transacción falla, y es aceptable: el negocio necesita un número para referirse a la orden, no una numeración fiscal. |
| Totales y estimado los calcula una vista para leer, y utilidades puras en el editor. | Columnas guardadas con disparadores. | No se duplica el dato. La vista y la utilidad se prueban por separado contra los mismos casos. |
| Los tiempos estimados sin «hora de inicio real». | Registrar cuándo empieza cada servicio. | La spec pide un estimado desde la recepción; medir tiempos reales queda fuera. |
| Tres bloques; si el PR crece demasiado, uno por bloque. | Un PR único obligado. | Constitución VIII: un PR revisable. |

## Despliegue

- La migración llega con `db-deploy` al entrar en `develop`; después va la app.
- No hay variables nuevas.
- Las órdenes de los seeds solo existen en local.

## Cambios al implementar

| Cambio | Motivo |
|---|---|
| La vista `work_order_summaries` expone los nombres de quién abrió, cerró, anuló o corrigió (`private.staff_name`, `security definer`, solo para el personal). | La RLS de `profiles` solo deja a cada uno leer su perfil (y al admin todos): el operador no vería quién abrió una orden (CA-20). La función da el nombre y nada más. |
| `services.estimated_minutes`, `save_work_order`, `correct_work_order`: los parámetros opcionales con valor por defecto al final. | Igual que en la 007: el generador de tipos declara obligatorios los que no tienen valor por defecto. |
| Añadir un servicio es un botón por servicio, con su precio; los empleados, botones de alternar; el primer pago propone el total y cada medio nuevo, el que falta. | Rapidez en el mostrador (un toque para el caso común) y pruebas simples. |
| El resumen (totales y estimado) va fijo abajo solo en teléfonos; desde `md` sigue a las líneas. | En escritorio tapaba las tarjetas de los servicios (lo vio el usuario). |
| «En el lavadero» en ámbar y «Cerradas» en verde (punto en el título y franja a la izquierda de cada fila); anuladas en gris con su etiqueta. | Pedido del usuario: los colores semánticos son para estados; el color nunca es la única señal. |
| `useClock` formatea las horas en 12 h («4:15 p. m.») y cambia los espacios especiales por normales; «hace …» con `useNow`. | Node y Chromium ponen espacios distintos en «p. m.»: el texto del servidor no coincidía con el del navegador (error de hidratación). |
| Los botones «Añadir …» llevan «Añadir» en `sr-only` delante del texto visible; el detalle separa la `<dl>` de los párrafos sueltos. | Auditoría de accesibilidad: el nombre accesible debe contener el texto visible (WCAG 2.5.3) y una `<dl>` solo admite pares `dt`/`dd`. |
| Las pruebas pgTAP de catálogos y órdenes vacían primero las órdenes de los seeds, dentro de su transacción. | Los seeds de órdenes apuntan a servicios y empleados. |

## Enmienda 2026-11-20: en cola, en proceso y ficha paginada (HU-07)

**Base de datos.** La migración `work_orders` aún no se ha aplicado en remoto, así que se edita.

- `work_orders` gana `started_at` y `started_by`, con un `check` de coherencia: los dos o ninguno, y
  solo en una orden que no esté en cola.
- El estado sigue siendo `open`, `closed` o `voided`:
  - **«En cola»** = abierta sin `started_at`;
  - **«En proceso»** = abierta con `started_at`.

  Un enum nuevo obligaría a tocar las cuatro funciones sin ganar nada.
- **`start_work_order(p_id)`** (`security definer`, personal):
  - solo una orden abierta y sin empezar;
  - pistas `work_order_not_open` y `work_order_already_started` (CA-33, CA-36);
  - cerrar no exige haberla empezado (CA-35).
- La vista gana `started_at` y `started_by_name`.
- pgTAP: empezar, empezar dos veces, empezar una cerrada, el cliente, el nombre en la vista.
- Seeds:
  - #4 de Camila, empezada hace 20 minutos;
  - una nueva orden en cola para la bicicleta de Andrés, para que haya algo en cada sección.

**App.**

- **Acción** `startWorkOrder`.
- **`order-status.utils`**: `queued`, `in_progress`, `closed` o `voided`, derivado del estado y de
  `started_at`. `OrderStatusChip` lo usa, con «En cola», «En proceso», «Cerrada» y «Anulada».
- **«Órdenes»**:
  - tres secciones: «En proceso» en ámbar, «En cola» en gris y «Cerradas» en verde (colores de
    estado, CLAUDE.md);
  - la cola, por llegada y con su turno;
  - en cada fila de la cola, el enlace a la orden y, aparte, un botón «Empezar» (un botón dentro de
    un enlace no es válido);
  - «Página X de Y».
- **Estimado**:
  - con inicio (en proceso), da la hora de entrega desde el inicio (CA-34);
  - sin inicio (en cola o una orden nueva), solo la duración: «≈ 2 h 15 min», sin hora;
  - el editor recibe `startedAt` en lugar de `receivedAt`.
- **Detalle**: «Empezar» si está en cola, y la línea «Empezada el … por …».
- **Ficha del cliente**: `CustomerHistory` muestra 10 órdenes y «Ver más» añade 10 más, en el
  cliente, porque la página ya trae todas (CA-16).

**Pruebas.**

| Criterio | Prueba |
|---|---|
| CA-32 a CA-36 | pgTAP; `work-orders.actions` (`startWorkOrder`); `orders-screen` (secciones, turno, «Empezar»); `order-detail`; `order-estimate`; `work-orders.spec.ts` (abrir → en cola → empezar → en proceso). |
| CA-16 | `customer-history` (10 + «Ver más»). |
| CA-18 y CA-19 | `orders-screen` (tres secciones, «Página 1 de 3»). |

Al implementar la enmienda:
- Las filas de «En cola» y «En proceso» se reordenan en el teléfono: el total arriba a la derecha y
  los tiempos (y «Empezar») en su propia línea.
- `now` se fija por petición en `src/i18n/request.ts`: con «hace …» calculado en servidor y
  navegador, cruzar un minuto entre ambos rompía la hidratación.
- Las fechas con hora del detalle se formatean por separado (fecha larga + `useClock`): Node y el
  navegador las unían distinto.
- Red de seguridad `overflow-x-clip` en el contenedor de la app, y la prueba «on an iPhone» de
  `e2e/ui.spec.ts` con todas las pantallas de las specs 007 y 008.
