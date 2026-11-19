---
spec: "002"
actualizado: 2026-11-19
---

# Tareas — 002 Autenticación y roles

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`, `RN-xx`) y termina en algo verificable (→).
- Las pruebas se escriben antes que el código y se ven en **rojo**; si una ya pasa al escribirla,
  se muta el código para verla fallar (ver la Definición de terminado en `CLAUDE.md`).
- Todo va en la rama `feature/002-autenticacion-roles`. El **bloque A** (P1) deja la app
  desplegable por sí solo; el **bloque B** (P2/P3) completa la spec.
- Rutas abreviadas: `sb/` = `packages/supabase/supabase/`, `web/` = `apps/web/`.

---

## Bloque A — P1: iniciar sesión, permisos y altas (HU-01, HU-02, HU-03)

### Fase A1 — Base de datos

- [x] T001 [P] pgTAP de estructura y permisos en `sb/tests/01_profiles.test.sql`:
      enums, columnas y checks, índice único `lower(email)`, FK `restrict`, RLS activado,
      `policies_are`, `anon` sin privilegios, `authenticated` sin `insert`/`delete` y con `update`
      solo en `role`/`status`, y el operador solo ve su fila y no actualiza ninguna
      (CA-09, RF-02, RN-02, RN-05) → `pnpm db:test` **rojo** (la tabla no existe)
- [x] T002 [P] pgTAP de comportamiento en `sb/tests/02_profiles_rules.test.sql`:
      - el trigger crea el perfil desde los metadatos y rechaza un rol o nombre inválido;
      - un admin cambia el rol y el estado de otro (CA-18);
      - nadie cambia su propio rol o estado, tampoco un admin (CA-10);
      - nunca quedan 0 admins activos, tampoco con `service_role` (CA-21, RN-03);
      - un admin desactivado deja de ser admin (`is_admin()` = false);
      - fijar contraseña pasa `invited → active` (CA-14);
      - vincular identidad `google` pasa `invited → active` (CA-26);
      - `disabled → invited` se rechaza

      → `pnpm db:test` **rojo**
- [x] T003 Migración `sb/migrations/<ts>_auth_profiles.sql` (con `migration:new auth_profiles`):
      enums, tabla `profiles`, trigger de `updated_at`, `current_profile_role()`, `is_admin()`,
      RLS, políticas y privilegios de columna (RF-02, RF-03, CA-09) → T001 en **verde**
- [x] T004 Triggers en la misma migración: `on_auth_user_created`, `on_auth_user_password_set`,
      `on_auth_identity_linked`, `profiles_guard` (CA-10, CA-14, CA-21, CA-26, RN-03)
      → T002 en **verde**. Confirma el riesgo 3 del plan (triggers sobre `auth.*` permitidos)
- [x] T005 [P] `sb/config.toml`: `enable_signup = false`, `minimum_password_length = 8`,
      `otp_expiry = 86400`, `site_url`, límite local de `email_sent` y plantillas de
      invitación/recuperación (RN-01, RN-04, RN-07) → `pnpm db:reset` sin errores
- [x] T006 [P] Plantillas en español `sb/templates/invite.html` y `recovery.html`, con enlace a
      `/auth/confirm?token_hash=…&type=…` (RNF idioma) → visibles en Mailpit tras una invitación
      manual
- [x] T007 Seeds `sb/seeds/01_users.sql`: `admin@`, `operador@` y `desactivado@motorismo.test`
      (contraseña `motorismo-local`; el desactivado, además, baneado) → `pnpm db:reset` + login
      manual en Studio
- [x] T008 Regenerar tipos (`pnpm db:types`) → `types:check` en verde y `ts:check` en verde
- [x] T009 Script `packages/supabase/scripts/bootstrap-admin.mjs` + script `admin:bootstrap`
      + dependencia `@supabase/supabase-js` (RF-06) → invita a un admin en el sandbox y se niega
      si ya existe uno

### Fase A2 — Infraestructura de la app y pruebas en rojo

- [x] T010 `web/src/modules/core/config/env.config.ts`: añadir `SUPABASE_SECRET_KEY` (servidor),
      `NEXT_PUBLIC_SITE_URL` y `getSiteUrl()`; actualizar `.env.example` y su test (casos nuevos
      escritos primero) → test en rojo y luego en verde
- [x] T011 [P] `web/src/modules/core/lib/supabase-proxy.lib.ts` y `supabase-admin.lib.ts`
      (`server-only`) → `ts:check`
- [x] T012 Infraestructura de pruebas sandbox:
      - `web/vitest.sandbox.config.mts` y script `test:sandbox`;
      - `web/__test__/sandbox/support/` con el cliente admin, `signInAs(seedUser)` y el cliente de
        Mailpit (último correo de una dirección y extracción del enlace)

      → un test trivial conecta con el sandbox
- [x] T013 [P] `web/__test__/sandbox/invite.sandbox.test.ts`:
      - invitar con el registro desactivado crea el perfil `invited` y deja un correo en español
        en Mailpit (CA-11, riesgo 1);
      - Auth **reenvía** la invitación a un correo sin confirmar en lugar de fallar (documenta por
        qué hace falta la comprobación previa de CA-12);
      - el reenvío invalida el enlace anterior y el nuevo funciona (CA-16)

      → **rojo**
- [x] T014 [P] `web/__test__/sandbox/access.sandbox.test.ts`:
      - el operador, con peticiones REST directas, solo lee su perfil y no puede actualizar
        ninguno (CA-09);
      - `signUp` falla con el registro desactivado (CA-27, RN-01);
      - `admin:bootstrap` se niega si ya hay un admin (RF-06)

      → verde tras la fase A1 (verifica la BD)
- [x] T015 [P] `web/__test__/src/modules/auth/utils/access.utils.test.ts`:
      - matriz de `decideAccess`: ruta pública o protegida × sin sesión, `active`, `invited`,
        `disabled` o sin perfil × cookie de actividad vigente, ausente o de más de 7 días
        (CA-03, CA-05, CA-06, CA-19);
      - `sanitizeNextPath`: rechaza URLs absolutas, `//evil`, `javascript:` y rutas `/auth/*`

      → **rojo**
