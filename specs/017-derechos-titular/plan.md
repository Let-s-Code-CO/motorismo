---
spec: "017"
estado: aprobado
actualizado: 2026-11-24
---

# Plan técnico — 017 Derechos del titular de datos

## Resumen

- **Solicitudes:** una tabla `data_requests`. Solo se lee con RLS (el administrador, todas; el
  cliente, las suyas) y solo se escribe con funciones `security definer`, que comprueban rol,
  estado y plazos.
- **Plazos:** una función calcula los festivos de Colombia de cualquier año (Ley 51 de 1983: fijos,
  trasladados al lunes y los que dependen de la Pascua) y suma días hábiles.
- **Datos del cliente:** una sola función arma su JSON. La usan «Mis datos» y su descarga (el
  cliente) y la descarga del administrador.
- **Supresión:** `erase_customer_data` anonimiza en una sola transacción: cliente, cuenta de Auth,
  vehículos, notas y reservas pendientes.
- **Pantallas:**
  - el cliente: «Mis datos» (`/my/data`);
  - el administrador: «Solicitudes de datos» (`/admin/data-requests`) y el registro de una solicitud
    desde la ficha de un cliente.

## Cambios de spec que propone este plan

Dos precisiones; ninguna cambia un criterio:

1. **Festivos.** La suposición decía «se cargan para cada año». Se **calculan** para cualquier año
   con la regla de la ley, así que no hay que cargarlos.
2. **Cuentas de Google.** Su correo lo pone Google y es con el que entran. Una corrección del correo
   de una cuenta de Google no se aplica: el administrador la rechaza con ese motivo, y la pantalla
   no ofrece cambiarlo. El correo de una cuenta con contraseña sí se cambia (CA-11).

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 017 aprobada; las dos precisiones de arriba se añaden a la spec al aprobar el plan. |
| II. Qué antes que cómo | ✅ | Tablas, funciones y rutas se deciden aquí. |
| III. Criterios verificables | ✅ | pgTAP para plazos, estados, permisos y supresión; sandbox para la cuenta borrada por la API; unitarias y E2E. |
| IV. Ambigüedad explícita | ✅ | Las dos precisiones, propuestas arriba. |
| V. Simplicidad y stack | ✅ | Sin dependencias nuevas; el archivo es JSON. |
| VI. Seguridad y datos personales | ✅ | Solicitudes y datos solo para su titular y el administrador, en RLS y en las funciones; la supresión no deja datos personales. |
| VII. Trazabilidad | ✅ | Rama `feature/017-derechos-titular`. |
| VIII. Incrementos pequeños | ⚠️ | Un solo PR con dos P2 (HU-04 y HU-05). Son pequeñas y usan las mismas funciones; separarlas obligaría a probar dos veces la misma supresión. |

## Base de datos (packages/supabase)

Una migración, `<ts>_data_rights.sql`.

### Días hábiles (RN-03)

- **`private.colombian_holidays(p_year int) returns setof date`** (`immutable`):
  - **fijos:** 1 ene, 1 may, 20 jul, 7 ago, 8 dic y 25 dic;
  - **trasladados al lunes siguiente si no caen en lunes:** 6 ene, 19 mar, 29 jun, 15 ago, 12 oct,
    1 nov y 11 nov;
  - **según la Pascua** (algoritmo de Gauss): Jueves y Viernes Santo; y, trasladados al lunes,
    Ascensión (+43), Corpus Christi (+64) y Sagrado Corazón (+71).
- **`private.is_business_day(d date)`:** de lunes a viernes y no festivo.
- **`private.add_business_days(p_from date, p_days int) returns date`:** el día hábil número
  `p_days` contando desde el día siguiente a `p_from`.

### `public.data_requests`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `customer_id` | uuid → `customers` | `on delete restrict`: nunca se borra. |
| `kind` | `data_request_kind` | `inquiry`, `correction` o `erasure`. |
| `channel` | `data_request_channel` | `app`, `counter` o `instagram`. |
| `description` | text ≤ 1000 | Obligatoria salvo una supresión pedida en la app (el motivo es opcional). |
| `status` | `data_request_status` | `received`, `attended`, `rejected` o `withdrawn`. |
| `received_at`, `due_on` | timestamptz, date | `due_on` = 10 o 15 días hábiles (RN-03). |
| `created_by` | uuid → `auth.users` | Cliente o administrador. |
| `resolved_by`, `resolved_at`, `response` | | Al atender, rechazar o retirar. |

- **Una abierta por tipo (RN-02):** índice único parcial `(customer_id, kind) where status =
  'received'`.
