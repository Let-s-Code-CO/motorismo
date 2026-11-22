---
spec: "013"
actualizado: 2026-11-21
---

# Tareas — 013 Avisos flotantes de confirmación

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `w/` = `apps/web/`, `t/` = `apps/web/__test__/`.

## Fase 1 — Base de datos

Sin cambios (plan: «Base de datos»).

## Fase 2 — Pruebas del núcleo (rojo)

- [x] T010 [P] `t/src/modules/core/lib/toast.lib.test.ts` → rojo:
  - `notify` añade el aviso al final; `dismiss` lo quita;
  - el cuarto aviso quita el más antiguo (CA-06);
  - un aviso con `after` no se publica hasta que se llega a su ruta, y solo una vez (CA-05).
- [x] T011 [P] `t/src/modules/core/components/toast-region.component.test.tsx` (reloj falso) → rojo:
  - región «Avisos»: confirmaciones en `role="status"` y errores en `role="alert"`; el foco no se
    mueve (CA-10);
  - una confirmación se cierra a los 5000 ms y no a los 4999 (CA-03);
  - con el ratón o el foco encima no se cierra; al salir se cierra con lo que le quedaba (CA-03);
  - «Cerrar» la quita al instante; se alcanza con Tab y tiene nombre (CA-04, CA-11);
  - un error sigue a la vista a los 60 s (CA-07, RN-01);
  - se ven 3, el más reciente abajo (CA-06);
  - un pendiente aparece al cambiar la ruta (CA-05).

## Fase 3 — Núcleo (verde)

- [x] T020 `w/src/modules/core/lib/toast.lib.ts`: almacén, `notify`, `dismiss`, pendientes por ruta,
  `subscribe` y `getSnapshot` → T010 en verde (RF-01).
- [x] T021 `w/src/modules/core/components/toast-region.component.tsx`, montada en
  `w/src/app/layout.tsx`:
  - posición del plan y `data-react-aria-top-layer`;
  - `animate-toast-in` con `motion-safe:` en `w/src/app/globals.css`;
  - mensajes `toast.region` y `toast.close` en `core/messages/es.json`.
  → T011 en verde (RF-01, CA-02, CA-12).
- [x] T022 `t/test-utils/render.tsx` monta la región, para que las pruebas de pantalla encuentren el
  aviso donde lo ve la persona.
  - Mutaciones vistas fallar: almacén (quedarse con los más antiguos, no consumir el pendiente,
    ignorar `after`, id por texto, modificar la lista en el sitio); región (4 s en vez de 5, sin
    pausa con el ratón, sin pausa con el foco, reiniciar el tiempo entero, errores que se cierran,
    sin `arrive`, `aria-atomic` por defecto, «Cerrar» que no hace nada, errores en la zona educada).
  - Desvío del plan: las zonas vivas usan `aria-live="polite"` y `aria-live="assertive"`, sin los
    roles `status` y `alert`. Las vacías se confundían con el estado o la alerta propios de una
    pantalla.

## Fase 4 — Migración de pantallas

Cada tarea sigue el mismo ciclo: ajusta las pruebas de la pantalla (la confirmación, en la región
«Avisos» y no en la página; el error de una acción suelta, en la región `alert`; sin red, ningún
aviso) → rojo → migra la pantalla → verde.

- [x] T030 [P] Clientes: lista (creado, desactivado, reactivado), ficha (contacto actualizado,
  desactivar o reactivar) y «Mi perfil» (guardado; su error sigue dentro, porque es un formulario)
  (CA-01, CA-07, CA-08, CA-09).
- [x] T031 [P] Vehículos: confirmaciones de la sección (CA-01).
- [x] T032 [P] Servicios y Empleados: creado, editado, desactivado y reactivado; error de
  desactivar en la región `alert` (CA-01, CA-07, CA-09).
- [x] T033 [P] Órdenes:
  - lista: «Empezar» y su error;
  - detalle: actualizada, cerrada, anulada y corregida;
  - `new-order-screen` con `notify({ after })`, sin `?saved=opened`, y `orders/[id]/page.tsx`
    sin `saved`.
  (CA-01, CA-05, CA-07)
- [x] T034 [P] Reservas:
  - detalle: guardada, más tiempo, «No asistió», cancelada y tolerancia; errores de «+5 min» y
    «No asistió» en la región `alert`;
  - `reservation-form` con `notify({ after })`, sin `?saved=1`, y `agenda/[id]/page.tsx` sin
    `saved`.
  (CA-01, CA-05, CA-07)
