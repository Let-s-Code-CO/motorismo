---
id: "001"
titulo: "Migración de plataforma a Next.js + Supabase + Vercel"
estado: en-progreso
creada: 2026-11-19
actualizada: 2026-11-19
---

# 001 — Migración de plataforma a Next.js + Supabase + Vercel

> Spec de plataforma (constitución, principio II): sus usuarios son quienes desarrollan y
> operan la app, por eso nombra tecnología.

## Contexto y problema

La primera versión era una SPA en React + Vite + Redux con Firebase (Auth y Firestore),
publicada en GitHub Pages. Partía de una plantilla de un curso («app de notas»), solo tenía login
funcional y las pantallas de negocio eran marcadores. No tenía pruebas, linter ni CI, usaba dos
gestores de paquetes y guardaba el rol del usuario en el `displayName`, sin control real de
permisos.

Se quiere desplegar en **Vercel** con base de datos **Supabase**, sobre un stack moderno y con
barreras de calidad automáticas (lint, tipos, pruebas, CI).

## Usuarios y roles

| Rol | Qué necesita |
|---|---|
| Desarrollador | Levantar todo en local con pocos comandos, con pruebas y verificaciones automáticas. |
| Operación / dueño | Una app desplegada y estable, con base de datos gestionada y despliegues predecibles. |

## Historias de usuario

### HU-01 (P1) — Base de la nueva plataforma en local

Como desarrollador, quiero clonar el repo y tener la app y la base de datos corriendo en local
para empezar a construir funcionalidades con el flujo SDD.

- **CA-01** — Dado un clon limpio con Node 24 y Docker, cuando ejecuto `pnpm install`,
  `pnpm db:start`, creo `apps/web/.env.local` desde `.env.example` y ejecuto `pnpm dev`,
  entonces la app responde en `http://localhost:3000`.
- **CA-03** — Dado que la app está corriendo, cuando un usuario abre la raíz, entonces ve el
  nombre «Motorismo Detailing», el logo y el mensaje «Estamos preparando la nueva plataforma.»,
  en español.
- **CA-05** — Dado que faltan o son inválidas las variables de conexión a Supabase, cuando la app
  se compila o arranca, entonces falla con un error que lo indica, en lugar de fallar más tarde
  en una consulta.
- **CA-07** — Dado el repositorio migrado, cuando busco dependencias o código de Firebase, Redux,
  Vite (como bundler de la app) o Cloudinary, entonces no hay ninguno.

### HU-02 (P1) — Barreras de calidad automáticas

Como desarrollador, quiero que lint, tipos, pruebas y build se verifiquen solos para no
desplegar código roto.

- **CA-02** — Dado un PR, cuando corre la CI, entonces se ejecutan lint, comprobación de tipos,
  pruebas unitarias, build, E2E y la validación de Supabase; un fallo en cualquiera deja el
  check en rojo.
- **CA-04** — Dado el esquema de la base de datos, cuando la cadena de migraciones se reaplica
  desde cero, entonces las pruebas pgTAP pasan, y si los tipos generados no coinciden con las
  migraciones la verificación falla.
- **CA-08** — Dado un commit, cuando su mensaje no sigue Conventional Commits, entonces el hook
  `commit-msg` lo rechaza; y el `pre-commit` ejecuta el lint.

### HU-03 (P2) — Despliegue en Vercel + Supabase

Como responsable de la operación, quiero que lo que entra en `develop` se despliegue solo, con
las migraciones aplicadas a la base de datos remota.

- **CA-06** — Dado un merge en `develop`, cuando termina el pipeline, entonces Vercel despliega la
  app (`apps/web`) y las migraciones nuevas se aplican al proyecto Supabase remoto.

## Requisitos funcionales

- **RF-01** — Monorepo pnpm + Turborepo con `apps/web` y `packages/supabase`, más configs
  compartidas de ESLint, TypeScript y Prettier.
- **RF-02** — `apps/web` en Next.js (App Router) con HeroUI + Tailwind, next-intl (solo español),
  TanStack Query, React Hook Form + Zod y clientes de Supabase tipados.
- **RF-03** — `packages/supabase` con CLI fijado, config local, seeds, pgTAP y tipos generados.
- **RF-04** — Vitest + Testing Library y Playwright configurados, con pruebas de ejemplo que
  documenten el estilo exigido.
- **RF-05** — Husky + commitlint, CI en GitHub Actions y workflow de despliegue de migraciones.
- **RF-06** — Flujo SDD operativo: constitución, plantillas, backlog y comandos de Claude Code.

## Fuera de alcance

- Autenticación y roles (spec propia; ver backlog).
- Funcionalidades de negocio (clientes, órdenes, reportes).
- Migración de datos de Firestore: no hay datos de negocio que conservar
  ([POR CONFIRMAR con el dueño] si existen usuarios de Firebase Auth que haya que recrear).

## Suposiciones

- La publicación anterior en GitHub Pages (`docs/`) deja de mantenerse; la nueva URL será la de
  Vercel.
- Mientras no exista otra rama, `develop` es la rama que se despliega.

## Preguntas abiertas

- Rama y entorno de producción (¿`main` → producción, `develop` → preview?). No bloquea HU-01/02.

## Checklist de calidad de la spec

- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba o comprobación automatizada.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar.
- [ ] Sin preguntas abiertas: queda la rama de producción (no bloquea la P1).

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Creación. Decisiones tomadas con el usuario: monorepo pnpm + Turborepo, andamiaje completo en este paso, solo español con next-intl, código/commits en inglés y documentación en español. |
