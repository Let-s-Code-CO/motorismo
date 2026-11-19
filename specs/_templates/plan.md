---
spec: "NNN"
estado: borrador
actualizado: AAAA-MM-DD
---

# Plan técnico — NNN <Título>

## Resumen

<Dos o tres frases: cómo se resuelve la spec con el stack del proyecto.>

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅/❌ | |
| II. Qué antes que cómo | | |
| III. Criterios verificables | | |
| IV. Ambigüedad explícita | | |
| V. Simplicidad y stack | | |
| VI. Seguridad y datos personales | | |
| VII. Trazabilidad | | |
| VIII. Incrementos pequeños | | |

## Base de datos (packages/supabase)

- Migraciones nuevas (`supabase/migrations/<timestamp>_<nombre>.sql`):
- Tablas / columnas / enums:
- RLS y políticas (quién lee/escribe qué):
- Seeds a actualizar:
- Pruebas pgTAP (`supabase/tests/`):

## Aplicación (apps/web)

- Módulo: `src/modules/<feature>/`
- Rutas (App Router):
- Componentes (atoms / molecules / organisms):
- Datos: queries / mutations (TanStack Query), Server Actions o Route Handlers:
- Formularios: esquemas Zod (`*.schema.ts`) + React Hook Form:
- Mensajes (`messages/es.json`):

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | unit / componente / e2e / pgTAP | |

## Archivos afectados

- Nuevos:
- Modificados:
- Eliminados:

## Dependencias nuevas

<Ninguna, o cada una con justificación y alternativas descartadas.>

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| | | |

## Despliegue

<Orden: migración → app. Variables de entorno nuevas en Vercel. Flags.>
