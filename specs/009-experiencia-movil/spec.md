---
id: "009"
titulo: "Experiencia móvil"
estado: implementada
creada: 2026-11-20
actualizada: 2026-11-20
---

# 009 — Experiencia móvil

## Contexto y problema

El personal usa la app sobre todo desde el celular, en el lavadero. Hoy, en el teléfono, la app
es la versión de escritorio «acomodada»:

- el encabezado pone el logo a la izquierda, junto a un botón «Menú», y a la derecha el avatar,
  «Instalar app» y «Cerrar sesión»: muchos elementos pequeños, sin un orden claro;
- el inicio del personal apila tarjetas grandes con texto, una debajo de otra: hay que desplazar
  para encontrar una sección, y no se siente como el menú de una app;
- el acceso (iniciar sesión, registro…) muestra en escritorio un panel de marca (logo con anillo
  plateado, destellos, brillo en movimiento, «Especialistas en PPF y Detailing») que en el
  teléfono desaparece: queda un formulario plano.

El negocio quiere que en el teléfono la app se sienta **hecha para el teléfono**: ordenada,
llamativa y con su marca, sin sacrificar lo rápido que es usarla.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador | Llegar a «Órdenes» y a las demás secciones con un toque, y ver de un vistazo qué hay en el lavadero. |
| Administrador | Lo mismo, más sus secciones («Usuarios»). |
| Cliente | Un encabezado claro y un acceso con la marca del negocio. |
| Visitante | Un acceso (iniciar sesión, registro) que transmita la marca también en el celular. |

## Historias de usuario

### HU-01 (P1) — Encabezado de app móvil

Como miembro del personal en el celular, quiero un encabezado como el de una app (menú a la
izquierda, logo al centro, mi cuenta a la derecha), para ubicarme y moverme sin buscar.

**Criterios de aceptación**

- **CA-01** — Dado un usuario con sesión en un teléfono, cuando mira el encabezado, entonces ve
  solo tres cosas: el botón «Menú» a la izquierda, el logo al centro (que lleva al inicio) y su
  avatar a la derecha; en 360 px de ancho nada se corta ni desplaza la página hacia los lados.
- **CA-02** — Dado ese encabezado, cuando el usuario pulsa «Menú», entonces se abre un panel desde
  la izquierda con el logo y las secciones que su rol puede ver, cada una con su ícono (el
  administrador ve «Usuarios»; el operador no; un cliente ve «Mi perfil»), con la actual marcada;
  al elegir una, va a ella y el panel se cierra.
- **CA-03** — Dado el panel abierto, cuando el usuario toca fuera de él, pulsa «Cerrar» o la tecla
  Escape, entonces se cierra y el foco vuelve a «Menú»; mientras está abierto, un lector de
  pantalla lo anuncia como un panel de navegación y no lee lo que hay detrás.
- **CA-04** — Dado el encabezado del teléfono, cuando el usuario pulsa su avatar, entonces se abre
  el menú de su cuenta, encabezado por su nombre y su rol (o «Cliente»), con «Instalar app» cuando
  la app se puede instalar en ese dispositivo (spec 006, CA-12 a CA-14) y «Cerrar sesión». El
  botón del avatar se anuncia con las iniciales que muestra («CD, tu cuenta») o «Tu cuenta» si hay
  foto.
- **CA-05** — Dado un escritorio, cuando el usuario mira el encabezado, entonces se ve como hoy:
  logo con el nombre a la izquierda, las secciones en línea, y su nombre, rol, «Instalar app» y
  «Cerrar sesión» a la derecha.

### HU-02 (P1) — Inicio como menú de app

Como miembro del personal en el celular, quiero que el inicio sea un menú de íconos grandes, con
lo que hay en el lavadero a la vista, para entrar a cualquier sección con un toque.

**Criterios de aceptación**

- **CA-06** — Dado un miembro del personal en un teléfono, cuando abre el inicio, entonces
  «Órdenes» va primero, a todo el ancho y oscura como el panel de marca; las demás secciones siguen
  como mosaicos iguales en dos columnas, cada uno con un ícono negro y el nombre corto del menú
  («Usuarios»), sin el texto de descripción, y si una queda sola en la última fila ocupa la fila
  entera; todo el mosaico se puede tocar; el conjunto queda centrado verticalmente en la pantalla;
  solo aparecen las secciones de su rol («Usuarios», solo el administrador).
- **CA-07** — Dado el inicio del personal (en teléfono y en escritorio), cuando se muestra
  «Órdenes», entonces dice cuántas órdenes hay **en proceso** y cuántas **en cola** al cargar la
  página, en números grandes (p. ej. «2 · En proceso» y «1 · En cola»); si no hay ninguna abierta,
  «Sin órdenes abiertas».
- **CA-08** — Dado el inicio en un teléfono, cuando se muestra, entonces no aparece la tarjeta
  «Próximamente» (es información, no una sección a la que ir).
- **CA-09** — Dado un escritorio, cuando el personal abre el inicio, entonces ve las tarjetas como
  hoy (ícono, nombre y descripción, del mismo tamaño); «Órdenes», oscura y con los números de CA-07.

### HU-03 (P2) — La marca en el acceso desde el celular

Como visitante en el celular, quiero ver la marca del negocio al iniciar sesión o registrarme,
para reconocerlo y confiar, sin que me estorbe para entrar.

**Criterios de aceptación**

