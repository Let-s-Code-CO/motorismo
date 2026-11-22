---
id: "012"
titulo: "Agendamiento de reservas"
estado: verificada
creada: 2026-11-21
actualizada: 2026-11-21
---

# 012 — Agendamiento de reservas

## Contexto y problema

Hoy los clientes piden turno por teléfono, WhatsApp o Instagram, y la reserva se anota donde se
pueda o se recuerda de memoria. Eso trae tres problemas:
- se prometen más vehículos a la misma hora de los que el lavadero puede atender;
- cuando el cliente llega, nadie sabe si tenía reserva, y se le vuelven a pedir sus datos;
- quien reservó espera igual que quien llegó sin avisar, así que reservar no sirve de nada.

Esta spec deja que el personal **reserve un puesto** para un cliente en una franja del horario de
atención, con o sin servicios. La agenda nunca da más reservas que puestos. Cuando el cliente llega,
la reserva se convierte en una **orden en cola** (spec 008), y su turno respeta la hora que
reservó.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador | Reservar, cambiar y cancelar reservas; ver la agenda del día; registrar la llegada del cliente (la reserva pasa a ser su orden) o que no asistió. |
| Administrador | Todo lo anterior; dar a una reserva su propia tolerancia de llegada; habilitar cada semana con el horario de cada día (cerrar un día o cambiar su horario), y configurar la duración de las franjas, los puestos y la tolerancia de llegada. |
| Cliente | Nada en esta spec: reservar desde la app queda fuera de alcance. |

## Historias de usuario

### HU-01 (P1) — Reservar un puesto

Como operador, quiero reservar un puesto para un cliente en una fecha y franja, para prometerle
solo lo que el lavadero puede atender.

**Criterios de aceptación**

- **CA-01** — Dado un miembro del personal en «Nueva reserva», cuando busca al cliente por nombre,
  celular o placa y lo elige, entonces puede elegir uno de sus vehículos activos (si tiene uno
  solo, ya viene elegido, RN-10 de la spec 008) o dejar el vehículo sin elegir.
- **CA-02** — Dado un cliente que aún no está registrado, cuando el personal lo registra desde la
  misma reserva (con las reglas de la spec 004 para un cliente sin cuenta), entonces queda elegido
  para la reserva, sin salir de ella.
- **CA-03** — Dada una fecha, cuando el personal la elige, entonces ve sus franjas dentro del
  horario de atención (p. ej. «8:00 a. m. – 9:00 a. m.»), cada una con sus puestos libres («1 de 2
  libres»). Las franjas llenas y la que está en curso («En curso») se muestran, pero no se pueden
  elegir; las que ya terminaron no se ofrecen, y si no queda ninguna lo dice. Un día
  cerrado dice «Cerrado», y un día de una semana que el administrador aún no ha habilitado dice
  «Semana sin habilitar»; en ninguno de los dos se puede reservar.
- **CA-04** — Dada una reserva, cuando el personal añade servicios, entonces solo se le ofrecen los
  servicios activos (para el tipo del vehículo, si lo eligió); los servicios son opcionales.
- **CA-05** — Dada una reserva con cliente y franja, cuando el personal la guarda, entonces queda
  **pendiente**, con quién y cuándo la creó, su franja ocupa un puesto, y se anuncia el resultado.
- **CA-06** — Dada una franja con un solo puesto libre, cuando dos personas del personal la
  reservan a la vez, entonces solo una reserva se guarda, y a la otra persona se le dice que la
  franja se llenó y se le muestran las franjas actualizadas (RN-02, por cualquier vía).
- **CA-07** — Dado un cliente desactivado o un vehículo retirado, cuando el personal intenta
  reservarle, entonces no puede (no se ofrece y se rechaza por cualquier vía).
- **CA-08** — Dado un vehículo con una reserva pendiente en una franja, cuando se intenta otra
  reserva para él en la misma franja, entonces se rechaza y se dice que ya la tiene.

### HU-02 (P1) — La agenda del día

Como miembro del personal, quiero ver las reservas de cada día por franja, para preparar el
lavadero y saber a quién esperamos.

**Criterios de aceptación**