- [x] T016 [P] `web/__test__/src/modules/auth/utils/auth-errors.utils.test.ts`:
      - `invalid_credentials` y usuario inexistente → el mismo mensaje (CA-02, RN-06);
      - `user_banned` → cuenta desactivada;
      - `signup_disabled` → cuenta de Google sin acceso;
      - `otp_expired` → enlace no válido;
      - código desconocido → mensaje genérico

      → **rojo**
- [x] T017 [P] Tests de esquemas en `web/__test__/src/modules/{auth,users}/schemas/`:
      - `login`;
      - `set-password`: mínimo 8 y confirmación igual (RN-04);
      - `invite-user`: nombre vacío o con solo espacios, más de 120 caracteres, correo inválido
        y rol ausente o desconocido (CA-13)

      → **rojo**
- [x] T018 [P] `web/__test__/src/modules/users/actions/users.actions.test.ts` (`inviteUser`):
      - un operador es rechazado antes de tocar Auth (CA-09);
      - un correo existente devuelve «Ya existe un usuario con este correo.» sin llamar a Auth
        (CA-12);
      - una entrada inválida devuelve errores por campo (CA-13);
      - en el caso válido llama a `inviteUserByEmail` con `full_name`, `role`, `invited_by` y
        `redirectTo`

      → **rojo**
- [x] T019 [P] Tests de componentes en `web/__test__/src/modules/…`:
      - `user-menu`: nombre, rol y cerrar sesión (CA-01, RF-05);
      - `app-header`: el operador no ve «Usuarios» y el admin sí (CA-07);
      - `no-permission`: texto y enlace al inicio (CA-08);
      - `users-table`: columnas y los tres estados (CA-17);
      - `invite-user-modal`: error junto a cada campo (CA-13);
      - `login-form`: muestra el error que recibe (CA-02)

      → **rojo**
- [x] T020 [P] Test de la ruta `auth/confirm` en
      `web/__test__/src/app/auth/confirm/route.test.ts`: `verifyOtp` falla → página de enlace no
      válido (CA-15); va bien → `/auth/set-password` → **rojo**

### Fase A3 — Implementación (verde)

