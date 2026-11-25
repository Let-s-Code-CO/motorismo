---
id: "014"
titulo: "Experiencia del cliente con cuenta"
estado: verificada
creada: 2026-11-21
actualizada: 2026-11-21
---

# 014 — Experiencia del cliente con cuenta

## Contexto y problema

El cliente que se registra en la app hoy solo ve «Mi perfil»: sus datos y sus vehículos. Si deja su
moto o su carro en el lavadero, no tiene cómo saber si ya empezaron ni cuándo estaría lista: llama o
escribe para preguntar. Tampoco ve qué servicios se le hicieron antes ni cuánto pagó, y para
reservar tiene que pedirle el turno al personal por teléfono o WhatsApp.

Se quiere que la app le sirva al cliente: ver el estado de su vehículo mientras está en el
lavadero, consultar su historial, y reservar, cambiar o cancelar sus reservas por su cuenta, con las
mismas reglas de la agenda que usa el personal (spec 012).

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Cliente con cuenta | Saber cómo va su vehículo, ver su historial y manejar sus reservas sin llamar. |
| Operador y administrador | Ver en la agenda las reservas que hizo el cliente, con las mismas reglas que las suyas, y saber quién las hizo. |

Los clientes sin cuenta (registrados en el punto de atención) no entran a la app: esta spec no los
cambia.

## Historias de usuario

### HU-01 (P1) — Mi vehículo en el lavadero

Como cliente, quiero ver cómo va mi vehículo mientras está en el lavadero, para no tener que
llamar a preguntar.

**Criterios de aceptación**

- **CA-01** — Dado un cliente con un vehículo en la cola, cuando abre su inicio, entonces ve ese
  vehículo «En cola», cuántas órdenes van antes que la suya («Van 2 antes»), los servicios que se le
  van a hacer y desde qué hora está en el lavadero.
- **CA-02** — Dado un vehículo suyo en proceso, cuando abre su inicio, entonces lo ve «En proceso»
  desde la hora en que empezó, con sus servicios y «Lista hacia las 4:30 p. m.» cuando todos los
  servicios tienen tiempo estimado. Si alguno no lo tiene, no da hora y dice «Sin hora estimada».
- **CA-03** — Dado un cliente con dos vehículos en el lavadero, cuando abre su inicio, entonces ve
  cada uno por separado, con su propio estado.
- **CA-04** — Dado un cliente sin vehículos en el lavadero, cuando abre su inicio, entonces se le
  dice que no tiene ninguno ahora, con acceso a su historial y a reservar (HU-03).
- **CA-05** — Dado el inicio abierto, cuando el personal empieza su orden, la cierra o cambia la
  cola, entonces el estado se actualiza solo en pocos segundos, sin recargar.
- **CA-06** — Dado cualquier cliente, entonces nunca ve órdenes, vehículos ni nombres de otros
  clientes: de la cola solo sabe cuántas órdenes van antes de la suya.

### HU-02 (P1) — Mi historial

Como cliente, quiero ver los servicios que se le hicieron a mis vehículos y cuánto pagué, para
llevar mis cuentas y saber cuándo toca otro servicio.

**Criterios de aceptación**

- **CA-07** — Dado un cliente con órdenes cerradas, cuando abre su historial, entonces ve cada
  orden, la más reciente primero, con la fecha, el vehículo, los servicios con su valor, el
  descuento si lo hubo, el total y los medios de pago con lo que se pagó con cada uno.
- **CA-08** — Dada una orden anulada, entonces no aparece en el historial del cliente. Una orden
  corregida aparece con sus valores corregidos.
- **CA-09** — Dado un vehículo que el cliente retiró, entonces sus órdenes siguen en el historial.
- **CA-10** — Dado un cliente sin órdenes cerradas, cuando abre su historial, entonces se le dice
  que aún no tiene servicios.
- **CA-11** — Dado un cliente con muchas órdenes, entonces el historial muestra primero las más
  recientes y deja ver las anteriores sin cargar todas de una vez.

### HU-03 (P2) — Reservar desde la app

Como cliente, quiero reservar mi turno desde la app, para asegurar mi puesto sin llamar.

**Criterios de aceptación**

- **CA-12** — Dado un cliente, cuando abre «Reservar», entonces elige uno de sus vehículos o «Sin
  vehículo», el día (con las franjas que aún no han empezado y sus puestos libres, como el personal,
  spec 012 CA-03), los servicios que quiere (los que se ofrecen para su tipo de vehículo, opcional) y
  una observación; al guardar, queda reservado y ve su reserva con el día, la hora y hasta qué hora
  puede llegar para conservar su turno (la tolerancia general).
- **CA-13** — Dado un día cerrado o una semana sin habilitar, entonces no se puede reservar en él,
  como para el personal.