- **RLS:** de lectura para el administrador (todas) y para el cliente (las suyas, por
  `customers.user_id = auth.uid()`). Sin `insert/update/delete` para nadie.
- **Constancia (CA-19):** una solicitud pasa de `received` a un estado final una sola vez, y solo
  por las funciones.
- **Vista `data_request_summaries`** (`security_invoker`, aplica la RLS de la tabla): nombre del
  cliente, `business_days_left` y `overdue`.

### Funciones (`security definer`, con sus *hints*)

Cada función comprueba el rol y el estado:

| Función | Quién | Qué hace |
|---|---|---|
| `request_data_change(p_kind, p_description)` | cliente activo | Corrección (descripción obligatoria) o supresión (motivo opcional), canal `app`. |
| `withdraw_data_request(p_id)` | su cliente | Solo una `received` → `withdrawn` (CA-08). |
| `register_data_request(p_customer, p_kind, p_channel, p_description)` | admin | Canal `counter` o `instagram` (CA-16). |
| `resolve_data_request(p_id, p_response)` | admin | Una consulta o una corrección → `attended` (CA-11, CA-17). |
| `reject_data_request(p_id, p_reason)` | admin | Cualquiera → `rejected` (CA-14). |
| `erase_customer_data(p_request_id)` | admin | Una supresión → anonimiza y `attended` (CA-12, CA-13). |
| `my_data()` | cliente | El JSON de sus datos. |
| `customer_data(p_customer)` | admin | El JSON de los datos de un cliente. |

*Hints:* `data_request_admin_only`, `data_request_open` (ya hay una abierta de ese tipo),
`data_request_closed`, `data_request_description_required`, `data_erasure_open_order` (con el
número de la orden).

### Los datos de un cliente (CA-01 a CA-03)

`private.customer_data_json(p_customer) returns jsonb` reúne:

- **perfil:** nombre, correo, celular, foto, origen (correo, Google o punto de atención), fecha de
  registro y de autorización (`consent_at`);
- **vehículos:** tipo, marca, línea, placa, color y si se retiró;
- **órdenes:** número, fechas, estado, vehículo, servicios con su valor, descuento, total y pagos,
  sin empleados, sin personal y sin notas internas;
- **reservas:** fecha, estado, vehículo, servicios, sus notas y el motivo de cancelación (los que
  ya ve en su área, spec 014);
- **solicitudes:** tipo, canal, estado, fechas y respuesta.

### Supresión (RN-05, RN-06, RN-07)

`erase_customer_data(p_request_id)`, en una sola transacción:

1. Si el cliente tiene una orden abierta, se rechaza con `data_erasure_open_order` y el número.
2. **Reservas pendientes:** se cancelan con el motivo «Supresión de datos», a nombre del
   administrador.
3. **Notas:** se vacían las de sus órdenes y reservas.
4. **Vehículos:** se retiran y se borran sus placas, también las de los ya retirados. Para eso,
   `vehicles_guard` acepta ese cambio solo durante la supresión, con un ajuste local de la
   transacción (`motorismo.erasing`).
5. **Cliente:**
   - `full_name = 'Cliente suprimido'` y correo, celular y foto vacíos;
   - `user_id = null`, `disabled_at = now()` (no aparece entre los activos ni se le reserva) y
     `erased_at = now()` (columna nueva);
   - se borra su cuenta de `auth.users`, ya desvinculada, así que la clave `restrict` no lo impide;
     su sesión cae en la siguiente acción porque el proxy ya no encuentra cuenta.
6. **Solicitudes del cliente:** se vacían sus descripciones y respuestas (RN-06); la de supresión
   queda `attended` con la respuesta «Datos suprimidos».

Órdenes, líneas, pagos, reportes y liquidaciones no se tocan: el nombre que ven es «Cliente
suprimido».

### Seeds

`seeds/07_data_requests.sql`:

- una corrección «Recibida» de Camila (`cliente@`), pedida en la app;
- una consulta de Valentina (sin cuenta), registrada en el punto de atención hace 12 días hábiles:
  vencida.

### pgTAP `16_data_rights.test.sql`

- **Festivos de 2026**, la lista completa: 12 ene, 23 mar, 2 y 3 abr, 18 may, 8 y 15 jun, 29 jun,
  20 jul, 7 y 17 ago, 12 oct, 2 y 16 nov, 8 y 25 dic, 1 ene y 1 may.
