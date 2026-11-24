---
id: "017"
titulo: "Derechos del titular de datos"
estado: verificada
creada: 2026-11-24
actualizada: 2026-11-24
---

# 017 — Derechos del titular de datos

## Contexto y problema

La política de tratamiento de datos (spec 004) promete a los clientes los derechos de la Ley 1581
de 2012: conocer sus datos, corregirlos y pedir que se supriman. Hoy solo pueden cambiar su nombre y
su celular en «Mi perfil»; para todo lo demás tienen que escribir por Instagram o ir al punto de
atención, y el negocio no lleva registro de esas solicitudes ni de sus plazos legales (10 días
hábiles para una consulta, 15 para un reclamo).

Se quiere que el cliente con cuenta vea y descargue todo lo que el negocio guarda de él, y que pida
desde la app la corrección o la supresión de sus datos. El administrador atiende esas solicitudes
dentro de los plazos, con un registro de cada una, y registra también las de los clientes sin
cuenta que llegan por los canales de siempre.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Cliente con cuenta | Ver y descargar sus datos; pedir que se corrijan o se supriman, y ver en qué va cada solicitud. |
| Administrador | Atender las solicitudes a tiempo; registrar las de los clientes sin cuenta; suprimir los datos de un cliente sin perder las cuentas del negocio. |
| Operador | Nada: las solicitudes y su contenido son del administrador. |
| Cliente sin cuenta | Lo representa el administrador, que registra su solicitud. |

## Historias de usuario

### HU-01 (P1) — Consultar mis datos

Como cliente, quiero ver y descargar todos los datos que el negocio tiene de mí, para saber qué
guarda y comprobar que es correcto.

**Criterios de aceptación**

- **CA-01** — Dado un cliente con cuenta, cuando abre «Mis datos» (desde «Mi perfil»), entonces ve:
  - su nombre, correo, celular y foto, y si su cuenta es con correo o con Google;
  - cuándo autorizó el tratamiento de sus datos, con enlace a la política;
  - sus vehículos, también los que retiró;
  - sus órdenes, también las anuladas (marcadas así);
  - sus reservas, también las canceladas;
  - sus solicitudes de datos y en qué van.
- **CA-02** — Dado «Mis datos», cuando pulsa «Descargar mis datos», entonces descarga un archivo con
  todo lo anterior.
- **CA-03** — Dado un cliente, entonces nunca ve ni descarga datos de otro cliente, ni datos internos
  del negocio (empleados que hicieron los servicios, nombres del personal, notas internas).

### HU-02 (P1) — Pedir la corrección o la supresión de mis datos

Como cliente, quiero pedir que se corrija un dato que no puedo cambiar yo, o que se supriman mis
datos, y saber cuándo me responderán.

**Criterios de aceptación**

- **CA-04** — Dado «Mis datos», cuando el cliente pide una corrección, entonces escribe qué hay que
  corregir (obligatorio). La solicitud queda «Recibida» con la fecha límite de respuesta: 15 días
  hábiles desde el día siguiente (RN-03). Se le recuerda que nombre y celular los cambia él mismo en
  «Mi perfil».
- **CA-05** — Dado «Mis datos», cuando el cliente pide la supresión, entonces antes de enviarla se le
  explica qué pasará: se cierra su cuenta y se borran sus datos personales; las órdenes que ya pagó
  quedan en las cuentas del negocio sin su nombre ni contacto (RN-05). Puede dejar un motivo
  (opcional). La solicitud queda «Recibida» con su fecha límite.
- **CA-06** — Dado un cliente con una solicitud «Recibida» de un tipo, entonces no puede enviar otra
  del mismo tipo hasta que se responda (se le dice cuál tiene abierta).
- **CA-07** — Dado un cliente, entonces ve cada solicitud con su tipo, fecha, fecha límite, estado
  («Recibida», «Atendida» o «Rechazada») y la respuesta del administrador.
- **CA-08** — Dado un cliente con una solicitud «Recibida», cuando la retira, entonces queda
  «Retirada» y puede enviar otra.

### HU-03 (P1) — Atender las solicitudes

Como administrador, quiero ver las solicitudes pendientes con su plazo y atenderlas, para cumplir
la ley y dejar constancia.

**Criterios de aceptación**

- **CA-09** — Dado un administrador, cuando abre «Solicitudes de datos», entonces ve las pendientes
  primero, la que vence antes arriba, cada una con el cliente, el tipo, el canal (la app, el punto
  de atención, Instagram), la fecha, la fecha límite y cuántos días hábiles faltan; las vencidas se
  marcan. Las atendidas, rechazadas y retiradas se ven aparte.