- **CA-09** — Dado un miembro del personal, cuando abre «Agenda», entonces ve el día de hoy con
  sus franjas en orden. Cada franja dice cuántos puestos le quedan libres y lista sus reservas con
  cliente, celular, vehículo (placa o tipo, si lo tiene), servicios y estado. La franja en curso
  dice «En curso» y las que ya terminaron, «Ya pasó»; una franja que terminó sin ninguna reserva no
  se muestra, y una línea dice cuántas se ocultaron («Se ocultan 7 franjas que ya pasaron sin
  reservas»).
- **CA-10** — Dada la agenda, cuando el personal va al día siguiente, al anterior o a una fecha
  elegida, entonces ve la agenda de ese día; la fecha mostrada sobrevive a recargar la página.
- **CA-11** — Dada una reserva de la agenda, cuando el personal la abre, entonces ve su detalle:
  cliente, vehículo, servicios, franja, tolerancia de llegada (la general o la suya, RN-11),
  observaciones, estado y quién la creó, cambió, canceló o atendió, y cuándo.

### HU-03 (P1) — El cliente llega: su reserva pasa a la cola con prioridad

Como operador, quiero convertir la reserva en la orden del cliente cuando llega, para no volver a
pedirle los datos y para que pase delante de quien llegó sin reservar.

**Criterios de aceptación**

- **CA-12** — Dada una reserva pendiente de hoy, cuando el personal pulsa «Llegó», entonces se abre
  una orden nueva con el cliente, el vehículo y los servicios de la reserva ya puestos. Los valores
  y tiempos estimados se toman del catálogo en ese momento (RN-01 de la spec 008). Si la reserva no
  tenía vehículo, se elige o se registra en la misma orden.
- **CA-13** — Dada esa orden, cuando el personal la guarda, entonces entra **«En cola»** (spec 008)
  y la reserva queda **atendida**, enlazada a su orden. Si el personal sale sin guardar, la reserva
  sigue pendiente.
- **CA-14** — Dada la cola, cuando se muestra, entonces está ordenada por **hora de turno** (RN-04):
  sin reserva, la hora de llegada; con reserva, la hora reservada. Las órdenes con reserva se marcan
  («Reserva 9:00 a. m.»).
- **CA-15** — Dado este caso: a las 8:00 a. m. llega un cliente sin reserva (orden 1). Otro tiene
  reserva a las 9:00 a. m. A las 9:00 a. m. llegan a la vez el de la reserva y uno sin reserva, y
  la orden del que llegó sin reserva se guarda primero. Cuando se muestra la cola, entonces el
  orden es: la orden 1 (1.º), la de la reserva (2.º) y la del que llegó sin reserva (3.º). Ante la
  misma hora de turno, va primero la reserva.
- **CA-16** — Dado un cliente con reserva a las 9:00 a. m. y una tolerancia de 15 minutos, cuando
  llega a las 9:10 a. m., entonces conserva su hora de turno de las 9:00 a. m. Si llega a las
  9:40 a. m., pasada la tolerancia, toma su hora de llegada como cualquiera: queda detrás de los que
  llegaron sin reserva a las 9:10 y 9:20.
- **CA-17** — Dado un cliente con reserva a las 9:00 a. m., cuando llega antes, a las 8:45 a. m.,
  entonces su hora de turno es la de llegada (8:45 a. m.): llegar temprano nunca le quita el
  puesto que tendría.
- **CA-18** — Dada una reserva de hoy cuya hora ya llegó pero cuyo cliente aún no llega (dentro de
  la tolerancia), cuando se muestra la cola, entonces aparece en su lugar como «Reserva por llegar»,
  sin número de turno. Así el personal puede decirle a quien llega sin reserva que hay alguien
  antes. Pasada su tolerancia, deja de aparecer en la cola.
- **CA-19** — Dada una reserva que no es de hoy, o que no está pendiente, cuando el personal la
  ve, entonces no se ofrece «Llegó» (y se rechaza por cualquier vía).

### HU-04 (P2) — Cambiar, cancelar o marcar que no asistió

