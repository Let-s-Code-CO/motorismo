# CLAUDE.md — Motorismo Detailing

Aplicación web interna para un negocio de lavado y detailing de motos: registro de clientes,
órdenes de trabajo y reportes para el administrador. Se despliega en **Vercel** con base de datos
**Supabase**.

Este proyecto se desarrolla con **Spec Driven Development (SDD)**. Antes de tocar código de
producto, lee [specs/constitution.md](specs/constitution.md) y [specs/README.md](specs/README.md).

## Idioma

- Respuestas al usuario, specs, `CLAUDE.md` y documentación: **español**.
- Código, identificadores, comentarios de código, nombres y descripciones de tests: **inglés**.
- Commits y PRs: **inglés** (título y cuerpo), Conventional Commits.
- Textos visibles de la UI: **español**, siempre vía `messages/es.json` (nunca en el JSX).

## Monorepo

pnpm 12 (workspaces, `nodeLinker: isolated`) + Turborepo. Node 24 (`.nvmrc`).

| Workspace | Qué es |
|---|---|
| `apps/web` | App Next.js 16 (App Router, React 19). Puerto 3000. |
| `packages/supabase` | `@motorismo/supabase`: migraciones, seeds, pgTAP y tipos `Database` generados. Lee su [CLAUDE.md](packages/supabase/CLAUDE.md) antes de tocar la base de datos. |
| `packages/eslint-config` | ESLint 9 (flat config) compartido: `base` y `next`. |
| `packages/typescript-config` | `base.json` y `nextjs.json`. |
| `packages/prettier-config` | Prettier con orden de imports. |

## Stack de `apps/web`

- Next.js 16 + React 19, TypeScript estricto.
- UI: HeroUI 2.8 + Tailwind CSS 4. HeroUI usa contexto de React: los componentes que lo usan
  llevan `'use client'`.
- Sistema visual (spec 003): Geist, base zinc con primario casi negro, radios 8/12/16 px, sombras
  suaves; tema en `src/app/hero.ts` y animaciones en `globals.css` (siempre `motion-safe:`).
  Iconos con `lucide-react`, decorativos (`aria-hidden`); los botones solo-icono llevan
  `aria-label`. Nada de colores llamativos: los semánticos solo para estados.
- **Tarjetas de resumen = filtros (estándar).** En cualquier listado con tarjetas que resumen por
  estado o categoría, cada tarjeta filtra la lista al pulsarla y se desmarca con otro clic. El
  filtro vive en la URL (`?status=…`, sobrevive a recargar y al botón «atrás»), las tarjetas son
  botones con `aria-pressed` y la elegida se marca (borde y anillo; el resto se atenúa). Sobre la
  lista va una línea de conteo («1 de 4 usuarios · Invitados», `aria-live`) con un botón fantasma
  «Ver todos» (no un chip). Referencia: `users-summary`, `users-filter-bar` y
  `users-filter.utils` (spec 003, CA-09); al aparecer la segunda pantalla, extraerlos a `core`.
- Accesibilidad: `e2e/a11y.spec.ts` audita con axe (WCAG 2.1 AA) y debe seguir en verde; las
  pantallas nuevas se añaden a esa auditoría.
- i18n: next-intl 4, **solo español**, sin segmento de idioma en la URL.
- Estado de servidor: TanStack Query 5. Formularios: React Hook Form + Zod 4.
- Supabase: `@supabase/ssr` con clientes tipados (`createClient<Database>`).
- Entorno validado con `@t3-oss/env-nextjs` en `src/modules/core/config/env.config.ts`.
- Pruebas: Vitest 4 + Testing Library (unitarias) y Playwright (E2E).
- Next 16 tiene cambios incompatibles con versiones anteriores: consulta la documentación incluida
  en `apps/web/node_modules/next/dist/docs/` (lo recuerda `apps/web/AGENTS.md`, que genera
  `next dev`; versiónalo, se recrea si se borra) y la skill `next-best-practices`.

## Comandos (desde la raíz)

```bash
nvm use                 # Node 24
corepack enable         # activa pnpm 12.15.0 (packageManager)
pnpm install

pnpm db:start           # Supabase local en Docker (API 54321, DB 54322, Studio 54323)
cp apps/web/.env.example apps/web/.env.local   # y pega la publishable key de `pnpm db:start`
pnpm dev                # http://localhost:3000

pnpm lint | pnpm lint:fix
pnpm ts:check
pnpm test               # Vitest (unitarias, sin servicios)
pnpm --filter web test:sandbox   # Vitest contra el Supabase local real (Auth, RLS, correos)
pnpm test:e2e           # Playwright contra el Supabase local (levanta el servidor solo)
pnpm build

pnpm db:reset           # reaplica migraciones + seeds desde cero
pnpm db:test            # pgTAP
pnpm db:types           # regenera packages/supabase/types/database.types.ts
pnpm db:stop
```

Un test concreto: `pnpm --filter web exec vitest run ruta/al/archivo.test.tsx`.

Usuarios locales (seeds), todos con la contraseña `motorismo-local`: administradores
`sebastian.pulido@motorismo.test` y `carlos.diaz@motorismo.test`, `operador@motorismo.test` y
`desactivado@motorismo.test`. Los correos (invitaciones,
recuperación) se ven en Mailpit: http://127.0.0.1:54324.

### Git hooks (Husky)

- **pre-commit**: `pnpm lint`
- **commit-msg**: commitlint (Conventional Commits)
- **pre-push**: `pnpm ts:check`, `pnpm test`, `pnpm build`

## Estructura de `apps/web`

