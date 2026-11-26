---
id: "019"
titulo: "Estilo automotriz premium con acento plata"
estado: verificada
creada: 2026-11-25
actualizada: 2026-11-25
---

# 019 — Estilo automotriz premium con acento plata

## Contexto y problema

La interfaz (specs 003, 009 y 010) es limpia y monocroma, pero se ve «clásica»: tarjetas planas,
títulos comunes y un encabezado de barra. El negocio quiere una imagen más actual, acorde con el
mundo del detailing y del sector tecnológico de hoy, sin perder la sobriedad de la marca.

Se exploraron dos estilos en ramas de prueba. El elegido es el **automotriz premium**: negro
profundo y acabados metálicos, con el acento **Plata**, que repite el anillo plateado del logo.
Esta spec lo convierte en el estilo oficial de toda la app, con la accesibilidad, el modo claro y
el teléfono a la altura del resto.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Todos (personal y clientes) | Una app con imagen moderna y premium, igual de legible y usable que hoy, en claro y en oscuro, en el teléfono y en el escritorio. |

## Historias de usuario

### HU-01 (P1) — Una identidad visual automotriz en toda la app

Como persona que usa la app, quiero una interfaz con aspecto premium y actual, para que transmita la
calidad del servicio del negocio.

**Criterios de aceptación**

- **CA-01** — Dada cualquier pantalla, cuando se muestra, entonces el acento de la interfaz (botón
  principal, sección actual del menú, íconos de las secciones, cifras destacadas) es plata con
  tinta oscura en modo oscuro, y acero oscuro con tinta blanca en modo claro (la plata sobre fondo
  claro no se distingue); sobre una superficie oscura, como el bloque de «Órdenes», es plata en los
  dos modos. Ningún otro color de acento aparece, salvo los de estado y la placa amarilla.
- **CA-02** — Dado el fondo de la app, cuando se muestra, entonces lleva una trama de puntos fina
  que se desvanece hacia abajo, un resplandor suave arriba y un grano apenas visible, quietos.
- **CA-03** — Dado el título principal de una pantalla, cuando se muestra, entonces es grande, de
  letra apretada y con un degradado cromado, y mantiene contraste AA en todo su degradado.
- **CA-04** — Dados números (precios, celulares, contadores, fechas en tablas) y encabezados de
  tabla, cuando se muestran, entonces una cifra sola va en letra monoespaciada y los encabezados en
  mayúsculas espaciadas y monoespaciadas, como un tablero; en una línea que mezcla palabras y cifras
  («2 vehículos», «CC … · Sin celular», una frase con un valor), las cifras van alineadas en la
  letra normal, para que las palabras no se lean como código.
- **CA-05** — Dada una tarjeta, cuando se muestra, entonces tiene bordes finos, esquinas más
  redondeadas que hoy y un canto de luz arriba; cuando el ratón pasa sobre ella, un foco de luz
  sigue al cursor, y si se puede pulsar su borde se ilumina con el acento.
- **CA-06** — Dado el botón principal de una pantalla, cuando se muestra, entonces tiene forma de
  píldora.

### HU-02 (P1) — Encabezado flotante e inicio tipo bento

Como persona del personal, quiero un encabezado y un inicio con más presencia, para orientarme
rápido y ver lo importante de un vistazo.

**Criterios de aceptación**

- **CA-07** — Dada cualquier pantalla con sesión, cuando se muestra, entonces el encabezado es una
  píldora flotante separada de los bordes, translúcida, con la sección actual marcada con el
  acento; en el teléfono conserva sus tres columnas (spec 009).
- **CA-08** — Dado el inicio del personal en escritorio, cuando se muestra, entonces es una
  cuadrícula de cuatro columnas en la que «Órdenes» ocupa un bloque de dos por dos, con las cifras
  «En proceso» y «En cola» en grande y del color del acento, y las demás secciones lo rodean sin
  dejar huecos (el administrador y el operador).
- **CA-09** — Dado el inicio del personal en un teléfono, cuando se muestra, entonces «Órdenes» va
  arriba a todo el ancho con sus cifras grandes y las demás secciones en dos columnas, como hoy
  (spec 009).

### HU-03 (P1) — Modo claro «showroom»

Como persona que prefiere el modo claro, quiero que también se vea renovado, para no quedarme con la
versión anterior.

**Criterios de aceptación**

- **CA-10** — Dado el modo claro, cuando se muestra cualquier pantalla, entonces el fondo es un gris
  claro de exposición con su trama de puntos, las tarjetas son blancas con sombras profundas, los
  títulos llevan el cromado oscuro y el acento sigue CA-01.
- **CA-11** — Dado el modo oscuro, cuando se muestra cualquier pantalla, entonces el fondo es casi
  negro con su trama, las tarjetas son de un gris muy oscuro con su canto de luz, y el acento es
  plata.

### HU-04 (P2) — Placas metálicas

Como persona que ve los vehículos, quiero que la placa se vea como una placa real, para reconocerla
de un vistazo.

