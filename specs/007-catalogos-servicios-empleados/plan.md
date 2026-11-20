---
spec: "007"
estado: aprobado
actualizado: 2026-11-20
---

# Plan técnico — 007 Catálogos de servicios y empleados

## Resumen

Tres tablas nuevas con RLS:
- `services`, con un valor opcional por tipo de vehículo;
- `employees`, con lo que todo el personal puede ver: el nombre;
- `employee_details`, con el documento, el celular y la comisión, que solo lee el administrador.

Partir el empleado en dos tablas hace que la regla de privacidad (RN-07) viva en Postgres y no en
la pantalla. Unas guardas devuelven pistas propias cuando un nombre o un documento ya existen,
como hacen las de clientes y vehículos. Las escrituras son solo del administrador, y nadie tiene
permiso para borrar.

En la app hay dos módulos, `services` y `employees`, con páginas de servidor, Server Actions (con
`callAction`) y formularios en modal. El menú gana las dos opciones y, para seguir cabiendo en
360 px, en pantallas pequeñas se recoge en un botón «Menú». No hay dependencias nuevas.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 007 `aprobada`. |
| II. Qué antes que cómo | ✅ | La tecnología vive solo aquí. |
| III. Criterios verificables | ✅ | Cada CA tiene prueba (tabla); las reglas de permisos, también en pgTAP y sandbox. |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. |
| V. Simplicidad y stack | ✅ | Sin dependencias. Patrón de páginas de servidor + Server Actions + `router.refresh()`, como Clientes; TanStack Query no hace falta (listas pequeñas, sin caché en el cliente). |
| VI. Seguridad y datos personales | ✅ | RLS en las tres tablas. Los datos del empleado están en una tabla que solo lee el administrador (RN-07), y nadie tiene `DELETE` (RN-02, CA-14). |
| VII. Trazabilidad | ✅ | Rama `feature/007-catalogos-servicios-empleados`; pruebas con cabecera `spec 007, CA-xx`. |
| VIII. Incrementos pequeños | ✅ | Bloque A = servicios (HU-01 y su parte de HU-03 y HU-04); bloque B = empleados (HU-02 y el resto). Cada uno se despliega solo. |

## Base de datos (packages/supabase)

**Migración** `<ts>_catalogs.sql`, creada con `migration:new catalogs < /dev/null`:

- **Clave de nombre** `private.service_name_key(text)`: `lower(regexp_replace(btrim(x), '\s+', ' ', 'g'))`.
  - Ignora mayúsculas y espacios de más (RN-03, CA-04), pero no las tildes ni los guiones, porque
    la spec no lo pide.
  - Es `immutable` y va en una columna generada.
- **`public.services`**:
  - `id uuid pk`;
  - `name text not null` (recortado, de 1 a 80 caracteres);
  - `name_key text generated … stored unique`;
  - `price_motorcycle`, `price_car` y `price_bicycle`: `integer null`, entre 1 y 10.000.000 (RN-05);
  - `check (coalesce(price_motorcycle, price_car, price_bicycle) is not null)`: al menos un valor (CA-03);
  - `disabled_at timestamptz null` y `created_at timestamptz not null default now()`.
  - Tres columnas y no una tabla de precios: los tipos de vehículo son fijos (enum
    `vehicle_type`), la consulta es una fila por servicio y la regla «al menos uno» queda en un
    solo `check`.
- **`public.document_type`** (enum): `cc`, `ce`, `ppt` y `passport`.
- **`public.employees`**: `id uuid pk`, `full_name text not null` (recortado, de 1 a 120),
  `disabled_at timestamptz null` y `created_at`.
- **`public.employee_details`**:
  - `employee_id uuid pk references employees on delete restrict`;
  - `document_type public.document_type not null` y `document_number text not null`;
  - el número va solo en dígitos (de 3 a 15) para CC, CE y PPT, o en mayúsculas y alfanumérico (de 5 a 20) para el pasaporte;
  - `phone text null check (phone ~ '^3[0-9]{9}$')`, con la misma regla que clientes;
  - `commission_pct smallint not null check (between 0 and 100)` (RN-06);
  - `unique (document_type, document_number)` (RN-04).
- **Guardas** `services_guard` y `employee_details_guard` (`before insert or update`):
  - Normalizan: el nombre recortado; el documento sin puntos, espacios ni guiones y en mayúsculas.
  - Si el nombre o el documento ya existen, lanzan `unique_violation` con la pista
    `service_name_taken` o `service_name_taken_disabled`, y `employee_document_taken` o
    `employee_document_taken_disabled`, según el existente esté activo o no.
  - La app traduce la pista y, si el existente está desactivado, sugiere reactivarlo (CA-04, CA-09).
  - Las restricciones `unique` quedan detrás, por si dos peticiones llegan a la vez.
