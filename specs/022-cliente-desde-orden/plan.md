---
spec: "022"
estado: aprobado
actualizado: 2026-11-25
---

# Plan técnico — 022 Registrar cliente y su primer vehículo desde «Nueva orden»

## Resumen

**Base de datos.** Una función nueva, `register_customer`, registra al cliente y, si viene, su
primer vehículo en una sola transacción: un error del vehículo deshace también al cliente (RN-01).
- Es `security invoker`: el alta del cliente pasa por la misma RLS y las mismas guardas que hoy.
- El vehículo se registra con la función de siempre, `save_vehicle`.

**Formularios.**
- Los campos del vehículo salen de `VehicleForm` a un componente propio, `VehicleFields`, que
  reutiliza el formulario de «Nuevo cliente» en una parte opcional «Primer vehículo».
- El buscador de clientes ofrece «Registrar cliente» también en «Nueva orden» y pasa al formulario
  el texto buscado.
- El vehículo del cliente recién registrado queda elegido solo, porque es el único (spec 008,
  RN-10).

## Corrección de la spec (propuesta, antes de aprobar el plan)

La suposición «“Registrar cliente” aparece cuando la búsqueda no encuentra a nadie, como al
reservar» no coincide con la reserva: allí el botón está siempre a la vista. Propuesta:
«“Registrar cliente” está siempre a la vista bajo la búsqueda, en la orden como en la reserva»
(CA-01 se cumple igual). Así no cambia la reserva y sirve también cuando la búsqueda encuentra a
otra persona con el mismo nombre.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 022 `aprobada`; la corrección de arriba se aplica en la spec antes de implementar. Enmienda las specs 004 (HU-06) y 008 (CA-01) al implementarla. |
| II. Qué antes que cómo | ✅ | La spec no nombra tecnología. |
| III. Criterios verificables | ✅ | Cada CA con pgTAP, Vitest o Playwright (tabla abajo). |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas; la suposición corregida, a la vista. |
| V. Simplicidad y stack | ✅ | Sin dependencias. La función reutiliza `save_vehicle`; los campos del vehículo se extraen, no se duplican. |
| VI. Seguridad y datos personales | ✅ | La autorización vive en Postgres: la función es `security invoker` (RLS de `customers` para el personal) y `save_vehicle` comprueba quién registra. `anon` no la ejecuta. |
| VII. Trazabilidad | ✅ | Pruebas citan `spec 022, CA-xx`. |
| VIII. Incrementos pequeños | ✅ | HU-01 (botón en la orden) y HU-02 (primer vehículo) se pueden desplegar por separado. |

## Base de datos (packages/supabase)

- **Migración nueva** `<timestamp>_register_customer.sql`.
- **Función `public.register_customer`:**
  - **Parámetros:** `p_full_name text`, `p_email text`, `p_phone text`, y los del vehículo, todos
    opcionales (`p_vehicle_type`, `p_vehicle_class`, `p_brand_name`, `p_line_name`,
    `p_displacement_cc`, `p_color`, `p_plate`, `p_plate_city_code`). Devuelve el `uuid` del cliente.
  - **Configuración:** `security invoker`, `set search_path = ''`.
  - **Cliente:** `insert into public.customers (full_name, email, phone)`, como hace hoy
    `createCustomer`. La RLS solo deja insertar al personal, y `customers_guard` pone el origen, quién
    lo registró y la fecha del consentimiento, y rechaza un correo usado (`customer_email_taken`).
  - **Vehículo:** con `p_vehicle_type` no nulo, `perform public.save_vehicle(p_customer_id => …)`
    con esos valores. Sus errores (`vehicle_plate_taken`, `vehicle_line_required`…) suben tal cual,
    y la transacción de la llamada deshace al cliente (RN-01).
  - **Permisos:** `revoke execute … from public, anon`; `grant execute … to authenticated,
    service_role`.
- **Tablas y RLS:** sin tablas, columnas ni políticas nuevas.
- **Seeds:** `-- seeds: unchanged — una función nueva; los seeds registran clientes y vehículos por
  separado`.
