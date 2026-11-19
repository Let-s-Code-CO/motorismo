---
spec: "002"
estado: aprobado
actualizado: 2026-11-19
---

# Plan técnico — 002 Autenticación y roles

## Resumen

Supabase Auth gestiona identidades, contraseñas, Google, enlaces por correo y sesiones (con el
registro público **desactivado**: solo el administrador crea cuentas). Una tabla `profiles` guarda
nombre, rol y estado. Esa tabla es la **fuente de verdad de los permisos** y la protegen RLS y
triggers en Postgres. La app (Next.js 16) aplica tres capas, de fuera hacia dentro:

1. `proxy.ts` en cada petición, incluidas las navegaciones del cliente y las Server Actions.
2. `requireUser()` / `requireAdmin()` en cada página y en cada Server Action.
3. RLS en la base de datos.

El rol y el estado **no** van en el JWT, porque quedarían desactualizados hasta 1 h y la spec
exige que un cambio se aplique en la «siguiente acción» (CA-18, CA-19). Se leen de la base de
datos en cada petición.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | La caducidad de los enlaces se corrigió en la spec antes de planificar. |
| II. Qué antes que cómo | ✅ | La tecnología solo aparece en este plan. |
| III. Criterios verificables | ✅ | Los 28 CA están mapeados a pruebas (ver tabla). Google: unit + pgTAP, más una verificación manual en preview (ver riesgos). |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. |
| V. Simplicidad y stack | ✅ | Ninguna dependencia nueva en la app. Las mutaciones van por Server Actions + RSC, sin TanStack Query. Para producción hace falta un SMTP propio (ver Despliegue). |
| VI. Seguridad y datos personales | ✅ | RLS en `profiles`. La secret key solo vive en módulos `server-only`. Mensajes que no revelan qué correos existen. Sin borrado de usuarios. |
| VII. Trazabilidad | ✅ | Rama `feature/002-autenticacion-roles`. Cada test cita su CA. |
| VIII. Incrementos pequeños | ⚠️ | Spec grande (6 historias). Dos hitos en la misma rama (el usuario prefiere un solo push): **bloque A** = P1 (HU-01, HU-02, HU-03), desplegable por sí solo; **bloque B** = P2/P3 (HU-04, HU-05, HU-06). Cada bloque cierra con su Definición de terminado. |

## Base de datos (`packages/supabase`)

### Migración `<timestamp>_auth_profiles.sql`

**Tipos**
- `public.user_role` enum: `operator`, `admin`.
- `public.user_status` enum: `invited`, `active`, `disabled`.

