---
spec: "004"
estado: aprobado
actualizado: 2026-11-19
---

# Plan técnico — 004 Registro de clientes y sección Clientes

## Resumen

Se activa el registro público de Supabase Auth, con confirmación de correo y Google, y se separan
dos tipos de cuenta: **personal** (`profiles`, spec 002) y **clientes** (tabla nueva `customers`).
Un cliente puede existir **sin cuenta**, cuando lo registra el personal en el punto de atención.

Abrir el registro obliga a cambiar cómo se decide quién es personal. Hoy el trigger de alta lee
el rol de `raw_user_meta_data`, y con el registro público ese campo lo escribe cualquiera
(`signUp({ options: { data: { role: 'admin' } } })`). A partir de este plan, el personal solo
nace de una **invitación pendiente** (`staff_invitations`) que únicamente un administrador puede
crear, y cualquier otra alta es un cliente (RN-11).

Las tres capas de la spec 002 se mantienen:

- el **proxy** distingue personal y cliente con una sola llamada a `current_account()`;
- las **páginas y acciones** usan `requireStaff()` / `requireCustomer()`;
- **RLS** y un trigger de guarda protegen `customers` en Postgres.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Los cambios a la spec 002 (RN-01, CA-27, RF-01) se aplicaron al aprobar la 004. |
| II. Qué antes que cómo | ✅ | La tecnología solo aparece en este plan. |
| III. Criterios verificables | ✅ | Los 31 CA están mapeados a pruebas. CA-21 (vincular Google a una cuenta sin confirmar) depende del comportamiento interno de Auth: pgTAP para nuestra parte y verificación manual en preview (ver riesgos). |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. Los comportamientos de Auth que no están documentados se comprueban con un spike (T-001) antes de construir sobre ellos. |
| V. Simplicidad y stack | ✅ | Ninguna dependencia npm nueva. Se añaden dos extensiones de Postgres que Supabase ya trae (`unaccent`, `pg_trgm`), justificadas abajo. Las lecturas van por RSC y las mutaciones por Server Actions, como en `users`. |
| VI. Seguridad y datos personales | ✅ | RLS en `customers` y en `staff_invitations`. Se cierra la escalada de privilegios por metadatos. La autorización de datos se exige en la base de datos (RN-04). Los mensajes no revelan correos. |
| VII. Trazabilidad | ✅ | Rama `feature/004-registro-clientes`. Cada test cita su CA. |
| VIII. Incrementos pequeños | ⚠️ | La spec es grande (7 historias). Dos bloques en la misma rama, como en la 002. **Bloque A** = P1 (HU-01 a HU-04, más el cambio de las invitaciones) y es desplegable por sí solo. **Bloque B** = P2/P3 (HU-05 a HU-07). Cada bloque cierra con su Definición de terminado. |

## Base de datos (`packages/supabase`)

Dos migraciones nuevas. Las de la spec 002 no se editan.

### Migración `<ts>_staff_invitations.sql`: el personal solo nace de una invitación

**Tabla `public.staff_invitations`**

| Columna | Tipo | Reglas |
|---|---|---|
| `email` | `text` PK | en minúsculas (`check (email = lower(email))`) |
| `full_name` | `text not null` | 1–120 caracteres |
| `role` | `user_role not null` | |
| `invited_by` | `uuid null` | `references profiles(id)`; `null` solo para el primer administrador (bootstrap) |
| `created_at` | `timestamptz not null` | `default now()` |

- **RLS** activado.
  - `insert`: solo `is_admin()`, con `with check (invited_by = auth.uid())`.
  - `delete`: solo `is_admin()`, para deshacer si falla el envío.
  - Sin `select` ni `update` para `authenticated`. `anon` no tiene nada.
