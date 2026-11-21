---
id: "013"
titulo: "Avisos flotantes de confirmación"
estado: planificada
creada: 2026-11-21
actualizada: 2026-11-21
---

# 013 — Avisos flotantes de confirmación

## Contexto y problema

Cuando alguien guarda algo, la app confirma con un aviso que aparece **en un lugar fijo de la
pantalla**, casi siempre arriba, bajo el título. Si el botón estaba abajo (al final de un formulario
largo, de una lista o de «Horario»), el aviso aparece fuera de la vista: la persona no sabe si se
guardó, o descubre un error solo al volver arriba. Le pasó al administrador al guardar los puestos
por franja (spec 012).

Además, cada pantalla dibuja su aviso a su manera y en su propio sitio, y algunos se quedan para
siempre en la pantalla hasta que se recarga.

Se quiere un único tipo de aviso para los resultados de lo que la persona acaba de hacer: un mensaje
**flotante, siempre a la vista**, abajo a la derecha en escritorio, que se va solo cuando es una
confirmación.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador y administrador | Saber, sin buscar, que lo que guardaron quedó guardado, o que no y por qué. |
| Cliente | Lo mismo en «Mi perfil» y en sus vehículos. |

## Historias de usuario

### HU-01 (P1) — Confirmaciones siempre a la vista

Como miembro del personal o cliente, quiero que la confirmación de lo que acabo de guardar aparezca
donde la vea, sin importar dónde estaba el botón, para no dudar de si se guardó.

**Criterios de aceptación**

- **CA-01** — Dada una pantalla con un resultado correcto (guardar, crear, editar, desactivar,
  reactivar, cerrar, anular o corregir una orden, empezar una orden, guardar una reserva, la semana
  o la configuración de la agenda, el perfil, un vehículo…), cuando la acción termina bien, entonces
  la confirmación aparece como un aviso flotante con su texto de siempre («Configuración guardada.»),
  a la vista aunque la página esté desplazada, y no como un aviso dentro de la página.
- **CA-02** — Dado un aviso flotante en una pantalla de escritorio (ancho de tableta horizontal o
  mayor), entonces aparece en la esquina inferior derecha, sin tapar el contenido de forma permanente.
  En un teléfono, aparece abajo, a lo ancho de la pantalla con su margen, sin provocar desplazamiento
  lateral.
- **CA-03** — Dada una confirmación, cuando pasan 5 segundos, entonces se cierra sola. Mientras el
  ratón o el foco del teclado estén sobre ella, no se cierra; al salir, vuelve a contar.
- **CA-04** — Dado cualquier aviso flotante, cuando la persona pulsa su botón «Cerrar», entonces
  desaparece al instante.
- **CA-05** — Dada una acción que termina llevando a otra pantalla (p. ej. guardar una reserva
  nueva abre su detalle), cuando se llega, entonces la confirmación aparece en la pantalla de
  llegada, una sola vez: recargar la página o volver atrás no la repite.
- **CA-06** — Dadas varias confirmaciones seguidas, cuando aparecen, entonces se apilan (la más
  reciente, más cerca del borde inferior), con un máximo de 3 a la vez: la más antigua se va cuando
  llega la cuarta.

### HU-02 (P1) — Errores de una acción suelta, a la vista hasta cerrarlos

Como miembro del personal, quiero que el error de una acción que no está dentro de un formulario
(desactivar, guardar la semana, empezar una orden) aparezca donde lo vea y se quede hasta que lo lea,
para no perderlo.

**Criterios de aceptación**

- **CA-07** — Dada una acción suelta de una pantalla (un botón que no pertenece a un formulario ni a
  un diálogo), cuando falla, entonces el error aparece como aviso flotante con su texto de siempre,
  diferenciado de una confirmación (color e ícono de error), y **no se cierra solo**: se queda hasta
  que la persona pulsa «Cerrar».
- **CA-08** — Dado un formulario o un diálogo (crear un cliente, editar una orden, cancelar una
  reserva, iniciar sesión…), cuando el guardado falla, entonces el error sigue apareciendo dentro de
  él, junto a su botón, como hoy: la persona tiene que corregir algo ahí. Los errores de cada campo
  tampoco cambian.
- **CA-09** — Dada una acción que no llega al servidor por falta de conexión (spec 006), entonces no
  aparece ningún aviso flotante: habla el aviso de «Sin conexión» de toda la app.