- **`public.save_employee(p_id uuid, p_full_name text, p_document_type, p_document_number text, p_phone text, p_commission_pct smallint) returns uuid`**:
  - Inserta o actualiza las dos tablas en una sola transacción.
  - `security invoker`: valen la RLS y las guardas, así que solo un administrador puede usarla.
- **RLS y privilegios**:

  | Tabla | Leer | Insertar / actualizar | Borrar |
  |---|---|---|---|
  | `services` | `is_admin()` o (`is_staff()` y `disabled_at is null`) (CA-15) | Solo `is_admin()` (RN-01) | Nadie: sin `grant delete` (CA-14) |
  | `employees` | Igual que `services` (CA-16: el operador solo ve los activos) | Solo `is_admin()` | Nadie |
  | `employee_details` | Solo `is_admin()` (RN-07, CA-16, CA-17) | Solo `is_admin()` | Nadie |

  - `anon` no tiene nada.
  - Los `grant insert/update` van por columnas, como en clientes, y `disabled_at` solo se cambia
    con `update`.
- **pgTAP** `09_catalogs.test.sql`:
  - forma, restricciones y clave de nombre;
  - `policies_are` y `table_privs_are`, incluido que nadie tiene `DELETE`;
  - por rol:
    - administrador: todo;
    - operador: lee los activos y nada de `employee_details`, no escribe;
    - cliente y `anon`: nada;
  - las guardas: pistas de duplicado activo o desactivado, y la normalización del documento;
  - `save_employee`, atómica, y rechazada para el operador.
- **Seeds** `04_catalogs.sql` (solo local; los catálogos reales los carga el administrador):
  - Servicios: «Lavado sencillo» (moto, carro y bicicleta), «Lavado detallado» (moto y carro), «Micropulido» (moto y carro) y «Recubrimiento cerámico» (solo moto), más «Polichado» desactivado.
  - Empleados: dos activos (uno con celular) y uno desactivado.
- **Tipos**: `pnpm db:types` y `types:check`.

## Aplicación (apps/web)

### Módulos

```
modules/services/
  api/services.server.ts          # listServices(): activos y desactivados (los ve quien la RLS deja)
  actions/services.actions.ts     # createService, updateService, setServiceDisabled (getActiveAdmin)
  components/organisms/
    services-screen.component.tsx # lista + «Desactivados» plegable + aviso de resultado
    services-table.component.tsx  # nombre, moto, carro, bicicleta; menú «⋯» (solo admin)
    service-form.component.tsx    # modal de alta y edición
  schemas/service.schema.ts       # nombre; precios opcionales («25.000» → 25000); al menos uno
  utils/services-errors.utils.ts  # pista → clave de mensaje
  messages/es.json                # namespace `services`
modules/employees/
  api/employees.server.ts         # listEmployees(isAdmin): el admin con detalles; el operador solo nombre
  actions/employees.actions.ts    # saveEmployee (rpc save_employee), setEmployeeDisabled
  components/organisms/
    employees-screen.component.tsx, employees-table.component.tsx, employee-form.component.tsx
  schemas/employee.schema.ts      # nombre, tipo + número (normalizado y validado por tipo),
                                  # celular (optionalMobileField de core), comisión 0–100
  utils/employees-errors.utils.ts
  messages/es.json                # namespace `employees`
modules/core/
  utils/money.utils.ts            # formatPesos(25000) → «$ 25.000»; parsePesos(«25.000») → 25000
  components/confirm-dialog.component.tsx  # confirmación de desactivar (CA-12), reutilizable
```

- **Rutas**: `src/app/(app)/services/page.tsx` y `src/app/(app)/employees/page.tsx`.
  - Usan `getStaffForPage()`: un cliente recibe «No tienes permiso» (CA-18).
  - Pasan `isAdmin` a la pantalla, que solo dibuja las acciones si es `true`. La autoridad es la
    RLS: la pantalla no decide permisos (CA-15, CA-17).
- **Server Actions**: `getActiveAdmin()` y luego Supabase con la sesión del usuario. Los errores
  de la guarda se traducen con `*-errors.utils`. Las pantallas las llaman con `callAction` (spec
  006; lo exige `call-action-coverage.test.ts`) y hacen `router.refresh()` al terminar.