- `handle_new_auth_user()` se reescribe (`create or replace`):
  - **si existe una invitación** para `lower(new.email)`, crea el `profile` con nombre, rol e
    invitador **tomados de la invitación** y la borra;
  - **si no, es un cliente**. En el alta solo valida, sin crear nada todavía:
    - nombre presente (`full_name`; en Google, `full_name` o `name`);
    - en altas por correo, `data_consent = true` en los metadatos (RN-04);
    - celular válido si viene.

    Si algo falla, lanza una excepción con `hint`. **Nunca lee `role` de los metadatos.**
- Función `public.email_in_use(p_email text) returns boolean` (`security definer`, solo para
  `service_role`). Mira `auth.users`, `profiles` y `customers`. La usa `inviteUser` para
  rechazar correos ocupados, incluidos los registros de clientes aún sin confirmar (RN-01).
- Mitigación de riesgo 2: una persona `invited` solo puede activarse con una sesión abierta
  desde su enlace. `decideAccess` y `setPassword` comprueban el método de la sesión (`amr`). Los
  nombres exactos de los métodos se confirman en T-001.
- **Seeds**: `01_users.sql` inserta primero las `staff_invitations` del personal.
- **pgTAP**:
  - Los fixtures de `01`/`02`/`03` pasan a crear la invitación antes que `auth.users`.
  - Nueva `04_staff_invitations.test.sql`:
    - RLS y privilegios;
    - la invitación se consume al crearse el usuario;
    - un alta con `role: admin` en los metadatos y sin invitación **nunca** crea personal (RN-11);
    - `email_in_use`.

### Migración `<ts>_customers.sql`

**Extensiones** (esquema `extensions`)
- `unaccent`: la búsqueda ignora tildes (CA-16).
- `pg_trgm`: índice GIN para búsquedas por fragmento.

Ambas vienen con Supabase. Alternativas descartadas: quitar tildes en JS al guardar (duplica la
lógica y no protege lo que llegue por otra vía) y búsqueda de texto completo (no encuentra
fragmentos de celular ni de correo).

**Tipos**
- `customer_origin`: `self_signup`, `google`, `counter`.
- `customer_status`: `registered` («Con cuenta»), `walk_in` («Sin cuenta»), `disabled`.

**Tabla `public.customers`**

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `user_id` | `uuid null unique` | `references auth.users(id) on delete restrict`. `null` = sin cuenta. |
| `full_name` | `text not null` | 1–120 caracteres |
| `email` | `text null` | minúsculas; índice único `lower(email)`; obligatorio si `user_id` no es null |
| `phone` | `text null` | `check (phone ~ '^3[0-9]{9}$')`, ya normalizado (RN-03) |
| `avatar_url` | `text null` | solo `https`; lo escribe solo el trigger de identidades (foto de Google) |
| `origin` | `customer_origin not null` | |
| `registered_by` | `uuid null` | `references profiles(id)`; obligatorio si `origin = counter` |
| `consent_at` | `timestamptz not null` | cuándo autorizó; la vía es `origin` (+ `registered_by`) (RF-07) |
| `disabled_at` | `timestamptz null` | |
| `status` | `customer_status` | **generada**: `disabled` si `disabled_at` no es null; si no, `registered` si hay `user_id`, y `walk_in` si no lo hay |
| `search_text` | `text` | **generada**: `lower(immutable_unaccent(nombre ‖ correo ‖ celular))`, con índice GIN trigram |
| `created_at`, `updated_at` | `timestamptz not null` | trigger `set_updated_at` |

Además:

- `check (email is not null or phone is not null)` (RN-02).
- Índices en `registered_by` y en `(status, created_at desc)`.

**Alta de clientes con cuenta** (trigger `security definer` sobre `auth.users`,
`after insert or update of email_confirmed_at`). Actúa cuando el usuario **queda confirmado** y
no es personal, para que un registro sin confirmar no sea cliente (RN-07, CA-19):
- **Si hay una ficha** sin cuenta con ese correo, la vincula (`user_id`) y completa el celular
  si faltaba (CA-28). Así nadie se apropia de una ficha sin demostrar que el correo es suyo.
