---
id: "022"
titulo: "Registrar cliente y su primer vehículo desde «Nueva orden»"
estado: aprobada
creada: 2026-11-25
actualizada: 2026-11-25
---

# 022 — Registrar cliente y su primer vehículo desde «Nueva orden»

## Contexto y problema

Cuando llega alguien por primera vez, el personal busca al cliente en «Nueva orden» y no lo
encuentra. Hoy tiene que salir a «Clientes», registrarlo, registrar su vehículo y volver a abrir la
orden. Al reservar ya se puede registrar al cliente sin salir (spec 012), pero no al abrir una
orden. Y registrar un cliente y su vehículo son siempre dos pasos, aunque casi siempre llegan juntos.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador y administrador | Registrar al cliente nuevo y su vehículo sin salir de la orden, y dejar ambos elegidos para seguir con los servicios. |

## Historias de usuario

### HU-01 (P1) — Registrar al cliente desde «Nueva orden»

Como miembro del personal, quiero registrar al cliente que no encuentro sin salir de «Nueva
orden», para atenderlo enseguida.

**Criterios de aceptación**

- **CA-01** — Dado el personal en «Nueva orden», cuando busca un cliente y no aparece ninguno,
  entonces ve la opción «Registrar cliente».
- **CA-02** — Dada la opción, cuando la pulsa, entonces se abre el mismo formulario de «Nuevo
  cliente» de la sección «Clientes», con sus mismas reglas y errores (spec 004, CA-24 a CA-26).
- **CA-03** — Dado el formulario lleno, cuando guarda, entonces el cliente queda registrado y
  elegido en la orden, sin salir de ella; si cancela, la orden sigue como estaba, con su búsqueda.
- **CA-04** — Dado el texto que buscó, cuando abre el formulario, entonces ese texto ya está en el
  campo que corresponde: un celular en «Celular», una placa en la placa del primer vehículo y
  cualquier otra cosa en «Nombre completo».

### HU-02 (P1) — El primer vehículo, en el mismo formulario

Como miembro del personal, quiero registrar el primer vehículo del cliente en el mismo formulario
en que lo registro, para no hacer dos pasos.

**Criterios de aceptación**

- **CA-05** — Dado el formulario de «Nuevo cliente» (en «Clientes», en «Nueva orden» y al
  reservar), entonces tiene una parte opcional «Primer vehículo» con los mismos campos y reglas de
  un vehículo (spec 005: tipo, marca, línea, placa, cilindraje, color…).
- **CA-06** — Dado el formulario sin vehículo, cuando guarda, entonces se registra solo el cliente,
  como hoy.
- **CA-07** — Dado el formulario con un vehículo, cuando guarda, entonces se registran el cliente y
  su vehículo juntos; si algo del vehículo es inválido (p. ej. una placa que ya tiene otro cliente),
  entonces ve el error junto al campo y no se registra ninguno de los dos (RN-01).
- **CA-08** — Dado un cliente registrado con su vehículo desde «Nueva orden», entonces la orden
  queda con ese cliente y ese vehículo elegidos, lista para añadir servicios.
- **CA-09** — Dado un cliente registrado con su vehículo al reservar, entonces la reserva queda con
  ese cliente y ese vehículo elegidos.
- **CA-10** — Dado un cliente registrado con su vehículo desde «Clientes», entonces su ficha muestra
  el vehículo.

## Requisitos funcionales

- **RF-01** — «Nueva orden» permite registrar al cliente que no encuentra, como ya lo permite la
  reserva (spec 012).
- **RF-02** — El formulario de «Nuevo cliente» es uno solo en las tres pantallas, con el primer
  vehículo opcional.

## Reglas de negocio

- **RN-01** — El cliente y su primer vehículo se registran juntos o ninguno: nunca queda un cliente
  registrado a medias por un error del vehículo.
- **RN-02** — Las reglas de siempre: las del cliente (spec 004: nombre, correo o celular,
  autorización de datos, correo único) y las del vehículo (spec 005: placa única entre vehículos
  activos, catálogo de marcas y líneas, spec 018).
- **RN-03** — Solo el personal (operador o administrador) registra clientes desde estas pantallas
  (spec 004, HU-06).

## Datos (vista conceptual)

Sin datos nuevos: se registran un cliente y un vehículo como hoy.

## Requisitos no funcionales

- **Móvil**: el formulario con el vehículo cabe en 360 px y en el iPhone, sin desplazamiento
  lateral, también dentro de «Nueva orden».
- **Accesibilidad**: el formulario con sus errores a la vista pasa la auditoría en claro y oscuro.

## Fuera de alcance

- Registrar más de un vehículo en el formulario (los siguientes, desde la ficha).
- Que el cliente registre su vehículo así desde la app (ya lo hace en «Mi perfil», spec 005).
- Abrir la orden con servicios desde el formulario: se añaden en la orden, como hoy.

## Suposiciones

- «Registrar cliente» aparece cuando la búsqueda no encuentra a nadie, como al reservar; no se
  muestra mientras hay resultados.
- La placa reconocida en CA-04 sigue el formato de placa de la spec 005; un número de 10 dígitos que
  empieza por 3 es un celular.

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
| 2026-11-25 | Creación, a pedido del usuario: registrar al cliente desde «Nueva orden» con el mismo formulario y, opcional, su primer vehículo. Enmienda las specs 004 (HU-06) y 008 (CA-01). |
| 2026-11-25 | Aprobada por el usuario. |
