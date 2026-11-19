---
id: "004"
titulo: "Registro de clientes y sección Clientes"
estado: planificada
creada: 2026-11-19
actualizada: 2026-11-19
---

# 004 — Registro de clientes y sección Clientes

## Contexto y problema

Hoy la app solo la usa el personal (operadores y administradores, invitados por el dueño). Los
clientes no existen en ella: sus datos se anotan a mano o se pierden, y el negocio no tiene una
lista de a quién atiende ni cómo contactarlo.

El negocio quiere que los clientes puedan **crear su propia cuenta** (con correo y contraseña o con
Google) y quedar registrados como clientes, y que el personal tenga una sección **Clientes** donde
consultarlos, buscarlos y registrar a mano a quien llega al punto de atención sin cuenta. Es la
base sobre la que después se asociarán vehículos y órdenes de trabajo.

Los datos de clientes son datos personales: solo se recogen los necesarios y con su autorización.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Cliente (nuevo) | Crear su cuenta con poco esfuerzo, entrar y mantener al día su nombre y celular. No ve nada del personal ni de otros clientes. |
| Operador | Consultar y buscar clientes; registrar a mano a quien llega sin cuenta y corregir sus datos. |
| Administrador | Todo lo del operador, más desactivar y reactivar clientes. |

## Historias de usuario

### HU-01 (P1) — Crear cuenta con correo y contraseña

Como cliente, quiero crear mi cuenta con mi nombre, correo y contraseña, para quedar registrado en
Motorismo y poder entrar cuando quiera.

**Criterios de aceptación**

- **CA-01** — Dado un visitante en la pantalla de inicio de sesión, cuando elige «Crear cuenta»,
  entonces ve el formulario de registro con nombre, correo, celular (opcional), contraseña y la
  casilla de autorización del tratamiento de datos con enlace a la política.
- **CA-02** — Dado un visitante, cuando se registra con datos válidos y autoriza el tratamiento de
  datos, entonces ve «Te enviamos un correo para confirmar tu cuenta.», recibe un correo en
  español con un enlace de confirmación y todavía no puede entrar.
- **CA-03** — Dado un visitante que se registró, cuando abre el enlace de confirmación vigente,
  entonces su cuenta queda confirmada, entra a la app como cliente y ve su perfil.
- **CA-04** — Dado un registro sin confirmar, cuando la persona intenta entrar con su correo y
  contraseña correctos, entonces no entra y ve «Confirma tu correo para entrar.» con la opción de
  reenviar el correo de confirmación.
- **CA-05** — Dado un enlace de confirmación caducado o ya usado, cuando se abre, entonces se ve
  que no es válido y la opción de pedir uno nuevo.
- **CA-06** — Dado un visitante, cuando envía el registro con el nombre vacío, un correo con
  formato inválido, un celular con formato inválido (RN-03), una contraseña de menos de 8
  caracteres o sin autorizar el tratamiento de datos, entonces ve el error junto a cada campo y no
  se crea la cuenta.
- **CA-07** — Dado un correo que ya pertenece a una cuenta (de cliente o del personal), cuando
  alguien se registra con él, entonces ve el mismo mensaje que en CA-02 (no revela que el correo
  existe), no se crea otra cuenta y la cuenta existente no cambia (ni su nombre ni su contraseña).

### HU-02 (P1) — Lo que puede y no puede hacer un cliente

Como dueño del negocio, quiero que un cliente con cuenta solo acceda a sus propios datos, para que
abrir el registro al público no exponga información del negocio ni de otros clientes.

**Criterios de aceptación**

- **CA-08** — Dado un cliente con sesión, cuando mira las opciones disponibles, entonces solo ve
  su perfil y cerrar sesión: no ve el inicio del personal, «Clientes» ni «Usuarios».
- **CA-09** — Dado un cliente con sesión, cuando abre directamente la URL de una página del
  personal, entonces ve «No tienes permiso para ver esta página.» y un enlace a su perfil.
- **CA-10** — Dado un cliente, cuando intenta leer o modificar datos de otros clientes o del
  personal, o cambiar su propio estado, por cualquier vía distinta de la interfaz (por ejemplo,
  peticiones directas con su sesión), entonces el sistema lo rechaza y no entrega ni cambia ningún
  dato.