- **Si no la hay**, la crea con nombre y celular de los metadatos. El origen sale de
  `raw_app_meta_data.provider` (`google` o `self_signup`), y `consent_at` es la fecha del alta
  (`auth.users.created_at`).
- Google crea el usuario ya confirmado, así que el cliente nace en el mismo `insert` (CA-20).
  Una cuenta de personal (con `profile`) nunca recibe ficha de cliente (CA-23).

**Foto de Google**: `sync_profile_avatar_from_identity()` también actualiza
`customers.avatar_url`. La foto aparece en la cabecera, la lista y la ficha y se refresca en cada
ingreso con Google (CA-20, petición del usuario).

**Funciones auxiliares** (`security definer`, `stable`)
- `is_staff()`: `current_profile_role() is not null`, es decir, personal activo.
- `current_account()`: devuelve `(kind, role, status)` de `auth.uid()`:
  - `kind` es `staff` o `customer`;
  - para clientes, `status` es `active` o `disabled`.

  El proxy la llama una sola vez por petición.
- `customer_status_counts()` (`security invoker`, sujeta a RLS): totales por estado para las
  tarjetas.

**RLS en `customers`**
- `select`: `is_staff()` o `user_id = auth.uid()`.
- `insert`: `is_staff()`.
- `update`: `is_staff()` o `user_id = auth.uid()`.
- Sin `delete` (RN-08).
- Privilegios por columna: `insert (full_name, email, phone)` y
  `update (full_name, email, phone, disabled_at)`.

**Guarda `customers_guard`** (`before insert or update`, `security invoker`, con `hint`)
- **Alta desde la API**: fuerza `origin = counter`, `registered_by = auth.uid()`, `user_id`
  null, `disabled_at` null y `consent_at = now()`. La UI exige marcar la autorización antes de
  enviar (CA-24, CA-25).
- **Columnas inmutables**: `user_id`, `origin`, `registered_by`, `consent_at`, `created_at`.
  Solo el trigger de alta (`security definer`) vincula `user_id`.
- **Correo**: no cambia si `user_id` no es null (RN-10).
- **El propio cliente** solo cambia `full_name` y `phone` (CA-14).
- **`disabled_at`** solo lo cambia un administrador (RN-09, CA-31).
- **Correo duplicado**: si ya pertenece a otro cliente o al personal, lo rechaza con
  `hint = 'customer_email_taken'` (CA-26).
- **Normalización**: correo en minúsculas y celular a 10 dígitos (acepta `+57`, espacios y
  guiones).

**Seeds** `02_customers.sql`:
- `cliente@motorismo.test`: con cuenta, contraseña `motorismo-local`;
- `cliente.google@motorismo.test`: origen Google, con foto;
- dos clientes sin cuenta, uno con solo celular;
- `cliente.desactivado@motorismo.test`: con cuenta y baneado.

**pgTAP** `05_customers.test.sql`:
- esquema, RLS y privilegios;
- cada regla de la guarda;
- estado generado y normalización;
- alta al confirmar (no antes); vinculación con la ficha (CA-28);
- Google y su foto (CA-20); personal sin ficha (CA-23);
- consentimiento obligatorio (RN-04);
- búsqueda sin tildes;
- `current_account()`.

## Aplicación (`apps/web`)

### Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/auth/sign-up` | visitantes (como `/auth/login`) | registro + «Continuar con Google» con aviso de autorización (CA-01, CA-20) |
| `/auth/confirm?type=email` | cualquiera | ruta existente que ahora acepta `email`: confirma y lleva a `/profile` (CA-03); un enlace inválido va a `/auth/invalid-link?type=email` con reenvío (CA-05) |
| `/privacy` | cualquiera, con o sin sesión | política de tratamiento de datos (texto base en `messages`) |
| `/profile` | cliente | «Mi perfil» (CA-12 a CA-14); el personal que llega aquí va a `/` |
| `/customers` | personal | lista, búsqueda, tarjetas-filtro, paginación y «Nuevo cliente» (modal) |
| `/customers/[id]` | personal | ficha, edición y desactivar/reactivar (solo admin) |

