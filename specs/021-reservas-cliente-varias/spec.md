---
id: "021"
titulo: "Reservas del cliente: varias por vehículo y tiempo estimado"
estado: verificada
creada: 2026-11-25
actualizada: 2026-11-25
---

# 021 — Reservas del cliente: varias por vehículo y tiempo estimado

## Contexto y problema

Desde la app, el cliente solo puede tener una reserva pendiente por vehículo (spec 014, RN-03): si
quiere llevar la moto el martes y otra vez el sábado, tiene que esperar a que pase la primera o
pedírselo al personal. Además, al elegir los servicios no sabe cuánto tiempo le tomará el lavadero,
y eso le ayuda a decidir la hora.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Cliente con cuenta | Reservar el mismo vehículo para varios días y saber cuánto tardarán los servicios que elige. |
| Personal | Ver esas reservas en la agenda como cualquier otra (sin cambios para él). |

## Historias de usuario

### HU-01 (P1) — Varias reservas del mismo vehículo

Como cliente, quiero reservar el mismo vehículo para varios días, para dejar agendadas mis próximas
visitas de una vez.

**Criterios de aceptación**

- **CA-01** — Dado un vehículo suyo con una reserva pendiente el martes, cuando lo reserva para el
  sábado, entonces queda reservado y tiene las dos pendientes.
- **CA-02** — Dado un vehículo suyo con una reserva pendiente un día, cuando intenta reservarlo otra
  vez ese mismo día (a otra hora), entonces se le dice que ese vehículo ya tiene una reserva ese día
  y que la cambie si quiere otra hora; no se crea la segunda (RN-01).
- **CA-03** — Dadas reservas «Sin vehículo», entonces vale lo mismo: varias en días distintos, una
  como mucho por día (RN-01).
- **CA-04** — Dada una reserva suya pendiente, cuando la cambia a un día en que ese vehículo ya tiene
  otra, entonces se le dice lo mismo que en CA-02 y la reserva queda como estaba.
- **CA-05** — Dado un cliente con varias reservas pendientes, cuando abre «Mis reservas», entonces
  las ve todas, por fecha, y cada una se cambia o se cancela sola; su inicio sigue mostrando la
  más próxima (spec 014).

### HU-02 (P1) — Cuánto tardará lo que elijo

Como cliente, quiero ver cuánto tiempo tomarán los servicios que elijo al reservar, para elegir una
hora que me sirva.

**Criterios de aceptación**

- **CA-06** — Dado el formulario para reservar o cambiar una reserva, cuando el cliente elige uno o
  más servicios, entonces ve el tiempo estimado de todos juntos, la suma de los tiempos de esos
  servicios («Tiempo estimado: ≈ 2 h 15 min»), y se actualiza al marcar o desmarcar uno.
- **CA-07** — Dado un servicio elegido que no tiene tiempo estimado, entonces el tiempo dice cuáles
  faltan («Sin estimar: Micropulido»); si ninguno de los elegidos tiene tiempo, solo dice que no hay
  estimado.
- **CA-08** — Dado que no ha elegido ningún servicio, entonces no se muestra tiempo estimado.

## Requisitos funcionales

- **RF-01** — Desde la app, el cliente puede tener varias reservas pendientes por vehículo (y «Sin
  vehículo»), en días distintos.
- **RF-02** — El formulario de reserva del cliente muestra el tiempo estimado de los servicios
  elegidos, con los tiempos del catálogo (spec 008, HU-06).

## Reglas de negocio

- **RN-01** — Reemplaza la spec 014, RN-03: desde la app, el cliente tiene como mucho una reserva
  pendiente por vehículo **por día**, y una «Sin vehículo» por día. Las reglas de la agenda siguen
  (spec 012, RN-01 a RN-03): franjas que no han empezado, días abiertos de semanas habilitadas,
  nunca más reservas que puestos.
- **RN-02** — El tiempo estimado es orientativo: no reserva más franjas ni cambia la tolerancia; la
  hora real depende de la cola del día (spec 012, RN-04).
- **RN-03** — El cliente sigue sin ver precios (spec 014): solo nombres y tiempos de los servicios.

## Datos (vista conceptual)

Sin datos nuevos: las reservas y los tiempos estimados de los servicios ya existen.

## Requisitos no funcionales

- **Móvil**: el tiempo estimado se ve bajo los servicios en 360 px y en el iPhone.
- **Accesibilidad**: el tiempo estimado se anuncia al cambiar (sin interrumpir), y el formulario
  pasa la auditoría en claro y oscuro.

## Fuera de alcance

- Reservar varios días en un solo envío (se reservan uno a uno).
- Mostrar a qué hora terminaría (depende de la cola).
- Cambiar las reglas del personal (spec 012): el personal ya puede hacerle varias reservas.
- Mostrar el tiempo estimado en el formulario de reserva del personal.

## Suposiciones

- No hay más límite que uno por vehículo y día: las semanas que se pueden reservar ya las limita el
  administrador al habilitarlas (spec 012).
- El tiempo se escribe como en las órdenes («45 min», «2 h 30 min»).

## Preguntas abiertas

Ninguna.

## Checklist de calidad de la spec

- [x] No menciona tecnologías, librerías, tablas ni componentes.
- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba.
- [x] No quedan marcas `[NECESITA ACLARACIÓN]`.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar.

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-25 | Creación, a pedido del usuario. Decisión del usuario: varias reservas pendientes por vehículo, una por día, hechas una a una. Enmienda la spec 014 (RN-03, CA-15). |
| 2026-11-25 | Aprobada por el usuario. |
| 2026-11-25 | Plan aprobado: estado `planificada`. |
| 2026-11-25 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-25 | Implementada. Además de lo previsto, una prueba de concurrencia en el sandbox (cuatro reservas del mismo vehículo y día a la vez dejan una). Enmendada la spec 014. |
| 2026-11-25 | Verificada: los 8 criterios con prueba vista fallar; E2E 253/253 contra producción. Se añadió que, al cambiar una reserva, el estimado de los servicios que ya tiene se ve desde el principio (CA-06), vista fallar con una mutación. |
