---
id: "006"
titulo: "App instalable"
estado: verificada
creada: 2026-11-20
actualizada: 2026-11-20
---

# 006 — App instalable

## Contexto y problema

El personal usa la app todo el día en el celular, la tablet o el computador del punto de
atención, y hoy la abre como una página más del navegador: hay que buscarla entre pestañas,
ocupa parte de la pantalla con la barra del navegador y no tiene ícono propio. Los clientes
entran a «Mi perfil» de la misma forma.

Además, el punto de atención puede quedarse sin internet. Hoy, si se cae la red, la app no lo
dice: un botón «Guardar» parece no hacer nada o falla con un error genérico, y al recargar se
ve la página de error del navegador. El negocio no quiere trabajar sin conexión (los datos
deben estar siempre al día y en un solo lugar), pero sí que la app avise con claridad y no deje
operar hasta que vuelva la red.

Por último, una tablet que deja la app abierta todo el día sigue con la versión que cargó por
la mañana; las mejoras publicadas durante el día no le llegan hasta que alguien recarga.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador y administrador | Abrir la app desde un ícono, a pantalla completa; saber cuándo no hay red y no perder lo escrito; recibir las versiones nuevas sin cerrar la app. |
| Cliente | Lo mismo para «Mi perfil»: instalarla en su celular si quiere. |

## Historias de usuario

### HU-01 (P1) — Instalar la app y abrirla como una app

Como usuario (personal o cliente), quiero instalar Motorismo en mi dispositivo para abrirla
desde un ícono, en su propia ventana, como cualquier otra app.

**Criterios de aceptación**

- **CA-01** — Dado un navegador que permite instalar páginas web (Chrome o Edge en Android,
  Windows, macOS o Linux), cuando se visita la app, entonces el navegador la ofrece para
  instalar con el nombre «Motorismo Detailing» y el ícono de la marca.
- **CA-02** — Dada la app instalada, cuando se abre desde su ícono, entonces se abre en su propia
  ventana, sin la barra de direcciones del navegador, con «Motorismo» como nombre corto bajo el
  ícono.
- **CA-03** — Dada la app instalada, cuando se abre desde su ícono, entonces llega a la página de
  inicio: con sesión, a la de su rol (el personal a su inicio, el cliente a «Mi perfil»); sin
  sesión, al acceso.
- **CA-04** — Dado un iPhone o iPad con Safari, cuando se agrega la app a la pantalla de inicio,
  entonces aparece con el ícono de la marca (no una captura de la página) y se abre a pantalla
  completa.
- **CA-05** — Dada la app instalada, cuando se abre, entonces la barra del sistema y la pantalla
  de carga usan los colores de la app (no un color genérico del navegador).

### HU-02 (P2) — Aviso sin conexión, sin dejar operar

Como usuario, quiero saber en cuanto se pierde la conexión y que la app no me deje hacer nada
hasta que vuelva, para no creer que guardé algo que no se guardó.

**Criterios de aceptación**

- **CA-06** — Dado un usuario con la app abierta, cuando el dispositivo pierde la conexión,
  entonces ve un aviso fijo «Sin conexión», que se anuncia a los lectores de pantalla y explica
  que no se puede operar hasta que vuelva la red.
- **CA-07** — Dado que no hay conexión, cuando el usuario intenta guardar, crear, enviar, buscar,
  desactivar, iniciar sesión o cualquier otra acción que necesite la red, entonces no puede: esas
  acciones están deshabilitadas mientras dura el aviso.
- **CA-08** — Dado que no hay conexión y el usuario estaba llenando un formulario, cuando vuelve la
  conexión, entonces el aviso desaparece, las acciones se habilitan de nuevo y lo que había
  escrito sigue ahí.
- **CA-09** — Dado que no hay conexión, cuando el usuario abre la app instalada, recarga la página o
  va a otra página, entonces ve una página de la app «Sin conexión», con la marca y un botón
  «Reintentar», en lugar del error del navegador; esa página no muestra datos de ninguna
  persona.
- **CA-10** — Dado que la conexión se cae justo mientras se envía una acción, cuando el envío falla
  por falta de red, entonces la app no informa éxito, muestra el aviso «Sin conexión» y conserva
  lo escrito para reintentarlo después.