### Proxy y acceso (`access.utils.ts`, `proxy.ts`, `auth.server.ts`)

- **Entrada de `decideAccess`**: `account: { kind: 'staff', status } | { kind: 'customer',
  status } | null`, que sale de `rpc('current_account')`.
- **Rutas nuevas**: `/auth/sign-up` entra en `ENTRY_PATHS` y `/privacy` en las rutas públicas.
- **Cliente**:
  - `/` o una ruta de entrada lo llevan a `/profile`;
  - si está desactivado, se cierra la sesión con `account_disabled` (CA-29);
  - el resto pasa, y la página decide. Por ejemplo, `/customers` muestra «No tienes permiso»
    con enlace a su perfil (CA-09).
- **Personal `invited`**: necesita una sesión de enlace (`amr`; mitigación del riesgo 2).
- **`auth.server.ts`**:
  - `getCurrentAccount()` sustituye a `getCurrentUser()`;
  - nuevos `requireStaff()`, `requireCustomer()`, `getActiveStaff()` y `getActiveAdmin()`;
  - el tipo `CurrentAccount` es una unión discriminada.
- **Cabecera**:
  - el menú depende de la cuenta: personal ve Inicio, Clientes y Usuarios (solo admin); el
    cliente, Mi perfil (CA-08);
  - chip «Cliente» y avatar con la foto.
- **Inicio del personal**: nueva tarjeta «Clientes».

### Módulo `auth` (cambios)

- **Esquema `sign-up.schema.ts`**: nombre, correo, celular opcional (RN-03), contraseña de 8 o
  más caracteres y `dataConsent: true` obligatorio.
- **Acción `signUp`**:
  - llama a `auth.signUp` con los metadatos `full_name`, `phone` y `data_consent`, y con
    `emailRedirectTo`;
  - siempre devuelve el mismo resultado cuando el correo ya existe (CA-07, RN-06).
- **Acción `resendConfirmation(email)`**: siempre responde igual (CA-04, CA-05).
- **`mapAuthError`**: `email_not_confirmed` se traduce a `emailNotConfirmed` («Confirma tu
  correo para entrar.»). El login lo muestra con el botón de reenvío (CA-04).
- **Login**: enlace «Crear cuenta». En el registro, el botón de Google lleva debajo «Al
  continuar autorizas el tratamiento de tus datos» con enlace a `/privacy`.
- **Plantilla `confirmation.html`** en español, con enlace
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

### Módulo nuevo `customers`

```
modules/customers/
  api/customers.server.ts       # listCustomers({q,status,page}), getCustomer(id), getMyCustomer(), countByStatus()
  actions/customers.actions.ts  # createCustomer, updateCustomer, setCustomerDisabled, updateMyProfile
  schemas/customer.schema.ts    # alta/edición en el punto de atención (+ consentimiento), mi perfil
  utils/customers-filter.utils.ts  # parse de ?q=&status=&page=, normalizeSearch (minúsculas, sin tildes)
  components/
    atoms/customer-status-chip, customer-origin-label
    organisms/customers-screen, customers-table, customer-form, customer-detail, my-profile-form
  messages/es.json
```

- **Lecturas**: RSC con la sesión del usuario (RLS). `range()` de 20 en 20 con `count: 'exact'`
  (RF-05). La búsqueda usa `ilike` sobre `search_text` con el término normalizado igual que en
  la base de datos.
- **Estado de la lista en la URL** (`?q=&status=&page=`): la búsqueda espera 300 ms tras
  escribir y aplica `router.replace` dentro de una transición. Las tarjetas y «Ver todos» siguen
  el estándar del proyecto, y cambiar el filtro o la búsqueda vuelve a la página 1.