- **CA-14** — Dada una franja que se llenó mientras el cliente elegía, cuando guarda, entonces se le
  dice que ya no hay puestos y las franjas se muestran al día.
- **CA-15** — Dado un vehículo suyo con una reserva pendiente, cuando intenta reservarlo otra vez
  **ese mismo día**, entonces se le dice que ese vehículo ya tiene una reserva ese día y que la
  cambie si quiere otra hora; igual con una segunda reserva «Sin vehículo» ese día (RN-03). *(Enmienda
  de la spec 021: en días distintos sí puede.)*
- **CA-16** — Dada una reserva hecha por el cliente, cuando el personal la ve en la agenda o en su
  detalle, entonces es una reserva más (ocupa su puesto y sigue la regla del turno, spec 012) y dice
  «Reservó el cliente desde la app».

### HU-04 (P2) — Mis reservas: ver, cambiar y cancelar

Como cliente, quiero ver mis reservas y cambiarlas o cancelarlas, para ajustar mis planes sin
llamar.

**Criterios de aceptación**

- **CA-17** — Dado un cliente con reservas, cuando abre «Mis reservas», entonces ve las pendientes
  (la más próxima primero) con el día, la hora, el vehículo, los servicios y hasta qué hora puede
  llegar; y las ya pasadas recientes con su estado (Atendida, No asistió, Cancelada).
- **CA-18** — Dada una reserva suya pendiente, cuando la cambia (día, franja, vehículo, servicios u
  observación), entonces queda cambiada con las mismas reglas que al reservar (CA-12 a CA-15).
- **CA-19** — Dada una reserva suya pendiente, cuando la cancela y confirma (con un motivo opcional),
  entonces deja de ocupar su puesto y el personal la ve «Cancelada por el cliente», con el motivo si
  lo escribió.
- **CA-20** — Dada una reserva que ya no está pendiente (llegó y se abrió su orden, se canceló o
  quedó «No asistió»), entonces el cliente ya no puede cambiarla ni cancelarla.
- **CA-21** — Dado cualquier cliente, entonces nunca ve, cambia ni cancela reservas de otros.
- **CA-22** — Dada una reserva suya pendiente a la vista, cuando el personal le da más tiempo para
  llegar («+5 min» o su propia tolerancia, spec 012), la cambia, la cancela o registra su llegada,
  entonces el cliente lo ve en pocos segundos, sin recargar: «Puedes llegar hasta las 9:25 a. m.»
  con la nueva hora, o su nuevo estado.
- **CA-23** — Dada una reserva suya pendiente cuya hora para conservar el turno ya pasó, cuando la ve
  en su inicio o en «Mis reservas», entonces dice «Ya pasó la hora para conservar tu turno; si
  llegas, entras por orden de llegada» en lugar de «Puedes llegar hasta…»; el texto cambia solo, sin
  recargar, cuando esa hora pasa con la pantalla abierta.

## Requisitos funcionales

- **RF-01** — El cliente con cuenta tiene un inicio con sus vehículos en el lavadero, su próxima
  reserva y accesos a reservar, a sus reservas, a su historial y a su perfil.
- **RF-02** — El estado, el historial y las reservas solo muestran datos del propio cliente.
- **RF-03** — Las reservas hechas por el cliente usan la misma agenda, franjas, puestos y reglas que
  las del personal (spec 012).

## Reglas de negocio

- **RN-01** — El cliente solo ve y toca lo suyo: sus órdenes, sus vehículos y sus reservas. La
  autorización se comprueba en el servidor, nunca solo ocultando botones.
- **RN-02** — Las reglas de la agenda (spec 012, RN-01 a RN-03) valen igual para el cliente: solo
  franjas que no han empezado de días abiertos de semanas habilitadas, nunca más reservas que
  puestos, y un vehículo no se repite en la misma franja.
- **RN-03** — Desde la app, el cliente tiene como mucho una reserva pendiente por cada vehículo suyo
  **por día**, y una «Sin vehículo» por día (enmienda de la spec 021, RN-01). El personal puede
  hacerle más (spec 012, RN-03).
- **RN-04** — El cliente cambia o cancela una reserva suya solo mientras está pendiente.
- **RN-05** — El cliente no cambia la tolerancia, no da «+5 min», no marca «No asistió» ni
  «Llegó»: eso sigue siendo del personal (spec 012).
- **RN-06** — Las órdenes anuladas no se muestran al cliente.
- **RN-07** — Las horas, como en el resto de la app, en 12 horas («4:30 p. m.»), en la hora de
  Colombia.

## Cambia la spec 012

