---
id: "024"
titulo: "Categoría de moto y precios por categoría"
estado: verificada
creada: 2026-11-26
actualizada: 2026-11-26
---

# 024 — Categoría de moto y precios por categoría

## Contexto y problema

Hoy cada servicio tiene un solo valor de referencia para moto (spec 007), pero el negocio cobra
según el tipo de moto: no cuesta lo mismo lavar una R 1200 GS que una Pulsar 200. La lista de
precios del negocio agrupa las motos en ocho categorías y da, para cada lavado y combo, un valor por
categoría; los servicios adicionales tienen un valor único. Sin la categoría, el personal tiene que
recordar el precio y corregir el valor de cada línea a mano, y el cliente no ve un tiempo fiable.

Además, el PPF (película de protección de pintura) se cotiza para cada vehículo: no tiene un valor ni
un tiempo fijos, y se acuerdan al recibir el vehículo o al tomar la reserva.

## Fuentes

Lista de precios del negocio (cuatro imágenes que entregó el usuario el 2026-11-26):

- **Categorías:** Street/Roadster, SBK/SSP, Scooter, Maxi Scooter, Trail, Maxi Trail, Cruiser/Clásica y
  Maxi Cruiser.
- **Lavado Pro Wash:** 44.000, 46.000, 42.000, 46.000, 48.000, 52.000, 44.000 y 48.000 (en ese orden).
- **Paquete de lavado Premium** (Pro Wash + limpieza completa de kit incluida tapa piñón + sellador +
  limpieza de asientos; unas 2 horas): 99.000, 101.000, 97.000, 101.000, 103.000, 107.000, 99.000 y
  103.000.
- **Combo de lavado Deluxe** (Pro Wash + desengrasado y lubricado de cadena + micropulido al 60 % en
  pintura brillante; no aplica a pintura mate; unas 3 h 30 min): 170.000, 182.000, 178.000, 180.000,
  175.000, 182.000, 170.000 y 180.000.
- **Combo de lavado Supreme** (Pro Wash + limpieza completa de kit incluida tapa piñón + limpieza de
  asientos + micropulido al 90 % + recubrimiento cerámico por 3 años; unos 2 días hábiles): 700.000,
  850.000, 750.000, 800.000, 830.000, 900.000, 700.000 y 750.000.
- **Servicios adicionales, valor único:**
  - asientos, 16.000;
  - sellador, 15.000;
  - limpieza de kit: desengrasado de cadena, 7.000; lubricado, 9.000; desengrasado y lubricado de
    cadena, 16.000; limpieza completa de kit incluida tapa piñón, 26.000; limpieza completa incluida
    tapa piñón y cubrecadena, 46.000.
- **PPF:** no figura en la lista: se cotiza por vehículo.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Administrador | Definir la categoría de las motos, los valores de cada servicio por categoría y los servicios «a convenir». |
| Operador | Que al añadir un servicio a una orden de una moto llegue el valor de su categoría; escribir el valor y el tiempo de un servicio «a convenir». |
| Cliente | Ver el tiempo estimado de lo que reserva (spec 021), sin precios. |

## Historias de usuario

### HU-01 (P1) — Cada moto tiene su categoría

Como persona del personal, quiero que cada moto tenga su categoría, para que el valor de los servicios
sea el de su tipo.

**Criterios de aceptación**

- **CA-01** — Dado un administrador en «Marcas y líneas» (spec 018), cuando abre una línea de moto,
  entonces le pone o le cambia su categoría entre las ocho de la lista (una R 1200 GS es Maxi Trail;
  una Pulsar 200, Street/Roadster).
- **CA-02** — Dada una moto de una línea con categoría, cuando se registra, entonces tiene la categoría
  de su línea sin que nadie la elija.
- **CA-03** — Dada una moto, cuando el personal la registra o la corrige, entonces puede darle otra
  categoría solo a esa moto; desde ese momento la moto conserva la suya aunque cambie la de su línea.
  Mientras no tenga una propia, sigue la de su línea: si el administrador cambia la categoría de la
  línea, cambia la de esas motos.
- **CA-04** — Dada una moto, cuando se ve en la ficha del cliente, en la orden o en el buscador del
  personal, entonces se ve su categoría (en la orden: en su tarjeta y al editarla).
- **CA-05** — Dado un cliente, cuando registra, corrige o mira su moto en la app, entonces no ve ni elige
  su categoría (la confirma el personal al recibir la moto).
- **CA-06** — Dada una moto sin categoría (registrada antes de esta spec, o de una línea nueva aún sin
  categoría), cuando el personal le añade un servicio con valores por categoría en una orden, entonces
  la orden le pide antes elegir la categoría de la moto y la guarda en la moto.

### HU-02 (P1) — Valores por categoría

