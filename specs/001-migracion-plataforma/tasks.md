---
spec: "001"
actualizado: 2026-11-19
---

# Tareas — 001 Migración de plataforma

## Fase 1 — Retirar la plataforma anterior

- [x] T001 Eliminar `src/`, `index.html`, `vite.config.js`, `docs/` y los dos lockfiles; conservar
      logo y favicon en `apps/web` (CA-07)

## Fase 2 — Monorepo y tooling

- [x] T010 `package.json` raíz, `pnpm-workspace.yaml` (catálogo, `allowBuilds`), `turbo.json`, `.nvmrc` (RF-01)
- [x] T011 [P] `@motorismo/eslint-config`, `typescript-config`, `prettier-config` (RF-01)
- [x] T012 [P] Husky (pre-commit, commit-msg, pre-push) + commitlint (CA-08)
- [x] T013 `.gitignore`, `.prettierignore`, `.vscode/`, `.mcp.json`, `.claude/launch.json`

## Fase 3 — Supabase

- [x] T020 `@motorismo/supabase`: CLI 2.117.0 fijado, `supabase init`, seeds, scripts (RF-03)
- [x] T021 pgTAP de humo (`00_schema_smoke.test.sql`) (CA-04)
- [x] T022 Generación y comprobación de tipos (`types-gen.sh`) (CA-04)

## Fase 4 — App web

- [x] T030 Next.js 16 + HeroUI + Tailwind 4 + next-intl (`es`) + TanStack Query (RF-02)
- [x] T031 Entorno validado (`env.config.ts`) y clientes Supabase tipados (CA-05)
- [x] T032 Portada temporal con textos en `messages/es.json` (CA-03)

## Fase 5 — Pruebas

- [x] T040 [P] Vitest + `renderWithProviders`; test de `Welcome` (CA-03)
- [x] T041 [P] Test de `env.config` (CA-05)
- [x] T042 Playwright + `e2e/home.spec.ts` (CA-01, CA-03)

## Fase 6 — CI/CD

- [x] T050 `ci.yml`: calidad (lint, tipos, unit, build, E2E) + Supabase (pgTAP, tipos) (CA-02)
- [x] T051 `db-deploy.yml`: `db push` al hacer merge en `develop` (CA-06)
- [ ] T052 Crear proyecto Supabase y secret `SUPABASE_DB_URL` en GitHub (CA-06)
- [ ] T053 Crear proyecto Vercel (Root Directory `apps/web`) y variables por entorno (CA-06)
- [ ] T054 Primera ejecución de la CI en un PR, en verde (CA-02)
- [ ] T055 Desactivar GitHub Pages

## Fase 7 — SDD

- [x] T060 `CLAUDE.md`, constitución, `specs/README.md`, `product.md`, `backlog.md`, plantillas (RF-06)
- [x] T061 Skills `/especificar`, `/planificar`, `/desglosar`, `/implementar`, `/verificar` (RF-06)
- [x] T062 Skills de terceros en `.claude/skills` + `skills-lock.json`

## Fase 8 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde
- [x] T091 `pnpm db:start` + `pnpm db:test` + `types:check` en verde
- [x] T092 Mutaciones vistas fallar y revertidas: clave publishable opcional → falla el test de
      env «fails on import when the publishable key is missing»; subtítulo cambiado → fallan
      el test de `Welcome` y el E2E
