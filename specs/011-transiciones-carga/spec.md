---
id: "011"
titulo: "Transiciones y estados de carga"
estado: implementada
creada: 2026-11-20
actualizada: 2026-11-20
---

# 011 — Transiciones y estados de carga

## Contexto y problema

En el lavadero la señal del celular no siempre es buena. Hoy, al tocar una sección o una orden, la
pantalla anterior se queda quieta hasta que llega la siguiente: con red lenta no se sabe si el
toque funcionó, se vuelve a tocar, y la app se siente lenta o «pegada». Además, los cambios de
pantalla son bruscos, sin la fluidez que se espera de una app instalada en el teléfono.

Se quiere que siempre se vea algo mientras cargan los datos, que se note que la app está
respondiendo, y que moverse por la app se sienta suave, sin estorbar a quien prefiere menos
movimiento.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador y administrador | Saber al instante que su toque funcionó y ver la forma de la pantalla mientras llegan los datos, sobre todo con mala señal. |
| Cliente | Lo mismo en «Mi perfil». |
| Todos | Una app fluida y con identidad, que respete «reducir movimiento». |

## Historias de usuario

### HU-01 (P1) — Esqueletos mientras llegan los datos

Como miembro del personal con mala señal, quiero ver la forma de la pantalla mientras cargan los
datos, para saber que viene en camino y no tocar dos veces.

**Criterios de aceptación**

- **CA-01** — Dada una pantalla que carga datos (inicio, «Órdenes», el detalle de una orden,
  «Nueva orden», «Clientes», la ficha de un cliente, «Servicios», «Empleados», «Usuarios» y «Mi
  perfil»), cuando los datos tardan, entonces se muestra un esqueleto con la forma de esa pantalla
  (título, tarjetas o filas donde irán los datos) en lugar de la pantalla anterior congelada.
- **CA-02** — Dados unos datos que llegan rápido (en menos de unos 300 ms), cuando se abre la
  pantalla, entonces no aparece ningún esqueleto: se pasa directo al contenido, sin parpadeo.
- **CA-03** — Dado un esqueleto a la vista, cuando lo usa un lector de pantalla, entonces se anuncia
  una sola vez que la pantalla está cargando, sin leer las formas vacías; y al llegar el
  contenido, se lee el contenido.
- **CA-04** — Dado un esqueleto, cuando se muestra en claro u oscuro (spec 010), entonces usa los
  colores del tema; con «reducir movimiento» activado, no tiene brillo animado.
- **CA-05** — Dado un esqueleto en el teléfono, cuando llega el contenido, entonces lo reemplaza sin
  saltos bruscos y sin desplazamiento lateral (360 px y iPhone).

### HU-02 (P2) — Señal de que la app está navegando

Como usuario, quiero ver al instante que mi toque hizo algo, para no repetirlo.

**Criterios de aceptación**

- **CA-06** — Dado un enlace o una sección del menú, cuando el usuario la toca y la pantalla
  siguiente tarda, entonces una barra fina bajo el encabezado avanza mientras carga, y se completa
  y desaparece cuando la pantalla nueva está a la vista.
- **CA-07** — Dada una navegación que termina enseguida, cuando se toca, entonces la barra no llega
  a verse (o apenas un instante), sin parpadeos.
- **CA-08** — Dado «reducir movimiento» activado, cuando se navega, entonces la señal sigue
  apareciendo pero sin animación de avance (una barra quieta mientras carga).

### HU-03 (P2) — Transición suave entre pantallas

Como usuario, quiero que el cambio de pantalla sea suave, para que la app se sienta fluida.

**Criterios de aceptación**

- **CA-09** — Dado un cambio de pantalla (entre secciones, a un detalle, de vuelta), cuando aparece
  la pantalla nueva, entonces su contenido entra con un fundido corto y subiendo unos píxeles
  (alrededor de 200 ms); el encabezado y el menú no se animan.
- **CA-10** — Dado «reducir movimiento» activado, cuando cambia la pantalla, entonces aparece sin
  movimiento ni fundido.
- **CA-11** — Dado el gesto o el botón «atrás» del navegador, cuando se vuelve, entonces la
  transición no estorba: la pantalla anterior aparece igual de rápido y en su posición.

### HU-04 (P3) — Un momento de marca al entrar y al salir

Como usuario, quiero que entrar y salir de la app se sienta parte de la marca.

**Criterios de aceptación**

- **CA-12** — Dado un usuario que inicia sesión, cuando su pantalla de inicio todavía está
  cargando, entonces ve el logo de la marca en su anillo plateado con su brillo, centrado, hasta
  que llega el inicio; si el inicio carga enseguida, no se agrega ninguna espera.
- **CA-13** — Dado un usuario que cierra sesión, cuando vuelve al acceso, entonces la pantalla de
  acceso aparece con un fundido.
- **CA-14** — Dado «reducir movimiento» activado, cuando se entra o se sale, entonces el logo se
  muestra quieto (sin brillo ni destellos animados) y no hay fundidos.

## Requisitos funcionales

- **RF-01** — Toda pantalla que carga datos tiene un estado de carga con la forma de su contenido.
- **RF-02** — Toda navegación muestra una señal de progreso si tarda.
- **RF-03** — Las pantallas entran con una transición corta; las animaciones respetan «reducir
  movimiento».

## Reglas de negocio

- **RN-01** — Nada de esto retrasa a propósito: un esqueleto, la barra o el momento de marca solo se
  ven mientras de verdad se espera.
- **RN-02** — Estilo sobrio y monocromo (spec 003): esqueletos y barra en los tonos neutros del tema,
  sin colores nuevos.
- **RN-03** — Todo movimiento se apaga con «reducir movimiento».

## Datos (vista conceptual)

Sin datos nuevos.

## Requisitos no funcionales

- Accesibilidad WCAG 2.1 AA (auditoría automática), también con un esqueleto a la vista, en claro
  y en oscuro.
- Teléfono siempre (360 px e iPhone), sin desplazamiento lateral.
- Las animaciones no deben bajar la fluidez en un teléfono de gama media (solo opacidad y
  desplazamiento).

## Relación con otras specs

- **Spec 003** (sistema visual): amplía sus animaciones (`motion-safe`) con transiciones y
  esqueletos.
- **Spec 009** (experiencia móvil) y **spec 010** (modo oscuro): los esqueletos y la barra siguen
  el encabezado móvil y el tema.

## Fuera de alcance

- Animar elementos sueltos (filas que entran una tras otra, contadores que suben).
- Interfaz optimista (mostrar un cambio antes de que lo confirme el servidor).
- Transiciones dentro de los diálogos o entre pasos de un formulario.
- Funcionar sin conexión (spec 006): sin red sigue el aviso «Sin conexión».

## Suposiciones

- «Tarda» es más de unos 300 ms; por debajo no se muestra el esqueleto (CA-02).
- La transición dura alrededor de 200 ms y solo anima el contenido de la página.
- El esqueleto de cada pantalla se parece a su forma, sin copiarla exactamente (número de filas
  aproximado).
- El momento de marca usa el mismo logo, anillo y brillo del acceso (specs 003 y 009).

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
| 2026-11-20 | Creación. Decisiones del usuario: fundido corto subiendo un poco entre pantallas; un momento de marca al entrar; esqueletos solo si la carga tarda; barra fina de progreso al navegar. |
| 2026-11-20 | Aprobada por el usuario. |
| 2026-11-20 | Plan aprobado: estado `planificada`. |
| 2026-11-20 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-20 | Implementada. La barra termina en cuanto la pantalla nueva aparece (su esqueleto o su contenido); la pestaña tiene su título también mientras carga. |
