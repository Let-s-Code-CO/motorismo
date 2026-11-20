---
id: "008"
titulo: "Orden de trabajo"
estado: implementada
creada: 2026-11-20
actualizada: 2026-11-20
---

# 008 — Orden de trabajo

## Contexto y problema

Hoy el trabajo hecho a cada vehículo en el lavadero se anota a mano o no se anota. El negocio no
sabe:
- qué vehículos tiene en el lavadero y cuándo estará listo cada uno;
- cuántas veces ha venido un cliente ni qué se le hizo la última vez;
- quién hizo cada servicio, que es lo que necesita para liquidar a los empleados;
- cómo se pagó cada trabajo, que es lo que necesita para cuadrar la caja.

La **orden de trabajo** registra lo que se hace a un vehículo en una visita:
- los servicios, con su valor y su tiempo estimado;
- los empleados que hicieron cada uno, con cuánto participó cada uno;
- cómo se pagó.

Se **abre** al recibir el vehículo y se **cierra** al entregarlo y cobrarlo. Usa lo que ya existe:
clientes (spec 004), vehículos (spec 005), servicios y empleados (spec 007).

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador | Abrir órdenes en el punto de atención, añadir servicios y empleados, ver qué hay en el lavadero y cuándo estará listo, cerrar y cobrar. |
| Administrador | Todo lo anterior; corregir o anular una orden ya cerrada, con motivo; configurar el tiempo estimado de cada servicio. |
| Cliente | Nada en esta spec (ver sus órdenes queda fuera de alcance). |

## Historias de usuario

### HU-01 (P1) — Abrir una orden con sus servicios y empleados

Como operador, quiero abrir una orden para el vehículo que recibo, con los servicios que se le
harán y quién los hace, para que quede registrado desde que entra al lavadero.

**Criterios de aceptación**

- **CA-01** — Dado un miembro del personal en «Nueva orden», cuando busca al cliente por nombre,
  celular o placa y lo elige, entonces ve sus vehículos activos para elegir uno; si tiene uno
  solo, ya viene elegido (RN-10).
- **CA-02** — Dado un cliente sin el vehículo que trae, cuando el personal lo registra desde la
  misma orden (con las reglas de la spec 005), entonces queda elegido para la orden, sin salir de
  ella.
- **CA-03** — Dado un vehículo elegido, cuando el personal añade un servicio, entonces solo se le
  ofrecen los servicios activos con valor para ese tipo de vehículo, y la línea toma ese valor de
  referencia, que se puede cambiar (descuento o recargo).
- **CA-04** — Dada una orden, cuando el personal añade varios servicios (p. ej. «Lavado detallado»
  y «PPF», o en una moto «Lavado detallado» y «Mantenimiento de cadena»), entonces cada uno es una
  línea con su valor, y la orden muestra **en todo momento** el subtotal (suma de las líneas), el
  descuento y el total, que se actualizan al añadir, quitar o cambiar una línea, antes de guardar.
- **CA-05** — Dada una orden, cuando el personal añade un servicio «Otro», entonces escribe una
  descripción y un valor libres.
- **CA-06** — Dada una línea, cuando el personal le asigna uno o más empleados activos, entonces la
  participación se reparte en partes iguales (2 → 50 % y 50 %; 3 → 34 %, 33 % y 33 %) y se puede
  cambiar (p. ej. 80 % y 20 %); la línea no se acepta si la suma no es 100 %. Si hay un solo
  empleado activo, cada línea nueva ya lo trae asignado al 100 % (RN-10).
- **CA-07** — Dada una orden con al menos un servicio, cuando el personal la guarda, entonces queda
  **abierta**, con su número, la fecha y hora de recepción y quién la abrió, y se anuncia el
  resultado.
- **CA-08** — Dada una orden abierta, cuando el personal añade, cambia o quita servicios, valores,
  empleados o porcentajes, entonces se guardan los cambios con las mismas reglas.
- **CA-09** — Dado un valor, cuando no es un número entero de pesos entre $ 0 y $ 10.000.000, o una
  descripción de «Otro» está vacía, entonces se indica junto al campo y no se guarda nada.
- **CA-25** — Dada una orden, cuando el personal escribe un descuento (un valor fijo en pesos),
  entonces el total pasa a ser el subtotal menos el descuento; el descuento no puede ser negativo
  ni mayor que el subtotal (se indica junto al campo).
