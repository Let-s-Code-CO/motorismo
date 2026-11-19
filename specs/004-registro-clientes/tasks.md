---
spec: "004"
actualizado: 2026-11-19
---

# Tareas — 004 Registro de clientes y sección Clientes

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`, `RN-xx`) y termina en algo verificable (→).
- Las pruebas se escriben antes que el código y se ven en **rojo**. Si una ya pasa al escribirla,
  se muta el código para verla fallar (ver la Definición de terminado en `CLAUDE.md`).
- Todo va en la rama `feature/004-registro-clientes`. El **bloque A** (P1) deja la app
  desplegable por sí solo; el **bloque B** (P2/P3) completa la spec.
- Rutas abreviadas: `sb/` = `packages/supabase/supabase/`, `web/` = `apps/web/`.

---

## Bloque A — P1: registro con correo, permisos del cliente, Mi perfil y consulta de clientes (HU-01 a HU-04)

### Fase A0 — Spike de Auth

- [ ] T001 Comprobar contra el Supabase local, con el registro y la confirmación activados
      temporalmente (script en el scratchpad, sin tocar el repo), los puntos 1 a 4 de «Riesgos»
      del plan:
      1. `provider` en `raw_app_meta_data` al hacer el `insert`;
      2. qué pasa al registrarse de nuevo con un correo sin confirmar;
      3. valores de `amr` según el tipo de sesión;
      4. si `email_not_confirmed` solo sale con la contraseña correcta.

      → resultados anotados en el plan (Historial). Si alguno contradice el plan, se actualiza
      antes de seguir.

### Fase A1 — Base de datos

- [ ] T002 [P] pgTAP `sb/tests/04_staff_invitations.test.sql`:
      - estructura, RLS, `policies_are` y privilegios (`anon` nada; `authenticated` solo
        `insert`/`delete` como admin);
      - la invitación crea el `profile` con su nombre, rol e invitador y se consume;
      - un alta con `role: admin` en los metadatos y sin invitación **no** crea personal (RN-11);
      - un alta de cliente sin nombre o sin `data_consent` se rechaza (RN-04);
      - `email_in_use` mira `auth.users`, `profiles` y `customers`, sin distinguir mayúsculas
        (RN-01)

      → `pnpm db:test` **rojo**
- [ ] T003 [P] Ajustar los fixtures de `sb/tests/01_profiles`, `02_profiles_rules` y
      `03_profiles_avatar`: crear la invitación antes de insertar en `auth.users`
      → siguen en rojo hasta T004 (dependen de la tabla nueva)
- [ ] T004 Migración `<ts>_staff_invitations.sql` (`migration:new staff_invitations < /dev/null`):
      - tabla, RLS y privilegios;
      - `handle_new_auth_user()` reescrita (invitación → personal; si no, validación de cliente);
      - `email_in_use()`

      (RN-01, RN-04, RN-11) → T002 y T003 en **verde**
- [ ] T005 [P] pgTAP `sb/tests/05_customers.test.sql`, parte A:
      - enums, columnas, checks e índices; RLS, `policies_are` y privilegios por columna;
      - `status` generado (`registered`/`walk_in`/`disabled`);
      - normalización del celular y del correo (RN-03);
      - la ficha nace al confirmar el correo y no antes (CA-19, RN-07), con `origin = self_signup`
        y `consent_at` = fecha del alta (RF-07);
      - el cliente lee y edita solo su fila, solo `full_name`/`phone`, y no cambia su correo ni
        `disabled_at` (CA-10, CA-14);
      - el cliente no lee `profiles` y el personal no aparece en `customers` (CA-11);
      - `search_text` encuentra «José» buscando «jose» (CA-16);
      - `current_account()` e `is_staff()`

      → **rojo**
- [ ] T006 Migración `<ts>_customers.sql`:
      - extensiones `unaccent` y `pg_trgm`, `immutable_unaccent()`;
      - enums, tabla con columnas generadas e índices (incluido GIN trigram);
      - trigger de alta al confirmar (con vinculación de ficha);
      - `customers_guard` completa (también las reglas del bloque B);
      - extensión de `sync_profile_avatar_from_identity` a `customers`;
      - `is_staff()`, `current_account()`, `customer_status_counts()`, RLS y privilegios

      → T005 en **verde**
- [ ] T007 [P] `sb/config.toml`:
      - `enable_signup = true` y `[auth.email] enable_confirmations = true`;
      - plantilla `confirmation`;
      - `email_sent` local suficiente para las pruebas.

      Plantilla `sb/templates/confirmation.html` en español, con enlace a
      `/auth/confirm?token_hash=…&type=email` (RF-03, RNF idioma)
      → `pnpm db:stop && pnpm db:start` sin errores
- [ ] T008 Seeds:
      - `01_users.sql` crea primero las invitaciones del personal;
      - nuevo `02_customers.sql` con `cliente@` (con cuenta), `cliente.google@` (con foto), dos
        sin cuenta (uno solo con celular) y `cliente.desactivado@` (baneado)

      → `pnpm db:reset` sin errores y login de `cliente@` en Studio/API.
      **Cuenta de prueba para usar la app como cliente** (petición del usuario):
      `cliente@motorismo.test` / `motorismo-local`, con celular y entrada directa a «Mi perfil»
- [ ] T009 `pnpm db:types` + `scripts/bootstrap-admin.mjs` (crea la invitación antes de invitar)
      → `types:check` en verde; el bootstrap funciona en el sandbox y se niega si ya hay un admin

### Fase A2 — Pruebas de la aplicación (rojo)

- [ ] T010 [P] `access.utils.test.ts`, ampliado:
      - cuenta `customer` activa y desactivada;
      - el cliente en `/` o en una ruta de entrada va a `/profile`;
      - `/auth/sign-up` es de entrada y `/privacy` es pública con y sin sesión;
      - un personal `invited` sin sesión de enlace (`amr`) sale

      (CA-09, CA-29, RF-02, RF-03) → **rojo**
- [ ] T011 [P] `phone.utils.test.ts` (`+57`, espacios, guiones, 9/11 dígitos, no empieza por 3) y
      `sign-up.schema.test.ts` (cada campo y el consentimiento) (CA-06, RN-03, RN-04) → **rojo**
- [ ] T012 [P] `auth-errors.utils.test.ts`: `email_not_confirmed` se traduce a
      `emailNotConfirmed` y `user_banned` a cuenta desactivada (CA-04, CA-22) → **rojo**
- [ ] T013 [P] `sign-up-form.component.test.tsx`: campos, errores junto a cada campo, casilla con
      enlace a la política y mensaje de «revisa tu correo» (CA-01, CA-02, CA-06) → **rojo**
- [ ] T014 [P] `nav-links.component.test.tsx`: el cliente solo ve «Mi perfil»; el operador ve
      Inicio y Clientes; el admin, además, Usuarios (CA-08, RF-04) → **rojo**
- [ ] T015 [P] `customer.schema.test.ts` (Mi perfil) y `my-profile-form.component.test.tsx`
      (correo de solo lectura, errores, «Tus datos se guardaron.») (CA-13, CA-14) → **rojo**
- [ ] T016 [P] `customers-filter.utils.test.ts`: parseo de `q`/`status`/`page` (valores
      inválidos, página 0 o negativa → 1) y `normalizeSearch` (mayúsculas y tildes)
      (CA-16, CA-17, RF-05) → **rojo**
- [ ] T017 [P] Pruebas de `core`: `summary-filter-cards` y `filter-bar`, a partir de las de
      `users-summary`/`users-filter-bar`, más `status-filter.utils` (CA-17) → **rojo**
- [ ] T018 Sandbox `__test__/sandbox/sign-up.sandbox.test.ts`:
      - registro → correo en Mailpit, sin sesión y sin ficha (CA-02, CA-19);
      - con la contraseña correcta, sin confirmar → `email_not_confirmed` (CA-04);
      - un correo existente da la misma respuesta y su nombre y contraseña quedan intactos
        (CA-07);
      - `role: admin` en los metadatos → cliente (RN-11).

      Los fixtures de personal en `__test__/sandbox/support` y `e2e/support` crean antes la
      invitación → **rojo**
- [ ] T019 Sandbox `__test__/sandbox/customers-access.sandbox.test.ts`, con la sesión de un
      cliente: no lee otros clientes ni `profiles`, no cambia `disabled_at` ni su correo, y no
      inserta clientes (CA-10) → **rojo**

### Fase A3 — Implementación (verde)

- [ ] T020 `users.actions.ts`:
      - `inviteUser` comprueba `email_in_use`, inserta la invitación con la sesión del admin
        (RLS), invita y, si falla el envío, borra la invitación;
      - `resendInvite` sin cambios de comportamiento

      → `invite.sandbox.test.ts` y `e2e/invite.spec.ts` (spec 002) en **verde**
- [ ] T021 `auth.types.ts` + `auth.server.ts`:
      - `CurrentAccount` como unión discriminada;
      - `getCurrentAccount`, `requireStaff`, `requireCustomer`, `getActiveStaff` y
        `getActiveAdmin`;
      - `(app)/layout`, `(app)/page` y `admin/users/page` pasan a usarlos

      → `ts:check` y pruebas de 002 en verde
- [ ] T022 `access.utils.ts` + `proxy.ts`: `rpc('current_account')` y `amr` de los claims. Además
      `setPassword` solo activa con una sesión de enlace (riesgo 2) → T010 en **verde**
- [ ] T023 [P] `core/utils/phone.utils.ts` y `auth/schemas/sign-up.schema.ts` → T011 en **verde**
- [ ] T024 Acciones `signUp` y `resendConfirmation`, más `mapAuthError` → T012 y T018 en
      **verde**
- [ ] T025 Página `/auth/sign-up` + `sign-up-form`. En el login, enlace «Crear cuenta» y, si el
      correo no está confirmado, mensaje con «Reenviar correo de confirmación» (CA-01, CA-04)
      → T013 en **verde**
- [ ] T026 La ruta `/auth/confirm` acepta `type=email` y lleva a `/profile`. `invalid-link` de
      tipo `email` ofrece reenviar la confirmación. Más la prueba unitaria de la ruta
      (CA-03, CA-05) → verde
- [ ] T027 [P] Página `/privacy` con el texto base de la política, en `messages/es.json`
      (RF-03, RN-04)
- [ ] T028 Cabecera según la cuenta: `nav-links`, `user-menu`, chip «Cliente» y avatar con foto
      (CA-08, RF-04) → T014 en **verde**
- [ ] T029 `/profile`: página, `my-profile-form` y la acción `updateMyProfile` (sesión del
      cliente, RLS) (CA-12, CA-13, CA-14) → T015 en **verde**
- [ ] T030 Extracción a `core` de `summary-filter-cards`, `filter-bar` y `status-filter.utils`.
      `users` los usa y se borran los suyos → T017 y las pruebas de `users` en **verde**, sin
      cambios en `e2e/users-filter.spec.ts`
- [ ] T031 Módulo `customers`: `customers-filter.utils`, `api/customers.server.ts`
      (`listCustomers` con `range` + `count`, `getCustomer`, `countByStatus`, `getMyCustomer`)
      y `messages/es.json` registrado en `i18n/messages.ts` → T016 en **verde**
- [ ] T032 `/customers`:
      - `customers-screen` y `customers-table`, con estado, origen y avatar;
      - búsqueda con espera de 300 ms en la URL;
      - tarjetas-filtro y paginación de 20

      (CA-15, CA-16, CA-17, RF-05) → verificado en el navegador
- [ ] T033 `/customers/[id]` (ficha de solo lectura en este bloque: CA-18). Tarjeta «Clientes» en
      el inicio del personal y enlace en el menú (RF-04) → verificado en el navegador

### Fase A4 — E2E

- [ ] T034 Helpers de Mailpit para el correo de confirmación en `e2e/support`. Nuevo
      `e2e/sign-up.spec.ts`: registro → mensaje → confirmar → «Mi perfil»; login sin confirmar
      → reenvío; enlace usado → inválido; errores de validación (CA-01 a CA-06)
- [ ] T035 `e2e/customer-access.spec.ts`:
      - el cliente solo ve «Mi perfil»;
      - `/customers` y `/admin/users` le muestran «No tienes permiso» con enlace a su perfil;
      - los clientes no aparecen en Usuarios ni el personal en Clientes

      (CA-08, CA-09, CA-11, CA-12)
- [ ] T036 `e2e/my-profile.spec.ts`: el cliente edita su nombre y su celular y el personal los
      ve en la ficha; un celular inválido no se guarda (CA-12, CA-13, CA-14)
- [ ] T037 `e2e/customers.spec.ts`: lista ordenada, búsqueda sin tildes, «No hay clientes que
      coincidan…», tarjetas + búsqueda + recarga + «Ver todos», ficha, y un registro sin
      confirmar que no aparece (CA-15 a CA-19)
- [ ] T038 `e2e/a11y.spec.ts`: registro, política, «Mi perfil», «Clientes» y la ficha
      (RNF accesibilidad)

### Fase A5 — Definición de terminado del bloque A

- [ ] T039 `pnpm lint` · `ts:check` · `test` · `test:sandbox` · `build` · `test:e2e` ·
      `db:reset` · `db:test` · `types:check` en verde. Mutaciones de las pruebas nuevas
      anotadas y revertidas (`git diff` + grep limpios). Commit del bloque.

---

## Bloque B — P2/P3: Google, punto de atención y desactivar (HU-05, HU-06, HU-07)

### Fase B1 — Base de datos (las reglas existen desde T006: se ven fallar mutándolas)

- [ ] T050 pgTAP `05_customers.test.sql`, parte B:
      - **Google**:
        - un alta con `provider = google` crea la ficha al instante con `origin = google`, la
          foto y `consent_at` (CA-20);
        - la foto se refresca al volver a entrar con Google (CA-20);
        - confirmar una cuenta existente no la duplica (CA-21);
        - una identidad de Google sobre alguien del personal no crea ficha (CA-23).
      - **Altas desde la API**: se fuerzan `origin = counter` y `registered_by`, y no hay
        `user_id` (CA-24).
      - **Correo duplicado** con el de otro cliente o del personal → `customer_email_taken`
        (CA-26).
      - **Correo bloqueado** si el cliente tiene cuenta (CA-27, RN-10).
      - **Vinculación**: una ficha sin cuenta se une al confirmar con ese correo y completa el
        celular (CA-28).
      - **Desactivar**: `disabled_at` solo lo cambia un admin (CA-31, RN-09); reactivar vuelve a
        `walk_in` o a `registered` (CA-30); no hay `delete` (RN-08).

      → verde, con cada regla mutada y vista en rojo

### Fase B2 — Pruebas de la aplicación (rojo)

- [ ] T051 [P] `customer.schema.test.ts`, alta y edición en el punto de atención: nombre,
      correo o celular (al menos uno), formatos y autorización obligatoria (CA-25, RN-02)
      → **rojo**
- [ ] T052 [P] `customer-form.component.test.tsx`: errores junto a cada campo, sin autorización
      no se envía y el correo está bloqueado si hay cuenta (CA-25, CA-27) → **rojo**
- [ ] T053 [P] `customer-detail.component.test.tsx`: el operador no ve desactivar/reactivar y el
      admin sí (CA-31) → **rojo**
- [ ] T054 [P] Botón de Google en el registro con el aviso de autorización y enlace a la política
      (CA-20) → **rojo**
- [ ] T055 Sandbox `customers-access.sandbox.test.ts`, ampliado: un operador no puede desactivar
      por la API (CA-31) → **rojo**

### Fase B3 — Implementación (verde)

- [ ] T056 Acción `createCustomer` + modal «Nuevo cliente» en `/customers`, con los `hint` →
      mensajes (CA-24, CA-25, CA-26) → T051 en **verde**
- [ ] T057 Acción `updateCustomer` + `customer-form` de edición en la ficha (CA-27)
      → T052 en **verde**
- [ ] T058 Acción `setCustomerDisabled` (RLS + baneo en Auth, que se revierte si falla) y los
      botones en la ficha, solo para el admin (CA-29, CA-30, CA-31) → T053 y T055 en **verde**
- [ ] T059 Google en el registro, con el aviso de autorización. Comentarios de
      `signInWithGoogle` y `auth/callback` al día (ya no hay «solo invitados») (CA-20, CA-23)
      → T054 en **verde**

### Fase B4 — E2E

- [ ] T060 `e2e/customers-counter.spec.ts`:
      - crear un cliente solo con celular (sin correo en Mailpit);
      - correo duplicado → mensaje;
      - editar;
      - correo bloqueado con cuenta;
      - ficha del punto de atención → registro con ese correo → una sola fila «Con cuenta»

      (CA-24 a CA-28)
- [ ] T061 `e2e/customers-disable.spec.ts`:
      - el admin desactiva a un cliente con la sesión abierta y este sale con el mensaje
        (CA-29);
      - el seed desactivado no entra (CA-22);
      - al reactivarlo vuelve a entrar (CA-30);
      - el operador no ve la opción (CA-31)
- [ ] T062 `e2e/a11y.spec.ts`: modal «Nuevo cliente» y ficha en modo edición

### Fase B5 — Definición de terminado y documentación

- [ ] T063 Definición de terminado completa, como en T039, y mutaciones anotadas
- [ ] T064 Documentación:
      - `CLAUDE.md`: tipos de cuenta, registro público, `core` de tarjetas-filtro, usuarios
        locales nuevos (incluida la cuenta de prueba de cliente `cliente@motorismo.test`);
      - `packages/supabase/CLAUDE.md`: invitaciones, `customers`, seeds y `config.toml`;
      - `specs/product.md`: rol Cliente, sin «no hay registro público»;
      - spec, plan y backlog al día

      → commit del bloque

### Fase B6 — Despliegue y verificación manual (requiere al usuario)

- [ ] T090 Supabase remoto:
      - registro y confirmación de correo activados;
      - plantilla `confirmation` en español;
      - redirección `/auth/confirm`;
      - SMTP propio configurado **antes** de abrir el registro
- [ ] T091 El negocio revisa y entrega el texto de la política de tratamiento de datos
- [ ] T092 Verificación manual con Google real en preview, junto con la T094 de la spec 002:
      - alta nueva con foto (CA-20);
      - correo con cuenta sin confirmar (CA-21, punto 5 del spike);
      - cliente desactivado (CA-22);
      - personal (CA-23)

---

## Cobertura de criterios

| CA | Tareas de prueba |
|---|---|
| CA-01 | T013, T034 |
| CA-02 | T013, T018, T034 |
| CA-03 | T026, T034 |
| CA-04 | T012, T018, T034 |
| CA-05 | T026, T034 |
| CA-06 | T011, T013, T034 |
| CA-07 | T018 |
| CA-08 | T014, T035 |
| CA-09 | T010, T035 |
| CA-10 | T005, T019 |
| CA-11 | T005, T035 |
| CA-12 | T035, T036 |
| CA-13 | T015, T036 |
| CA-14 | T005, T015, T036 |
| CA-15 | T037 |
| CA-16 | T005, T016, T037 |
| CA-17 | T016, T017, T037 |
| CA-18 | T037 |
| CA-19 | T005, T018, T037 |
| CA-20 | T050, T054, T092 (manual) |
| CA-21 | T050, T092 (manual) |
| CA-22 | T012, T061 |
| CA-23 | T050, T092 (manual) |
| CA-24 | T050, T060 |
| CA-25 | T051, T052 |
| CA-26 | T050, T060 |
| CA-27 | T050, T052, T060 |
| CA-28 | T050, T060 |
| CA-29 | T010, T061 |
| CA-30 | T050, T061 |
| CA-31 | T050, T053, T055, T061 |
| RN-11 | T002, T018 |