```
src/
  app/                       # rutas (App Router): layout, page, route handlers
  i18n/                      # next-intl: request.ts y registro de mensajes por módulo
  modules/{feature}/
    api/                     # {feature}.client.ts / {feature}.server.ts
    components/              # atoms/ molecules/ organisms/
    constants/  hooks/  types/  utils/
    messages/es.json         # textos del módulo, bajo el namespace {feature}
    queries/                 # {feature}.keys.ts, {feature}.queries.ts, {feature}.mutations.ts
    schemas/                 # {feature}.schema.ts (Zod, fuente de verdad de los tipos de formularios)
__test__/                    # espejo de src/ (p. ej. __test__/src/modules/core/...)
__test__/test-utils/         # renderWithProviders (mensajes reales en español)
e2e/                         # Playwright
```

- Nombres de archivo en kebab-case con sufijo: `*.component.tsx`, `*.hook.ts`, `*.schema.ts`,
  `*.types.ts`, `*.queries.ts`, `*.mutations.ts`, `*.keys.ts`, `*.utils.ts`, `*.lib.ts`,
  `*.provider.tsx`, `*.config.ts`, `*.actions.ts` (Server Actions), `*.server.ts` (solo servidor,
  con `import 'server-only'`), `*.test.ts(x)`, `*.sandbox.test.ts`, `e2e/*.spec.ts`.
- Componentes con **export default**; early returns.
- Alias: `@web/*` → `src/*`, `@tests/*` → `__test__/*`, `@motorismo/supabase/types`.
- Cada módulo nuevo registra su `messages/es.json` en `src/i18n/messages.ts`.
- Datos: query key factories + `queryOptions` (TanStack Query 5); tipos de filas derivados de
  `Tables<'tabla'>`, sin genéricos explícitos que oculten drift.
- Autorización en Postgres (RLS), nunca solo ocultando elementos en la UI.

## Autenticación y permisos (spec 002)

- `public.profiles` (rol `operator`/`admin`, estado `invited`/`active`/`disabled`) es la fuente de
  verdad. Rol y estado **no** se leen del JWT: se consultan en cada petición.
- Tres capas: `src/proxy.ts` (`decideAccess`, en cada petición) → `requireUser()` en páginas y
  `getActiveAdmin()` en Server Actions (`modules/auth/api/auth.server.ts`) → RLS.
- Clientes Supabase: `supabase-server.lib.ts` (sesión del usuario, por defecto),
  `supabase-proxy.lib.ts` (solo el proxy) y `supabase-admin.lib.ts` (secret key, solo servidor y
  solo para lo que la sesión del usuario no puede hacer, tras comprobar permisos).
- Los errores de Auth se traducen con `mapAuthError`; los mensajes no revelan si un correo existe.
- Componentes HeroUI llevan `'use client'`. Las tablas de HeroUI se exponen como `grid` (ARIA).

## Los tests son documentación (obligatorio)

1. Cada archivo de test abre con un comentario: unidad bajo prueba, su papel en el negocio, las
   reglas que protege y la spec/criterio que cubre (`spec 003, CA-02`).
2. `describe`/`it` se leen como especificación: «hace X cuando Y (porque Z)».
3. Casos no obvios llevan el porqué; las expectativas numéricas muestran la cuenta.
4. Cubre la matriz: camino feliz, cada variante, límites (0, vacío, negativo) e invariantes.
5. Fixtures con builders con valores por defecto + `overrides`.
6. Deterministas: sin red real, reloj real ni aleatoriedad.
7. Las descripciones dicen exactamente lo que se asserta.

## Definición de terminado (obligatoria antes de dar algo por terminado)

1. **Tests** escritos/ampliados para el comportamiento cambiado y en verde. Cada test nuevo se
   ha **visto fallar** (escrito antes del código, o mutando el código, observando el fallo y
   revirtiendo). Reporta qué mutación se aplicó y comprueba con `git diff` + grep que no quedó.
2. **E2E** (Playwright) para funcionalidades nuevas o cambios grandes.
3. **Tipos**: `pnpm ts:check`.
4. **Build**: `pnpm build`.
5. **Migraciones**: `pnpm db:reset`, `pnpm db:test` y `types:check` en verde (ver
   `packages/supabase/CLAUDE.md`).
6. La spec, el plan y las tareas reflejan lo implementado.

Si algo no se puede ejecutar en el entorno, dilo explícitamente y nombra el comando pendiente.

## Flujo SDD

1. `/especificar <descripción>` → `specs/NNN-slug/spec.md` (qué y por qué).
2. El usuario **aprueba** la spec.
3. `/planificar NNN` → `plan.md` (cómo, con este stack).
4. `/desglosar NNN` → `tasks.md`.
5. `/implementar NNN` → ejecuta las tareas en una rama `feature/NNN-slug` desde `develop`.
6. `/verificar NNN` → contrasta el código con cada criterio de aceptación.

No escribas código de producto sin una spec `aprobada` o posterior (excepciones en la
constitución). Si la spec es ambigua o incorrecta, detente y propón el cambio de spec.

## Despliegue

- **Vercel**: proyecto con *Root Directory* `apps/web`; pnpm y Turborepo se detectan solos.
  Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` por entorno.
- **Supabase**: las migraciones llegan al proyecto remoto con el workflow `db-deploy` al entrar
  en `develop` (secret `SUPABASE_DB_URL`). Nunca se edita el esquema desde el dashboard.
- **CI** (`.github/workflows/ci.yml`): lint, tipos, unit, build, E2E y validación de Supabase en
  cada PR.

## No hacer

- No hagas commits ni push salvo que el usuario lo pida.
- No uses `supabase link` ni un `supabase` global: usa los scripts del paquete (CLI fijado).
- No edites `packages/supabase/types/database.types.ts` a mano.
- No añadas funcionalidades fuera de la spec.