- **CA-10** — Dado un cliente desactivado o un vehículo retirado, cuando el personal intenta abrirle
  una orden, entonces no puede (no se ofrece y se rechaza por cualquier vía).

### HU-02 (P1) — Cerrar y cobrar

Como operador, quiero cerrar la orden al entregar el vehículo, registrando cómo pagó el cliente,
para que el trabajo quede terminado y cobrado.

**Criterios de aceptación**

- **CA-11** — Dada una orden abierta, cuando el personal la cierra, entonces registra uno o más
  pagos (medio y monto: efectivo, transferencia, tarjeta u otro) cuya suma es exactamente el
  total (ya con el descuento); la orden queda **cerrada** con la fecha y hora de entrega y quién la
  cerró. El primer pago se propone por el total, para que el caso común sea un solo clic.
- **CA-12** — Dada una orden, cuando la suma de los pagos no es igual al total, alguna línea no tiene
  empleados o sus porcentajes no suman 100 %, entonces no se puede cerrar, y se dice qué falta.
- **CA-13** — Dada una orden de total $ 0 (p. ej. una cortesía, o un descuento del 100 %), cuando
  se cierra, entonces no necesita pagos.
- **CA-14** — Dada una orden cerrada, cuando un operador intenta cambiarla por cualquier vía,
  entonces no puede.

### HU-03 (P2) — Historial del cliente al atenderlo

Como operador, quiero ver al encontrar al cliente cuántas veces ha venido y qué se le hizo las dos
últimas veces, para atenderlo mejor.

**Criterios de aceptación**

- **CA-15** — Dado un cliente elegido en «Nueva orden», cuando se muestra, entonces se ve su total
  de visitas (órdenes cerradas, sin contar las anuladas) y sus dos últimas: fecha, vehículo,
  servicios y total.
- **CA-16** — Dada la ficha de un cliente (spec 004), cuando el personal la abre, entonces ve sus
  órdenes, de la más reciente a la más antigua, con número, fecha, vehículo, servicios, total y
  estado: las 10 más recientes y, si hay más, «Ver más» trae las 10 siguientes (un cliente fiel no
  alarga la ficha sin fin). *(Enmienda 2026-11-20.)*
- **CA-17** — Dado un cliente sin órdenes, cuando se muestra su historial, entonces se dice que es
  su primera visita.

### HU-04 (P2) — «Órdenes»: la cola, lo que está en proceso y lo entregado

Como miembro del personal, quiero ver qué vehículos esperan turno, cuáles se están trabajando y
cuándo estará listo cada uno, y lo ya entregado, para organizar el lavadero y retomar cualquiera.

**Criterios de aceptación**

- **CA-18** — Dado un miembro del personal, cuando abre «Órdenes», entonces ve tres secciones, cada
  una con su color:
  - **«En proceso»**: las órdenes empezadas, con la hora estimada de entrega (HU-06);
  - **«En cola»**: las abiertas sin empezar, por orden de llegada (la más antigua primero), con su
    turno (1.º, 2.º…), hace cuánto llegaron y su tiempo estimado (sin hora de entrega: aún no se
    sabe cuándo empezará);
  - **«Cerradas»** (CA-19).

  Cada orden muestra número, cliente, placa (o tipo de vehículo), servicios y total.
  *(Enmienda 2026-11-20: antes, una sola sección «En el lavadero».)*
- **CA-19** — Dado el mismo listado, cuando mira las **cerradas**, entonces las ve de la más reciente
  a la más antigua, por páginas («Página 2 de 14»), con su fecha de entrega y su total; las
  anuladas aparecen marcadas.
- **CA-20** — Dada una orden de la lista, cuando el personal la abre, entonces ve su detalle completo
  (servicios, empleados y participación, subtotal, descuento, total, tiempo estimado, pagos, quién
  la abrió, la empezó y la cerró y cuándo) y, si está abierta, puede editarla, empezarla (si está en
  cola) o cerrarla.

### HU-05 (P3) — Corregir o anular con motivo

Como administrador, quiero corregir o anular una orden con un motivo, para arreglar errores sin
perder el rastro de lo que pasó.

**Criterios de aceptación**

- **CA-21** — Dada una orden abierta, cuando un miembro del personal la anula con un motivo (p. ej.
  «el cliente se fue sin el servicio»), entonces queda **anulada**, con quién, cuándo y por qué.