- **CA-10** — Dado el menú o el inicio del administrador, entonces «Solicitudes de datos» dice cuántas
  hay pendientes y si alguna está vencida.
- **CA-11** — Dada una solicitud de corrección, cuando el administrador la atiende, entonces puede
  corregir los datos del cliente (nombre, celular y correo; el correo de un cliente con cuenta es
  también con el que entra) y la cierra «Atendida» con una respuesta para el cliente (obligatoria).
- **CA-12** — Dada una solicitud de supresión, cuando el administrador la ejecuta y lo confirma,
  entonces se suprimen los datos del cliente (RN-05), la solicitud queda «Atendida» y el cliente,
  si tenía la sesión abierta, sale en su siguiente acción.
- **CA-13** — Dada una solicitud de supresión de un cliente con una orden abierta, entonces no se
  puede ejecutar hasta que se cierre o se anule (se dice cuál); sus reservas pendientes se cancelan
  al ejecutarla.
- **CA-14** — Dada cualquier solicitud, cuando el administrador la rechaza, entonces escribe el motivo
  (obligatorio, p. ej. un deber legal de conservar el dato) y queda «Rechazada».
- **CA-15** — Dado un operador o un cliente, entonces no ve «Solicitudes de datos» y no puede leer,
  atender ni rechazar una solicitud por ninguna vía; un cliente solo ve y retira las suyas.

### HU-04 (P2) — Solicitudes de clientes sin cuenta

Como administrador, quiero registrar la solicitud de un cliente que llega al punto de atención o
escribe por Instagram, para atenderla con el mismo registro y plazos.

**Criterios de aceptación**

- **CA-16** — Dada la ficha de un cliente (con o sin cuenta), cuando el administrador registra una
  solicitud, entonces elige el tipo (consulta, corrección o supresión), el canal (punto de atención
  o Instagram) y escribe lo que pidió; queda «Recibida» con su fecha límite (10 días hábiles una
  consulta, 15 un reclamo).
- **CA-17** — Dada una consulta, cuando el administrador la atiende, entonces puede descargar el
  archivo con los datos de ese cliente (el mismo de CA-02) para entregárselo, y la cierra «Atendida»
  con su respuesta.
- **CA-18** — Dada una solicitud registrada por el administrador, entonces se atiende igual que las
  de la app (CA-11 a CA-14).

### HU-05 (P2) — Constancia

Como administrador, quiero que quede constancia de cada solicitud y de cómo se atendió, para
demostrar que se cumplió la ley si la Superintendencia lo pide.

**Criterios de aceptación**

- **CA-19** — Dada una solicitud, entonces queda registrado quién la creó, cuándo, quién la atendió o
  rechazó, cuándo y con qué respuesta. Nada de eso se puede borrar ni cambiar después.
- **CA-20** — Dados los datos de un cliente suprimido, entonces su solicitud de supresión sigue en el
  registro, sin sus datos personales (RN-06).

## Requisitos funcionales

- **RF-01** — «Mis datos» para el cliente con cuenta, enlazado desde «Mi perfil», con la descarga.
- **RF-02** — Solicitudes de datos de tres tipos: consulta, corrección y supresión, con estado,
  plazo, canal y respuesta.
- **RF-03** — «Solicitudes de datos» para el administrador, y el registro de solicitudes desde la
  ficha de un cliente.
- **RF-04** — Suprimir los datos de un cliente conservando, sin datos personales, lo que el negocio
  debe guardar.

## Reglas de negocio

- **RN-01** — Solo el administrador lee y atiende las solicitudes; el cliente ve las suyas. Se
  comprueba en el servidor.
- **RN-02** — Una solicitud abierta por tipo y por cliente.
- **RN-03** — Plazos (Ley 1581, numeral 6 de la política): una consulta, 10 días hábiles; una
  corrección o una supresión (reclamos), 15 días hábiles. Se cuentan desde el día siguiente al
  recibo. Días hábiles: de lunes a viernes, sin festivos nacionales de Colombia.
- **RN-04** — Pedir la supresión es también revocar la autorización: mientras se atiende, el negocio
  no usa sus datos para nada distinto de atender sus servicios en curso. Es una regla de
  organización (el negocio no tiene envíos ni otros usos de los datos que la app pueda apagar):
  la app no la comprueba.