- **Mutaciones**: Server Actions con la sesión del usuario.
  - Se autoriza con `getActiveStaff()` o `getActiveAdmin()`; RLS y la guarda deciden al final.
  - Los `hint` se traducen a mensajes, por ejemplo `customer_email_taken` →
    «Ya existe una cuenta con este correo.».
  - Desactivar un cliente con cuenta también lo banea en Auth con la secret key, y si Auth falla
    se revierte, igual que `setUserStatus` en la spec 002.
- **Sin TanStack Query**: igual que en `users`, RSC + Server Actions + `revalidatePath` bastan.
- **Formularios**: React Hook Form + Zod 4. La utilidad `normalizeMobile` en
  `core/utils/phone.utils.ts` es compartida por el registro, el perfil y la ficha.

### Extracción a `core` (estándar de tarjetas-filtro, segunda pantalla)

`users-summary`, `users-filter-bar` y `users-filter.utils` pasan a componentes genéricos de
`core`:

- `summary-filter-cards`
- `filter-bar`
- `status-filter.utils`

`users` y `customers` los usan con sus propias opciones y textos. Las pruebas de `users` siguen
en verde sin cambiar su comportamiento.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | componente + e2e | `__test__/.../sign-up-form.component.test.tsx`, `e2e/sign-up.spec.ts` |
| CA-02 | sandbox + e2e | `__test__/sandbox/sign-up.sandbox.test.ts` (correo en Mailpit, sin sesión), `e2e/sign-up.spec.ts` |
| CA-03 | e2e | `e2e/sign-up.spec.ts` (abre el enlace de Mailpit → «Mi perfil») |
| CA-04 | sandbox + e2e | `sign-up.sandbox.test.ts` (`email_not_confirmed` solo con contraseña correcta), `e2e/sign-up.spec.ts` (mensaje + reenvío) |
| CA-05 | unit + e2e | `confirm` route test, `e2e/sign-up.spec.ts` (enlace usado) |
| CA-06 | unit + componente | `sign-up.schema.test.ts`, `sign-up-form.component.test.tsx` |
| CA-07 | sandbox | `sign-up.sandbox.test.ts` (mismo resultado; nombre y contraseña de la cuenta existente intactos) |
| CA-08 | componente + e2e | `nav-links.component.test.tsx`, `e2e/customer-access.spec.ts` |
| CA-09 | unit + e2e | `access.utils.test.ts`, `e2e/customer-access.spec.ts` |
| CA-10 | pgTAP + sandbox | `05_customers.test.sql` (RLS), `__test__/sandbox/customers-access.sandbox.test.ts` (peticiones directas con sesión de cliente) |
| CA-11 | pgTAP + e2e | `05_customers.test.sql`, `e2e/customer-access.spec.ts` |
| CA-12 | e2e | `e2e/my-profile.spec.ts` |
| CA-13 | e2e | `e2e/my-profile.spec.ts` (y lo ve el personal en la ficha) |
| CA-14 | unit + componente + pgTAP | `customer.schema.test.ts`, `my-profile-form.component.test.tsx`, `05_customers.test.sql` (el cliente no cambia su correo ni `disabled_at`) |
| CA-15 | e2e | `e2e/customers.spec.ts` |
| CA-16 | unit + pgTAP + e2e | `customers-filter.utils.test.ts` (normalización), `05_customers.test.sql` (`search_text` sin tildes), `e2e/customers.spec.ts` |
| CA-17 | componente + e2e | `summary-filter-cards.component.test.tsx`, `e2e/customers.spec.ts` (filtro + búsqueda + recarga + «Ver todos») |
| CA-18 | e2e | `e2e/customers.spec.ts` |
| CA-19 | pgTAP + sandbox | `05_customers.test.sql` (sin ficha hasta confirmar), `sign-up.sandbox.test.ts` |
| CA-20 | pgTAP + manual | `05_customers.test.sql` (alta con `provider = google`, foto, consentimiento); verificación manual con Google real en preview |
| CA-21 | pgTAP + manual | `05_customers.test.sql` (confirmación posterior de una cuenta existente sin duplicar); manual en preview |
| CA-22 | unit + e2e | `auth-errors.utils.test.ts`, `e2e/customer-access.spec.ts` (seed desactivado) |
| CA-23 | pgTAP | `05_customers.test.sql` (identidad Google sobre personal: sin ficha) |
| CA-24 | e2e | `e2e/customers-counter.spec.ts` (sin correo en Mailpit) |
| CA-25 | unit + componente | `customer.schema.test.ts`, `customer-form.component.test.tsx` |
| CA-26 | pgTAP + e2e | `05_customers.test.sql`, `e2e/customers-counter.spec.ts` |
| CA-27 | pgTAP + e2e | `05_customers.test.sql` (correo bloqueado con cuenta), `e2e/customers-counter.spec.ts` |
| CA-28 | pgTAP + e2e | `05_customers.test.sql`, `e2e/customers-counter.spec.ts` (ficha de mostrador → registro → una sola fila «Con cuenta») |
| CA-29 | e2e | `e2e/customers-disable.spec.ts` (con sesión abierta del cliente) |
| CA-30 | e2e + pgTAP | `e2e/customers-disable.spec.ts`, `05_customers.test.sql` (vuelve a `walk_in` sin cuenta) |
| CA-31 | componente + pgTAP + sandbox | `customer-detail.component.test.tsx`, `05_customers.test.sql`, `customers-access.sandbox.test.ts` |
| RN-11 | pgTAP + sandbox | `04_staff_invitations.test.sql`, `sign-up.sandbox.test.ts` (`signUp` con `role: admin` → cliente) |