Como administrador, quiero dar a un servicio un valor para cada categoría de moto, o uno igual para
todas, para que la orden traiga el precio correcto.

**Criterios de aceptación**

- **CA-07** — Dado el formulario de un servicio, cuando el administrador indica el valor para moto,
  entonces elige entre un valor único para todas las motos o un valor por cada una de las ocho
  categorías; carro y bicicleta siguen con su valor único (spec 007).
- **CA-08** — Dado un servicio con valor por categoría, cuando le falta el valor de una categoría,
  entonces no se guarda y se dice cuál falta: un servicio con valores por categoría los tiene todos.
- **CA-09** — Dada la lista de «Servicios», cuando un servicio tiene valores por categoría, entonces
  se ven todos, con su categoría, o el rango («$ 42.000 a $ 52.000») donde no caben. *(Precisado
  durante la implementación, a pedido del usuario:* una tarjeta por servicio, en tres grupos
  —«Paquetes por categoría», de menor a mayor valor; «Valor único»; «A convenir»—; cada paquete con
  su rango y sus ocho valores; un tipo de vehículo al que no se ofrece no se nombra.)
- **CA-19** — Dado el formulario de un servicio, cuando el administrador escribe una descripción
  (opcional, hasta 300 caracteres; p. ej. lo que incluye un paquete), entonces se guarda y se ve bajo
  el nombre en «Servicios».
- **CA-10** — Dada una orden de una moto de una categoría, cuando se añade un servicio con valores por
  categoría, entonces la línea trae el valor de esa categoría, que se puede cambiar solo para esta
  orden, como hoy (spec 008, CA-03).
- **CA-11** — Dada una orden de una moto, cuando se cambia la categoría de la moto, entonces las líneas
  ya añadidas conservan su valor (como al cambiar el catálogo, spec 008); los servicios que se añadan
  después traen el de la nueva categoría.

### HU-03 (P1) — Servicios «a convenir» (PPF)

Como persona del personal, quiero un servicio como el PPF, sin valor ni tiempo fijos, para escribirlos
al recibir el vehículo o al tomar la reserva.

**Criterios de aceptación**

- **CA-12** — Dado el formulario de un servicio, cuando el administrador lo marca «a convenir»,
  entonces no lleva valores ni tiempo estimado, y se ofrece para moto, carro y bicicleta.
- **CA-13** — Dada una orden, cuando se añade un servicio «a convenir», entonces la línea llega sin
  valor ni tiempo y no se puede guardar la orden hasta escribir su valor; el tiempo se puede escribir
  o dejar «Sin estimar».
- **CA-14** — Dada una reserva que el personal toma con un servicio «a convenir», cuando la registra,
  entonces escribe su tiempo estimado para esa reserva. El formulario y el detalle de la reserva del
  personal muestran el tiempo estimado total de sus servicios (como el del cliente, spec 021), con el
  de los servicios «a convenir» sumado.
- **CA-15** — Dada una reserva con un servicio «a convenir», cuando llega el vehículo («Llegó»),
  entonces la orden trae el servicio con el tiempo de la reserva y sin valor, para escribirlo.
- **CA-16** — Dado un cliente que reserva desde la app, cuando elige servicios, entonces no se le
  ofrecen los «a convenir» (se cotizan antes con el personal).

### HU-04 (P2) — La lista de precios del negocio, cargada

Como administrador, quiero encontrar ya cargadas las categorías y los servicios de la lista de
precios, para no escribirlos uno a uno.

**Criterios de aceptación**

- **CA-17** — Dado un entorno nuevo (también producción), cuando se abre «Servicios», entonces están
  los servicios de la lista con sus valores por categoría o únicos y sus tiempos («Fuentes»), y el PPF
  «a convenir»; el administrador los corrige después como cualquier servicio.
- **CA-18** — Dado un entorno nuevo, cuando se abre «Marcas y líneas», entonces cada línea de moto del
  catálogo inicial ya tiene su categoría; las que la gente añada después llegan sin categoría, por
  revisar (spec 018).

### HU-05 (P1) — Paquetes e incluidos *(enmienda 2026-11-26)*

Como persona del personal o cliente, quiero que al elegir un paquete se vea lo que ya incluye y no
pueda elegir otro paquete ni pedir aparte algo incluido, para no cobrar ni reservar dos veces lo
mismo.

Un **paquete** es un servicio con valores por categoría: Pro Wash o un combo (Premium, Deluxe,
Supreme).

**Criterios de aceptación**

- **CA-20** — Dado el formulario de un servicio, cuando el administrador marca qué servicios del
  catálogo incluye, entonces se guardan como sus «incluidos». Un servicio no se incluye a sí mismo
  ni incluye a uno que ya lo incluye.
- **CA-21** — Dada la lista de «Servicios», cuando un servicio incluye otros, entonces su tarjeta dice
  «Incluye: …» con sus nombres.
