---
id: "002"
titulo: "Autenticación y roles"
estado: implementada
creada: 2026-11-19
actualizada: 2026-11-19
---

# 002 — Autenticación y roles

## Contexto y problema

La app guarda datos personales de clientes y, más adelante, información económica (valores de
servicios, liquidaciones de empleados). Hoy no tiene acceso con sesión: cualquiera con la URL
vería la portada, y cuando existan las pantallas de negocio cualquiera podría ver o cambiar datos.

El negocio necesita que solo entren personas autorizadas por el dueño, y que cada una vea y haga
solo lo que le corresponde: el operador atiende el mostrador y el administrador además consulta
reportes y gestiona quién tiene acceso. En la versión anterior el rol se guardaba de forma que
cualquier usuario podía alterarlo y no protegía nada; esta vez los permisos deben cumplirse de
verdad, no solo ocultando opciones en pantalla.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador | Entrar con su cuenta para registrar clientes y órdenes; recuperar su contraseña si la olvida. |
| Administrador | Todo lo del operador, más dar de alta, cambiar de rol y desactivar cuentas. |
| Empleado (no usuario) | No inicia sesión. Solo aparecerá en catálogos de otras specs. |

## Historias de usuario

### HU-01 (P1) — Iniciar y cerrar sesión

Como operador o administrador, quiero entrar con mi correo y contraseña y salir cuando termine,
para que nadie más use la app en mi nombre.

**Criterios de aceptación**

- **CA-01** — Dado un usuario activo, cuando introduce su correo y contraseña correctos, entonces
  entra a la página de inicio y ve su nombre y su rol.
- **CA-02** — Dado cualquier visitante, cuando introduce un correo inexistente o una contraseña
  incorrecta, entonces sigue en la pantalla de inicio de sesión y ve el mismo mensaje en ambos
  casos: «Correo o contraseña incorrectos.» (no revela si el correo está registrado).
- **CA-03** — Dado un visitante sin sesión, cuando abre cualquier página interna, entonces es
  llevado al inicio de sesión y, tras entrar, vuelve a la página que había pedido.
- **CA-04** — Dado un usuario con sesión, cuando cierra sesión, entonces vuelve al inicio de
  sesión y no puede ver páginas internas aunque use «atrás» en el navegador o abra su URL.
- **CA-05** — Dado un usuario con sesión, cuando abre la pantalla de inicio de sesión, entonces es
  llevado a la página de inicio.
- **CA-06** — Dado un usuario cuya cuenta está desactivada, cuando introduce sus credenciales
  correctas, entonces no entra y ve «Tu cuenta está desactivada. Contacta al administrador.».

### HU-02 (P1) — Permisos según el rol

Como dueño del negocio, quiero que cada persona solo pueda ver y hacer lo que corresponde a su rol,
para proteger los datos de clientes y la información económica.

**Criterios de aceptación**

- **CA-07** — Dado un operador con sesión, cuando mira las opciones disponibles, entonces no ve
  ninguna reservada al administrador (en esta spec: la gestión de usuarios).
- **CA-08** — Dado un operador con sesión, cuando abre directamente la URL de una página reservada
  al administrador, entonces ve «No tienes permiso para ver esta página.» y un enlace al inicio.
- **CA-09** — Dado un operador, cuando intenta leer o modificar información reservada al
  administrador por cualquier vía distinta de la interfaz (por ejemplo, peticiones directas con su
  sesión), entonces el sistema lo rechaza y no entrega ni cambia ningún dato.
- **CA-10** — Dado cualquier usuario, cuando intenta cambiar su propio rol o su estado por
  cualquier vía, entonces el sistema lo rechaza.

### HU-03 (P1) — Dar de alta usuarios

Como administrador, quiero invitar a una persona indicando su nombre, correo y rol, para que pueda
crear su contraseña y empezar a usar la app sin que yo la conozca.

**Criterios de aceptación**

- **CA-11** — Dado un administrador, cuando invita a una persona con nombre, correo y rol válidos,
  entonces esa persona aparece en la lista de usuarios con estado «Invitado» y recibe un correo en
  español con un enlace para crear su contraseña.