- **RN-05** — Suprimir los datos de un cliente:
  - se borran su nombre (queda «Cliente suprimido»), correo, celular, foto y su cuenta (ya no puede
    entrar, y su correo queda libre para registrarse de nuevo);
  - sus vehículos se retiran y se borran sus placas;
  - se vacían las notas de sus órdenes y reservas;
  - sus reservas pendientes se cancelan;
  - sus órdenes cerradas y anuladas se conservan, sin datos personales, para las cuentas del negocio:
    los reportes y las liquidaciones no cambian.
- **RN-06** — Ejecutada la supresión, ninguna solicitud del cliente guarda datos personales: todas
  (no solo la de supresión) pierden lo que pidió y la respuesta, y conservan el tipo, el canal, el
  estado, las fechas y quién las atendió, con «Cliente suprimido» como nombre.
- **RN-07** — No se suprime a un cliente con una orden abierta.
- **RN-08** — El correo de una cuenta de Google lo pone Google y es con el que entra: no se corrige
  (la solicitud se rechaza con ese motivo). El de una cuenta con contraseña sí (CA-11).
- **RN-09** — Un cliente suprimido es definitivo: nadie corrige sus datos, lo reactiva ni lo
  desactiva. La ficha y la lista de clientes no ofrecen esas acciones, y la base de datos las
  rechaza.

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Solicitud de datos | cliente, tipo (consulta, corrección, supresión), canal (app, punto de atención, Instagram), descripción, estado (recibida, atendida, rechazada, retirada), fecha, fecha límite, creada por, atendida por, fecha de respuesta, respuesta | Nunca se borra. |
| Cliente | datos personales, autorización (fecha) | Suprimido: sin datos personales ni cuenta. |
| Festivos | fecha | Para contar días hábiles. |

## Requisitos no funcionales

- **Privacidad:** las solicitudes son datos personales: solo el administrador y su titular.
- **Móvil:** «Mis datos» y las solicitudes se piensan primero para el teléfono, sin desplazamiento
  lateral.
- **Accesibilidad:** WCAG 2.1 AA en claro y oscuro, con la auditoría automática en verde.

## Fuera de alcance

- Correos o mensajes automáticos al cliente cuando se responde (lo ve en «Mis datos»; a un cliente
  sin cuenta o suprimido le avisa el administrador por su canal).
- Que el cliente cambie su correo él mismo (lo hace el administrador por una corrección).
- Suprimir a un empleado o a un miembro del personal.
- Borrar del todo el historial de órdenes de un cliente.
- La gestión de quejas ante la Superintendencia.

## Suposiciones

- Los festivos de Colombia se calculan para cualquier año con la regla de la ley (fijos, trasladados
  al lunes y los que dependen de la Pascua): no hay que cargarlos.
- El archivo de «Descargar mis datos» lo pueden leer una persona y un programa.
- Un cliente desactivado (spec 004) no entra a la app; sus solicitudes las registra el
  administrador.
- Una supresión de un cliente sin cuenta se ejecuta igual (RN-05), sin cuenta que cerrar.

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
| 2026-11-24 | Creación. Decisiones del usuario: suprimir es anonimizar (las órdenes quedan sin datos personales); la supresión es una solicitud que atiende el administrador; «Mis datos» para ver y descargar; las correcciones que el cliente no puede hacer, por solicitud al administrador; el administrador registra las solicitudes de los clientes sin cuenta. |
| 2026-11-24 | Aprobada por el usuario. |
| 2026-11-24 | Plan aprobado: estado `planificada`. Precisiones del plan: los festivos se calculan (suposición) y el correo de una cuenta de Google no se corrige (RN-08). |
| 2026-11-24 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-24 | Implementada: estado `implementada`. En el menú la sección se llama «Habeas data»; `customers_contact_required` admite un cliente suprimido sin contacto. |
| 2026-11-24 | Verificación, correcciones aprobadas por el usuario: RN-06 dice lo que hace el código (todas las solicitudes del cliente pierden sus textos); RN-04 es una regla de organización; nueva RN-09 (un cliente suprimido es definitivo); prueba del cambio de correo contra Auth real (CA-11). Con «Habeas data» el menú no cabía: las secciones propias del administrador van bajo «Administración» (spec 009). |
| 2026-11-24 | Verificada: todos los criterios con su prueba en verde (Definición de terminado completa: lint, tipos, 1.372 unitarias, 54 de sandbox, 665 pgTAP, build y 205 E2E contra producción). |