**Tabla `public.profiles`**

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` PK | `references auth.users(id) on delete restrict` (RN-05: los usuarios no se borran) |
| `full_name` | `text not null` | `check (char_length(btrim(full_name)) between 1 and 120)` |
| `email` | `text not null` | Copia de `auth.users.email`, ya en minúsculas por Auth; índice único `lower(email)` (RN-02) |
| `role` | `user_role not null` | default `operator` |
| `status` | `user_status not null` | default `invited` |
| `invited_by` | `uuid null` | `references public.profiles(id)` |
| `created_at`, `updated_at` | `timestamptz not null` | default `now()`; trigger para `updated_at` |

**Funciones** (`security definer`, `set search_path = ''`, `stable` donde aplique)
- `public.current_profile_role()` → rol de `auth.uid()` **solo si su estado es `active`**; si no,
  `null`.
- `public.is_admin()` → `current_profile_role() = 'admin'`. Las políticas la llaman como
  `(select public.is_admin())` para que se evalúe una vez por consulta (skill
  supabase-postgres-best-practices).

**Triggers**
- `on_auth_user_created` (`after insert on auth.users`): crea el perfil con `full_name`, `role` e
  `invited_by` de `raw_user_meta_data`. Con el registro desactivado, solo el admin API (secret key)
  crea usuarios, así que esos metadatos son de confianza en la inserción. Si falta el nombre o el
  rol no es válido, lanza una excepción y la invitación falla de forma atómica.
- ~~`on_auth_user_password_set`~~ — **descartado al implementar** (ver Historial): la activación
  por contraseña la hace la Server Action `setPassword` con la secret key (CA-14).
- `on_auth_identity_linked` (`after insert on auth.identities`, proveedor ≠ `email`): pasa el
  perfil de `invited` a `active` (CA-26).
- `profiles_guard` (`before update on public.profiles`):
  - rechaza cambiar `id`, `email`, `invited_by` y `created_at`;
  - rechaza que `auth.uid()` cambie su propio `role` o `status` (CA-10);
  - rechaza cualquier cambio que deje 0 administradores `active` (RN-03, CA-21; también cubre
    actualizaciones hechas con la secret key);
  - rechaza la transición `disabled → invited`.

**RLS** (`alter table … enable row level security`)

| Operación | Política |
|---|---|
| `select` | `id = (select auth.uid())` **o** `(select public.is_admin())` |
| `update` | `(select public.is_admin())`; además, privilegios de columna: `revoke update … from authenticated; grant update (role, status) … to authenticated` |
| `insert` / `delete` | Ninguna política, y `revoke insert, delete … from anon, authenticated` |

`anon` no tiene ningún privilegio sobre `profiles`.

### Configuración del sandbox (`supabase/config.toml`)
- `[auth] enable_signup = false` (RN-01; también impide que una cuenta de Google desconocida cree
  un usuario, CA-27). `minimum_password_length = 8` (RN-04). `site_url = "http://localhost:3000"`.
- `[auth.email] otp_expiry = 86400` (24 h, suposición de la spec).
- `[auth.rate_limit] email_sent`: se sube localmente para que las pruebas que envían correos no
  choquen con el límite de 2 por hora.
- `[auth.email.template.invite]` y `[auth.email.template.recovery]`: asunto y HTML en español en
  `supabase/templates/{invite,recovery}.html`. El enlace apunta a
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>`.
- `[auth.external.google]`: desactivado en local por defecto. Se activa con credenciales propias
  vía `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` / `env(..._SECRET)`, documentado.

### Seeds `supabase/seeds/01_users.sql` (solo local)
Tres usuarios con contraseña `motorismo-local`: `admin@motorismo.test` (admin, active),
`operador@motorismo.test` (operator, active) y `desactivado@motorismo.test` (operator, disabled y
baneado). Se insertan en `auth.users` + `auth.identities` y los perfiles los crea el trigger.

### Primer administrador (RF-06)
`scripts/bootstrap-admin.mjs` → `pnpm --filter @motorismo/supabase admin:bootstrap -- --email … --name …`.
Usa `SUPABASE_URL` + `SUPABASE_SECRET_KEY`, se niega si ya existe un admin e invita con
`role: 'admin'`. Añade `@supabase/supabase-js` (misma versión que la app) a `packages/supabase`.

## Aplicación (`apps/web`)

### Entorno (`env.config.ts`)
- Servidor: `SUPABASE_SECRET_KEY` (obligatoria; nunca con prefijo `NEXT_PUBLIC_`).
- Cliente: `NEXT_PUBLIC_SITE_URL` (opcional). `getSiteUrl()` = `NEXT_PUBLIC_SITE_URL` → si no,
  `https://${VERCEL_URL}` → si no, `http://localhost:3000`. Se usa en los `redirectTo` de
  invitación, recuperación y OAuth.

### Clientes Supabase (`modules/core/lib/`)
- Existentes: `supabase-browser.lib.ts`, `supabase-server.lib.ts`.
- Nuevo `supabase-proxy.lib.ts`: cliente para `proxy.ts` que lee y escribe cookies en
  `NextRequest`/`NextResponse`.
- Nuevo `supabase-admin.lib.ts` (`server-only`, secret key, sin sesión): solo para
  `auth.admin.*`.

### Proxy (`src/proxy.ts`)
Matcher: todo excepto `_next/static`, `_next/image`, `favicon.ico` e imágenes de `public/`.
Por petición:
1. Refresca la sesión (`supabase.auth.getClaims()`).
2. Si hay sesión, lee `profiles(role, status)` del usuario con una consulta.
3. Delega la decisión en `decideAccess()`, una función pura:

| Situación | Resultado |
|---|---|
| Ruta pública (`/auth/*`) sin sesión | pasa |
| Ruta protegida sin sesión | → `/auth/login?next=<ruta>` (CA-03) |
| `/auth/login` con sesión activa | → `/` (CA-05) |
| Perfil `disabled` o inexistente | cierra sesión → `/auth/login?error=account_disabled` (CA-06, CA-19, CA-28) |
| Perfil `invited` (sesión del enlace, sin contraseña) | → `/auth/set-password` |
| Cookie `mt_last_seen` ausente o con más de 7 días | cierra sesión → `/auth/login?error=session_expired` |
| Resto | pasa y renueva `mt_last_seen` |

4. `sanitizeNextPath()` solo acepta rutas relativas internas, para evitar redirecciones abiertas.

El cierre por inactividad se hace en la app porque la inactividad de Supabase es una función del
plan Pro.

### Rutas

| Ruta | Tipo | Notas |
|---|---|---|
| `(auth)/auth/login/page.tsx` | página | Formulario de correo y contraseña, «Continuar con Google», enlace de recuperación y mensajes `?error=` |
| `(auth)/auth/forgot-password/page.tsx` | página | CA-22 |
| `(auth)/auth/set-password/page.tsx` | página | Sirve para aceptar la invitación y para la recuperación (CA-14, CA-23) |
| `auth/confirm/route.ts` | GET | `verifyOtp({ token_hash, type })`. Si falla, muestra «enlace no válido» (CA-15, CA-24); si va bien, `/auth/set-password` |
| `auth/callback/route.ts` | GET | `exchangeCodeForSession` de OAuth. Los errores de Auth se traducen a mensajes (CA-27, CA-28) |
| `(app)/layout.tsx` | layout | Cabecera con nombre, rol, cierre de sesión y enlace «Usuarios» solo para admin (RF-05, CA-07) |
| `(app)/page.tsx` | página | Inicio: «Hola, {nombre}» y su rol (CA-01). Sustituye a la portada temporal |
| `(app)/admin/users/page.tsx` | página | `requireAdmin()`: el operador ve `NoPermission` (CA-08). Lista de usuarios (CA-17) |

No se usa `forbidden()`/`forbidden.tsx` porque en Next 16 sigue siendo experimental.

### Módulo `src/modules/auth/`
```
actions/auth.actions.ts        signIn, signOut, signInWithGoogle, requestPasswordReset, setPassword
api/auth.server.ts             getCurrentUser (React cache), requireUser, requireAdmin
components/atoms/              role-chip.component.tsx
components/molecules/          google-button.component.tsx, user-menu.component.tsx
components/organisms/          login-form, forgot-password-form, set-password-form, no-permission
schemas/                       login.schema.ts, forgot-password.schema.ts, set-password.schema.ts
utils/access.utils.ts          decideAccess, sanitizeNextPath, isSessionExpired
utils/auth-errors.utils.ts     mapAuthError: código de Auth → clave de mensaje
types/auth.types.ts            CurrentUser (derivado de Tables<'profiles'>)
messages/es.json               namespace "auth"
```
- `mapAuthError`: `invalid_credentials` y usuario inexistente → el mismo mensaje (CA-02, RN-06);
  `user_banned` → cuenta desactivada; `signup_disabled` → «Esta cuenta de Google no tiene acceso…»;
  `otp_expired` → enlace no válido.
- `requestPasswordReset` siempre devuelve el mismo resultado, exista o no el correo (CA-22).
- Formularios: React Hook Form + `zodResolver`. Los esquemas son la fuente de los tipos y los
  errores se asocian a su campo (RNF de accesibilidad).