Como operador, quiero mover o cancelar una reserva, o dejar constancia de que el cliente no llegó,
para liberar el puesto y que la agenda diga la verdad.

**Criterios de aceptación**

- **CA-20** — Dada una reserva pendiente, cuando el personal cambia su franja, vehículo, servicios u
  observaciones, entonces se guardan con las mismas reglas de HU-01. Si cambia la franja, la nueva
  necesita un puesto libre, y la anterior lo recupera.
- **CA-21** — Dada una reserva pendiente, cuando el personal la cancela (con un motivo opcional),
  entonces queda **cancelada**, con quién y cuándo; libera su puesto y sigue visible en la agenda,
  marcada.
- **CA-22** — Dada una reserva pendiente cuya hora más su tolerancia ya pasó, cuando el personal
  marca «No asistió», entonces queda **no asistió**, con quién y cuándo, y sigue visible, marcada.
  Antes de ese momento no se ofrece (y se rechaza por cualquier vía).
- **CA-23** — Dada una reserva atendida, cancelada o que no asistió, cuando cualquiera intenta
  cambiarla, convertirla o borrarla, por cualquier vía, entonces el sistema lo impide (RN-05).
- **CA-24** — Dada una reserva pendiente, cuando el administrador le pone su propia tolerancia (de 0
  a 60 minutos; p. ej. 30 para un cliente que viene de lejos), entonces su hora de turno al llegar
  (CA-16), su «Reserva por llegar» (CA-18) y cuándo se puede marcar «No asistió» (CA-22) usan esa
  tolerancia; las demás reservas siguen la general. Puede volver a la general cuando quiera.
- **CA-25** — Dado un operador, cuando ve una reserva, entonces ve su tolerancia, pero no puede
  fijarla en un valor cualquiera por ninguna vía; solo puede sumarle 5 minutos mientras el cliente
  está por llegar (CA-34). *(Enmienda 2026-11-21.)*

### HU-05 (P1) — Habilitar la semana y configurar la agenda

Como administrador, quiero habilitar cada semana con el horario de cada día y configurar cuántos
vehículos caben a la vez, para que la agenda refleje cuándo abre de verdad el lavadero y su
capacidad.

**Criterios de aceptación**

- **CA-26** — Dado un administrador en «Agenda» → «Horario», cuando elige una semana sin habilitar
  (de lunes a domingo, p. ej. del 23 al 29 de noviembre), entonces se le proponen los siete días
  abiertos de 9:00 a. m. a 6:00 p. m. Al habilitarla, el personal ya puede reservar en sus franjas.
- **CA-27** — Dada una semana, antes o después de habilitarla, cuando el administrador cierra un día
  (p. ej. el domingo 29) o le cambia el horario (p. ej. el sábado 28 de 9:00 a. m. a 1:00 p. m.),
  entonces ese día sigue el cambio y los demás no.
- **CA-28** — Dada una semana habilitada, cuando el administrador la deshabilita, entonces no se
  pueden hacer reservas nuevas en ella; las que ya tenía siguen como estaban (CA-31).
- **CA-29** — Dada la configuración, cuando el administrador cambia la duración de las franjas (de
  15 en 15 minutos, entre 15 y 240; 60 por defecto), los puestos por franja (de 1 a 20) o la
  tolerancia de llegada (de 0 a 60 minutos; 15 por defecto), entonces se guarda y se usa desde ese
  momento. Un valor fuera de rango se indica junto al campo y no se guarda nada.
- **CA-30** — Dado el horario de un día cuyo cierre no es posterior a su apertura, o en el que no
  cabe una franja completa, cuando el administrador lo guarda, entonces se indica junto al día y no
  se guarda nada.
- **CA-31** — Dadas reservas pendientes ya hechas, cuando el administrador cierra su día, le cambia
  el horario, deshabilita su semana o cambia la configuración, entonces conservan su fecha y hora.
  Si alguna queda en un día cerrado, fuera del horario o por encima de los puestos, se marca en la
  agenda («Fuera del horario», «Sobrecupo») para que el personal la mueva o la cancele.
- **CA-32** — Dado un operador, cuando intenta habilitar o deshabilitar una semana, cambiar el
  horario de un día o la configuración, por cualquier vía, entonces no puede.