**Criterios de aceptación**

- **CA-12** — Dada una placa de vehículo (spec 005, HU-07), cuando se muestra, entonces conserva su
  amarillo y su tinta negra, y además se ve como metal reflectivo: brillo arriba y sombra abajo, una
  veta fina, letras en relieve y un destello quieto. *Enmendado por la spec 023:* el relieve (luz
  arriba, sombra abajo) es del marco, los caracteres y el círculo, dibujados en vectores; la leyenda va
  sin relieve para que se lea.
- **CA-13** — Dada una placa, cuando el ratón pasa sobre ella o sobre la fila o tarjeta que la
  contiene, entonces un destello la cruza una sola vez; si el dispositivo pide reducir el
  movimiento, no la cruza.

## Requisitos funcionales

- **RF-01** — El estilo se aplica a todas las pantallas: acceso, personal y cliente, en claro y en
  oscuro, en escritorio y en teléfono.
- **RF-02** — No queda en la app ningún selector de color: el acento es fijo.
- **RF-03** — Lo que esta spec cambia de las specs 003 (sistema visual), 009 (encabezado e inicio)
  y 010 (colores del modo oscuro) se enmienda en ellas.

## Reglas de negocio

- **RN-01** — Accesibilidad sin rebajas: todo texto, ícono y control cumple WCAG 2.1 AA en claro y
  en oscuro, incluidos los títulos con degradado, las cifras con el acento y el texto sobre el
  acento.
- **RN-02** — Nada se mueve solo y sin fin (WCAG 2.2.2): el fondo, la trama y el grano son quietos;
  el foco de luz solo sigue al cursor y el destello de la placa pasa una vez.
- **RN-03** — Lo único de color, además de los estados y las acciones destructivas, es la placa
  amarilla, que reproduce un objeto real (spec 005).
- **RN-04** — Todo sigue funcionando igual: mismas secciones, textos, botones, rutas y
  comportamiento. Solo cambia el aspecto, y la forma del inicio en escritorio (CA-08).

## Datos (vista conceptual)

No hay datos nuevos.

## Requisitos no funcionales

- **Accesibilidad**: la auditoría automática (WCAG 2.1 AA) pasa en claro y en oscuro en todas las
  pantallas que ya audita.
- **Móvil**: ninguna pantalla se desplaza de lado en 360 px ni en el iPhone de 440 px.
- **Rendimiento**: el fondo y los efectos no hacen más lenta la navegación ni el desplazamiento en
  un teléfono de gama media.

## Fuera de alcance

- Cambiar textos, secciones, flujos o datos.
- Un selector de color o de tema más allá de claro, oscuro y sistema (spec 010).
- El estilo de vidrio y degradados, explorado y descartado.
- Animaciones continuas del fondo.
- Cambiar el logo o la franja y el panel de marca del acceso, más allá de heredar el estilo.

## Suposiciones

- La letra sigue siendo Geist; los números y etiquetas de tablero usan su versión monoespaciada.
- Los colores de estado (éxito, aviso, error) y los botones destructivos no cambian (specs 003 y 007).
- El área del cliente hereda el estilo; su inicio (`/my`) conserva su forma (spec 014), sin bento.
- El selector de acento y las ramas de exploración quedan fuera del producto y se descartan.

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
| 2026-11-25 | Creación, a partir de la exploración visual en la rama `explore/automotriz`. Decisión del usuario y del responsable del proyecto: estilo automotriz premium con acento Plata. |
| 2026-11-25 | Aclaración del usuario, tras verlo en el navegador: en modo claro el acento es acero oscuro (CA-01). |
| 2026-11-25 | Aprobada por el usuario. |
| 2026-11-25 | Plan aprobado: estado `planificada`. |
| 2026-11-25 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-25 | Verificada. Enmienda de CA-04 (cifra sola en mono; en una línea mixta, cifras alineadas en la letra normal), tal como se decidió en la implementación. `style.spec.ts` se completó: la trama, el resplandor y el grano del fondo (CA-02); el tamaño y el espaciado de los títulos y el área del cliente (CA-03); el foco de luz pintado donde está el puntero y el canto de luz (CA-05); el encabezado translúcido (CA-07); el destello al pasar por la fila de la placa (CA-13). Cada comprobación se vio fallar con una mutación. |
| 2026-11-25 | Implementada. La regresión completa (E2E en claro y oscuro, axe, teléfono, capturas de 30 pantallas en 1280, 360 y 440 px) llevó a tres ajustes, dentro de lo especificado: texto secundario del claro más oscuro (RN-01: zinc-500 no daba AA sobre el gris de exposición), la mono solo en cifras solas (las líneas que mezclan palabras y la placa conservan Geist con cifras alineadas, CA-04 y CA-12) y «Reintentar» de «Sin conexión» en píldora (CA-06). |
| 2026-11-25 | Enmendada por la spec 023 (CA-12): la placa es un dibujo vectorial de la norma; el relieve pasa del sombreado del texto a un filtro sobre marco, caracteres y círculo. |