### Módulo `src/modules/users/` (administración)
```
actions/users.actions.ts       inviteUser, resendInvite, changeRole, setUserStatus
api/users.server.ts            listUsers (cliente con la sesión del admin → RLS)
components/organisms/          users-table.component.tsx, invite-user-modal.component.tsx
components/molecules/          user-actions-menu.component.tsx, status-chip.component.tsx
schemas/invite-user.schema.ts  full_name (1–120, trim), email, role ∈ Enums<'user_role'>
messages/es.json               namespace "users"
```
- Cada action: `requireAdmin()` → `safeParse` con Zod → operación → `revalidatePath('/admin/users')`.
- `inviteUser`:
  1. comprueba si el correo ya existe en `profiles`; si existe, error «Ya existe un usuario con
     este correo.» (CA-12). Esto es necesario porque Auth **reenvía** la invitación a un usuario
     sin confirmar en lugar de fallar;
  2. `auth.admin.inviteUserByEmail(email, { data: { full_name, role, invited_by }, redirectTo })`.
- `resendInvite`: solo para estado `invited`. Vuelve a llamar a `inviteUserByEmail`, que genera
  un token nuevo e invalida el anterior (CA-16).
- `changeRole` / `setUserStatus`:
  1. `update` en `profiles` con la sesión del admin, donde RLS y el trigger validan CA-10 y CA-21;
  2. al desactivar o reactivar, `auth.admin.updateUserById(id, { ban_duration })` como segunda
     barrera para que ni siquiera se emita sesión;
  3. si falla el paso 2, se revierte el paso 1.

  El estado en `profiles` es la fuente de verdad: aunque el ban fallara, el proxy y RLS bloquean.

### Otros cambios
- `src/i18n/messages.ts`: registra `auth` y `users`.
- `modules/core/components/welcome.component.tsx` y su test se eliminan (la portada temporal
  desaparece; CA-03 de la spec 001 pasa a cumplirse con la página de inicio autenticada).
- `CLAUDE.md`: añade los sufijos `*.actions.ts` y `*.server.ts` a las convenciones.

## Estrategia de pruebas

Cuatro niveles:
- **pgTAP** (`supabase/tests/01_profiles.test.sql`), que cambia de rol con
  `set local role authenticated` + `request.jwt.claims`.
- **Vitest unit** (`__test__/…`).
- **Vitest sandbox** (`__test__/sandbox/…`, script `test:sandbox`): habla con el Supabase local
  real y lee los correos de Mailpit (`:54324`).
- **Playwright** (`e2e/…`) contra el sandbox con los seeds.

| CA | Prueba |
|---|---|
| CA-01 | E2E `auth-login.spec.ts` (entra y ve nombre y rol) · unit `user-menu.component.test.tsx` |
| CA-02 | unit `auth-errors.utils.test.ts` (mismo mensaje para ambos casos) · E2E `auth-login.spec.ts` |
| CA-03 | unit `access.utils.test.ts` (redirección con `next`, `sanitizeNextPath` contra redirección abierta) · E2E |
| CA-04 | E2E `auth-logout.spec.ts` (cerrar sesión, «atrás» y URL directa) |
| CA-05 | unit `access.utils.test.ts` · E2E |
| CA-06 | sandbox `sign-in.sandbox.test.ts` (usuario baneado → `user_banned`) · unit `decideAccess` (perfil `disabled`) · E2E con el seed desactivado |
| CA-07 | unit `app-header` (el operador no ve «Usuarios») · E2E `roles.spec.ts` |
| CA-08 | unit `no-permission.component.test.tsx` · E2E `roles.spec.ts` (URL directa) |
| CA-09 | pgTAP (el operador no ve ni actualiza perfiles ajenos) · sandbox (petición REST directa con el token del operador) · unit `users.actions.test.ts` (`requireAdmin` rechaza) |
| CA-10 | pgTAP (`profiles_guard`: cambio de rol o estado propio rechazado, también siendo admin) |
| CA-11 | sandbox `invite.sandbox.test.ts` (perfil `invited` y correo en Mailpit, en español) · E2E `invite.spec.ts` |
| CA-12 | unit `users.actions.test.ts` · sandbox (correo existente) |
| CA-13 | unit `invite-user.schema.test.ts` · unit `invite-user-modal.component.test.tsx` (error junto a cada campo) |
| CA-14 | pgTAP (trigger de contraseña → `active`) · E2E `invite.spec.ts` (enlace de Mailpit → contraseña → dentro) |
| CA-15 | E2E (abrir el mismo enlace dos veces) · unit de la ruta `auth/confirm` (error → mensaje) |
| CA-16 | sandbox (reenvío: el token antiguo falla y el nuevo funciona) |
| CA-17 | unit `users-table.component.test.tsx` (columnas y los tres estados) |
| CA-18 | sandbox (cambio de rol; la siguiente consulta del usuario ya ve los permisos nuevos) · pgTAP |
| CA-19 | E2E `disable-user.spec.ts` (dos contextos: el admin desactiva y la siguiente navegación del otro lleva al login con el mensaje) · unit `decideAccess` |
| CA-20 | sandbox (reactivar → vuelve a entrar con su contraseña) |
| CA-21 | pgTAP (no puede quedar 0 admins activos, tampoco con la secret key) · unit de la action (mensaje) |
| CA-22 | unit `auth.actions.test.ts` (misma respuesta exista o no el correo) · E2E `password-reset.spec.ts` |
| CA-23 | E2E `password-reset.spec.ts` (Mailpit → nueva contraseña → entra; la anterior falla) |
| CA-24 | unit de la ruta `auth/confirm` · E2E (enlace ya usado) |
| CA-25 | sandbox (recuperación de un usuario baneado → sigue sin poder entrar) |
| CA-26 | pgTAP (vincular una identidad `google` → `active`) · unit de la ruta `auth/callback` · **manual en preview** |
| CA-27 | unit `auth/callback` (`signup_disabled` → mensaje) · sandbox (`enable_signup=false` impide crear usuarios) · **manual en preview** |
| CA-28 | unit `auth/callback` (`user_banned` → mensaje) · **manual en preview** |