- **Lista de empleados del operador**: `listEmployees` solo consulta `employees` (el nombre). La
  RLS ya filtra los desactivados, y aunque se pidiera `employee_details`, volvería vacío.
- **Formularios**: React Hook Form + Zod, en un `Modal` con `scrollBehavior="outside"`. El
  `Select` del tipo de documento lleva `popoverProps.portalContainer` (regla de `CLAUDE.md`). Los
  precios usan `inputMode="numeric"` y se muestran con separador de miles al salir del campo.
- **Menú** (`auth/components/molecules/nav-links.component.tsx`):
  - Gana «Servicios» (`/services`) y «Empleados» (`/employees`) para el personal (CA-19).
  - Desde `md` se ve en línea, como hoy. Por debajo, un botón «Menú» abre un desplegable con los
    mismos enlaces y la sección actual marcada.
  - Sin esto, el encabezado del administrador (cinco enlaces, avatar, instalar y salir)
    desbordaría 360 px (spec 003, CA-02).
- **Inicio del personal** (`src/app/(app)/page.tsx`): dos tarjetas nuevas, «Servicios» y
  «Empleados», con el mismo diseño que «Clientes» (CA-19).
- **Mensajes**: los `es.json` de `services` y `employees` (títulos, columnas, formularios,
  validaciones, errores, avisos y confirmaciones), registrados en `src/i18n/messages.ts`.
  `auth.header` gana `services`, `employees` y `menu`.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | componente + e2e | `service-form.component.test.tsx` (envía los valores normalizados). `services-table.component.test.tsx` (`$ 25.000`). `e2e/services.spec.ts` (el admin registra un servicio). |
| CA-02 | componente | `services-table.component.test.tsx`: un tipo sin valor muestra «No disponible». |
| CA-03 | unit + pgTAP | `service.schema.test.ts`: sin nombre, sin valores, 0, decimales, más de 10.000.000, y «25.000» se acepta. `09_catalogs`: los `check` rechazan lo mismo. |
| CA-04 | pgTAP + unit + e2e | `09_catalogs`: pista activo o desactivado, sin distinguir mayúsculas ni espacios. `services.actions.test.ts`: pista → mensaje. `services.spec.ts`: el duplicado se rechaza. |
| CA-05 | unit + e2e | `services.actions.test.ts` (`updateService`) y `services.spec.ts` (corregir el valor). |
| CA-06 | componente | `services-screen.component.test.tsx`: estado vacío para el admin. |
| CA-07 | componente + e2e | `employee-form.component.test.tsx` y `e2e/employees.spec.ts`. |
| CA-08 | unit + pgTAP | `employee.schema.test.ts`: nombre, documento por tipo, celular y comisión (-1, 101, 12.5). `09_catalogs`: `check`. |
| CA-09 | pgTAP + unit | `09_catalogs`: «1.020.304.050» = «1020304050», pista activo o desactivado. `employees.actions.test.ts`: mensaje. |
| CA-10 | unit + e2e | `employees.actions.test.ts` y `employees.spec.ts` (corregir la comisión). |
| CA-11 | componente | `employees-screen.component.test.tsx`: estado vacío. |
| CA-12 | componente + e2e | Pantallas: confirmar → acción → aviso; «Desactivados» con fecha. `services.spec.ts` y `employees.spec.ts`. |
| CA-13 | componente + e2e | Reactivar desde «Desactivados», en las mismas pruebas. |
| CA-14 | pgTAP + sandbox | `09_catalogs`: sin privilegio `DELETE` para nadie. `__test__/sandbox/catalogs-access.sandbox.test.ts`: un `delete` del admin por la API no borra nada. |
| CA-15 | componente + e2e | `services-screen` con `isAdmin=false`: sin acciones. `services.spec.ts` como operador. |
| CA-16 | pgTAP + sandbox + e2e | `09_catalogs` y `catalogs-access.sandbox`: el operador solo ve el nombre de los activos y nada de `employee_details`. `employees.spec.ts` como operador. |
| CA-17 | pgTAP + sandbox + unit | Escrituras y `save_employee` del operador rechazadas (`42501`). `*.actions.test.ts`: `forbidden` sin admin. |
| CA-18 | e2e + pgTAP | `e2e/roles.spec.ts` (ampliado): un cliente en `/services` y `/employees` ve «No tienes permiso». `09_catalogs`: el cliente no lee nada. |
| CA-19 | componente + e2e | `app-header`/`nav-links` (ampliado): opciones por rol; en 360 px, el botón «Menú». `roles.spec.ts`: las tarjetas de inicio por rol. `ui.spec.ts` (sin desplazamiento horizontal en 360 px con el admin). |
| RNF a11y | e2e | `a11y.spec.ts`: Servicios y Empleados (admin), los formularios, la confirmación y el «Menú» móvil. |