- **pgTAP** `tests/19_register_customer.test.sql`:
  - el personal registra solo al cliente (CA-06);
  - el personal registra cliente y vehículo, y el vehículo queda suyo (CA-07);
  - una placa ya usada → `vehicle_plate_taken`, sin cliente nuevo (CA-07, RN-01);
  - un correo ya usado → `customer_email_taken`, sin vehículo nuevo;
  - un cliente con cuenta no puede usarla (RN-03);
  - `function_privs_are` sin `anon`.

## Aplicación (apps/web)

- **`vehicles`:**
  - `components/molecules/vehicle-fields.component.tsx` (nuevo): los campos de hoy de `VehicleForm`
    (tipo, clase, marca, línea, cilindraje, color, placa y ciudad), con su lógica:
    - al cambiar el tipo se vacían marca, línea y clase;
    - al cambiar la marca se vacía la línea;
    - consulta el catálogo y los municipios;
    - lleva el `portalContainer` propio para los desplegables dentro de un modal.
  - **Su formulario:** recibe el `UseFormReturn<VehicleFormInput, unknown, VehicleFormValues>` del
    formulario que lo contiene.
  - **`VehicleForm`:** queda como `useForm` + `VehicleFields` + error + botones, sin cambiar su
    comportamiento; sus pruebas no cambian.
- **`customers`:**
  - **`actions/customers.actions.ts`:** `createCustomer` acepta un `vehicle` opcional
    (`registerCustomerSchema` = `newCustomerSchema` + `vehicle: vehicleFormSchema.optional()`) y
    llama a `register_customer`, con o sin vehículo (un solo camino).
  - **Si la base rechaza:**
    - un error de vehículo (*hint* `vehicle_*`, o `23505` de la placa) vuelve como
      `{ error: 'vehicle', vehicleError }`, con la clave de `fromVehicleError(…, 'staff')`;
    - uno del cliente, como hoy.
  - **`components/organisms/customer-form.component.tsx`** (alta):
    - **Casilla «Registrar también su primer vehículo»:** al marcarla, aparece la parte «Primer
      vehículo» con `VehicleFields` y un segundo `useForm` del vehículo.
    - **Al guardar:** se valida el cliente y, con la casilla marcada, también el vehículo
      (`trigger`). Se envía todo junto.
    - **Errores de la base:**
      - la placa usada va bajo el campo «Placa» (`setError`);
      - el correo usado va bajo «Correo»;
      - otro error del vehículo va dentro de su parte;
      - el resto, como hoy.
  - **Prellenado:** con la prop `initialSearch`, `prefillFromSearch` (`utils/search-prefill.utils.ts`,
    pura) reparte el texto buscado:
    - 10 dígitos que empiezan por 3 → «Celular»;
    - una placa de moto o de carro (patrones de `plate.utils`) → la placa del primer vehículo, con
      la casilla marcada y el tipo que corresponde;
    - cualquier otra cosa → «Nombre completo».
- **`work-orders`:** `components/organisms/customer-picker.component.tsx`:
  - **«Registrar cliente»:** siempre a la vista, también con `purpose="order"`, con el texto de la
    búsqueda como `initialSearch`.
  - **Al guardar:** elige el cliente; su único vehículo queda elegido por RN-10 (orden y reserva,
    CA-08 y CA-09).
  - **Al cancelar:** la búsqueda sigue como estaba (CA-03).
- **Mensajes:**
  - `customers.form.withVehicle` («Registrar también su primer vehículo»);
  - `customers.form.vehicleTitle` («Primer vehículo»);
  - `orders.picker.registerCustomer` ya existe;
  - errores del vehículo con las claves de `vehicles.errors`.
