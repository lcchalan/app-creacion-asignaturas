# V31 · Guía estructurada, numeración curricular y recursos educativos

## Decisión de construcción

No se mantiene compatibilidad con Guía canónica v1/v2. Al no existir información real de producción, la migración v3 elimina semanas, versiones, revisiones, imágenes y JSON canónicos de prueba, sin eliminar Plan Docente, oferta académica, usuarios ni bibliografía configurada.

## Estructura institucional

La numeración de Unidad/tema/subtema es responsabilidad de LUIS y nunca de la IA. La fuente es la jerarquía normalizada de `AcademicOfferingUnit`, `AcademicOfferingUnitContent` y `AcademicOfferingUnitSubcontent`.

## Conocimiento e IA

Se incorpora el tipo de recurso `GUIDE_RESOURCE_SPEC` — «Especificación de recursos educativos para la Guía Didáctica». Debe existir una versión activa y aplicable a la Guía antes de generar contenido.

El documento se congela dentro del snapshot de fuentes cuando comienza la generación de la Guía, igual que el Prompt de Guía y los demás documentos institucionales.

## Contenido API

El documento canónico v3 expone contenido como bloques semánticos. Esto permite que un consumidor aplique componentes visuales distintos a encabezados, párrafos, enlaces, imágenes, tablas, listas y focalizadores.


## Recursos en el contrato v3

Además del bloque `resource` que marca la posición visual del recurso dentro del contenido, LUIS reconstruye el guion aceptado en `content.resources`. Esto permite que EVA consuma directamente Bloom, tipo, complejidad, herramienta, pantallas/escenas y bibliografía sin interpretar las tablas visuales.