- **CA-11** — Dada la página «Sin conexión», cuando vuelve la red y el usuario pulsa «Reintentar»,
  entonces llega a la página que intentaba abrir.

### HU-03 (P2) — Aviso y opción «Instalar app»

Como usuario con sesión, quiero que la app me avise de que se puede instalar, y tener la opción
«Instalar app» junto a mi cuenta, para no tener que buscar cómo se instala en el menú del
navegador.

**Criterios de aceptación**

- **CA-12** — Dado un usuario con sesión, en un navegador que permite instalar directamente, cuando
  mira la zona de su cuenta en el encabezado (junto a «Cerrar sesión»), entonces encuentra
  «Instalar app»; al elegirla, el navegador le pide
  confirmar la instalación.
- **CA-13** — Dado un usuario con sesión en un iPhone o iPad, cuando elige «Instalar app», entonces
  ve los pasos para agregarla a la pantalla de inicio (Compartir → «Agregar a inicio»).
- **CA-14** — Dada la app ya instalada y abierta desde su ícono, o un navegador que no permite
  instalarla, cuando el usuario mira la zona de su cuenta, entonces no aparece «Instalar app»,
  ni el aviso de CA-18.
- **CA-18** — Dado un usuario con sesión en un dispositivo donde se puede instalar la app, cuando
  entra, entonces ve un aviso flotante abajo, «Instala Motorismo en este dispositivo», con
  «Instalar» (que hace lo mismo que CA-12, o en iPhone o iPad muestra los pasos de CA-13) y
  «Ahora no». El ícono del encabezado representa un dispositivo, no una descarga.
- **CA-19** — Dado el aviso de instalación, cuando el usuario pulsa «Ahora no», entonces el aviso
  desaparece y no vuelve en ese dispositivo durante 14 días; «Instalar app» sigue en el encabezado.
- **CA-20** — Dado que hay que avisar «Sin conexión» o «Hay una versión nueva», cuando también se
  podría instalar la app, entonces solo se ve el aviso más urgente (sin conexión, luego versión
  nueva); el de instalación espera.

### HU-04 (P3) — Aviso de versión nueva

Como usuario que deja la app abierta mucho tiempo, quiero enterarme cuando hay una versión
nueva y actualizar cuando me convenga, sin perder lo que estoy haciendo.

**Criterios de aceptación**

- **CA-15** — Dado un usuario con la app abierta, cuando se publica una versión nueva, entonces, a
  más tardar al volver a la ventana de la app o en unos minutos, ve un aviso «Hay una versión
  nueva» con un botón «Actualizar».
- **CA-16** — Dado el aviso de versión nueva, cuando el usuario pulsa «Actualizar», entonces la app
  carga la versión nueva y queda en la misma página.
- **CA-17** — Dada una versión nueva, cuando el usuario no pulsa «Actualizar», entonces la app nunca
  se recarga sola, y lo que esté escribiendo sigue ahí.

## Requisitos funcionales

- **RF-01** — La app se identifica con el nombre «Motorismo Detailing», el nombre corto
  «Motorismo», el ícono de la marca y los colores del sistema visual (spec 003).
- **RF-02** — La app instalada abre en su propia ventana y en la página de inicio, que lleva a cada
  persona a lo de su rol (specs 002 y 004).
- **RF-03** — La app detecta la pérdida y la vuelta de la conexión, y bloquea las acciones que
  necesitan la red mientras no la hay.
- **RF-04** — Sin conexión, cualquier página que se abra muestra la página «Sin conexión» de la
  app.
- **RF-05** — La app detecta que hay una versión nueva publicada y lo avisa, sin recargarse sola.

## Reglas de negocio

- **RN-01** — No se opera sin conexión: nada se guarda en el dispositivo para enviarlo después, y
  ninguna acción se ejecuta sin red.
- **RN-02** — La app no guarda en el dispositivo datos de clientes, vehículos ni cuentas para
  mostrarlos sin conexión. Lo único disponible sin red es la página «Sin conexión», igual para
  todos y sin datos de nadie (un equipo compartido nunca muestra lo de otra cuenta). Aparte, solo
  recuerda la fecha en que se pulsó «Ahora no» en el aviso de instalación (CA-19), que no es un
  dato de nadie.