- **Rutas:** sin cambios.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | componente + e2e | `customer-picker.component.test.tsx` (en la orden, «Registrar cliente»); `e2e/work-orders.spec.ts` |
| CA-02 | componente | `customer-picker.component.test.tsx` (abre el formulario de «Nuevo cliente» con sus errores, spec 004) |
| CA-03 | componente + e2e | `customer-picker.component.test.tsx` (guardar elige al cliente; cancelar deja la búsqueda) |
| CA-04 | unit + componente | `search-prefill.utils.test.ts` (celular, placa de moto y de carro, nombre); `customer-form.component.test.tsx` (los campos llegan llenos) |
| CA-05 | componente | `customer-form.component.test.tsx` (la casilla muestra los campos del vehículo) |
| CA-06 | pgTAP + componente | `19_register_customer.test.sql`; `customer-form.component.test.tsx` (sin vehículo no lo envía) |
| CA-07 | pgTAP + componente | `19_register_customer.test.sql` (juntos; placa usada → ninguno); `customer-form.component.test.tsx` (placa usada bajo «Placa»; validación del vehículo antes de enviar) |
| CA-08 | componente + e2e | `customer-picker.component.test.tsx` (vehículo elegido); e2e: de la búsqueda a la orden guardada con ese cliente y vehículo |
| CA-09 | componente | `customer-picker.component.test.tsx` con `purpose="reservation"` |
| CA-10 | e2e | `e2e/customers.spec.ts` (nuevo cliente con vehículo → la ficha muestra la placa) |
| RN-01 | pgTAP | `19_register_customer.test.sql` |
| RN-03 | pgTAP | `19_register_customer.test.sql` (un cliente no puede; `anon` sin permiso) |
| Regresión | componente | `vehicle-form.component.test.tsx` sin cambios, tras extraer `VehicleFields` |
| Accesibilidad y móvil | e2e | `a11y.spec.ts`: el formulario con el vehículo y sus errores, claro y oscuro. `ui.spec.ts` «on an iPhone»: «Nueva orden» con el formulario abierto, sin desplazamiento lateral |

## Archivos afectados

- **Nuevos:**
  - `packages/supabase/supabase/migrations/<timestamp>_register_customer.sql`
  - `packages/supabase/supabase/tests/19_register_customer.test.sql`
  - `apps/web/src/modules/vehicles/components/molecules/vehicle-fields.component.tsx`
  - `apps/web/src/modules/customers/utils/search-prefill.utils.ts` y su prueba
- **Modificados:**
  - `packages/supabase/types/database.types.ts` (generado)
  - `vehicles/components/organisms/vehicle-form.component.tsx`
  - `customers/actions/customers.actions.ts`, `customers/schemas/customer.schema.ts`,
    `customers/components/organisms/customer-form.component.tsx`, `customers/messages/es.json`
  - `work-orders/components/organisms/customer-picker.component.tsx`
  - Pruebas de `customers` y `work-orders`; `e2e/work-orders.spec.ts`, `e2e/customers.spec.ts`,
    `e2e/a11y.spec.ts`, `e2e/ui.spec.ts`
  - `specs/004-registro-clientes/spec.md`, `specs/008-orden-de-trabajo/spec.md` (enmiendas),
    `CLAUDE.md`
- **Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Una función en Postgres que hace las dos altas. | Dos llamadas desde la Server Action, borrando el cliente si falla el vehículo. | Solo una transacción garantiza «juntos o ninguno» (RN-01); borrar después deja ventanas y rastros. |
| `security invoker` para `register_customer`. | `security definer` con su propia comprobación de rol. | Reutiliza la RLS y las guardas del alta de hoy sin duplicarlas. |
| Extraer `VehicleFields` y usar un segundo `useForm` para el vehículo. | Campos anidados (`vehicle.*`) en el formulario del cliente; copiar los campos. | Conserva el esquema y la lógica del vehículo tipados y en un solo lugar; `VehicleForm` no cambia por fuera. |
| Elegir el vehículo nuevo por RN-10 (único vehículo). | Devolver también su id. | Un cliente recién registrado tiene uno solo: la regla de siempre ya lo elige. |
| «Registrar cliente» siempre a la vista. | Solo sin resultados. | Igual que en la reserva (ver la corrección de la spec). |

## Ajustes durante la implementación

- **«Registrar cliente» como enlace** (decisión del usuario al verlo): va en la frase de debajo de
  la búsqueda, no como botón con borde. Sigue siendo un `button` con el mismo nombre accesible.
- **`ColorSelect` con `shouldCloseOnScroll: false`:** la E2E de la orden encontró que, en un modal
  más alto que la pantalla, la lista de colores se cerraba al abrirla con el ratón. Arreglado en el
  componente (sirve también para el vehículo en el teléfono).
- **Un solo tipo de error por acción:** `createCustomer` devuelve `{ error: 'vehicle', vehicleError }`
  aparte de `CustomersErrorKey`, para que la pantalla lo distinga. `CustomerForm` tipa `callAction`
  con los dos resultados (crear y corregir).

## Despliegue

Migración primero (función nueva; la app de hoy no la usa), luego la app. Sin variables nuevas.