- **CA-10** — Dado un teléfono o una tablet, cuando se abre cualquier pantalla de acceso (iniciar
  sesión, registro, recuperar contraseña, nueva contraseña, confirmar el correo), entonces arriba
  hay una franja oscura de marca con el logo en su anillo plateado, destellos, el brillo en
  movimiento y «Especialistas en PPF y Detailing», y el formulario debajo.
- **CA-11** — Dado un teléfono de 390 × 844 (iPhone), cuando se abre «Iniciar sesión», entonces el
  botón «Entrar» se ve sin desplazar; en 360 px de ancho nada desplaza la página hacia los lados.
- **CA-12** — Dado un dispositivo con «reducir movimiento» activado, cuando se abre el acceso,
  entonces la franja no se anima; en cualquier caso, los adornos son decorativos (un lector de
  pantalla no los lee) y el nombre del negocio se anuncia una sola vez.
- **CA-13** — Dado un escritorio, cuando se abre el acceso, entonces se ve como hoy: el panel de
  marca al lado del formulario, sin la franja.

## Requisitos funcionales

- **RF-01** — En el teléfono, el menú principal es un panel lateral que abre el botón «Menú»; en
  escritorio, las secciones siguen en línea en el encabezado.
- **RF-02** — En el teléfono, la cuenta (nombre, rol, «Instalar app», «Cerrar sesión») vive en el
  menú del avatar.
- **RF-03** — El inicio del personal resume las órdenes abiertas: en proceso y en cola (spec 008).
- **RF-04** — El acceso muestra la marca en todos los tamaños: panel lateral en escritorio, franja
  superior en teléfono y tablet.

## Reglas de negocio

- **RN-01** — Las secciones del panel y del inicio son exactamente las que el rol puede ver
  (spec 002, CA-07; spec 004; spec 007, CA-19): el panel no muestra nada que el rol no pueda abrir.
- **RN-02** — El estilo sigue siendo monocromo (spec 003): los íconos «llamativos» lo son por
  tamaño, contraste y el brillo plateado de la marca, no por colores nuevos.
- **RN-03** — En proceso = abierta y empezada; en cola = abierta sin empezar (spec 008, RN-12).

## Datos (vista conceptual)

Sin datos nuevos. El resumen de «Órdenes» cuenta las órdenes abiertas de la spec 008.

## Requisitos no funcionales

- Accesibilidad WCAG 2.1 AA (auditoría automática), también con el panel y el menú de la cuenta
  abiertos.
- Táctil: todo lo que se toca en el teléfono mide al menos 44 × 44 px.
- Toda pantalla cambiada se revisa en 360 px y en un iPhone (440 px y 390 × 844) sin
  desplazamiento lateral; el movimiento respeta «reducir movimiento».

## Relación con otras specs

- **Spec 003, CA-03**: en el teléfono, el acceso ya no es «solo el formulario, con el logo»: lleva
  la franja de marca (CA-10). En escritorio no cambia.
- **Spec 007** (menú «Menú» por debajo de cierto ancho): el desplegable pasa a ser un panel lateral
  (CA-02).
- **Spec 006, CA-12**: en el teléfono, «Instalar app» sigue en la zona de la cuenta, ahora dentro
  del menú del avatar (CA-04). El aviso flotante de instalación no cambia.

## Fuera de alcance

- Una barra de pestañas fija abajo (tipo app nativa).
- Menú lateral en escritorio (sigue en el backlog: «Navegación principal»).
- Colores por sección, modo oscuro.
- Rediseñar «Mi perfil» del cliente o las demás pantallas: solo encabezado, inicio y acceso.
- Gestos (deslizar para abrir el menú).

## Suposiciones

- «Teléfono» es el mismo ancho en el que hoy el menú se recoge en «Menú» (spec 007); la franja de
  marca del acceso aparece en todo tamaño donde hoy no se ve el panel lateral (teléfono y tablet).
- El cliente también tiene el panel, con «Mi perfil», para que el encabezado sea igual para todos.
- El resumen de «Órdenes» se calcula al cargar el inicio; no se actualiza solo mientras se mira.
- En la franja del acceso no van las cuatro tarjetas de servicios del panel de escritorio (PPF,
  cerámico, pulido, lavado): ocuparían la pantalla y empujarían el formulario.
- La tarjeta «Próximamente» sigue en escritorio.

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
| 2026-11-20 | Creación. Decisiones del usuario: franja de marca arriba en el acceso; inicio en cuadrícula de íconos con el resumen de «Órdenes»; íconos monocromos de marca; panel lateral y solo el avatar a la derecha. |
| 2026-11-20 | Aprobada por el usuario. |
| 2026-11-20 | Plan aprobado: estado `planificada`. |
| 2026-11-20 | Tareas aprobadas: estado `lista`. |
| 2026-11-20 | Ajustes pedidos por el usuario durante la implementación: la franja del acceso crece con la pantalla y el formulario queda centrado (CA-10, CA-11); en el inicio, «Órdenes» primero, a todo el ancho y oscura con los números en grande, también en escritorio (CA-06, CA-07, CA-09); los mosaicos con el nombre corto y el inicio centrado en el teléfono (CA-06). Accesibilidad: el nombre y el rol encabezan el menú de la cuenta como texto, y el botón del avatar se anuncia con sus iniciales (CA-04; WCAG 2.5.3). |
| 2026-11-20 | Implementada. |