- [x] T035 [P] «Horario»: las confirmaciones de semana y configuración a la región; los errores,
  debajo de su botón (formulario) (CA-01, CA-08).
- [x] T036 Comprobar que ningún `Alert` de confirmación queda en una página: `grep` de
  `tone: 'success'` y `color="success"` en `w/src/modules`, que solo debe encontrar lo
  permanente (RN-02).
  - El `grep` encontró **Usuarios** (invitar, rol, desactivar o reactivar, reenviar), que no estaba en
    el inventario del plan: migrada, con pruebas nuevas en `users-screen.component.test.tsx`.
  - Las pruebas de cada pantalla se vieron fallar antes de migrarla (el aviso salía en la página,
    no en la región).
  - Corrección hallada al migrar Reservas: al cambiar una reserva, la ruta no cambia
    (`?edit=1` → sin él) y el aviso «para la pantalla de llegada» se quedaba pendiente. El almacén
    recuerda la pantalla actual y lo muestra al momento (prueba en `toast.lib.test.ts`, vista
    fallar sin recordar la pantalla).
  - En el detalle de una orden, el error al empezarla salía con el color de una confirmación; ahora
    es un error (prueba nueva).

## Fase 5 — E2E

- [x] T040 `w/e2e/toasts.spec.ts`:
  - en «Horario», desplazado hasta abajo, guardar la configuración muestra el aviso dentro de la
    ventana, abajo a la derecha, y a los ~5 s ya no está (CA-01, CA-02, CA-03);
  - a 360 px, abajo y a lo ancho, sin desplazamiento lateral (CA-02);
  - guardar una reserva muestra «Reserva guardada.» en su detalle, y recargar no la repite (CA-05);
  - con «reducir movimiento», la animación del aviso es `none` (CA-12).
- [x] T041 `w/e2e/a11y.spec.ts`: auditoría con un aviso de cada tono a la vista, en claro y oscuro
  (CA-11). `w/e2e/ui.spec.ts`: el aviso en la prueba «on an iPhone» (CA-02).
- [x] T042 Ajustar las E2E que esperaban `?saved=…` o el aviso en la página (`reservations.spec.ts`,
  `work-orders.spec.ts` y las que busquen confirmaciones).
  - La primera ronda de `toasts.spec.ts` falló de verdad: la zona de errores vacía dejaba 8 px bajo
    la confirmación (corregido con `not-empty:mt-2`), y se medía en plena animación de entrada.
  - Hallado en las capturas del iPhone: el aviso tapaba el banner «Instala Motorismo» (spec 006),
    que también va abajo. `useBottomBanner` (`core/hooks`) publica la altura de los banners de
    abajo en `--bottom-banners` y la región sube por encima. Prueba unitaria (vista fallar sumando
    alturas, sin olvidar un banner y sin el margen) y E2E en el iPhone: el aviso queda encima del
    banner.

## Fase 6 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde,
  con las E2E también contra el build de producción (`CI=1`), como la CI.
- [x] T091 Sin migraciones: `db:reset`, `db:test` y `types:check` no aplican.
  - E2E completa contra el build de producción, construido sin cachés: 171/171.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado y revertida (`git diff` + grep).
- [x] T093 Revisión en el teléfono: capturas a 360 px y en iPhone de 440 px táctil, en claro y
  oscuro.
- [x] T095 (verificación) La prueba de CA-11 recorre la página con Tab hasta «Cerrar» y lo pulsa
  con Enter; vista fallar con `tabIndex={-1}` en el botón.
- [x] T094 `CLAUDE.md`: estándar de avisos (resultado → `notify`; errores de formulario dentro);
  spec, plan y backlog actualizados.

## Cobertura de criterios

| Criterio | Tareas |
|---|---|
| CA-01 | T030–T035, T040 |
| CA-02 | T021, T040, T041 |
| CA-03 | T011, T040 |
| CA-04 | T011 |
| CA-05 | T010, T011, T033, T034, T040 |
| CA-06 | T010, T011 |
| CA-07 | T011, T030, T032–T034 |
| CA-08 | T030, T035 |
| CA-09 | T030, T032 |
| CA-10 | T011 |
| CA-11 | T011, T041 |
| CA-12 | T021, T040 |
