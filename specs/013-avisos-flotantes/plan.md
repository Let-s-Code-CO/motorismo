---
spec: "013"
estado: aprobado
actualizado: 2026-11-21
---

# Plan técnico — 013 Avisos flotantes de confirmación

## Resumen

Una pieza propia y pequeña en `core`, sin dependencias nuevas:

- **Almacén de avisos:** un módulo con `notify()` y `dismiss()` que se puede llamar desde
  cualquier componente. Guarda como mucho 3 avisos y los expone con `useSyncExternalStore`.
- **Región de avisos:** un componente cliente montado una vez en el layout raíz, así sobrevive a
  la navegación del cliente. Pinta los avisos fijos abajo a la derecha (desde `md`) o abajo a lo
  ancho (teléfono), con dos regiones vivas: `status` para las confirmaciones y `alert` para los
  errores.
- **Migración de pantallas:** las confirmaciones y los errores de acciones sueltas dejan de ser un
  `Alert` dentro de la página y pasan a `notify()`. Los errores de formularios y diálogos no
  cambian (CA-08). Los `?saved=…` de la URL se sustituyen por un aviso «para la pantalla de
  llegada».

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 013 aprobada. |
| II. Qué antes que cómo | ✅ | El almacén, la región y los roles ARIA se deciden aquí. |
| III. Criterios verificables | ✅ | Unitarias del almacén y de la región (reloj falso), de componente para cada pantalla migrada y E2E en escritorio, teléfono, tema oscuro y «reducir movimiento». |
| IV. Ambigüedad explícita | ✅ | Sin preguntas abiertas: el usuario decidió posición, errores y duración. |
| V. Simplicidad y stack | ✅ | Sin librerías: el toast de HeroUI se descarta (ver «Riesgos y decisiones»). Unas 150 líneas propias. |
| VI. Seguridad y datos personales | ✅ | Sin datos: los avisos viven en memoria del navegador y no se guardan. |
| VII. Trazabilidad | ✅ | Rama `feature/013-avisos-flotantes`; cada prueba cita su CA. |
| VIII. Incrementos pequeños | ✅ | HU-01 (la región y las confirmaciones) se despliega sola; HU-02 y HU-03 se apoyan en ella. |

## Base de datos (packages/supabase)

Sin cambios.

## Aplicación (apps/web)

- **Módulo:** `src/modules/core/`. Los avisos son transversales.

### El almacén: `core/lib/toast.lib.ts`

- **Tipos:** `Toast = { id, tone: 'success' | 'danger', text }`.
- **`notify({ tone, text })`:**
  - añade el aviso al final;
  - si ya hay 3, quita el más antiguo (CA-06).
- **`notify({ …, after: path })`:** lo deja pendiente hasta que la ruta sea `path` (CA-05). Solo
  vive en memoria, así que recargar o volver atrás no lo repite.
- **`dismiss(id)`:** cierra un aviso.
- **Suscripción:** `subscribe` y `getSnapshot`, para `useSyncExternalStore`.
- Sin React: se prueba como función pura.

### La región: `core/components/toast-region.component.tsx`

- Se monta en `src/app/layout.tsx`, dentro de los proveedores (necesita los mensajes).
- Lleva `data-react-aria-top-layer`: así un `Modal` abierto no la oculta a los lectores de
  pantalla, como `ConnectionGate`.
- **Pendientes:** con `usePathname`, publica los avisos que esperaban esa ruta (CA-05).
- **Posición** (`fixed`, `z-[60]`, por encima de los modales):
  - teléfono: `inset-x-4 bottom-4`;
  - desde `md`: `right-6 bottom-6 w-96` (CA-02).
  - Los avisos se apilan en columna: el más reciente, abajo.
- **Accesibilidad (CA-10):**
  - Dos contenedores vivos, siempre montados aunque estén vacíos (así anuncian al recibir
    contenido): uno con `aria-live="polite"` para las confirmaciones y otro con
    `aria-live="assertive"` para los errores, los dos con `aria-atomic="false"`. Sin los roles
    `status` y `alert`: vacíos, se confundirían con el estado o la alerta propios de una pantalla.
  - El foco nunca se mueve.