- **CA-11** — Dado un administrador, cuando abre la gestión de usuarios (spec 002), entonces no
  ve clientes en ella; y en la sección «Clientes» no aparece el personal.

### HU-03 (P1) — Mi perfil

Como cliente, quiero ver y corregir mis datos, para que el negocio pueda contactarme.

**Criterios de aceptación**

- **CA-12** — Dado un cliente con sesión, cuando entra a la app, entonces llega a «Mi perfil» y ve
  su nombre, correo, celular y fecha de registro.
- **CA-13** — Dado un cliente en «Mi perfil», cuando cambia su nombre o su celular con datos
  válidos y guarda, entonces ve «Tus datos se guardaron.» y el personal ve los datos nuevos en su
  ficha.
- **CA-14** — Dado un cliente en «Mi perfil», cuando deja el nombre vacío o escribe un celular
  inválido, entonces ve el error junto al campo y no se guarda nada. Su correo se ve pero no se
  puede cambiar.

### HU-04 (P1) — Consultar clientes

Como operador o administrador, quiero ver y buscar a los clientes, para encontrar rápido sus datos
de contacto.

**Criterios de aceptación**

- **CA-15** — Dado un miembro del personal, cuando abre «Clientes» desde el menú, entonces ve la
  lista de clientes con nombre, correo, celular, estado y fecha de alta, del más reciente al más
  antiguo.
- **CA-16** — Dado un miembro del personal en «Clientes», cuando escribe parte del nombre, del
  correo o del celular de un cliente, entonces la lista muestra solo los que coinciden, sin
  distinguir mayúsculas ni tildes; si ninguno coincide, ve «No hay clientes que coincidan con tu
  búsqueda.».
- **CA-17** — Dado un miembro del personal en «Clientes», cuando pulsa una de las tarjetas de
  resumen («Con cuenta», «Sin cuenta», «Desactivados»), entonces la lista se filtra por ese estado
  según el estándar de tarjetas-filtro del proyecto (el filtro sobrevive a recargar y se quita con
  «Ver todos»), y se combina con la búsqueda.
- **CA-18** — Dado un miembro del personal, cuando abre un cliente de la lista, entonces ve su
  ficha: nombre, correo, celular, estado, origen («Registro propio», «Google» o «Punto de
  atención»), fecha de alta, fecha de la autorización de datos y, si se creó en el punto de
  atención, quién lo registró.
- **CA-19** — Dado un registro sin confirmar (CA-02), cuando el personal consulta «Clientes»,
  entonces no aparece ni cuenta en los totales.

### HU-05 (P2) — Entrar o registrarse con Google

Como cliente, quiero crear mi cuenta y entrar con Google, para no tener que inventar otra
contraseña.

**Criterios de aceptación**

- **CA-20** — Dada una cuenta de Google cuyo correo no pertenece a nadie, cuando la persona elige
  «Continuar con Google» (en inicio de sesión o en registro) y autoriza, entonces se crea su cuenta
  de cliente con el nombre, el correo y la foto de Google, sin pedir confirmación de correo, y
  entra a «Mi perfil». Junto al botón se lee que al continuar autoriza el tratamiento de datos, y
  esa autorización queda registrada.
- **CA-21** — Dado un cliente con cuenta de correo y contraseña cuyo correo coincide con el de su
  cuenta de Google, cuando continúa con Google, entonces entra a su misma cuenta (no se crea otra)
  y, si estaba sin confirmar, queda confirmada.
- **CA-22** — Dado un cliente desactivado (HU-07), cuando entra con Google o con su contraseña,
  entonces no entra y ve «Tu cuenta está desactivada. Contacta al administrador.».
- **CA-23** — Dado un miembro del personal, cuando continúa con Google con su correo, entonces
  entra como hasta ahora con su rol (spec 002); nunca se le crea una cuenta de cliente.

### HU-06 (P2) — Registrar y editar clientes en el punto de atención

Como operador o administrador, quiero registrar a un cliente que llega sin cuenta y corregir sus
datos, para tenerlo en la lista aunque no use la app.

**Criterios de aceptación**

- **CA-24** — Dado un miembro del personal, cuando crea un cliente con nombre, al menos un correo
  o un celular válidos y marca que el cliente autorizó el tratamiento de sus datos, entonces el
  cliente aparece en la lista como «Sin cuenta» y no recibe ningún correo.