### HU-06 (P2) — Al día sin recargar *(enmienda 2026-11-21)*

Como miembro del personal, quiero que la cola y la agenda se actualicen solas y que se vea cuánto le
queda a quien está por llegar, para no decidir con datos viejos.

**Criterios de aceptación**

- **CA-33** — Dada una «Reserva por llegar» en la cola, cuando se muestra, entonces dice hasta qué hora
  conserva su turno y cuántos minutos le quedan («Conserva su turno hasta las 6:00 p. m. · quedan
  20 min»); la cuenta baja sola cada minuto, se resalta en los últimos 5 minutos y, al llegar a 0, la
  fila desaparece sin recargar.
- **CA-34** — Dada una «Reserva por llegar», cuando un miembro del personal pulsa «+5 min», entonces su
  tolerancia crece 5 minutos (se puede pulsar varias veces), sin pasar de 60; pasada su tolerancia ya
  no se ofrece (y se rechaza por cualquier vía).
- **CA-35** — Dada «Órdenes», «Agenda», el detalle de una reserva o el inicio abiertos, cuando otra
  persona abre, empieza, cierra o anula una orden, o reserva, cambia, cancela o atiende una reserva,
  entonces la pantalla se actualiza sola en pocos segundos, sin recargar y sin perder lo que se está
  escribiendo.
- **CA-36** — Dada la agenda abierta, cuando una franja empieza, entonces deja de ofrecer «Reservar»
  sin recargar.
- **CA-37** — Dada una reserva pendiente cuya tolerancia ya pasó, cuando se muestra en la agenda o en
  su detalle, entonces se señala «Pasó su tolerancia», junto a «No asistió»; nunca se marca sola
  (RN-12).
- **CA-38** — Dada una reserva a la que se le dio más tiempo, cuando se ve su detalle, entonces se
  lista cada «+5 min» con quién lo dio, cuándo y hasta qué hora conservó el turno, con el total
  («Se le dio más tiempo 3 veces: 15 min en total»); la cola («Ya se le dio +15 min (3 veces)») y la
  agenda («+15 min de espera») también lo dicen. Nadie borra ese registro.
- **CA-39** — Dada una reserva abierta desde «Órdenes», cuando se pulsa «Volver», entonces regresa a
  «Órdenes»; abierta desde la agenda, regresa a su día.

### HU-07 (P2) — Agendar desde el cliente *(enmienda 2026-11-21)*

Como miembro del personal, quiero agendar a un cliente desde su ficha, desde uno de sus vehículos
o desde la lista de clientes, para no tener que buscarlo otra vez en «Nueva reserva».

**Criterios de aceptación**

- **CA-40** — Dada la ficha de un cliente activo, cuando el personal pulsa «Agendar», entonces se
  abre «Nueva reserva» con ese cliente ya elegido. Si tiene un solo vehículo activo, viene elegido
  (RN-10); si no, se elige como siempre, o «Sin vehículo».
- **CA-41** — Dado un vehículo activo en la ficha de un cliente activo, cuando el personal pulsa su
  «Agendar», entonces se abre «Nueva reserva» con el cliente y ese vehículo ya elegidos.
- **CA-42** — Dada la lista de «Clientes», cuando el personal abre el menú de la fila de un cliente
  activo, entonces ofrece «Agendar», que hace lo mismo que en su ficha (CA-40).
- **CA-43** — Dado un cliente desactivado, entonces ni su ficha, ni sus vehículos, ni su fila
  ofrecen «Agendar». Si la dirección de «Nueva reserva» trae un cliente desactivado o que no existe,
  o un vehículo que no es suyo o está retirado, el formulario empieza sin ese cliente o sin ese
  vehículo, como si no viniera.

## Requisitos funcionales

- **RF-01** — Una reserva pertenece a un cliente y, opcionalmente, a uno de sus vehículos. Tiene una
  fecha y una franja, servicios opcionales y observaciones opcionales.
- **RF-02** — Estados de una reserva: pendiente → atendida, cancelada o no asistió. Se registra
  quién y cuándo hizo cada cambio.