El flujo real de Google no se puede automatizar sin cuentas de Google de prueba. Su lógica queda
cubierta por unit y pgTAP, y el recorrido real se verifica a mano una vez en preview con una
lista de comprobación en `tasks.md`.

## Archivos afectados

- **Nuevos**: la migración, `supabase/tests/01_profiles.test.sql`, `seeds/01_users.sql`,
  `templates/{invite,recovery}.html`, `scripts/bootstrap-admin.mjs`, `src/proxy.ts`,
  `modules/auth/**`, `modules/users/**`, `modules/core/lib/supabase-{proxy,admin}.lib.ts`, las
  rutas `(auth)` y `(app)`, `auth/confirm` y `auth/callback`, los tests (`__test__/**`,
  `__test__/sandbox/**`, `e2e/*.spec.ts`) y `apps/web/vitest.sandbox.config.mts`.
- **Modificados**: `config.toml`, `types/database.types.ts` (regenerado), `env.config.ts`,
  `.env.example`, `src/i18n/messages.ts`, `src/app/layout.tsx`, `playwright.config.ts` (E2E con
  el sandbox), `.github/workflows/ci.yml` (el job de E2E y el sandbox pasan a necesitar Supabase),
  `CLAUDE.md` y `packages/supabase/CLAUDE.md`.
- **Eliminados**: `src/app/page.tsx` (pasa a `(app)/page.tsx`), `welcome.component.tsx` y su test.

## Dependencias nuevas

- `@supabase/supabase-js` en `packages/supabase`, solo para el script del primer administrador.
  Es la misma versión que ya usa la app. La alternativa descartada era llamar a mano a la API REST
  de Auth.
- **Servicio externo**: un SMTP propio para producción (recomendado Resend; vale cualquier SMTP).
  El correo integrado de Supabase solo entrega a los miembros del equipo del proyecto y con un
  límite muy bajo, así que no sirve para invitar personal.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Rol y estado leídos de la BD en cada petición | Claims en el JWT (custom access token hook) | El JWT dura hasta 1 h y CA-18/CA-19 exigen efecto en la siguiente acción |