- **CA-22** — Dada una orden cerrada, cuando el administrador la corrige (servicios, valores,
  descuento, empleados, porcentajes o pagos) indicando un motivo, entonces se guardan los cambios con las
  mismas reglas de cierre, y la orden muestra que fue corregida, por quién, cuándo y por qué.
- **CA-23** — Dada una orden cerrada, cuando el administrador la anula con un motivo, entonces queda
  anulada, con quién, cuándo y por qué; sigue visible, marcada, y deja de contar en el historial y
  los totales.
- **CA-24** — Dada una orden, cuando cualquiera intenta borrarla por cualquier vía, entonces el
  sistema lo impide: solo se anula.

### HU-06 (P2) — Tiempo estimado

Como administrador, quiero indicar cuánto suele tardar cada servicio, para que al abrir una orden
se sepa cuándo estará listo el vehículo y se le pueda decir al cliente.

**Criterios de aceptación**

- **CA-26** — Dado un administrador en el formulario de un servicio (spec 007), cuando indica un
  tiempo estimado en minutos (opcional, de 5 a 1.440), entonces se guarda con el servicio y se ve
  en «Servicios» («45 min», «2 h 30 min»).
- **CA-27** — Dada una orden, cuando se añade un servicio con tiempo estimado, entonces la línea
  trae ese tiempo, que se puede cambiar solo para esta orden (sin tocar el del servicio), igual que
  el valor (RN-01).
- **CA-28** — Dada una línea «Otro» o de un servicio sin tiempo estimado, cuando se añade, entonces
  su tiempo queda vacío («Sin estimar») y el personal puede escribirlo en la orden.
- **CA-29** — Dada una orden con todas sus líneas estimadas, cuando se muestra, entonces se ve el
  tiempo total (la suma de las líneas) y la hora aproximada de entrega (la de recepción más ese
  tiempo): «≈ 2 h 15 min · lista hacia las 4:15 p. m.». Se actualizan al añadir, quitar o cambiar
  una línea.
- **CA-30** — Dada una orden con alguna línea sin estimar, cuando se muestra, entonces se ve la suma
  de las que sí tienen tiempo como un mínimo, con un aviso de cuáles faltan: «≈ 1 h 30 min · falta
  estimar: Otro»; la hora de entrega se muestra como «desde las 3:30 p. m.», nunca como una hora
  exacta. Sin ninguna línea estimada, se dice «Sin tiempo estimado».
- **CA-31** — Dado un tiempo estimado de un servicio, cuando el administrador lo cambia en el
  catálogo, entonces las órdenes ya abiertas conservan el de sus líneas.

### HU-07 (P2) — En cola y en proceso *(enmienda 2026-11-20)*

Como operador, quiero distinguir los vehículos que esperan turno de los que ya se están
trabajando, para saber qué sigue y dar una hora de entrega que cuente desde que empezamos.

**Criterios de aceptación**

- **CA-32** — Dada una orden recién abierta, cuando se guarda, entonces queda **«En cola»**, con su
  hora de llegada.
- **CA-33** — Dada una orden en cola, cuando un miembro del personal pulsa **«Empezar»** (en la lista
  o en su detalle), entonces pasa a **«En proceso»**, con la hora de inicio y quién la empezó, y se
  anuncia el resultado.
- **CA-34** — Dada una orden en proceso, cuando se muestra su estimado, entonces la hora de entrega
  cuenta desde que empezó (no desde que llegó): una moto que esperó 40 minutos en cola corre su
  hora esos 40 minutos.
- **CA-35** — Dada una orden en cola, cuando el personal la cierra o la anula sin haberla empezado
  (p. ej. se olvidó «Empezar»), entonces puede: empezar no es obligatorio para cerrar.
- **CA-36** — Dada una orden en proceso, cuando cualquiera intenta devolverla a la cola o empezarla
  otra vez, por cualquier vía, entonces el sistema lo impide.

## Requisitos funcionales

- **RF-01** — Una orden pertenece a un cliente y a uno de sus vehículos, y tiene un número
  consecutivo único.
- **RF-02** — Una orden tiene una o más líneas de servicio. Cada línea es un servicio del catálogo,
  o «Otro» con descripción libre, y tiene un valor y uno o más empleados con su participación.