- RN-05 y RN-06 de la spec 012 decían que solo el personal reserva, cambia y cancela, y que un
  cliente no ve ni toca la agenda. Con esta spec, el cliente con cuenta reserva, cambia y cancela
  **sus** reservas (RN-03 y RN-04 de esta spec); sigue sin ver la agenda ni las reservas de otros.

## Cambia la spec 004

- CA-12 de la spec 004 decía que el cliente, al entrar, llega a «Mi perfil»; con esta spec llega a
  su inicio (RF-01). CA-08 decía que solo ve su perfil y cerrar sesión; ahora ve «Inicio», «Mis
  reservas», «Historial» y «Mi perfil», y sigue sin ver nada del personal.

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Reserva | quién la hizo (el cliente o un miembro del personal), quién la canceló | Para «Reservó el cliente desde la app» y «Cancelada por el cliente». |

El resto ya existe: órdenes con sus servicios, descuento, total y pagos (spec 008); reservas y
agenda (spec 012).

## Requisitos no funcionales

- **Móvil primero:** el cliente usa la app sobre todo en el teléfono; cada pantalla se revisa a
  360 px y en iPhone, sin desplazamiento lateral.
- **Accesibilidad:** WCAG 2.1 AA en claro y oscuro, con la auditoría automática en verde.
- **Privacidad:** solo datos del propio cliente (RN-01); nada de nombres de empleados ni de otros
  clientes.
- **Avisos:** los resultados (reserva guardada, cancelada) con los avisos flotantes (spec 013).

## Fuera de alcance

- Avisos al cliente por WhatsApp, correo o notificaciones del teléfono (backlog: confirmación por
  WhatsApp).
- Pagar desde la app.
- Que el cliente vea quién atendió su vehículo (empleados) o quién registró sus órdenes.
- Los derechos del titular de datos desde la app (backlog, punto 9).
- Clientes sin cuenta.

## Suposiciones

- El historial muestra todo el detalle de cada orden (decisión del usuario): servicios con valor,
  descuento, total y medios de pago; sin nombres de empleados ni del personal.
- La hora estimada solo se da cuando la orden ya empezó y todos sus servicios tienen tiempo
  estimado (decisión del usuario); en cola se dice cuántas van antes, sin hora.
- El cliente cambia o cancela mientras la reserva está pendiente (decisión del usuario: «mientras no
  esté en proceso»). Cuando llega y se le abre la orden, la reserva queda atendida y ya no la toca.
- La tolerancia de una reserva del cliente es la general; solo el administrador le pone una propia.
- Si el cliente no tiene vehículos registrados, puede reservar «Sin vehículo» o registrarlo antes en
  «Mis vehículos» (spec 005).
- Al cancelar, el motivo es opcional (decisión del usuario); el personal ve que la canceló el
  cliente y el motivo si lo escribió.

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
| 2026-11-21 | Creación. Decisiones del usuario: P1 estado del vehículo e historial, P2 reservas; estado con hora estimada (solo en proceso); historial con todo el detalle; cambiar o cancelar mientras la reserva esté pendiente; una reserva pendiente por vehículo (y una «Sin vehículo») desde la app. |
| 2026-11-21 | Ajustes del usuario: lo que el personal cambie de una reserva del cliente (más tiempo para llegar, cambio, cancelación, llegada) lo ve el cliente en tiempo real (CA-22); el motivo al cancelar es opcional (CA-19). Aprobada. |
| 2026-11-21 | Al planificar: se anota que cambia la spec 004 (CA-08 y CA-12): el cliente entra a su inicio y tiene cuatro secciones. |
| 2026-11-21 | Plan aprobado (refresco cada 15 s en las pantallas del cliente): estado `planificada`. |
| 2026-11-21 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-21 | Implementada. Al implementar: los servicios para reservar salen de una función sin precios (la spec 007 mantiene el catálogo cerrado a los clientes), y con varios vehículos el cliente debe elegir uno o «Sin vehículo». |
| 2026-11-21 | Añadido a petición del usuario: CA-23, una reserva pendiente cuya hora para conservar el turno ya pasó lo dice, en vez de «Puedes llegar hasta…». Estado `en-progreso`. |
| 2026-11-21 | CA-23 implementado (`ArriveBy`, en el inicio y en «Mis reservas»). Estado `implementada`. |
| 2026-11-21 | Verificada: los 23 criterios con prueba vista fallar (pgTAP, unitarias, sandbox y E2E contra producción). Cierres de la verificación: el mensaje del límite nombra también «sin vehículo» (CA-15) y una comprobación pgTAP de que la reserva del cliente ocupa su puesto (CA-16). Estado `verificada`. |
| 2026-11-25 | Enmienda de la spec 021: una reserva pendiente por vehículo y día (antes, una por vehículo), y el tiempo estimado de los servicios al reservar (RN-03, CA-15). |
