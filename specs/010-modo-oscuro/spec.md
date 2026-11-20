---
id: "010"
titulo: "Modo oscuro"
estado: implementada
creada: 2026-11-20
actualizada: 2026-11-20
---

# 010 — Modo oscuro

## Contexto y problema

La app solo tiene tema claro. El personal la usa en el celular, muchas veces de noche o en el
lavadero con poca luz, y la mayoría de los teléfonos ya están en modo oscuro: la app «encandila»
y se siente ajena al resto del dispositivo. La marca (logo plateado sobre negro) además luce
especialmente bien en oscuro.

Se quiere que la app siga el tema del dispositivo por defecto y que cada quien pueda fijarlo en
claro u oscuro, sin perder legibilidad, contraste ni la identidad de la marca.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador y administrador | Usar la app cómoda de noche o con poca luz, y elegir el tema que prefieran en cada dispositivo. |
| Cliente | Lo mismo en «Mi perfil» y en el acceso. |
| Visitante | Un acceso (iniciar sesión, registro) que respete el tema de su teléfono. |

## Historias de usuario

### HU-01 (P1) — La app sigue el tema del dispositivo

Como usuario con el teléfono en modo oscuro, quiero que la app se vea en oscuro sin hacer nada,
para que no me encandile y se sienta parte de mi dispositivo.

**Criterios de aceptación**

- **CA-01** — Dado un dispositivo en modo oscuro y ninguna elección guardada («Sistema»), cuando
  se abre cualquier pantalla (acceso, inicio, listados, fichas, órdenes, diálogos), entonces se ve
  en oscuro desde el primer momento, sin un destello claro al cargar; y en claro si el dispositivo
  está en claro.
- **CA-02** — Dado «Sistema» y la app abierta, cuando el usuario cambia el tema del dispositivo,
  entonces la app cambia al momento, sin recargar ni perder lo que estaba escribiendo.
- **CA-03** — Dado cualquiera de los dos temas, cuando se audita la accesibilidad de las pantallas
  (también con errores de formulario a la vista y con diálogos y menús abiertos), entonces cumplen
  WCAG 2.1 AA, incluido el contraste de textos, campos, bordes de enfoque y botones.
- **CA-04** — Dado el tema oscuro, cuando se muestra una placa, entonces se ve igual que en claro:
  amarilla con letras negras, como la placa colombiana.
- **CA-05** — Dado el tema oscuro, cuando se muestran estados y acciones (en cola, en proceso,
  cerrada, anulada, errores, avisos, botones de peligro como «Desactivar cliente» o «Anular
  orden»), entonces se distinguen entre sí igual que en claro y cumplen el contraste AA.
- **CA-06** — Dado el tema oscuro, cuando se muestran los elementos de marca (panel y franja de
  marca del acceso, la tarjeta «Órdenes» del inicio, el logo), entonces conservan su aspecto y se
  distinguen del fondo de la página (no se funden con él).
- **CA-07** — Dado el tema oscuro, cuando la app está instalada o abierta en el navegador del
  teléfono, entonces la barra del sistema acompaña el tema (oscura en oscuro, clara en claro).
- **CA-08** — Dado un dispositivo sin conexión, cuando se muestra la página «Sin conexión»
  (spec 006), entonces sigue el tema del dispositivo.

### HU-02 (P1) — Elegir el tema

Como usuario, quiero fijar el tema en claro, oscuro o dejarlo en «Sistema», para usar la app como
prefiero en cada dispositivo.

**Criterios de aceptación**

- **CA-09** — Dado un teléfono con sesión, cuando el usuario abre el menú de su cuenta, entonces
  encuentra «Tema» con tres opciones con ícono —Claro (sol), Oscuro (luna) y Sistema (pantalla)—,
  la actual marcada; al elegir una, la app cambia al instante.
- **CA-10** — Dado un escritorio con sesión, cuando el usuario mira el encabezado, entonces hay un
  botón de tema cuyo ícono es el tema elegido (sol, luna o pantalla) y cuyo nombre lo dice
  («Tema: Sistema»); al pulsarlo se abren las tres opciones con su ícono, la actual marcada; al
  elegir una, la app cambia al instante.