- [x] T030 `modules/auth/utils/access.utils.ts` y `auth-errors.utils.ts` → T015 y T016 en verde
- [x] T031 `modules/auth/types/auth.types.ts` y `api/auth.server.ts`: `getCurrentUser` (React
      `cache`), `requireUser` y `requireAdmin` (RF-03) → `ts:check`
- [x] T032 `web/src/proxy.ts`: refrescar la sesión, consultar el perfil, `decideAccess`, cerrar
      sesión cuando toque y gestionar la cookie `mt_last_seen` (RF-01, CA-03, CA-05, CA-06,
      CA-19) → prueba manual con los tres seeds
- [x] T033 [P] Esquemas Zod de `auth` y `users` → T017 en verde
- [x] T034 [P] `modules/auth/messages/es.json` y `modules/users/messages/es.json`, registrados en
      `src/i18n/messages.ts`
- [x] T035 `modules/auth/actions/auth.actions.ts`: `signIn`, `signOut` y `setPassword`, que fijan
      o borran `mt_last_seen` (CA-01, CA-02, CA-04, CA-14)
- [x] T036 Rutas de autenticación: `(auth)/auth/login`, `(auth)/auth/set-password` y
      `auth/confirm/route.ts`, con los componentes `login-form`, `set-password-form` y
      `role-chip` → T020 y parte de T019 en verde
- [x] T037 Zona autenticada: `(app)/layout.tsx` con `app-header` y `user-menu`, y `(app)/page.tsx`
      con el inicio «Hola, {nombre}» (RF-05, CA-01, CA-07). Se eliminan `src/app/page.tsx`,
      `welcome.component.tsx`, su test y `e2e/home.spec.ts` → T019 (`user-menu`, `app-header`)
      en verde
- [x] T038 Administración, lectura: `users/api/users.server.ts` (`listUsers`),
      `(app)/admin/users/page.tsx` con `requireAdmin` y `no-permission`, y `users-table`
      (CA-08, CA-17) → T019 (`users-table`, `no-permission`) en verde
- [x] T039 Administración, invitación: `inviteUser` en `users.actions.ts` y `invite-user-modal`
      (CA-11, CA-12, CA-13) → T018 y T019 (`invite-user-modal`) en verde
- [x] T040 `resendInvite` y el botón «Reenviar invitación» para usuarios `invited` (CA-16)
      → T013 en verde

### Fase A4 — E2E

- [x] T041 Infraestructura E2E:
      - `playwright.config.ts` contra el sandbox;
      - `web/e2e/support/` con login por rol (`storageState`) y cliente de Mailpit;
      - en `ci.yml`, el job `quality` arranca Supabase, ejecuta `db:reset` y pasa al build las
        variables (`SUPABASE_SECRET_KEY` local)

      → el pipeline local de E2E corre
- [x] T042 [P] `web/e2e/auth-login.spec.ts`: entra y ve nombre y rol (CA-01), contraseña o
      correo erróneos dan el mismo mensaje (CA-02), una página protegida lleva al login y luego
      vuelve (CA-03), `/auth/login` con sesión lleva al inicio (CA-05) y el seed desactivado no
      entra y ve el mensaje (CA-06)
- [x] T043 [P] `web/e2e/auth-logout.spec.ts`: cerrar sesión, botón «atrás» y URL directa (CA-04)
- [x] T044 [P] `web/e2e/roles.spec.ts`: el operador no ve «Usuarios» (CA-07) y en la URL directa
      ve «No tienes permiso…» (CA-08)
- [x] T045 `web/e2e/invite.spec.ts`: el admin invita, se abre el enlace de Mailpit, se crea la
      contraseña y la persona entra con estado Activo (CA-11, CA-14); abrir el mismo enlace otra
      vez da enlace no válido (CA-15)

### Fase A5 — Definición de terminado del bloque A

- [x] T046 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
      `pnpm build` · `pnpm test:e2e` en verde
- [x] T047 `pnpm db:reset` + `pnpm db:test` + `types:check` en verde
- [x] T048 Una mutación aplicada a cada test nuevo que no se vio en rojo; fallo observado,
      revertida y `git diff` limpio. Anotar las mutaciones aquí
- [x] T049 Documentación:
      - `CLAUDE.md`: sufijos `*.actions.ts` y `*.server.ts`, y `test:sandbox`;
      - `packages/supabase/CLAUDE.md`: seeds de usuarios y `admin:bootstrap`