## Archivos afectados

- **Nuevos**:
  - La migración `catalogs`, `tests/09_catalogs.test.sql` y `seeds/04_catalogs.sql`.
  - Los módulos `services` y `employees`.
  - En `core`: `money.utils.ts` y `confirm-dialog.component.tsx`.
  - Las rutas `/services` y `/employees`.
  - Pruebas unitarias, de componente y de sandbox, más `e2e/services.spec.ts` y `e2e/employees.spec.ts`.
- **Modificados**:
  - `types/database.types.ts`, regenerado.
  - `nav-links.component.tsx` y `auth/messages/es.json`.
  - `src/i18n/messages.ts`.
  - `e2e/a11y.spec.ts`, `e2e/roles.spec.ts` y `e2e/ui.spec.ts`.
  - `CLAUDE.md` (seeds y usuarios locales) y `packages/supabase/CLAUDE.md` (seeds).
- **Eliminados**: ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Empleado partido en `employees` (nombre) y `employee_details` (datos privados). | Una tabla con privilegios por columna. Una vista `security definer`. | Los privilegios por columna son por rol de Postgres, y administrador y operador son el mismo rol (`authenticated`). Una vista que salta la RLS es justo lo que se quiere evitar. Con dos tablas, cada una tiene su RLS clara. |
| Tres columnas de precio. | Una tabla `service_prices` (servicio × tipo). | Los tipos son fijos; una fila por servicio simplifica la lista, el formulario y la regla «al menos uno». Si un día hay más tipos, se migra. |
| Guardas con pistas para los duplicados. | Leer el código `23505` y luego consultar. | Mismo patrón que clientes y vehículos. La pista ya dice si el existente está desactivado, sin otra consulta. |
| `save_employee` como `security invoker`. | Dos llamadas desde la Server Action. `security definer`. | Es atómica (las dos tablas o ninguna) y respeta la RLS: no hay que repetir el permiso en SQL. |
| Menú recogido en «Menú» por debajo de `md`. | Barrido horizontal del menú. Menú lateral. | Con cinco opciones el encabezado no cabe en 360 px. El menú lateral es la spec «Navegación principal» del backlog; esto es lo mínimo para no romper la spec 003. |
| Seeds de catálogos solo en local. | Migración de datos. | Los servicios, precios y empleados son del negocio real y los carga el administrador. Los datos de ejemplo no deben llegar a develop ni a producción. |

## Despliegue

- La migración llega al proyecto remoto con `db-deploy` al entrar en `develop`. Después va la app.
- No hay variables nuevas.
- El administrador carga los servicios y empleados reales en cada entorno.

## Cambios al implementar

| Cambio | Motivo |
|---|---|
| `save_employee(p_full_name, p_document_type, p_document_number, p_commission_pct, p_phone default null, p_id default null)`: los opcionales, al final y con valor por defecto. | El generador de tipos declara obligatorios los parámetros sin valor por defecto. Así, sin `p_id` registra, y sin `p_phone` no guarda celular. La migración aún no estaba aplicada en remoto, así que se editó. |
| El tema (`hero.ts`) usa el tono 600 de la escala roja como `danger` por defecto. | La auditoría de accesibilidad de los formularios, con sus errores a la vista, encontró que `text-danger` (red-500) no llega a AA sobre blanco. Se corrige para toda la app, igual que se hizo con `foreground`. |
| El menú «Menú» marca la sección actual con `menuitemradio`. | `DropdownMenu` con `selectionMode="single"`: el lector de pantalla anuncia cuál es la actual. |
| En teléfonos, los precios de un servicio van bajo su nombre, y en «Empleados» el documento y el celular (este último, corregido al verificar); sus columnas aparecen desde `sm` (precios) o `md` (documento y celular). | Mismo criterio que Clientes: nada detrás de un desplazamiento lateral. |
| `09_catalogs.test.sql` vacía los catálogos al empezar, dentro de su transacción. | Las pruebas pgTAP no dependen de los seeds (`04_catalogs.sql` crea «Polichado» y una cédula que la prueba también usa). |
| Las E2E eligen la acción del menú «⋯» reintentando. | Tras cada cambio la lista se refresca desde el servidor y vuelve a dibujar las filas, lo que cierra un menú recién abierto. |
