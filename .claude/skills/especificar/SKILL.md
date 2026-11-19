---
name: especificar
description: Crea una especificación SDD nueva (specs/NNN-slug/spec.md) a partir de una descripción de funcionalidad. Úsala cuando el usuario quiera especificar, definir o empezar una funcionalidad nueva, o cambiar el comportamiento de una existente.
argument-hint: <descripción de la funcionalidad>
---

# /especificar — crear una spec

Entrada del usuario: $ARGUMENTS

Objetivo: producir el **qué** y el **por qué** de una funcionalidad, sin decidir el cómo.
No escribas código ni plan técnico en este paso.

## Pasos

1. Lee `specs/constitution.md`, `specs/product.md` y `specs/backlog.md`.
2. Si la entrada está vacía, pide la descripción y detente.
3. Comprueba si ya existe una spec que cubra esto (`grep -H "^titulo:" specs/*/spec.md`).
   Si existe y el cambio altera su comportamiento, propón editarla en lugar de crear otra.
4. Calcula el siguiente ID: el mayor `NNN` de `specs/[0-9][0-9][0-9]-*` + 1, con tres dígitos.
   Elige un slug corto en español, en minúsculas y con guiones.
5. Copia `specs/_templates/spec.md` a `specs/NNN-slug/spec.md` y rellénala:
   - Historias priorizadas (P1, P2, P3); la P1 sola debe aportar valor.
   - Criterios `CA-xx` en formato Dado / Cuando / Entonces, observables y verificables.
   - Sin nombres de librerías, tablas, componentes ni endpoints.
   - Lo desconocido como `[NECESITA ACLARACIÓN: …]`; lo supuesto, en «Suposiciones».
6. Si hay marcas `[NECESITA ACLARACIÓN]`, pregunta las más importantes (máximo 5) con la
   herramienta de preguntas, ofreciendo opciones concretas. Incorpora las respuestas a la spec.
7. Completa el checklist de calidad de la spec con honestidad.
8. Actualiza `specs/backlog.md`: mueve el elemento a «Especificadas» con su ID y estado.
9. Deja `estado: borrador` y presenta un resumen: historias, criterios, suposiciones y
   preguntas pendientes. Pide al usuario que la apruebe.

Cuando el usuario apruebe explícitamente, cambia a `estado: aprobada`, actualiza la fecha y
añade la entrada en «Historial». Siguiente paso sugerido: `/planificar NNN`.
