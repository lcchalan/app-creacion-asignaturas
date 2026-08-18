# v32.1.3 — Desplazamiento independiente durante la revisión

## Objetivo
Permitir que el revisor consulte simultáneamente el Plan Docente y la lista de cotejo sin tener que desplazarse por toda la página entre el documento y los criterios.

## Comportamiento
En pantallas de escritorio (ancho superior a 1050 px):

- El contenido del Plan Docente conserva su desplazamiento interno existente.
- La tarjeta de la lista de cotejo dispone de su propio desplazamiento vertical.
- La lista permanece visible en la columna derecha mientras se revisa el documento.
- Cada columna responde al desplazamiento del puntero cuando este se encuentra sobre ella.
- No se modifica el HTML institucional del Plan Docente ni la lógica de guardado/aprobación.

En tabletas y móviles se conserva el flujo vertical de una sola columna.

## Archivo modificado
- `public/styles.css`

## Base de datos
No requiere migraciones ni cambios en Prisma.
