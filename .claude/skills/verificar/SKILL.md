---
name: verificar
description: Verifica que la implementación de una spec SDD cumple cada criterio de aceptación y detecta divergencias entre spec, plan y código. Úsala cuando el usuario pida verificar, auditar o cerrar una spec.
argument-hint: <NNN>
---

# /verificar — implementación vs. spec

Spec: $ARGUMENTS

## Pasos

1. Lee `spec.md`, `plan.md` y `tasks.md` de la spec.
2. Para cada `CA-xx`, localiza la prueba que lo cubre y comprueba que:
   - existe y pasa;
   - su aserción corresponde de verdad a la regla de negocio (no solo al mock);
   - su descripción coincide con lo que asserta.
3. Para cada `RF-xx` y `RN-xx`, localiza dónde se implementa.
4. Busca divergencias (drift):
   - comportamiento en el código que no está en la spec;
   - partes de la spec sin implementar;
   - tareas marcadas que no se reflejan en el código;
   - tablas sin RLS o permisos que solo se comprueban en la UI.
5. Ejecuta las comprobaciones de la Definición de terminado y reporta la salida real.
6. Entrega una tabla: criterio → prueba → estado (✅ / ⚠️ / ❌) y la lista de divergencias.
7. Si todo está ✅, pon la spec en `verificada` y actualiza el backlog. Si no, propón las
   correcciones (en la spec o en el código) sin aplicarlas hasta que el usuario decida.