- **CA-12** — Dado un administrador, cuando invita con un correo que ya pertenece a otro usuario,
  entonces la invitación no se crea y ve «Ya existe un usuario con este correo.».
- **CA-13** — Dado un administrador, cuando envía el formulario de invitación con el nombre vacío,
  un correo con formato inválido o sin rol, entonces ve el error junto a cada campo y no se crea
  la invitación.
- **CA-14** — Dada una persona invitada, cuando abre el enlace vigente y crea una contraseña que
  cumple RN-04, entonces su estado pasa a «Activo» y entra a la app con el rol asignado.
- **CA-15** — Dada una persona invitada, cuando abre un enlace caducado o ya usado, entonces ve que
  el enlace no es válido y que debe pedir al administrador que reenvíe la invitación.
- **CA-16** — Dado un administrador, cuando reenvía la invitación de un usuario «Invitado»,
  entonces la persona recibe un enlace nuevo y los anteriores dejan de funcionar.
- **CA-17** — Dado un administrador, cuando abre la gestión de usuarios, entonces ve a todos los
  usuarios con nombre, correo, rol y estado (Invitado, Activo, Desactivado).

### HU-04 (P2) — Cambiar rol y desactivar cuentas

Como administrador, quiero cambiar el rol de un usuario y desactivar a quien ya no trabaja en el
negocio, para mantener el acceso al día sin borrar su historial.

**Criterios de aceptación**

- **CA-18** — Dado un administrador, cuando cambia el rol de otro usuario, entonces desde la
  siguiente acción de ese usuario se aplican los permisos del nuevo rol.
- **CA-19** — Dado un administrador, cuando desactiva a otro usuario, entonces ese usuario no puede
  volver a entrar (CA-06) y, si tenía una sesión abierta, en su siguiente acción es llevado al
  inicio de sesión con el mensaje de cuenta desactivada.
- **CA-20** — Dado un administrador, cuando reactiva a un usuario desactivado, entonces ese
  usuario puede volver a entrar con su contraseña de siempre.
- **CA-21** — Dado que solo queda un administrador activo, cuando intenta desactivarse, cambiarse
  a operador o hacer lo mismo con el último administrador, entonces el sistema lo impide y explica
  que debe existir al menos un administrador activo.

### HU-05 (P2) — Recuperar la contraseña

Como usuario, quiero restablecer mi contraseña desde la pantalla de inicio de sesión si la olvido,
sin depender del administrador.

**Criterios de aceptación**

- **CA-22** — Dado cualquier visitante, cuando solicita recuperar la contraseña con un correo,
  entonces ve siempre «Si el correo está registrado, recibirás un enlace para crear una nueva
  contraseña.», exista o no el correo.
- **CA-23** — Dado un usuario activo que solicitó la recuperación, cuando abre el enlace vigente y
  crea una contraseña que cumple RN-04, entonces puede entrar con la nueva contraseña y la
  anterior deja de funcionar.
- **CA-24** — Dado un enlace de recuperación caducado o ya usado, cuando se abre, entonces se ve
  que no es válido y la opción de pedir uno nuevo.
- **CA-25** — Dado un usuario desactivado, cuando completa una recuperación de contraseña,
  entonces sigue sin poder entrar (CA-06).

### HU-06 (P3) — Entrar con Google

Como usuario, quiero entrar con mi cuenta de Google si uso ese mismo correo, para no recordar otra
contraseña.

**Criterios de aceptación**

- **CA-26** — Dado un usuario activo o invitado cuyo correo coincide con su cuenta de Google,
  cuando elige «Continuar con Google» y autoriza, entonces entra a la app con su rol (y, si estaba
  «Invitado», pasa a «Activo»).
- **CA-27** — Dada una cuenta de Google cuyo correo no pertenece a ningún usuario, cuando la usa
  para entrar, entonces no entra, no se crea ningún usuario y ve «Esta cuenta de Google no tiene
  acceso. Pide al administrador que te invite.».
- **CA-28** — Dado un usuario desactivado, cuando entra con Google, entonces no entra y ve el
  mensaje de cuenta desactivada.

## Requisitos funcionales

- **RF-01** — Todas las páginas, salvo inicio de sesión, recuperación de contraseña y aceptación
  de invitación, requieren sesión.