- **Cada aviso:**
  - ícono `lucide` decorativo (`CircleCheck` o `CircleAlert`) y texto;
  - botón solo-icono «Cerrar» (`aria-label`, alcanzable con el teclado; CA-04, CA-11);
  - superficie `bg-content1` con borde y sombra del sistema visual;
  - el tono, en el ícono y en el borde (`success` o `danger`, con su par `dark:`). Se comprueba el
    contraste con axe en los dos temas.
- **Tiempo:**
  - Las confirmaciones se cierran a los 5000 ms (RN-01, CA-03).
  - El reloj se pausa mientras el ratón (`pointerenter`/`pointerleave`) o el foco
    (`focusin`/`focusout`) están sobre el aviso, y sigue con el tiempo que le quedaba.
  - Los errores no tienen reloj (CA-07).
- **Banners de abajo (añadido al implementar):** los de la spec 006 (instalar, versión nueva) también
  van abajo. Con `useBottomBanner`, cada uno publica su altura en `--bottom-banners`, y la región
  sube por encima (`bottom-[calc(1rem+var(--bottom-banners,0px))]`).
- **Movimiento:** entra con `motion-safe:animate-toast-in` (fundido y subida de 4 px, 200 ms). Con
  «reducir movimiento», solo aparece y desaparece (CA-12).

### Mensajes

En `core/messages/es.json`:

- `toast.region`: «Avisos»;
- `toast.close`: «Cerrar».

### Pantallas que se migran

**Confirmaciones → `notify` (CA-01):**

- **Clientes:** creado, desactivado y reactivado.
- **Ficha del cliente:** contacto actualizado y la acción desactivar/reactivar.
- **Mi perfil:** guardado.
- **Vehículos:** sección de vehículos.
- **Servicios y Empleados:** creado, editado, desactivado y reactivado.
- **Órdenes:**
  - «Empezar» en la lista;
  - en el detalle: actualizada, cerrada, anulada y corregida.
- **Reservas:** el detalle (guardada, más tiempo, «No asistió», cancelada, tolerancia).
- **Usuarios:** invitar, cambiar el rol, desactivar o reactivar y reenviar (añadida al migrar: no
  estaba en el inventario).
- **«Horario»:** semana y configuración. Esto deshace el aviso bajo el botón de la spec 012, que
  era la solución provisional.

**Errores de acciones sueltas → `notify({ tone: 'danger' })` (CA-07):**

- Las mismas pantallas, cuando el error viene de un botón que no pertenece a un formulario ni a un
  diálogo: desactivar o reactivar, «Empezar», «+5 min», «No asistió».

**Sin cambios (CA-08):**

- Los `serverError` de los formularios: cliente, vehículo, servicio, empleado, orden, reserva,
  invitación, acceso, registro y contraseña.
- Los errores de los diálogos: cerrar, anular, cancelar, retirar y tolerancia.
- Los errores por campo.
- En «Horario» y en «Mi perfil», el error de guardar sigue dentro, porque son formularios.

**Navegación (CA-05):**

- `reservation-form` y `new-order-screen` hacen `notify({ …, after: destino })` y navegan sin
  `?saved=…`.
- `agenda/[id]` y `orders/[id]` dejan de leer `saved`. El parámetro antiguo se ignora.

**Sin conexión (CA-09):**

- `callAction` devuelve `null` y cada pantalla sale antes de llamar a `notify`. Es lo mismo que
  hoy, y se cubre en las pruebas de componente.

**Lo que no cambia (RN-02):**

- Los estados permanentes: «Viene de la reserva…», «Fuera del horario», «Propuesta…».
- Los avisos de la spec 006: sin conexión, versión nueva e instalar.

## Estrategia de pruebas

