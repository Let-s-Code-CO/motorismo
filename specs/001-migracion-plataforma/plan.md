---
spec: "001"
estado: aprobado
actualizado: 2026-11-19
---

# Plan técnico — 001 Migración de plataforma

## Resumen

Se reemplaza la SPA de Vite/Firebase por un monorepo pnpm + Turborepo: una app Next.js
(HeroUI, next-intl, TanStack Query, React Hook Form + Zod) y un paquete de Supabase con CLI
fijado, pgTAP y tipos generados. La app no conserva funcionalidad de la versión anterior: solo
una portada temporal; cada funcionalidad vuelve con su propia spec.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Esta spec cubre el cambio de plataforma. |
| II. Qué antes que cómo | ✅ | Spec de plataforma (excepción explícita). |
| III. Criterios verificables | ✅ | Ver estrategia de pruebas. |
| IV. Ambigüedad explícita | ✅ | Rama de producción como pregunta abierta. |
| V. Simplicidad y stack | ✅ | Versiones fijadas; las elecciones se justifican abajo. |
| VI. Seguridad | ✅ | Solo la publishable key en el cliente; RLS obligatorio desde la primera tabla. |
| VII. Trazabilidad | ✅ | Rama `feature/001-migracion-plataforma`. |
| VIII. Incrementos pequeños | ✅ | Sin funcionalidad de negocio en este cambio. |

## Decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Monorepo pnpm 12 + Turborepo | App Next.js única | Elegido por el usuario: deja espacio para más apps y paquetes compartidos. |
| Next.js **16.4.6** | 16.4.3 | 16.4.3 está afectada por GHSA-mfr8-8qww-v76h y otro aviso de caché `use cache` (moderados); Next 16 aborta el build. 16.4.5+ los corrige. |
| HeroUI 2.8.10 + Tailwind 4.1.16 | HeroUI 3.x | Versión estable y conocida; la 3.x cambia la API. |
| ESLint 9 *flat config* | ESLint 8 + `.eslintrc` | Next 16 retiró `next lint` y `eslint-config-next` 16 está en flat config. |
| next-intl solo `es`, sin segmento de idioma | Segmento `[locale]` en la URL | Elegido por el usuario; añadir inglés luego es trivial. |
| Mensajes reales en los tests (`renderWithProviders`) | Mock global de next-intl | Una clave inexistente hace fallar el test; menos mocks. |
| `@supabase/ssr` + publishable key | anon key / supabase-js solo | Patrón actual de Supabase para App Router (cookies). |
| Migraciones remotas vía `db push --db-url` en Actions | `supabase link`; integración GitHub de Supabase | `link` escribe versiones locales que alteran el sandbox. La integración nativa (branching) es de pago. |
| Env validado con `@t3-oss/env-nextjs` | `process.env` directo | Falla al arrancar si falta configuración; cumple CA-05. |

## Estructura resultante

```
apps/web/                     Next.js 16 (App Router)
  src/app/                    layout (NextIntl + AppProvider), page, globals.css, hero.ts
  src/i18n/                   request.ts, messages.ts (registro de módulos)
  src/modules/core/           config/env.config.ts, lib/supabase-{browser,server}.lib.ts,
                              providers/app.provider.tsx, components/welcome.component.tsx,
                              messages/es.json
  __test__/                   espejo de src + test-utils/render.tsx
  e2e/                        home.spec.ts
packages/supabase/            config.toml, migrations/, seeds/, tests/, types/, scripts/
packages/{eslint,typescript,prettier}-config/
.github/workflows/            ci.yml, db-deploy.yml
.husky/                       pre-commit, commit-msg, pre-push
.claude/skills/               especificar, planificar, desglosar, implementar, verificar
                              + skills de terceros (next, supabase-postgres, zod, rhf, vercel-react)
```

## Estrategia de pruebas

| Criterio | Tipo | Verificación |
|---|---|---|
| CA-01 | E2E + manual | `pnpm test:e2e` levanta `pnpm dev` y abre `/`. |
| CA-02 | CI | `.github/workflows/ci.yml` (pendiente de su primera ejecución en GitHub). |
| CA-03 | Componente + E2E | `__test__/src/modules/core/components/welcome.component.test.tsx`, `e2e/home.spec.ts`. |
| CA-04 | pgTAP + script | `supabase/tests/00_schema_smoke.test.sql`; `types:check`. |
| CA-05 | Unit | `__test__/src/modules/core/config/env.config.test.ts`. |
| CA-06 | Despliegue | Pendiente: crear proyectos de Vercel y Supabase. |
| CA-07 | Búsqueda | `grep` de firebase/redux/cloudinary en código y lockfile. |
| CA-08 | Hooks | `.husky/commit-msg` + `commitlint.config.js`. |

## Despliegue

1. **Supabase**: crear el proyecto (región cercana a los usuarios). Copiar la cadena *Session
   pooler* como secret `SUPABASE_DB_URL` del repo en GitHub.
2. **Vercel**: importar el repo, *Root Directory* `apps/web`, framework Next.js (pnpm se detecta
   por `packageManager`). Variables por entorno: `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Si se usa la integración de Supabase del Marketplace de
   Vercel, comprobar que la clave se expone con ese nombre o mapearla.
3. En Supabase → Auth → URL Configuration, añadir el dominio de Vercel como *Site URL* y en
   *Redirect URLs* (lo necesitará la spec de autenticación).
4. Desactivar GitHub Pages en el repo (ya no hay `docs/`).