- **CA-22** — Dado un entorno nuevo, cuando se abre «Servicios», entonces los incluidos de la lista de
  precios ya están cargados:
  - Premium: Pro Wash, Limpieza completa de kit con tapa piñón, Sellador y Limpieza de asientos;
  - Deluxe: Pro Wash y Desengrasado y lubricado de cadena;
  - Supreme: Pro Wash, Limpieza completa de kit con tapa piñón y Limpieza de asientos;
  - Limpieza completa de kit con tapa piñón: Desengrasado y lubricado de cadena;
  - Limpieza completa de kit con tapa piñón y cubrecadena: Limpieza completa de kit con tapa piñón;
  - Desengrasado y lubricado de cadena: Desengrasado de cadena y Lubricado de cadena.

  Lo que no se vende suelto (micropulido al 60 % o al 90 %, recubrimiento cerámico) sigue en la
  descripción.
- **CA-23** — Dada una reserva (del personal o del cliente) o una orden, cuando ya tiene un paquete,
  entonces no se puede elegir otro: los demás se ven como no disponibles, con el motivo.
- **CA-24** — Dado un servicio elegido, cuando incluye otros (también lo que estos incluyen), entonces
  cada incluido se ve como «Incluido en {servicio}» y no se puede elegir aparte. Con Premium: Pro
  Wash, las limpiezas de kit, el desengrasado, el lubricado, el sellador y los asientos.
- **CA-25** — Dados dos servicios que comparten algo incluido, cuando se elige uno, entonces el otro no
  se puede elegir y se dice con cuál se cruza (Premium y «Limpieza completa de kit con tapa piñón y
  cubrecadena» incluyen ambos la limpieza de kit). Al quitar el elegido, vuelven a poder elegirse.
- **CA-26** — Dada una reserva o una orden que llega con dos paquetes o con servicios que se cruzan
  (sin pasar por la app), cuando se guarda, entonces se rechaza y se dice por qué. Las líneas «Otro»
  no cuentan.
- **CA-27** — Dada una orden con un paquete, cuando se ve, entonces el paquete es una sola línea con su
  valor y dice lo que incluye; los incluidos no son líneas aparte (totales, reporte y liquidación
  como hoy).
- **CA-28** — Dada la elección de servicios de una reserva (del personal o del cliente) o de una orden,
  cuando se muestran, entonces van en dos grupos con su título, «Paquetes» y «Servicios adicionales»
  (el resto, también «Otro» en la orden), para no confundirlos. *(Pedido por el usuario durante la
  implementación.)*
- **CA-29** — Dada una orden, cuando un servicio del catálogo ya está añadido, entonces su botón pasa de
  «+» a «−» y al pulsarlo se quita la línea: no se añade dos veces («Otro» sí se puede repetir).
  *(Pedido por el usuario durante la implementación.)*

## Requisitos funcionales

- **RF-01** — Cada moto tiene una de ocho categorías: Street/Roadster, SBK/SSP, Scooter, Maxi Scooter,
  Trail, Maxi Trail, Cruiser/Clásica y Maxi Cruiser.
- **RF-02** — El valor de moto de un servicio es único o por categoría; carro y bicicleta, único.
- **RF-03** — Un servicio puede ser «a convenir»: sin valores ni tiempo de referencia, para cualquier
  tipo de vehículo.
- **RF-04** — Un servicio puede incluir otros servicios del catálogo. Lo incluido se hereda: si A
  incluye B y B incluye C, A incluye C.

## Reglas de negocio

- **RN-01** — Las líneas de una orden copian el valor y el tiempo al añadirse (spec 008): cambiar la
  categoría de una moto o los valores del catálogo no altera órdenes existentes.
- **RN-02** — Una orden no se guarda con una línea «a convenir» sin valor.
- **RN-03** — El cliente nunca ve precios (spec 021) ni la categoría de su moto: solo el personal la
  elige y la ve. *(Precisado al verificar:* la app nunca le muestra la categoría y la base le impide
  cambiarla; leerla no se le bloquea en la base, porque no es un dato personal ni un precio y el
  personal la lee en el formulario y en la orden.)
- **RN-04** — La categoría de una moto es la propia si el personal le dio una; si no, la de su línea.
- **RN-05** — Una reserva o una orden lleva como mucho un paquete.
- **RN-06** — Dos servicios de una misma reserva u orden no comparten nada incluido (cada servicio
  cuenta como incluido en sí mismo). Se comprueba al guardar; lo ya guardado no cambia.

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Categoría de moto | Nombre, orden | Lista fija de ocho. |
| Línea de moto | Categoría | La del catálogo inicial, clasificada; las nuevas, sin categoría. |
| Moto | Categoría propia (opcional) | Si no tiene, la de su línea. |
| Servicio | Valor de moto único o por categoría; «a convenir» | Carro y bicicleta, como en la spec 007. |
| Incluido | Servicio que incluye, servicio incluido | Sin ciclos; se hereda (RF-04). |