- **RF-02** — Cada usuario tiene exactamente un rol: operador o administrador.
- **RF-03** — Los permisos se comprueban en el servidor para cada lectura y escritura, no solo en
  la interfaz.
- **RF-04** — El administrador gestiona usuarios desde la app: invitar, reenviar invitación,
  cambiar rol, desactivar y reactivar.
- **RF-05** — La página de inicio y la cabecera muestran el nombre y el rol del usuario y la
  opción de cerrar sesión.
- **RF-06** — Cada entorno nuevo debe poder ponerse en marcha con un primer administrador sin
  modificar código.

## Reglas de negocio

- **RN-01** — No hay registro público: solo entran personas invitadas por un administrador.
- **RN-02** — El correo identifica al usuario y es único (sin distinguir mayúsculas).
- **RN-03** — Siempre debe existir al menos un administrador activo.
- **RN-04** — La contraseña tiene al menos 8 caracteres.
- **RN-05** — Los usuarios no se borran: se desactivan, para conservar su relación con el historial
  (órdenes que registraron).
- **RN-06** — Los mensajes de inicio de sesión y recuperación no revelan si un correo está
  registrado.
- **RN-07** — Los enlaces de invitación y de recuperación son de un solo uso y caducan (vigencia en
  «Suposiciones»).

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Usuario | nombre, correo, rol, estado, fecha de alta, invitado por | Estado: Invitado, Activo, Desactivado. |

## Requisitos no funcionales

- **Seguridad**: los intentos repetidos de inicio de sesión se limitan para frenar ataques de
  fuerza bruta. Las contraseñas nunca se muestran ni se guardan legibles.
- **Privacidad**: los datos de usuario solo los ve el administrador (y cada usuario los suyos).
- **Idioma**: pantallas y correos (invitación y recuperación) en español.
- **Accesibilidad**: los formularios se pueden completar solo con teclado y los errores se asocian
  a su campo.
- **Dispositivos**: usable en el computador del mostrador y en un móvil.

## Fuera de alcance

- Menú de navegación completo de la app (spec de navegación del backlog); aquí solo se muestra la
  gestión de usuarios al administrador y la cabecera con el usuario.
- Que los empleados inicien sesión.
- Verificación en dos pasos, otros proveedores (Apple, Microsoft…) y registro público.
- Que el usuario edite su perfil (nombre, correo) o cambie su contraseña con sesión iniciada.
- Registro de auditoría de quién cambió qué.
- Recrear cuentas de la app anterior en Firebase.

## Suposiciones

- Los enlaces de invitación y de recuperación caducan a las **24 horas** (la plataforma usa una
  sola vigencia para todos los enlaces por correo; decidido con el usuario al planificar).
- La sesión se mantiene en el dispositivo hasta cerrarla o tras **7 días sin uso**. El computador
  del mostrador puede compartirse, por lo que cada persona cierra sesión al terminar su turno.
- El primer administrador de cada entorno lo crea quien despliega la app, siguiendo un
  procedimiento documentado en el plan.
- Para entrar con Google basta con que el correo de la cuenta de Google coincida con el del usuario.

## Preguntas abiertas

Ninguna. Decisiones tomadas con el usuario el 2026-11-19: altas desde la app por el administrador;
solo operador y administrador inician sesión; correo y contraseña + Google; recuperación de
contraseña por autoservicio.

## Checklist de calidad de la spec

- [x] No menciona tecnologías, librerías, tablas ni componentes (Google se nombra como método de
      acceso elegido por el negocio, no como decisión técnica).
- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba.
- [x] No quedan marcas `[NECESITA ACLARACIÓN]`.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar (HU-01 + HU-02 + HU-03: acceso protegido,
      permisos reales y altas de personal).

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Creación (borrador). |
| 2026-11-19 | Aprobada por el usuario, con las suposiciones tal como están. |
| 2026-11-19 | Al planificar: el enlace de recuperación caduca a las 24 h, igual que la invitación (antes 1 h). Aprobado por el usuario. |
| 2026-11-19 | Plan técnico aprobado. |
| 2026-11-19 | Tareas aprobadas. |
| 2026-11-19 | Implementada (bloques A y B) y verificada en local. Pendiente: despliegue y verificación manual de Google (fase B5). |
