# Constitución del proyecto

Principios no negociables que toda spec, plan e implementación deben cumplir. Cada `plan.md`
incluye una verificación explícita contra esta lista. Cambiar la constitución requiere acuerdo
explícito y se registra en el historial al final de este archivo.

## I. La especificación es la fuente de verdad

- Ningún comportamiento de producto se implementa sin una spec en estado `aprobada` (o posterior).
- Si el código y la spec divergen, se corrige uno de los dos en el mismo cambio. No se acepta
  "spec drift".
- **Excepciones** (no requieren spec, sí un commit descriptivo): correcciones triviales sin cambio
  de comportamiento (typos, estilos menores), actualizaciones de dependencias sin cambio funcional
  y tooling interno (CI, lint, configuración del editor).

## II. Qué antes que cómo

- `spec.md` describe problema, usuarios, comportamiento observable y reglas de negocio.
  No menciona librerías, componentes, tablas ni endpoints.
- `plan.md` decide el cómo. `tasks.md` lo convierte en pasos ejecutables.
- Las specs de plataforma (infraestructura, migraciones de stack) son la excepción: sus usuarios
  son las personas que desarrollan y operan la app, y pueden nombrar tecnología.

## III. Criterios de aceptación verificables

- Cada historia de usuario tiene criterios en formato **Dado / Cuando / Entonces** con ID
  (`CA-01`, `CA-02`...).
- Cada criterio se cubre con al menos una prueba automatizada (Vitest, Playwright o pgTAP),
  y esa prueba se ha visto fallar.
- Un criterio que no se puede verificar se reescribe hasta que se pueda.

## IV. Ambigüedad explícita

- Lo que no se sabe se marca como `[NECESITA ACLARACIÓN: pregunta]`. Nunca se rellena con
  suposiciones silenciosas.
- Una spec con marcas `[NECESITA ACLARACIÓN]` abiertas no puede pasar a `aprobada`.
- Las suposiciones razonables se listan en «Suposiciones» para que el usuario las valide.

## V. Simplicidad y stack del proyecto

- Stack: Next.js + React, HeroUI + Tailwind, TanStack Query, React Hook Form + Zod, next-intl,
  Supabase (Postgres, Auth, Storage), Vercel.
- Toda dependencia nueva se justifica en el plan con las alternativas descartadas.
- Se construye lo mínimo que satisface los criterios de aceptación. Nada especulativo.

## VI. Seguridad y datos personales

- Los datos de clientes (nombre, celular, correo, placa) son datos personales: se recogen solo los
  necesarios y se cumple la normativa de protección de datos aplicable.
- Toda tabla expuesta tiene **RLS activado** con políticas explícitas. La autorización (p. ej.
  funciones solo-admin) se aplica en Postgres, no solo ocultando elementos de la UI.
- Ningún secreto se versiona. Las claves de servicio (`service_role` / secret key) nunca llegan
  al navegador.

## VII. Trazabilidad

- Cada spec tiene un ID de tres dígitos (`NNN`) y vive en `specs/NNN-slug/`.
- Ramas `feature/NNN-slug` desde `develop`; PRs y commits referencian el ID.
- Cada tarea de `tasks.md` referencia los criterios (`CA-xx`) o requisitos (`RF-xx`) que cubre.
- Cada archivo de test indica en su cabecera la spec y los criterios que protege.

## VIII. Incrementos pequeños y desplegables

- Las specs se dividen en historias priorizadas (P1, P2, P3). La P1 sola debe aportar valor
  y poder desplegarse.
- Una spec que no cabe en un PR revisable se divide en varias.
- El esquema de base de datos solo cambia mediante migraciones versionadas.

---

## Historial

| Fecha      | Cambio |
|------------|--------|
| 2026-11-19 | Versión inicial, con el stack Next.js + Supabase + Vercel (spec 001). |
