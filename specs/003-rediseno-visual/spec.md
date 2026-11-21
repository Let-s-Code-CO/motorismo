---
id: "003"
titulo: "Rediseño visual de la interfaz"
estado: verificada
creada: 2026-11-19
actualizada: 2026-11-19
---

# 003 — Rediseño visual de la interfaz

## Contexto y problema

Las pantallas de la spec 002 funcionan, pero su aspecto es el de una plantilla por defecto. El
negocio quiere una interfaz moderna y sobria, coherente con su marca (logo monocromo), que
transmita confianza y sea cómoda en el computador del mostrador y en el móvil.

## Usuarios y roles

| Rol | Qué necesita |
|---|---|
| Operador y administrador | Pantallas claras, legibles y rápidas de usar, en escritorio y móvil. |

## Historias de usuario

### HU-01 (P1) — Interfaz moderna y coherente sin cambiar el comportamiento

Como usuario, quiero una interfaz moderna, sobria y coherente para trabajar con comodidad.

- **CA-01** — Dado cualquier usuario, cuando usa la app, entonces todo lo que describe la spec 002
  sigue funcionando igual (sus pruebas siguen en verde).
- **CA-02** — Dado un móvil de 360 px de ancho, cuando se abren el acceso, el inicio y la gestión
  de usuarios, entonces no hay desplazamiento horizontal.
- **CA-03** — Dado un escritorio, cuando se abre el acceso, entonces se ve un panel de marca junto
  al formulario; en móvil solo el formulario, con el logo.
- **CA-04** — Dadas las pantallas de acceso, inicio y usuarios, cuando se auditan con una
  herramienta automática de accesibilidad, entonces no hay incumplimientos graves ni críticos
  (incluido el contraste de color).
- **CA-05** — Dado un campo de contraseña, cuando el usuario pulsa «Mostrar contraseña», entonces
  ve lo que escribió, y puede volver a ocultarlo.
- **CA-06** — Dado el menú principal, cuando el usuario está en una sección, entonces esa opción se
  ve marcada como actual.
- **CA-07** — Dada la gestión de usuarios, cuando el administrador la abre, entonces ve cuántos
  usuarios hay activos, invitados y desactivados, y las acciones de cada fila están agrupadas en un
  menú.
- **CA-09** — Dada la gestión de usuarios, cuando el administrador pulsa el resumen de un estado
  (activos, invitados o desactivados), entonces la lista muestra solo ese estado, el resumen elegido
  se ve marcado y aparece una forma visible de volver a ver todos; pulsar otra vez el mismo
  resumen o «Ver todos» quita el filtro. El filtro se conserva al recargar la página.
- **CA-08** — Dado cualquier visitante o usuario, cuando mira el pie de página, entonces encuentra
  un enlace al Instagram del negocio (@motorismodetail) que se abre en una pestaña nueva.

## Fuera de alcance

- Modo oscuro.
- Nuevas funcionalidades o cambios de textos de negocio.

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Creación y aprobación por petición directa del usuario («que la UI se vea muy moderna, sin ser loco»). Base monocroma del logo, confirmada por el usuario. |
| 2026-11-19 | CA-08 (Instagram en el pie de página), a petición del usuario. Estética del panel de marca tomada del perfil de Instagram (plata sobre negro). |
| 2026-11-19 | CA-09 (filtrar usuarios desde el resumen), a petición del usuario. |
| 2026-11-19 | CA-09 implementado (filtro en la URL, «Ver todos» fantasma). El usuario lo fija como estándar para futuras pantallas con tarjetas de resumen (ver `CLAUDE.md`). |
| 2026-11-19 | Implementada. Ajustes pedidos por el usuario: círculo del logo como en Instagram y centrado, «Especialistas en PPF y Detailing» como título, panel de marca más rico (anillo, destellos, servicios). Tabla de usuarios en una columna de datos + acciones para que nada quede oculto en móvil. |
| 2026-11-19 | `/verificar`: CA-01 a CA-09 ✅ (462 unitarias y 69 E2E en verde, lint y tipos OK). CA-07 tenía cubierto el menú de acciones pero no los números de las tarjetas: se añade `users-screen.component.test.tsx` (2 activos, 1 invitado, 1 desactivado), vista fallar por mutación (contar uno de más). Verificada. |
| 2026-11-20 | Spec 009: en teléfono y tablet el acceso lleva una franja de marca arriba (CA-03 queda solo para escritorio). |
| 2026-11-20 | Spec 010: el sistema visual gana su versión oscura (mismas reglas; colores por tokens o con su variante `dark:`). |
| 2026-11-20 | Spec 011: transiciones entre pantallas, esqueletos de carga y barra de progreso, todo con `motion-safe`. |
| 2026-11-20 | Tarjetas de resumen: el hover ilumina en lugar de subir la tarjeta 2 px. En oscuro la sombra no se veía y solo quedaba el salto; ahora se aclaran el fondo y el borde (y las partes de un panel ya no se oscurecen). |