La auditoría axe (`e2e/a11y.spec.ts`) añade registro, «Mi perfil», «Clientes», la ficha y la
política.

## Archivos afectados

**Nuevos**
- `packages/supabase`:
  - migraciones `<ts>_staff_invitations.sql` y `<ts>_customers.sql`;
  - `seeds/02_customers.sql`;
  - pruebas `tests/04_staff_invitations.test.sql` y `tests/05_customers.test.sql`;
  - `templates/confirmation.html`.
- `apps/web/src`:
  - `app/auth/sign-up/page.tsx`, `app/privacy/page.tsx` y `app/(app)/profile/page.tsx`;
  - `app/(app)/customers/page.tsx` y `app/(app)/customers/[id]/page.tsx`;
  - el módulo `modules/customers/**`;
  - `auth` (`sign-up-form`, `sign-up.schema`);
  - `core` (`summary-filter-cards`, `filter-bar`, `status-filter.utils`, `phone.utils`).
- Pruebas en `__test__/**`, `__test__/sandbox/{sign-up,customers-access}.sandbox.test.ts` y
  `e2e/{sign-up,customer-access,my-profile,customers,customers-counter,customers-disable}.spec.ts`.

**Modificados**
- `config.toml`:
  - `enable_signup = true` y `[auth.email] enable_confirmations = true`;
  - plantilla `confirmation`;
  - `email_sent` local más alto, para las pruebas.
- `seeds/01_users.sql`, `tests/01..03`, `scripts/bootstrap-admin.mjs` (crea la invitación antes
  de invitar).
- `proxy.ts`, `access.utils.ts`, `auth.server.ts`, `auth.types.ts`, `auth.actions.ts`,
  `auth-errors.utils.ts`, `confirm/route.ts`, `callback/route.ts` (comentarios),
  `invalid-link` (tipo `email`), `login-form`, `nav-links`, `app-header`, `user-menu`,
  `role-chip`, `(app)/layout.tsx`, `(app)/page.tsx`, `admin/users/page.tsx` (`requireStaff`).
- `users.actions.ts`: `inviteUser` inserta la invitación con la sesión del admin, comprueba
  `email_in_use` y, si falla el envío, borra la invitación.
- `users-screen` y la extracción a `core`; `messages`.
- Fixtures de sandbox y e2e: `createUser` del personal crea antes la invitación.
- `CLAUDE.md` y `packages/supabase/CLAUDE.md`: tipos de cuenta, registro público, seeds nuevos y
  componentes de `core`.