**Registro del bloque A (2026-11-19)**

- Resultados: lint ✅ · `ts:check` ✅ · 102 unit ✅ · 8 sandbox ✅ · build ✅ · 10 E2E ✅ ·
  `db:reset` + pgTAP (3 archivos, 50 aserciones) ✅ · `types:check` ✅.
- Mutaciones vistas fallar y revertidas (`grep MUTATION` vacío):
  - BD: `current_profile_role` sin filtro de estado → fallan los casos de admin desactivado;
    política de lectura `using (true)` → falla «el operador solo ve su perfil» (pgTAP y sandbox);
    la identidad `email` también activa → falla su caso; `profiles_guard` vacío → fallan cambio
    propio, vuelta a invitado, último admin y columnas inmutables; políticas abiertas → fallan
    los dos casos de CA-09 del sandbox.
  - App: sin comprobación de admin en `inviteUser` → falla CA-09; `decideAccess` sin estado
    desactivado → fallan CA-06/CA-19; `sanitizeNextPath` acepta `/auth/*` → falla su caso;
    «Usuarios» visible para todos → falla CA-07; `user_not_found` distinto → falla CA-02;
    `setPassword` sin activación → falla CA-14 (escrito antes del cambio).
  - E2E: el recorrido de invitación detectó que el trigger de contraseña activaba al abrir el
    enlace; se corrigió (ver «Historial del plan»).
- Riesgos del plan confirmados: 1 (invitar con registro desactivado) ✅ y 3 (triggers sobre
  `auth.*`) ✅.

---

## Bloque B — P2/P3: gestión de cuentas, recuperación y Google (HU-04, HU-05, HU-06)

### Fase B1 — Pruebas en rojo

- [x] T050 [P] `web/__test__/sandbox/user-admin.sandbox.test.ts`:
      - cambiar el rol se nota en la siguiente consulta del usuario (CA-18);
      - desactivar y banear hace que `signInWithPassword` falle con `user_banned` (CA-06);
      - reactivar permite volver a entrar con la misma contraseña (CA-20);
      - un usuario baneado que completa la recuperación sigue sin poder entrar (CA-25)

      → **rojo**
- [x] T051 [P] `users.actions.test.ts` (`changeRole` y `setUserStatus`):
      - el operador es rechazado (CA-09);
      - el error del último admin se traduce a su mensaje (CA-21);
      - si falla el ban, el perfil se revierte;
      - al desactivar se banea y al reactivar se quita el ban

      → **rojo**
- [x] T052 [P] `web/__test__/src/modules/auth/actions/auth.actions.test.ts`:
      `requestPasswordReset` devuelve lo mismo exista o no el correo, y también si Auth falla
      (CA-22) → **rojo**
- [x] T053 [P] Esquema `forgot-password`, el componente `forgot-password-form` y el caso
      `type=recovery` de `auth/confirm` (enlace caducado → opción de pedir otro) (CA-24) → **rojo**
- [x] T054 [P] Test de la ruta `auth/callback` en `web/__test__/src/app/auth/callback/route.test.ts`:
      - éxito → redirige a `next` (CA-26);
      - `signup_disabled` → mensaje de cuenta de Google sin acceso (CA-27);
      - `user_banned` → cuenta desactivada (CA-28);
      - sin `code` → error

      → **rojo**

### Fase B2 — Implementación (verde)

- [x] T060 `changeRole` y `setUserStatus` con ban y reversión, más `user-actions-menu` y
      `status-chip` en la tabla (CA-18, CA-19, CA-20, CA-21) → T050 y T051 en verde
- [x] T061 `(auth)/auth/forgot-password`, `requestPasswordReset` y la recuperación por
      `auth/confirm` → `set-password` (CA-22, CA-23, CA-24) → T052 y T053 en verde
- [x] T062 Google:
      - `signInWithGoogle` y el componente `google-button`;
      - la ruta `auth/callback/route.ts`;
      - `[auth.external.google]` en `config.toml` activable por variables de entorno;
      - documentar cómo probarlo en local

      (CA-26, CA-27, CA-28) → T054 en verde

### Fase B3 — E2E