- **CA-11** — Dado un tema elegido en un dispositivo, cuando el usuario recarga, cierra sesión,
  vuelve otro día o abre el acceso sin sesión, entonces la app sigue en ese tema en ese
  dispositivo; en otro dispositivo, cada uno guarda el suyo.
- **CA-12** — Dado un dispositivo donde nunca se eligió, cuando se abre la app, entonces el tema es
  «Sistema».
- **CA-13** — Dado el selector de tema (teléfono o escritorio), cuando se usa solo con el teclado o
  con un lector de pantalla, entonces se puede abrir, recorrer y elegir, y se anuncia cuál está
  elegido.

## Requisitos funcionales

- **RF-01** — Dos temas, claro y oscuro, en todas las pantallas, con «Sistema» (seguir al
  dispositivo) por defecto.
- **RF-02** — El tema se elige en el menú de la cuenta (teléfono) y en un menú propio del
  encabezado (escritorio), y se recuerda por dispositivo.
- **RF-03** — Ninguna pantalla muestra un tema distinto al que corresponde mientras carga.

## Reglas de negocio

- **RN-01** — El sistema visual sigue siendo monocromo (spec 003): en oscuro, base casi negra con
  textos claros; los colores semánticos solo para estados y acciones destructivas; la placa
  amarilla es la única excepción y no cambia con el tema.
- **RN-02** — La elección del tema es del dispositivo, no de la cuenta: no se guarda en la base de
  datos ni viaja con el usuario.
- **RN-03** — Todo contraste de texto y de elementos interactivos cumple AA en los dos temas.

## Datos (vista conceptual)

Sin datos nuevos en el servidor. La preferencia (Claro, Oscuro o Sistema) vive en el dispositivo.

## Requisitos no funcionales

- Accesibilidad WCAG 2.1 AA en los dos temas (auditoría automática de todas las pantallas
  auditadas hoy, en claro y en oscuro).
- Teléfono siempre: el selector y las pantallas en oscuro se revisan en 360 px y en iPhone.
- Sin parpadeo de tema al cargar ni al navegar.

## Relación con otras specs

- **Spec 003** (sistema visual): se amplía con su versión oscura; sus reglas (monocromo, radios,
  sombras suaves, `danger` con contraste AA) valen en los dos temas.
- **Spec 006** (app instalable): la barra del sistema y la página «Sin conexión» siguen el tema.
- **Spec 009** (experiencia móvil): el menú de la cuenta gana «Tema»; el encabezado de escritorio,
  el botón de tema.

## Fuera de alcance

- Guardar el tema con la cuenta (sincronizarlo entre dispositivos).
- Programar el tema por horario, o temas de color personalizados.
- Los correos (invitación, confirmación, recuperación): siguen como están.
- Un selector de tema en las pantallas de acceso (siguen la elección guardada o el sistema).
- Transiciones animadas al cambiar de tema (van con la spec de transiciones).

## Suposiciones

- En oscuro, el panel y la franja de marca siguen negros con su brillo plateado y se separan del
  fondo con un borde. La tarjeta «Órdenes» destaca por relieve: un degradado carbón un poco más
  claro que el resto, borde plateado y un resplandor suave (nunca clara: encandilaría).
- El logo (plateado sobre negro) se usa igual en los dos temas.
- El ícono de la app instalada no cambia con el tema.

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
| 2026-11-20 | Creación. Decisiones del usuario: en el teléfono, «Tema» en el menú de la cuenta; en escritorio, un menú propio cuyo ícono es el tema elegido; se recuerda por dispositivo; tres opciones con ícono (Claro, Oscuro, Sistema). |
| 2026-11-20 | Aprobada por el usuario. |
| 2026-11-20 | Plan aprobado: estado `planificada`. |
| 2026-11-20 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-20 | Ajustes pedidos por el usuario durante la implementación: «Órdenes» en oscuro destaca por relieve (degradado carbón, borde plateado, resplandor), no por ser clara. La auditoría en oscuro ajustó el rojo de error y los botones destructivos. |
| 2026-11-20 | Implementada. |