- `specs/product.md`: rol Cliente.

**Eliminados**: `users-summary`, `users-filter-bar` y `users-filter.utils` (sustituidos por los
de `core`).

## Dependencias nuevas

Ninguna en npm. En Postgres, las extensiones `unaccent` y `pg_trgm`, justificadas en la sección
de base de datos.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| **1.** El personal nace solo de `staff_invitations` | Seguir confiando en `raw_user_meta_data.role` (lo escribe cualquiera con registro público). `app_metadata` vía `createUser` + invitación (depende de si Auth escribe `app_metadata` en el mismo `insert`, sin documentar). Hook *before user created* (otra pieza de configuración remota). | Es determinista, vive en Postgres y RLS lo protege. |
| **2.** Una persona `invited` solo se activa con una sesión de enlace (`amr`) | Confiar en que el registro público nunca cambie la contraseña de un usuario sin confirmar. | Si Auth reescribe la contraseña de un usuario sin confirmar cuando alguien se registra con su correo, un atacante podría registrar el correo de un invitado y activarse como personal tras el clic de la víctima. T-001 lo comprueba; la mitigación es barata y se aplica igual. |
| **3.** La ficha del cliente nace al **confirmar** el correo | Crearla en el alta y filtrar por confirmación. | RN-07 y CA-19 sin filtros por todas partes. Vincular una ficha del mostrador exige demostrar que el correo es tuyo (CA-28). |
| **4.** Tabla `customers` separada de `profiles` | Añadir el rol `customer` a `profiles`. | Un cliente puede no tener cuenta (`user_id` null) y tiene otros datos. Mezclarlos ensuciaría las reglas del personal (último admin, invitaciones) y la gestión de usuarios (CA-11). |
| **5.** `status` y `search_text` como columnas generadas | Calcularlos en la app. | Una sola fuente de verdad, filtrable e indexable desde PostgREST. |
| **6.** Los totales de las tarjetas no dependen de la búsqueda | Que también se filtren con la búsqueda. | Igual que en Usuarios: las tarjetas resumen la base completa y la línea de conteo muestra el resultado filtrado. |
| **7.** Paginación en el servidor (`range` + `count`) | Traer todo y filtrar en el cliente (como Usuarios). | Los clientes serán miles (RF-05, rendimiento). |

**Comportamientos de Auth a verificar en T-001 (spike, antes de construir)**
1. `raw_app_meta_data.provider` ya está en el `insert` de `auth.users`, tanto en el registro por
   correo como en Google.
2. Qué pasa al registrarse con un correo que existe sin confirmar: ¿cambia la contraseña o los
   metadatos? ¿Reenvía el correo?
3. Los valores de `amr` tras `verifyOtp` de tipo `invite`, `recovery` y `email`, y tras
   entrar con contraseña.
4. Si `signInWithPassword` devuelve `email_not_confirmed` solo cuando la contraseña es correcta.
5. Google con un correo que ya tiene una cuenta sin confirmar (CA-21). No se puede automatizar
   en local, así que se verifica manualmente en preview junto con la T094 de la spec 002.

Si un resultado contradice el plan, se actualiza el plan (y la spec si cambia lo observable)
antes de seguir.

## Despliegue

1. **Migraciones**, por `db-deploy` al entrar en `develop`: primero `staff_invitations` y luego
   `customers`.
2. **Supabase remoto** (panel):
   - activar el registro y la confirmación por correo;
   - plantilla `confirmation` en español;
   - URL de redirección `/auth/confirm`;
   - Google habilitado.
3. **SMTP propio obligatorio antes de abrir el registro**: el SMTP por defecto de Supabase
   permite muy pocos correos por hora.
4. **Política de tratamiento de datos**: el negocio revisa el texto base antes de abrir el
   registro en producción (suposición de la spec).
5. **Vercel**: sin variables nuevas.

## Historial del plan

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Creación (borrador). |
| 2026-11-19 | Aprobado por el usuario. |