- **RF-03** — Estados: abierta (en cola → en proceso) → cerrada, y abierta o cerrada → anulada. Se
  registra quién y cuándo
  hizo cada cambio de estado.
- **RF-04** — Al cerrar, se registran uno o más pagos (medio y monto) cuya suma es el total.
- **RF-05** — Historial por cliente: total de visitas y últimas órdenes.
- **RF-06** — Una orden tiene un descuento opcional (valor fijo). Subtotal = suma de las líneas;
  total = subtotal − descuento.
- **RF-07** — Cada servicio del catálogo tiene un tiempo estimado opcional. Cada línea de la orden
  lo copia y se puede editar en la orden; la orden suma el de sus líneas y calcula la hora
  aproximada de entrega.

## Reglas de negocio

- **RN-01** — El valor de una línea se copia del valor de referencia del servicio para ese tipo de
  vehículo al añadirla, y se guarda en la orden. Cambiar después el catálogo no altera ninguna
  orden (spec 007, RN-08). La línea también guarda el nombre del servicio y su tiempo estimado tal
  como eran.
- **RN-02** — Valores en pesos colombianos enteros, de $ 0 a $ 10.000.000 por línea. El subtotal es
  la suma de las líneas; el descuento es un valor fijo de $ 0 hasta el subtotal; el total es el
  subtotal menos el descuento. Cómo afecta el descuento a la liquidación se decide en esa spec.
- **RN-03** — La participación de los empleados de una línea son porcentajes enteros que suman 100.
  Por defecto se reparte en partes iguales, y el sobrante del redondeo va al primero
  (34/33/33).
- **RN-04** — Solo se ofrecen servicios y empleados activos. Una orden ya registrada sigue
  mostrando los que se desactivaron después.
- **RN-05** — Abierta, la edita el personal (operador o administrador). Cerrada, solo el
  administrador la corrige o la anula, siempre con motivo. Anulada, nadie la cambia. Las reglas
  valen por cualquier vía.
- **RN-06** — Las órdenes nunca se borran: se anulan, y siguen visibles y marcadas.
- **RN-12** — Una orden abierta está en cola hasta que se empieza. Empezar se hace una sola vez y
  no se deshace; no es obligatorio para cerrar (CA-35). El estimado cuenta desde el inicio si lo hay,
  y una orden en cola solo muestra su duración (CA-18, CA-34).
- **RN-07** — Una «visita» es una orden cerrada y no anulada.
- **RN-08** — No se abre una orden para un cliente desactivado ni para un vehículo retirado.
- **RN-09** — Los pagos de una orden suman exactamente su total. Los medios son efectivo,
  transferencia, tarjeta u otro.
- **RN-10** — Regla general de la interfaz: un selector con una sola opción posible la trae ya
  elegida (el único vehículo activo del cliente, el único empleado activo…), sin obligar a
  desplegarlo. Se puede cambiar si luego hay más opciones.
- **RN-11** — El tiempo estimado, en el servicio y en cada línea, es opcional y va de 5 a 1.440
  minutos (24 h). El de la orden es la suma de sus líneas (los servicios se hacen uno tras otro).
  Mientras falte alguna línea por estimar, el total es un mínimo y así se presenta (CA-30).

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Orden | número, cliente, vehículo, estado, descuento, recibida (fecha, quién), empezada (fecha, quién), cerrada (fecha, quién), anulada (fecha, quién, motivo), corregida (fecha, quién, motivo), observaciones | Subtotal, total y tiempo estimado se calculan de las líneas. |
| Línea de servicio | orden, servicio (o «Otro»), nombre del servicio, valor, tiempo estimado (opcional) | Copia nombre, valor y tiempo al añadirse (RN-01); valor y tiempo se pueden editar en la orden. |
| Servicio (spec 007) | + tiempo estimado (minutos, opcional) | Cambio al catálogo de la spec 007 (HU-06). |
| Participación | línea, empleado, porcentaje | Por línea, suma 100. |
| Pago | orden, medio, monto | Suma = total al cerrar. |

## Requisitos no funcionales

- Accesibilidad WCAG 2.1 AA (auditoría automática), también con errores visibles.
- Rápido de usar en el punto de atención: abrir una orden típica (cliente conocido, un vehículo,
  dos servicios) en pocos pasos, sin desplazamiento lateral en 360 px; las opciones únicas ya
  vienen elegidas (RN-10).