| Perfil creado por trigger en `auth.users` | Insertarlo desde la Server Action | Es atómico: no puede existir un usuario sin perfil |
| Activación: `setPassword` (secret key) tras guardar la contraseña; trigger para identidades OAuth | Trigger sobre `encrypted_password`; RPC que llama el propio usuario | Auth escribe una contraseña aleatoria al verificar la invitación (el trigger activaba demasiado pronto); con la RPC el usuario podría cambiar su estado (CA-10) |
| `profiles.status` como fuente de verdad + ban de Auth como segunda barrera | Solo el ban | El ban no corta un JWT ya emitido |
| Inactividad de 7 días en el proxy (cookie) | `[auth.sessions] inactivity_timeout` | Esa opción requiere el plan Pro |
| Server Actions + RSC + `revalidatePath` | TanStack Query para la lista | Más simple para un CRUD pequeño de admin |
| Comprobación previa de correo duplicado en la action | Confiar en el error de Auth | Auth reenvía la invitación a usuarios sin confirmar en vez de fallar |

**Riesgos que se verifican en la implementación**
1. Que `inviteUserByEmail` funcione con `enable_signup = false` (prueba sandbox en la primera
   tarea de la app).
2. La vinculación automática de Google con un usuario **invitado** (sin confirmar): Auth elimina
   las identidades sin confirmar y vincula la de Google. Hay que confirmar en preview que se
   conserva el mismo `id`, y con él el perfil. Plan B: exigir aceptar la invitación por correo
   antes de usar Google.
3. Que los triggers sobre `auth.users`/`auth.identities` estén permitidos en la versión de la
   plataforma (patrón documentado por Supabase). La pgTAP de la migración lo confirma.
4. Latencia: una consulta a `profiles` por petición en el proxy. Hay que desplegar Vercel y
   Supabase en la misma región.

## Despliegue

**Requisito previo**: la spec 001 tiene que estar terminada (proyectos de Vercel y Supabase
creados).

1. **Migración**: llega a `develop` y el workflow `db-deploy` la aplica.
2. **Auth del proyecto remoto** (panel de Supabase, porque `config.toml` no se sube solo):
   - registro desactivado;
   - contraseña mínima de 8;
   - vigencia de los enlaces de 86400 s;
   - plantillas de invitación y recuperación en español;
   - *Site URL* = dominio de producción, y en *Redirect URLs* los dominios de preview de Vercel
     (`https://*-<equipo>.vercel.app/**`);
   - proveedor Google con su Client ID y secret;
   - SMTP propio.
3. **Google Cloud**: crear un cliente OAuth con el callback de Supabase como URI de redirección.
4. **Vercel**: variables `SUPABASE_SECRET_KEY` (solo servidor) y `NEXT_PUBLIC_SITE_URL` por
   entorno.
5. **Desplegar la app** y ejecutar `admin:bootstrap` con el correo del dueño.
6. **Verificación manual de Google** en preview (CA-26, CA-27, CA-28).

## Historial del plan

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-19 | Dos hitos en la misma rama en vez de dos PR. | Decisión del usuario (un solo push). |
| 2026-11-19 | Las rutas `/auth/*` viven en `src/app/auth/` (sin grupo `(auth)`). | Evitar dos carpetas que resuelven al mismo segmento. Sin cambio de comportamiento. |
| 2026-11-19 | La activación por contraseña pasa del trigger `on_auth_user_password_set` a la acción `setPassword` (secret key, solo `invited → active`). | El E2E de invitación mostró que Auth escribe una contraseña aleatoria al verificar el enlace: el trigger activaba al abrir el enlace, sin contraseña elegida (incumplía CA-14). La spec no cambia. |
| 2026-11-19 | `logging.serverFunctions: false` en `next.config.ts`. | `next dev` imprimía los argumentos de las Server Actions, contraseñas incluidas. |
| 2026-11-19 | Columna `profiles.activated_at` + restricciones (`active` exige haber aceptado; `invited` exige no haberlo hecho); el guard la fija en la primera activación y es inmutable; `setUserStatus` devuelve a «Invitado» a quien nunca aceptó. | `/verificar` detectó que reactivar a un invitado lo dejaba «Activo» sin contraseña. Nuevos CA-29 y RN-08 aprobados por el usuario. |