- **Días hábiles:** un plazo que cruza un fin de semana y un festivo.
- **Solicitudes:**
  - el ciclo de cada tipo;
  - una abierta por tipo;
  - retirar;
  - rechazar con motivo obligatorio;
  - solo una vez a un estado final;
  - sin escritura directa.
- **Permisos:**
  - el operador no lee nada;
  - el cliente solo lo suyo;
  - `anon` sin funciones;
  - `my_data` sin empleados ni notas internas.
- **Supresión:**
  - con orden abierta, rechazada;
  - ejecutada: nombre, contacto, cuenta (`auth.users`), placas, notas y reservas pendientes;
  - las órdenes cerradas, intactas, y `service_report` con el mismo total;
  - las solicitudes sin datos personales.

## Aplicación (apps/web)

### Módulo `src/modules/data-rights/`

- **`api/data-rights.server.ts`:** `getMyData`, `getCustomerData`, `listDataRequests`,
  `getDataRequest` y `dataRequestsSummary` (pendientes y vencidas, para el inicio).
- **`actions/data-rights.actions.ts`** (con `callAction` y `notify` en los componentes):
  - **cliente:** `requestCorrection`, `requestErasure` y `withdrawDataRequest`, con
    `getActiveCustomer()`;
  - **administrador:** `registerDataRequest`, `resolveDataRequest`, `rejectDataRequest` y
    `eraseCustomerData`, con `getActiveAdmin()`;
  - **`correctCustomerEmail` (CA-11):** con `getActiveAdmin()` y el cliente admin de Supabase:
    `auth.admin.updateUserById(user_id, { email, email_confirm: true })` y luego `customers.email`.
    Solo para cuentas con contraseña; una de Google responde `googleEmail`.
- **`schemas/data-rights.schema.ts`:** descripción, motivo, respuesta y correo.
- **`types`:** con `WithNulls` donde el generador marca no nulas columnas que pueden serlo.
- **Componentes:**
  - **`my-data-screen` (cliente):** secciones de CA-01, «Descargar mis datos», «Pedir una
    corrección» (diálogo), «Pedir la supresión de mis datos» (diálogo que explica RN-05 y lleva un
    botón destructivo) y sus solicitudes, cada una con «Retirar».
  - **`data-requests-screen` (administrador):** las pendientes primero por fecha límite, días
    hábiles que faltan, las vencidas marcadas, y las cerradas aparte.
  - **`data-request-detail` (administrador):**
    - la solicitud y el cliente, con enlace a su ficha para corregir nombre y celular;
    - «Cambiar correo» si es una corrección de una cuenta con contraseña;
    - «Marcar atendida» con respuesta, y «Rechazar» con motivo;
    - en una supresión, «Suprimir datos» (destructivo, confirmado), o la orden abierta que lo
      impide.
  - **`register-data-request-dialog`:** en la ficha del cliente, solo para el administrador.
- **Mensajes:** namespace `dataRights`, registrado en `src/i18n/messages.ts`.

### Rutas

| Ruta | Para quién | Qué es |
|---|---|---|
| `/my/data` | cliente | «Mis datos», con `loading.tsx` (`profile`); enlazada desde «Mi perfil». |
| `/my/data/export` | cliente | `mis-datos-AAAA-MM-DD.json`. |
| `/admin/data-requests` y `/admin/data-requests/[id]` | admin | Con `loading.tsx` (`list` y `detail`); los demás ven `NoPermission`. |
| `/customers/[id]/data/export` | admin | `datos-cliente-AAAA-MM-DD.json` (CA-17); 403 a cualquier otro. |

### Navegación e inicio (CA-10)

- **Menú:** `NAV_LINKS` añade `{ href: '/admin/data-requests', key: 'dataRequests', icon:
  ShieldCheck, audiences: ['admin'] }`.
- **Inicio:** el mosaico dice «2 pendientes · 1 vencida» o «Sin solicitudes pendientes».
  `staff-home` recibe el resumen, como ya recibe el de «Órdenes».

## Estrategia de pruebas