### HU-03 (P2) — Avisos accesibles y en ambos temas

Como persona que usa lector de pantalla, teclado o modo oscuro, quiero recibir los mismos avisos,
para saber igual que los demás qué pasó.

**Criterios de aceptación**

- **CA-10** — Dado un aviso flotante, cuando aparece, entonces el lector de pantalla lo anuncia una
  vez (una confirmación sin interrumpir lo que esté leyendo; un error, de inmediato), y el foco se
  queda donde estaba: el aviso nunca se lo roba.
- **CA-11** — Dado un aviso flotante, entonces su botón «Cerrar» se alcanza con el teclado y tiene
  nombre accesible, y el aviso cumple WCAG 2.1 AA (contraste) en tema claro y oscuro: la auditoría
  automática de accesibilidad pasa con un aviso a la vista en los dos temas.
- **CA-12** — Dada la preferencia «reducir movimiento», cuando un aviso aparece o se va, entonces lo
  hace sin desplazarse (solo aparece y desaparece).

## Requisitos funcionales

- **RF-01** — Un solo tipo de aviso flotante para toda la app, con dos tonos: confirmación y error.
- **RF-02** — Todas las confirmaciones de resultado que hoy se muestran dentro de una pantalla pasan
  a ser avisos flotantes (CA-01), incluidas las que se muestran al llegar a otra pantalla (CA-05).
- **RF-03** — Los errores de acciones sueltas pasan a ser avisos flotantes que no se cierran solos
  (CA-07); los de formularios y diálogos no cambian (CA-08).

## Reglas de negocio

- **RN-01** — Una confirmación se cierra sola a los 5 segundos (en pausa mientras se señala o tiene
  el foco); un error nunca se cierra solo.
- **RN-02** — Un aviso informa del resultado de lo que la persona acaba de hacer en este
  dispositivo; los estados permanentes de una pantalla («Fuera del horario», «Semana sin
  habilitar», «Viene de la reserva…») no son avisos flotantes y se quedan donde están.

## Datos (vista conceptual)

No guarda datos. Una confirmación que debe verse al llegar a otra pantalla (CA-05) viaja con esa
navegación y se consume al mostrarse.

## Requisitos no funcionales

- **Móvil siempre:** revisado en 360 px y en iPhone de 440 px táctil, sin desplazamiento lateral.
- **Accesibilidad:** WCAG 2.1 AA (CA-10, CA-11); el aviso no tapa para siempre ningún botón: se
  puede cerrar y las confirmaciones se van solas.
- **Temas:** claro y oscuro (spec 010), con los colores del sistema visual (spec 003): nada de
  colores llamativos fuera de los estados.

## Fuera de alcance

- Los avisos de la app instalable y de la conexión (spec 006): «Sin conexión», «Hay una versión
  nueva» e «Instalar app» se quedan como están.
- Notificaciones de cosas que hicieron otras personas (p. ej. «Llegó una reserva»): la pantalla ya se
  actualiza sola (spec 012, HU-06); avisar de ellas sería otra funcionalidad.
- Deshacer desde el aviso («Desactivado. Deshacer»).
- Notificaciones del sistema operativo o correos.

## Suposiciones

- 5 segundos bastan para leer una frase corta (decidido por el usuario); el aviso tiene «Cerrar»
  para irse antes.
- En el teléfono el aviso va abajo, a lo ancho, porque ahí lo ve el pulgar y no tapa el encabezado
  (el usuario dejó el teléfono a criterio; abajo a la derecha es solo para escritorio).
- El aviso de error de una acción suelta usa el mismo texto que hoy muestra la pantalla.
- Si llega una confirmación igual a otra que sigue a la vista (pulsar dos veces), se muestra de nuevo
  como una más de la pila (CA-06); no se intenta fusionarlas.

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
| 2026-11-21 | Creación, a partir del aviso de «Horario» que quedó fuera de la vista (spec 012). Decisiones del usuario: abajo a la derecha en escritorio; errores mixtos (flotantes solo los de acciones sueltas, sin cerrarse solos; los de formularios y diálogos se quedan dentro); confirmaciones de 5 segundos. |
| 2026-11-21 | Aprobada por el usuario. |
| 2026-11-21 | Plan aprobado: estado `planificada`. |