- **RF-03** — La agenda muestra, por día, las franjas del horario de atención con sus puestos libres
  y sus reservas.
- **RF-04** — Una reserva atendida queda enlazada a la orden que se abrió con ella, y la orden a su
  reserva.
- **RF-05** — La cola de «Órdenes» (spec 008) se ordena por hora de turno (RN-04) y muestra las
  reservas por llegar (CA-18).
- **RF-06** — El administrador habilita la agenda semana por semana (de lunes a domingo); cada día
  de una semana tiene su horario o está cerrado.
- **RF-07** — Hay una sola configuración para el negocio: duración de franja, puestos por franja y
  tolerancia de llegada.

## Reglas de negocio

- **RN-01** — Solo se reserva en una franja que todavía no ha empezado, de un día abierto de una
  semana habilitada. Las franjas se cuentan desde la apertura de ese día con la duración
  configurada, y solo cuentan las completas (si se abre de 9:00 a. m. a 5:30 p. m. con franjas de
  1 hora, la última es de 4:00 p. m. a 5:00 p. m.).
- **RN-02** — Las reservas pendientes y atendidas de una franja nunca superan sus puestos; las
  canceladas y las que no asistieron no ocupan puesto. Se cumple por cualquier vía, también con
  reservas simultáneas. Los clientes que llegan sin reserva no ocupan puestos de la agenda.
- **RN-03** — Un vehículo no tiene dos reservas pendientes en la misma franja. Un cliente sí puede
  tener varias (p. ej. una por vehículo).
- **RN-04** — **Hora de turno** de una orden en cola:
  - sin reserva, su hora de llegada;
  - con reserva, la más temprana entre su llegada y la hora de inicio de su franja, siempre que
    llegue dentro de su tolerancia (CA-16, CA-17);
  - con reserva, pero llegando después de su tolerancia, su hora de llegada.

  La cola va de la hora de turno más temprana a la más tardía. Ante la misma hora, va primero la
  reserva y luego el orden de llegada. La cola sigue sin reordenarse a mano (spec 008).
- **RN-05** — Las reservas nunca se borran. Pendiente, la cambia el personal. Atendida, cancelada o
  no asistió, nadie la cambia. Las reglas valen por cualquier vía.
- **RN-06** — Reservan, cambian, cancelan y registran la llegada el operador y el administrador;
  solo el administrador configura la agenda y da a una reserva su propia tolerancia. Un cliente no ve ni toca la agenda.
- **RN-07** — Los servicios de una reserva son una intención. Al convertirse en orden, cada servicio
  toma el valor y el tiempo estimado del catálogo en ese momento para el tipo del vehículo (RN-01 de
  la spec 008). Si alguno ya no está activo o no tiene valor para ese tipo, no se copia y se avisa.
- **RN-08** — Cambiar la configuración no mueve ninguna reserva ya hecha (CA-31).
- **RN-09** — Las horas se muestran como se leen en Colombia, en 12 horas («9:00 a. m.»), en la hora
  de Colombia.
- **RN-10** — Habilitar una semana propone los siete días de 9:00 a. m. a 6:00 p. m.: el lavadero
  trabaja todos los días, y el administrador cierra o ajusta los que no.
- **RN-11** — La tolerancia de una reserva es la suya, si se la pusieron, o si no la general vigente.
  Va de 0 a 60 minutos y solo se cambia mientras la reserva está pendiente: el administrador la fija
  en cualquier valor; el personal puede sumarle 5 minutos mientras el cliente está por llegar
  (CA-34). *(Enmienda 2026-11-21.)*
