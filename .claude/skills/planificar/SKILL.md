---
name: planificar
description: Genera el plan técnico (plan.md) de una spec SDD aprobada, usando el stack del proyecto (Next.js, Supabase, HeroUI, TanStack Query, Zod). Úsala cuando el usuario pida planificar o diseñar técnicamente una spec.
argument-hint: <NNN>
---

# /planificar — plan técnico de una spec

Spec: $ARGUMENTS

## Precondiciones

- `specs/NNN-*/spec.md` existe y su `estado` es `aprobada`. Si no, detente y explica qué falta.
- La spec no tiene marcas `[NECESITA ACLARACIÓN]` abiertas.

## Pasos

1. Lee la spec, `specs/constitution.md`, `CLAUDE.md` y `packages/supabase/CLAUDE.md`.
2. Explora el código afectado: módulos en `apps/web/src/modules/`, migraciones existentes en
   `packages/supabase/supabase/migrations/` y los tipos en `packages/supabase/types/`.
   Consulta las skills `next-best-practices`, `supabase-postgres-best-practices`, `zod` y
   `react-hook-form` cuando la decisión dependa de ellas.
3. Copia `specs/_templates/plan.md` a `specs/NNN-slug/plan.md` y rellénalo:
   - Esquema de base de datos con **RLS** para cada tabla nueva: la autorización vive en Postgres.
   - Módulo con la estructura del proyecto (api, components, queries, schemas, messages…).
   - Tabla de estrategia de pruebas: cada `CA-xx` mapeado a una prueba concreta
     (Vitest, Playwright o pgTAP).
   - Dependencias nuevas solo con justificación y alternativas descartadas.
4. Rellena la verificación contra la constitución. Si algún principio no se cumple, justifícalo
   o cambia el plan.
5. Si el plan revela un hueco o error en la spec, detente: propón el cambio de spec primero.
6. Presenta el plan resumido y pide aprobación. Al aprobarse: `estado: aprobado` en el plan y
   `estado: planificada` en la spec. Siguiente paso: `/desglosar NNN`.