- Sin conexión no se opera (spec 006).

## Fuera de alcance

- Agendamiento o reservas (guardar un puesto para una fecha y hora, con o sin servicios): spec 009.
  Al llegar el cliente, la reserva se convertirá en una orden que entra a la cola.
- Devolver a la cola una orden empezada, o reordenar la cola a mano.

- Que el cliente vea sus órdenes en «Mi perfil».
- Avisar al cliente (WhatsApp, «tu moto está lista»).
- Reportes con filtros por fecha, empleado y placa, y exportar (specs de administración).
- Calcular la liquidación de los empleados: esta spec solo guarda la participación.
- Facturación electrónica, impuestos, propinas, inventario de insumos, fotos del vehículo.
- Estados intermedios («lista para entregar») y avisos cuando se pasa la hora estimada.
- Tiempos estimados distintos por tipo de vehículo (uno solo por servicio).

## Suposiciones

- El número de orden es consecutivo y único en todo el negocio (Orden #1, #2…).
- Una orden puede llevar observaciones libres (p. ej. «trae un rayón en el tanque»), opcionales.
- El descuento es de la orden, no de cada línea; aun así, el valor de cada línea se puede ajustar
  (CA-03).
- Una línea de valor $ 0 es válida (cortesía); una orden de total $ 0 se cierra sin pagos (CA-13).
- Varios vehículos de un mismo cliente que llegan juntos son órdenes distintas.
- Un vehículo puede tener una sola orden abierta a la vez; si ya tiene una, se ofrece abrir esa.
- «Órdenes» es una opción del menú del personal, con su tarjeta en la página de inicio.
- RN-10 se aplica también a los selectores que ya existen (p. ej. el formulario de vehículo) cuando
  se toquen; se deja escrita como estándar en la guía del proyecto.

## Preguntas abiertas

Ninguna. Resueltas con el usuario el 2026-11-20:
- Toda orden es de un vehículo registrado, que se puede registrar desde la misma orden.
- Estados abierta y cerrada, más anulada.
- Varios servicios por orden, cada uno con sus empleados y su participación en partes iguales,
  editable (p. ej. 80/20).
- Una orden cerrada solo la corrige o la anula el administrador, con motivo.
- Pagos con uno o varios medios por orden.
- El negocio es un lavadero: «En el lavadero» para las órdenes abiertas.
- Total visible y actualizado mientras se arma la orden; descuento de valor fijo por orden.
- Tiempo estimado por servicio (configurado en el catálogo, opcional) y estimado de la orden; cada
  línea puede ajustar o completar su tiempo en la orden, y con líneas sin estimar el total se
  presenta como un mínimo, diciendo cuáles faltan.
- Un selector con una sola opción la trae elegida.

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
| 2026-11-20 | Creación. |
| 2026-11-20 | Correcciones del usuario: lavadero (no taller); total visible al armar la orden; descuento de valor fijo; tiempo estimado por servicio y de la orden (HU-06, toca el catálogo de la spec 007); un selector con una sola opción viene elegido (RN-10). |
| 2026-11-20 | Tiempo estimado: opcional en el servicio; editable por línea en la orden; con líneas sin estimar, el total se muestra como mínimo («desde las …») diciendo cuáles faltan (CA-27 a CA-31). |
| 2026-11-20 | Aprobada por el usuario. |
| 2026-11-20 | Plan aprobado: estado `planificada`. |
| 2026-11-20 | Tareas aprobadas: estado `lista`. |
| 2026-11-20 | Implementada (bloques A, B y C). Ajustes visuales pedidos durante la implementación: resumen fijo solo en el móvil; colores de estado en «Órdenes». |
| 2026-11-20 | Enmienda aprobada por el usuario: «En cola» y «En proceso» con «Empezar» (HU-07, CA-32 a CA-36, RN-12); «Órdenes» en tres secciones (CA-18); ficha del cliente con las 10 más recientes y «Ver más» (CA-16); páginas con total (CA-19). Agendamiento, a la spec 009. |
| 2026-11-20 | Enmienda implementada: «En cola» / «En proceso» con «Empezar», tres secciones en «Órdenes», ficha con «Ver más», páginas con total. Revisado en teléfono (iPhone 440 px y 360 px). |