La utilidad `renderWithProviders` monta también la región de avisos. Así las pruebas de pantalla
siguen buscando el texto que ve la persona, y además comprueban que sale en la región («Avisos») y
no dentro de la página.

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | componente + e2e | Pruebas de cada pantalla migrada: la confirmación aparece en la región «Avisos», no en la página. `e2e/toasts.spec.ts`: en «Horario», desplazado hasta abajo, guardar la configuración muestra el aviso dentro de la ventana. |
| CA-02 | e2e | `e2e/toasts.spec.ts`: en escritorio, el aviso queda en la esquina inferior derecha (caja dentro de la ventana, pegada a la derecha y abajo); a 360 px, abajo y a lo ancho, sin desplazamiento lateral. Se añade a la prueba «on an iPhone» de `ui.spec.ts`. |
| CA-03 | componente | `toast-region.component.test.tsx` (reloj falso): se cierra a los 5000 ms y no a los 4999; con el ratón o el foco encima no se cierra; al salir, se cierra con el tiempo que quedaba. |
| CA-04 | componente | «Cerrar» lo quita al instante. |
| CA-05 | unit + componente + e2e | `toast.lib.test.ts`: un aviso pendiente no se publica hasta su ruta. Región: aparece al cambiar `usePathname`. E2E: guardar una reserva muestra «Reserva guardada.» en su detalle, y recargar no la repite. |
| CA-06 | unit + componente | El cuarto aviso quita el más antiguo; se ven 3, el más reciente abajo. |
| CA-07 | componente | Una acción suelta que falla (p. ej. desactivar en Servicios) pone el error en la región `alert`, y a los 60 s sigue ahí. |
| CA-08 | componente | Las pruebas de formularios y diálogos siguen encontrando su error dentro (sin cambios), y la región queda vacía. |
| CA-09 | componente | Con `callAction` → `null`, no aparece ningún aviso. |
| CA-10 | componente | La confirmación está en la zona `aria-live="polite"` y el error en la `assertive`; el foco sigue en el botón que se pulsó. |
| CA-11 | componente + e2e | «Cerrar» se alcanza con Tab y tiene nombre accesible. `a11y.spec.ts` audita con un aviso de cada tono a la vista, en claro y oscuro (`chromium-dark`). |
| CA-12 | e2e | Con `reducedMotion: 'reduce'`, la animación del aviso es `none`. |

Cada prueba nueva se ve fallar con una mutación, que se anota en `tasks.md`.

## Archivos afectados

- **Nuevos:**
  - `src/modules/core/lib/toast.lib.ts`;
  - `src/modules/core/components/toast-region.component.tsx`;
  - `__test__/src/modules/core/lib/toast.lib.test.ts`;
  - `__test__/src/modules/core/components/toast-region.component.test.tsx`;
  - `e2e/toasts.spec.ts`.
- **Modificados:**
  - `src/app/layout.tsx`, `src/app/globals.css` (`animate-toast-in`) y `core/messages/es.json`;
  - las ~12 pantallas de «Pantallas que se migran» y sus pruebas;
  - `src/app/(app)/agenda/[id]/page.tsx` y `src/app/(app)/orders/[id]/page.tsx`;
  - `__test__/test-utils/render.tsx`;
  - `e2e/a11y.spec.ts`, `e2e/ui.spec.ts`, y las E2E que buscan las confirmaciones (`?saved=1` en
    `reservations.spec.ts` y `work-orders.spec.ts`);
  - `CLAUDE.md`: estándar de avisos.
- **Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Región propia en `core`. | El toast de HeroUI 2.8 (`addToast`, ya instalado con `@heroui/react`). | Su código fija en inglés el nombre del aviso (`aria-label: "toast"`, que pisa el texto para el lector de pantalla) y el del botón de cerrar («closeButton»); su reloj se pausa con el ratón pero no con el foco del teclado (CA-03), y tiene una sola posición para todos los anchos (CA-02). Corregirlo desde fuera exigiría parches frágiles. |
| Dos regiones vivas (`status` y `alert`) siempre montadas. | Un solo contenedor; `role="alert"` en cada aviso; el `Alert` de HeroUI dentro del aviso. | Las confirmaciones no deben interrumpir y los errores sí (CA-10). Un contenedor vivo creado junto con su texto no siempre se anuncia. El `Alert` de HeroUI ya lleva `role="alert"`, lo que haría inmediatas también las confirmaciones. |
| Los avisos «para la pantalla de llegada» viven en memoria, ligados a la ruta destino. | Seguir con `?saved=1` en la URL; `sessionStorage`. | La URL repite el aviso al recargar y al volver atrás (CA-05 lo prohíbe). La memoria basta porque la navegación es del cliente y la región está en el layout raíz. |
| El aviso se dibuja por encima de los modales (`z-[60]`, `data-react-aria-top-layer`). | Dejarlo debajo. | Una confirmación puede llegar mientras se cierra un diálogo. Sin `top-layer`, `ariaHideOutside` lo ocultaría a los lectores de pantalla. |
| El reloj de 5 s empieza al mostrarse el aviso. | Empezar al crearlo. | Un aviso pendiente de otra ruta no gasta su tiempo mientras se navega (CA-05). |

## Despliegue

Solo la app: no hay migración ni variables nuevas.