- **RN-12** — Una reserva nunca pasa sola a «No asistió»: pasada su tolerancia se señala (CA-37) y
  alguien la marca. *(Enmienda 2026-11-21.)*

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Reserva | cliente, vehículo (opcional), fecha, inicio y fin de la franja, servicios (opcional), tolerancia propia (opcional), observaciones, estado, creada (quién, cuándo), cambiada (quién, cuándo), cancelada (quién, cuándo, motivo opcional), no asistió (quién, cuándo), atendida (quién, cuándo, orden) | La franja se guarda como inicio y fin: un cambio de configuración no la mueve (RN-08). |
| Servicio de la reserva | reserva, servicio | Solo el servicio; valor y tiempo se toman al convertirse en orden (RN-07). |
| Semana de la agenda | lunes de la semana, habilitada (quién, cuándo) | Sin habilitar, no se reserva. |
| Día de la agenda | fecha, abierto o cerrado, apertura, cierre | Siete por semana; por defecto, abierto de 9:00 a. m. a 6:00 p. m. |
| Configuración de agenda | duración de franja, puestos por franja, tolerancia | Una sola para el negocio. |
| Orden (spec 008) | + reserva de origen (opcional), hora de turno | La hora de turno ordena la cola (RN-04). |

## Requisitos no funcionales

- Accesibilidad WCAG 2.1 AA (auditoría automática), también con errores visibles y en oscuro.
- En el teléfono: agenda y reserva sin desplazamiento lateral en 360 px y en iPhone de 440 px, y
  reservar a un cliente conocido en pocos pasos.
- Esqueleto de carga en las pantallas nuevas con datos (spec 011).
- Sin conexión no se opera (spec 006).

## Cambia la spec 008

- **CA-18 de la 008:** la cola «En cola» se ordena por hora de turno (RN-04), no solo por llegada.
  Sin reservas, el orden es el mismo de hoy. Se registrará como enmienda en la spec 008.

## Fuera de alcance

- Que el cliente reserve, vea o cancele sus reservas desde la app (cuando se trabajen las pantallas
  del cliente).
- Avisos y recordatorios al cliente (WhatsApp, correo, notificaciones).
- Abonos o pagos al reservar.
- Reservas recurrentes («todos los sábados»).
- Elegir un empleado o un puesto concreto para la reserva.
- Calcular la capacidad por el tiempo estimado de los servicios: cada reserva ocupa un puesto en su
  franja, dure lo que dure.
- Habilitar varias semanas de una vez o copiar el horario de una semana a otra.
- Lista de espera cuando una franja está llena.

## Suposiciones

- «Agenda» es una opción del menú del personal, con su mosaico en el inicio.
- Configuración por defecto, hasta que el administrador la cambie: franjas de 1 hora, 2 puestos y
  15 minutos de tolerancia. Ninguna semana viene habilitada: el administrador habilita la primera.
- Se pueden habilitar semanas con la anticipación que se quiera; las reservas llegan hasta donde
  haya semanas habilitadas.
- Llegar antes de la hora reservada toma la hora de llegada, que ya es anterior (CA-17).
- El vehículo es opcional al reservar (el cliente puede no saber cuál traerá); se completa al
  llegar.
- Si el cliente con reserva ya tiene una orden abierta con ese vehículo, «Llegó» lleva a esa orden,
  como en la spec 008, y la reserva se enlaza a ella.
- Una reserva pendiente de un día que ya pasó se queda pendiente hasta que alguien la marque «No
  asistió»; no cambia sola.
- La franja que se está atendiendo no se puede reservar: quien llama para venir ya llega sin
  reserva.

## Preguntas abiertas

Ninguna. Resueltas con el usuario el 2026-11-21:
- Por ahora solo reserva el personal; las pantallas del cliente se verán en otra spec.
- Capacidad: puestos fijos por franja, configurables por el administrador.
- El lavadero trabaja todos los días: el administrador habilita cada semana, que se propone de
  9:00 a. m. a 6:00 p. m. todos los días, y cierra o ajusta los días que no (p. ej. el 29 de
  noviembre). Franjas de 1 hora por defecto, que el administrador puede cambiar.
- La reserva tiene prioridad en la cola por su hora reservada; ante la misma hora, va primero la
  reserva (ejemplo de las 8:00 y las 9:00, CA-15).