- **CA-25** — Dado un miembro del personal, cuando envía el formulario sin nombre, sin correo ni
  celular, con formatos inválidos o sin marcar la autorización, entonces ve el error junto a cada
  campo y no se crea el cliente.
- **CA-26** — Dado un miembro del personal, cuando crea o edita un cliente con un correo que ya
  pertenece a otro cliente o al personal, entonces no se guarda y ve «Ya existe una cuenta con este
  correo.».
- **CA-27** — Dado un miembro del personal en la ficha de un cliente, cuando cambia su nombre o
  su celular (y su correo, solo si el cliente no tiene cuenta), entonces se guardan los cambios.
  El correo de un cliente con cuenta no se puede cambiar.
- **CA-28** — Dado un cliente registrado en el punto de atención con un correo, cuando esa persona
  crea su cuenta (con contraseña tras confirmar, o con Google) con ese mismo correo, entonces su
  cuenta queda unida a esa ficha: no aparece un cliente duplicado, la ficha pasa a «Con cuenta» y
  conserva sus datos (si no tenía celular y lo dio al registrarse, se añade).

### HU-07 (P3) — Desactivar y reactivar clientes

Como administrador, quiero desactivar a un cliente sin borrarlo, para cortar su acceso conservando
su historial.

**Criterios de aceptación**

- **CA-29** — Dado un administrador, cuando desactiva a un cliente, entonces este aparece como
  «Desactivado», no puede entrar (CA-22) y, si tenía una sesión abierta, en su siguiente acción es
  llevado al inicio de sesión con el mensaje de cuenta desactivada.
- **CA-30** — Dado un administrador, cuando reactiva a un cliente desactivado, entonces vuelve a
  «Con cuenta» (y puede entrar como siempre) o a «Sin cuenta» si nunca la creó.
- **CA-31** — Dado un operador, cuando mira la ficha de un cliente, entonces no ve la opción de
  desactivar o reactivar, y si lo intenta por cualquier otra vía el sistema lo rechaza.

## Requisitos funcionales

- **RF-01** — Cualquier persona puede crear una cuenta de cliente; nadie puede registrarse como
  personal (el personal sigue entrando solo por invitación, spec 002).
- **RF-02** — Personal y clientes usan la misma pantalla de inicio de sesión; tras entrar, el
  personal llega al inicio y el cliente a «Mi perfil» (o, en ambos casos, a la página que había
  pedido y a la que tiene acceso).
- **RF-03** — Son públicas, además de las de la spec 002, las páginas de registro, de confirmación
  de la cuenta y de la política de tratamiento de datos.
- **RF-04** — La sección «Clientes» está en el menú del operador y del administrador.
- **RF-05** — La lista de clientes se pagina de 20 en 20; la búsqueda y el filtro aplican sobre
  todos los clientes, no solo sobre la página visible.
- **RF-06** — La recuperación de contraseña de la spec 002 sirve igual para los clientes con
  cuenta.
- **RF-07** — De cada cliente se guarda cuándo y por qué vía autorizó el tratamiento de sus datos
  (registro propio, Google o punto de atención, y en este caso quién lo registró).

## Reglas de negocio

- **RN-01** — Un correo identifica a una sola persona en toda la app (personal o cliente), sin
  distinguir mayúsculas.
- **RN-02** — El cliente que se registra solo da siempre correo; el registrado en el punto de
  atención necesita al menos un correo o un celular.
- **RN-03** — El celular es colombiano: 10 dígitos que empiezan por 3. Se aceptan espacios,
  guiones y el prefijo +57, y se guarda solo con los 10 dígitos.
- **RN-04** — No se crea ningún cliente sin su autorización para el tratamiento de datos
  personales.
- **RN-05** — La contraseña tiene al menos 8 caracteres (igual que la spec 002).
- **RN-06** — Los mensajes de registro, inicio de sesión y recuperación no revelan si un correo
  está registrado.
- **RN-07** — Un registro sin confirmar no es todavía un cliente: no entra ni aparece en la lista.
- **RN-08** — Los clientes no se borran: se desactivan, para conservar su relación con el
  historial.