- **RN-03** — La app nunca se recarga sola: actualizar es decisión del usuario.
- **RN-04** — Instalar la app no cambia los permisos: cada persona ve exactamente lo mismo que en el
  navegador según su rol y estado.

## Datos (vista conceptual)

No hay datos nuevos de negocio. Lo único que la app guarda en el dispositivo es lo necesario para
mostrar la página «Sin conexión» (marca y textos), igual para todos, y la fecha del último
«Ahora no» del aviso de instalación (CA-19).

## Requisitos no funcionales

- Accesibilidad: el aviso «Sin conexión», el de versión nueva, la página «Sin conexión» y los pasos
  de instalación en iPhone cumplen WCAG 2.1 AA y se suman a la auditoría automática.
- Dispositivos: celular (desde 360 px de ancho), tablet y escritorio. En pantallas con muesca o
  esquinas redondeadas, el contenido de la app instalada no queda tapado.
- Seguridad y privacidad: RN-02; nada de lo guardado en el dispositivo depende de la sesión.
- Rendimiento: instalar la app no hace más lenta la carga de ninguna página.

## Fuera de alcance

- Trabajar sin conexión (consultar o guardar sin red y sincronizar después).
- Notificaciones push (p. ej. «tu moto está lista»): se decidirán con la confirmación por WhatsApp
  o las reservas.
- Publicar la app en Play Store o App Store.
- Atajos del ícono, compartir hacia la app o abrir enlaces de otras apps dentro de ella.
- Actualizar solo, sin preguntar.

## Suposiciones

- El ícono se hace con el logo monocromo actual, con margen suficiente para los íconos recortados
  en círculo de Android.
- La app se instala desde cualquier página, con o sin sesión (lo ofrece el navegador); la opción
  propia «Instalar app» vive junto a la cuenta en el encabezado, solo con sesión.
- «Sin conexión» es lo que informa el dispositivo, más cualquier envío que falle por falta de red
  (CA-10): un Wi-Fi conectado pero sin internet se detecta al primer envío fallido.
- Mientras no hay conexión, lo que ya estaba en pantalla sigue visible para leerlo (bajo el aviso);
  solo se bloquean las acciones.
- La versión nueva se busca al volver a la ventana de la app y cada pocos minutos mientras está
  abierta (CA-15).

## Preguntas abiertas

Ninguna. Resueltas con el usuario el 2026-11-20: sin modo sin conexión (aviso y bloqueo); aviso de
versión nueva con «Actualizar», sin recarga automática; opción «Instalar app» propia, con pasos en
iPhone; la instalan personal y clientes.

## Checklist de calidad de la spec

- [x] No menciona tecnologías, librerías, tablas ni componentes.
- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba. (CA-04, el agregado en iPhone, se prueba
  revisando lo que la app declara para Safari; la comprobación en un iPhone real queda como prueba
  manual.)
- [x] No quedan marcas `[NECESITA ACLARACIÓN]`.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar.

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-20 | Creación. |
| 2026-11-20 | Aprobada por el usuario. |
| 2026-11-20 | Al planificar: «Instalar app» va junto a la cuenta en el encabezado (no existe un «menú de la cuenta»; solo el avatar y «Cerrar sesión»). |
| 2026-11-20 | Plan aprobado: estado `planificada`. |
| 2026-11-20 | Tareas aprobadas: estado `lista`. |
| 2026-11-20 | Cambio pedido por el usuario durante la implementación: aviso flotante de instalación con «Instalar» y «Ahora no» (CA-18 a CA-20); el ícono del encabezado deja de parecer una descarga. |
| 2026-11-20 | Implementada (bloques A a D y el aviso de instalación). Falta la prueba manual en dispositivos reales tras el despliegue (T055). |
| 2026-11-20 | Verificada: CA-01 a CA-20 cubiertos. Correcciones al verificar: el proxy excluye solo rutas exactas, y una prueba exige `callAction` en todo componente que llama a una Server Action. Queda la prueba manual en dispositivos (T055). |
| 2026-11-20 | Spec 009: en el teléfono, «Instalar app» vive en el menú del avatar (CA-12); en escritorio no cambia. |
| 2026-11-20 | Spec 010: la barra del sistema y la página «Sin conexión» siguen el tema; caché `motorismo-offline-v2`. |