- Si llega tarde, conserva su turno dentro de una tolerancia configurable (15 minutos por defecto);
  pasada la tolerancia, toma su hora de llegada. El administrador puede dar a una reserva concreta
  su propia tolerancia (CA-24).

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
| 2026-11-21 | Creación. Decisiones del usuario: solo reserva el personal; puestos fijos por franja; horario semanal con franjas de 1 hora configurables; prioridad por hora reservada con tolerancia de llegada. |
| 2026-11-21 | Corrección del usuario: el lavadero trabaja todos los días. El administrador habilita cada semana (propuesta de 9:00 a. m. a 6:00 p. m. todos los días) y cierra o ajusta días concretos; HU-05 pasa a P1 (CA-26, CA-27, CA-28). |
| 2026-11-21 | Petición del usuario: el administrador puede dar a una reserva su propia tolerancia de llegada (CA-24, CA-25, RN-11). |
| 2026-11-21 | Aprobada por el usuario. |
| 2026-11-21 | Plan aprobado: estado `planificada`. |
| 2026-11-21 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-21 | Implementada. Ajustes pedidos por el usuario: «Agenda» como tablero de puestos (un recuadro por puesto, ocupado o libre con «Reservar»; las canceladas y «No asistió» aparte; resumen del día) y ejemplos locales de una orden que llegó con reserva y de una reserva por llegar. |
| 2026-11-21 | Verificada: los 32 criterios con prueba vista fallar (pgTAP, Vitest, sandbox y E2E). Se cerraron tres huecos de la verificación: el campo de fecha de la agenda (CA-10), el rastro completo del detalle (CA-11) y la cancelada visible en la agenda (CA-21, prueba del tablero). En la cola, la etiqueta de reserva distingue si dio el turno (sólida) o si llegó tarde o antes y entra por llegada (con contorno). |
| 2026-11-21 | Enmienda aprobada por el usuario (HU-06): cuenta regresiva y «+5 min» en la «Reserva por llegar» (CA-33, CA-34), pantallas al día en tiempo real (CA-35), franjas que empiezan sin recargar (CA-36) y «Pasó su tolerancia» sin marcarla sola (CA-37, RN-12); CA-25 y RN-11 dejan al operador sumar 5 minutos. Estado `en-progreso`. |
| 2026-11-21 | Peticiones del usuario durante la enmienda: el registro de cada «+5 min» a la vista (CA-38) y «Volver» al sitio de donde se abrió la reserva (CA-39). Los recuadros «Libre» de las franjas empezadas siguen con su diseño. |
| 2026-11-21 | Petición del usuario: las horas pasadas ya no estorban. CA-09: la agenda oculta las franjas que terminaron sin reservas (y dice cuántas), marca «Ya pasó» las que terminaron con reservas y «En curso» la actual; CA-03: el formulario no ofrece franjas terminadas. |
| 2026-11-21 | Enmienda HU-06 verificada (CA-33 a CA-39). Correcciones a raíz de la revisión del usuario: guardar la configuración de la agenda fallaba desde la app (actualización sin condición, rechazada por la API; prueba de sandbox), los avisos de «Horario» salen debajo de su botón y el seed deja los ejemplos de hoy dentro del horario. E2E completa en verde contra el build de producción (165/165). Estado `verificada`. |
| 2026-11-21 | Ajuste pedido por el usuario (CA-35): el refresco en tiempo real solo actúa en las pantallas que muestran órdenes o reservas (inicio, «Órdenes», «Agenda» y sus detalles). En «Clientes», un cambio provocaba 14 peticiones al servidor sin mostrar nada nuevo. |
| 2026-11-21 | Enmienda aprobada por el usuario (HU-07): «Agendar» desde la ficha del cliente, desde cada uno de sus vehículos y desde el menú de su fila en «Clientes» (CA-40 a CA-43); solo desde el vehículo dejaría sin forma de agendar a quien reserva sin vehículo. Estado `en-progreso`. |
| 2026-11-21 | Enmienda HU-07 implementada: «Agendar» en la ficha, en cada vehículo (con la placa en su nombre accesible, para distinguir dos motos iguales) y en el menú de la fila; la dirección de «Nueva reserva» ignora un cliente desactivado o inexistente. Solo el personal, como toda reserva. |
| 2026-11-21 | Enmienda HU-07 verificada (CA-40 a CA-43): cada criterio con prueba de componente y E2E, vistas fallar; los roles no cambian (solo el personal reserva). Estado `verificada`. |