- **RN-09** — Solo el administrador desactiva y reactiva clientes.
- **RN-10** — En esta versión nadie cambia el correo de un cliente con cuenta.
- **RN-11** — Una cuenta de cliente nunca obtiene permisos del personal por ninguna vía.

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Cliente | nombre, correo, celular, estado, origen, fecha de alta, registrado por, autorización de datos (fecha y vía) | Estado: Con cuenta, Sin cuenta, Desactivado. Origen: Registro propio, Google, Punto de atención. |
| Cuenta | correo, contraseña o Google, confirmada | Una cuenta es del personal (spec 002) o de un cliente, nunca de ambos. |

## Requisitos no funcionales

- **Seguridad**: los intentos repetidos de registro, inicio de sesión y reenvío de correos se
  limitan para frenar abusos y el envío masivo de correos.
- **Privacidad**: el personal ve los datos de los clientes porque los necesita para atenderlos;
  cada cliente ve solo los suyos. Cumplimiento de la Ley 1581 de 2012 (protección de datos
  personales en Colombia) en lo que toca a la autorización.
- **Idioma**: pantallas y correos (confirmación de cuenta) en español.
- **Accesibilidad**: las pantallas nuevas pasan la auditoría automática de accesibilidad del
  proyecto; los formularios se completan solo con teclado y los errores se asocian a su campo.
- **Dispositivos**: el registro y «Mi perfil» se piensan primero para el móvil (el cliente se
  registra desde su teléfono); «Clientes» es usable en el computador del punto de atención y en un
  móvil.
- **Rendimiento**: la búsqueda responde en menos de un segundo con varios miles de clientes.

## Fuera de alcance

- Vehículos y placas de los clientes (spec aparte; ahí se resuelve si son solo motos o vehículos
  en general).
- Historial de servicios, número de lavadas y órdenes de trabajo.
- Citas o reservas desde la app.
- Que el cliente cambie su correo o elimine su cuenta; consultas y solicitudes de supresión de
  datos (derechos del titular) desde la app.
- Verificar el celular (SMS o WhatsApp).
- Convertir un cliente en miembro del personal o viceversa.
- Importar los clientes de la versión anterior de la app.
- Exportar la lista de clientes.
- Avisar al personal cuando se registra un cliente nuevo.

## Suposiciones

- El enlace de confirmación de cuenta caduca a las **24 horas** (la plataforma usa una sola
  vigencia para todos los enlaces por correo, como en la spec 002).
- El celular **no es único**: dos clientes pueden compartirlo (por ejemplo, una familia).
- El texto de la **política de tratamiento de datos** lo entrega el negocio. Mientras tanto se
  publica un texto base que el negocio debe revisar **antes de abrir el registro en producción**.
- Una persona del personal que también es cliente no puede tener las dos cuentas con el mismo
  correo (RN-01); si se necesita, usa otro correo para la cuenta de cliente.
- Los clientes registrados con Google quedan sin celular hasta que lo añadan en «Mi perfil».
- La sesión del cliente sigue las mismas reglas que la del personal (7 días sin uso).

## Cambios que esta spec introduce en la spec 002

Aplicados a la spec 002 al aprobar esta (2026-11-19):

- **RN-01** de la 002 («No hay registro público») pasa a: «No hay registro público **para el
  personal**: operadores y administradores solo entran por invitación. Los clientes sí pueden
  registrarse (spec 004)».
- **CA-27** de la 002 (una cuenta de Google desconocida no entra) queda **reemplazado** por
  CA-20 de esta spec: una cuenta de Google desconocida crea una cuenta de cliente.
- **RF-01** de la 002 amplía sus páginas públicas con las de RF-03 de esta spec.

## Preguntas abiertas

Ninguna. Decisiones tomadas con el usuario el 2026-11-19: el cliente ve y edita su perfil; el
registro con contraseña exige confirmar el correo; operador y administrador consultan, crean y
editan clientes, y solo el administrador los desactiva; el registro pide nombre, correo y celular
opcional (los vehículos van en otra spec).

## Checklist de calidad de la spec

- [x] No menciona tecnologías, librerías, tablas ni componentes (Google se nombra como método de
      acceso elegido por el negocio, como en la spec 002).
- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba.
- [x] No quedan marcas `[NECESITA ACLARACIÓN]`.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar (HU-01 a HU-04: los clientes se registran con
      correo y el personal los consulta y busca).

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Creación (borrador). |
| 2026-11-19 | Aprobada por el usuario, con las suposiciones tal como están. Se aplican sus cambios a la spec 002. |
| 2026-11-19 | Plan técnico aprobado. |