- [x] T070 [P] `web/e2e/disable-user.spec.ts` con dos contextos de navegador: el admin desactiva
      al operador y la siguiente navegación del operador lo lleva al login con el mensaje (CA-19);
      el admin lo reactiva y vuelve a entrar (CA-20); la interfaz impide degradar al último admin
      y lo explica (CA-21)
- [x] T071 [P] `web/e2e/password-reset.spec.ts`: la solicitud muestra el mensaje neutro (CA-22);
      el enlace de Mailpit permite poner una contraseña nueva, con la que entra mientras la
      antigua falla (CA-23); el mismo enlace usado otra vez da enlace no válido (CA-24)

### Fase B4 — Definición de terminado del bloque B

- [x] T080 Las mismas comprobaciones que T046 y T047, más las mutaciones de T048 para los tests
      nuevos
- [x] T081 Spec a `implementada`, plan y backlog actualizados

**Registro del bloque B (2026-11-19)**

- Resultados: lint ✅ · `ts:check` ✅ · 133 unit ✅ · 12 sandbox ✅ · build ✅ · 14 E2E ✅ ·
  pgTAP (50 aserciones) ✅ · `types:check` ✅.
- Mutaciones vistas fallar y revertidas (`grep MUTATION` vacío): ban omitido en
  `setUserStatus` → CA-19; `/auth/confirm` trata `user_banned` como enlace caducado → CA-25;
  `/auth/callback` ignora el error de Google → CA-27; botones en la fila propia → CA-10 y CA-21;
  `requestPasswordReset` responde distinto si Auth falla → RN-06; `current_profile_role` sin
  filtro de estado → «la sesión abierta pierde el acceso» (sandbox).
- Hallazgo: un usuario baneado recibe el correo de recuperación (no se revela nada), pero Auth
  rechaza el enlace con `user_banned`; `/auth/confirm` lo envía al login con el mensaje de cuenta
  desactivada (CA-25).
- Pendiente: fase B5 (necesita los proyectos remotos de la spec 001).

### Fase B5 — Despliegue y verificación manual (requiere la spec 001 terminada)

- [ ] T090 Auth del proyecto remoto según el plan:
      - registro desactivado, contraseña mínima de 8 y enlaces de 86400 s;
      - plantillas en español;
      - *Site URL* y *Redirect URLs* (con las previews de Vercel);
      - SMTP propio
- [ ] T091 Cliente OAuth en Google Cloud y proveedor Google en Supabase
- [ ] T092 Variables en Vercel: `SUPABASE_SECRET_KEY` y `NEXT_PUBLIC_SITE_URL` por entorno
- [ ] T093 `admin:bootstrap` con el correo del dueño en cada entorno (RF-06)
- [ ] T094 Verificación manual de Google en preview, anotando el resultado aquí:
      - un usuario activo entra con Google (CA-26);
      - un **invitado** entra con Google, pasa a Activo y conserva el mismo id (CA-26, riesgo 2);
      - una cuenta de Google desconocida es rechazada y no se crea ningún usuario (CA-27);
      - un usuario desactivado es rechazado (CA-28)

---

## Cobertura de criterios

| CA | Tareas de prueba |
|---|---|
| CA-01 | T019, T042 |
| CA-02 | T016, T019, T042 |
| CA-03 | T015, T042 |
| CA-04 | T043 |
| CA-05 | T015, T042 |
| CA-06 | T015, T042, T050 |
| CA-07 | T019, T044 |
| CA-08 | T019, T044 |
| CA-09 | T001, T014, T018, T051 |
| CA-10 | T002 |
| CA-11 | T013, T045 |
| CA-12 | T013, T018 |
| CA-13 | T017, T018, T019 |
| CA-14 | T002, T045 |
| CA-15 | T020, T045 |
| CA-16 | T013 |
| CA-17 | T019 |
| CA-18 | T002, T050 |
| CA-19 | T015, T070 |
| CA-20 | T050, T070 |
| CA-21 | T002, T051, T070 |
| CA-22 | T052, T071 |
| CA-23 | T071 |
| CA-24 | T053, T071 |
| CA-25 | T050 |
| CA-26 | T002, T054, T094 (manual) |
| CA-27 | T014, T054, T094 (manual) |
| CA-28 | T054, T094 (manual) |