## Requisitos no funcionales

- **Móvil**: el formulario de servicio con ocho valores cabe en 360 px sin desplazamiento lateral.
- **Accesibilidad**: los ocho valores tienen su categoría como etiqueta.

## Fuera de alcance

- Calcular el valor de un paquete sumando sus incluidos: cada paquete tiene su propio valor.
- Precios por categoría para carros o bicicletas.
- Mostrar precios al cliente.
- Descuentos automáticos por paquete («ahorro de $ 2.000» de la imagen es informativo).

## Suposiciones

- Cada lavado, paquete y combo de la lista es un servicio del catálogo con valores por categoría; sus
  incluidos dicen qué servicios del catálogo trae (HU-05) y su descripción, el resto. Cada variante
  de limpieza de kit es un servicio con valor único. «Kit» es el kit de arrastre: limpiarlo incluye
  desengrasar y lubricar la cadena.
- En el entorno local, la orden #2 de Camila deja de llevar Pro Wash junto con Deluxe (lo incluye).
- Los tiempos de la lista se cargan como tiempo estimado del servicio (Premium 2 h, Deluxe 3 h 30
  min). El Supreme («2 días hábiles») supera el tiempo máximo de un servicio (1.440 min, spec 008): se
  carga sin tiempo y el personal lo ajusta.
- La comisión de los empleados se calcula sobre el valor de la línea, como hoy (spec 016).
- En el entorno local, las motos de las órdenes y reservas de ejemplo usan los servicios de la lista.
  Como la lista es solo de motos, quedan cuatro servicios de ejemplo de la spec 007 sin valor de moto
  («Lavado sencillo», «Lavado detallado», «Micropulido» y «Polichado», desactivado) para el carro y la
  bicicleta de los seeds.
- La categoría de cada línea del catálogo inicial (173 líneas de moto) se toma de la ficha de cada
  modelo (tipo de moto según el fabricante); el administrador la corrige si hace falta.

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
| 2026-11-26 | Creación, a pedido del usuario, con la lista de precios del negocio. Enmienda las specs 005 (categoría de la moto), 007 (RF-01: valor de moto por categoría), 008 (servicios «a convenir»), 012/014 (reservas) y 018 (categoría de la línea). |
| 2026-11-26 | Decisiones del usuario: la categoría la da la línea y el personal puede cambiarla en cada moto; las líneas del catálogo inicial llegan clasificadas; solo el personal ve y elige la categoría; una moto sin categoría la pide en la orden; el PPF lo reserva solo el personal; la lista de precios llega cargada en todos los entornos. |
| 2026-11-26 | Aprobada por el usuario: la lista de precios de las imágenes es la base, cargada una vez (el administrador la cambia después); la clasificación de las líneas de moto actuales es parte de la implementación. |
| 2026-11-26 | Plan aprobado, con dos precisiones del usuario: la descripción opcional de un servicio (CA-19) y el tiempo estimado en la reserva del personal (CA-14). Estado `planificada`. |
| 2026-11-26 | Implementada: estado `implementada`. A pedido del usuario, «Servicios» pasa a tarjetas en tres grupos (CA-09 precisado; enmienda de la spec 007, CA-02). |
| 2026-11-26 | Verificada. Correcciones aprobadas por el usuario: la categoría también en la tarjeta de la orden guardada (CA-04); RN-03 precisada (la app nunca la muestra al cliente y la base le impide cambiarla); prueba en el iPhone del diálogo de categoría y del tiempo del PPF. Estado `verificada`. |
| 2026-11-26 | Enmienda HU-05 «Paquetes e incluidos» (CA-20 a CA-27, RF-04, RN-05, RN-06), a pedido del usuario antes del merge: un solo paquete por reserva u orden, los incluidos no se eligen aparte y la limpieza de kit incluye desengrasar y lubricar la cadena. Aprobada por el usuario, con su plan y tareas. |
| 2026-11-26 | Enmienda HU-05 implementada, con dos precisiones del usuario: grupos «Paquetes» / «Servicios adicionales» (CA-28) y quitar con «−» un servicio ya añadido a la orden (CA-29). Estado `implementada`. |
| 2026-11-26 | Enmienda HU-05 verificada. Correcciones aprobadas por el usuario: «Llegó» deja en «omitidos» un servicio de la reserva que ya se cruza con otro (RN-06); prueba del orden por valor de los paquetes en la reserva del personal y en la orden (CA-28); auditorías de accesibilidad y de iPhone de la orden con un paquete. Estado `verificada`. |