| Criterio | Tipo | Prueba |
|---|---|---|
| CA-01, CA-03 | pgTAP + comp. + e2e | `my_data` (contenido, sin empleados ni notas internas, solo lo suyo); `my-data-screen`; E2E del cliente. |
| CA-02 | unit + e2e | La ruta de descarga (403 sin sesión de cliente, nombre del archivo); E2E descarga el JSON. |
| CA-04, CA-05 | pgTAP + unit + comp. + e2e | `request_data_change` (plazo, descripción); acciones; diálogos (la explicación de RN-05); E2E. |
| CA-06 | pgTAP + comp. | Una abierta por tipo; el mensaje con la que tiene abierta. |
| CA-07, CA-08 | pgTAP + comp. | Estados y respuesta; retirar. |
| CA-09, CA-10 | pgTAP + comp. | La vista (días hábiles, vencida); `data-requests-screen`; el mosaico del inicio. |
| CA-11 | unit + e2e | `correctCustomerEmail` (Google rechazado); E2E corrige y cierra con respuesta. |
| CA-12, CA-13 | pgTAP + sandbox + e2e | Supresión completa; orden abierta; sandbox: la cuenta borrada ya no entra; E2E: el cliente sale. |
| CA-14 | pgTAP + comp. | Rechazo con motivo obligatorio. |
| CA-15 | pgTAP + unit + e2e | `data_request_admin_only`; acciones y rutas rechazan; el operador ve «No tienes permiso». |
| CA-16 a CA-18 | pgTAP + comp. + e2e | `register_data_request`; diálogo de la ficha; E2E de una consulta del punto de atención con descarga. |
| CA-19, CA-20 | pgTAP | Quién y cuándo; una sola vez a un estado final; sin datos personales tras suprimir. |

Además:

- **Accesibilidad:** `a11y.spec.ts` audita «Mis datos» con su diálogo de supresión, la lista y el
  detalle del administrador, en claro y oscuro.
- **Móvil:** `ui.spec.ts` añade «Mis datos» y las solicitudes en el iPhone.
- **Esqueletos:** `loading-coverage.test.ts` con las rutas nuevas.
- **`call-action-coverage`:** se cumple porque todas las acciones van con `callAction`.

Cada prueba nueva se ve fallar con una mutación, que se anota en `tasks.md`.

## Archivos afectados

- **Nuevos:**
  - la migración, `16_data_rights.test.sql` y `seeds/07_data_requests.sql`;
  - el módulo `data-rights`;
  - las rutas `/my/data` (con su `export`), `/admin/data-requests` (con `[id]`) y
    `/customers/[id]/data/export`;
  - una suite de sandbox y `e2e/data-rights.spec.ts`.
- **Modificados:**
  - `vehicles_guard` (la excepción de la supresión) y `customers` (`erased_at`);
  - `database.types.ts`;
  - `nav.constants.ts`, los mensajes de `auth`, `staff-home` y la página de inicio;
  - «Mi perfil» (enlace a «Mis datos») y la ficha del cliente (registrar una solicitud);
  - `src/i18n/messages.ts`, `a11y.spec.ts`, `ui.spec.ts` y `loading-coverage.test.ts`;
  - la política de privacidad (numeral 6: las solicitudes también desde «Mis datos»);
  - `CLAUDE.md`.
- **Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Detalles de la implementación

- `customers_contact_required` se vuelve a crear con el mismo nombre: un cliente suprimido puede quedar sin
  correo ni celular. La ciudad de la placa de un carro se conserva (es obligatoria y no identifica a
  nadie); solo se borra la placa.
- `vehicles_guard` se copia tal cual con una condición al principio (`motorismo.erasing`).
- Las solicitudes del cliente en «Mis datos» se leen de la tabla (RLS), con su id para retirarlas; el
  archivo descargado no lleva ids.
- En el menú, la sección se llama «Habeas data» (corto para el encabezado); su página y su mosaico,
  «Solicitudes de datos».
- La etiqueta «Vencida» lleva texto blanco en los dos temas (en oscuro, sobre `danger-300`).

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Supresión en SQL, en una transacción, borrando también `auth.users`. | Borrar la cuenta con la API de administración desde la acción. | Todo o nada: no queda un cliente anonimizado con cuenta viva, ni al revés. La sandbox comprueba que la cuenta ya no entra. |
| Cambio de correo con la API de administración. | Escribir `auth.users` en SQL. | Auth guarda el correo también en sus identidades; la API lo hace bien. No es atómico con `customers`: si lo segundo falla, la acción se puede repetir. |
| Festivos calculados. | Una tabla cargada cada año. | Exactos para cualquier año y sin mantenimiento. |
| JSON para la descarga. | Excel o PDF. | Datos anidados (órdenes con líneas y pagos); lo lee un programa y, con sangría, una persona. |
| `disabled_at` al suprimir. | Un estado nuevo de cliente. | No aparece entre los activos ni en los selectores, sin tocar las specs 004, 008 y 012. |

## Despliegue

Migración primero, que llega con `db-deploy` al entrar en `develop`, y después la app. Sin
variables nuevas: la clave secreta ya existe.
