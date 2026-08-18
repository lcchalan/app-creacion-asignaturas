# v32.1.2 · Vista única del Plan Docente durante la revisión

## Decisión funcional

El Plan Docente debe poseer una única representación HTML institucional. El profesor y los revisores (Par académico, Equipo de calidad, DIITEP y Dirección) visualizan la misma estructura A–H. Los permisos determinan qué acciones se habilitan; no se mantiene un segundo formato resumido para revisión.

## Implementación

- `teachingPlanPreviewHtml()` acepta un contexto explícito de visualización.
- La vista del profesor continúa usando el estado de su proyecto.
- La vista de revisión recibe desde el backend un `planView` con los datos institucionales, mapeos de resultados, perfil del profesor, correo, bibliografía, formato aplicado y estado de aprobación.
- El revisor utiliza el mismo renderizador en modo `readOnly`.
- El modo de solo lectura omite la edición de semanas sin alterar la estructura académica.

## Seguridad de contexto

La visualización de un Plan revisado nunca toma el correo ni el perfil del usuario revisor para completar la sección F. El backend entrega el contexto del profesor propietario del Plan.

## Diseño

La pantalla de revisión utiliza un ancho máximo mayor que las pantallas generales del sistema porque combina el documento y la lista de cotejo. En escritorio se prioriza aproximadamente 70 % para el Plan y 30 % para la lista. En pantallas menores de 1050 px las columnas se apilan.

## Base de datos

No se modifica el esquema ni las migraciones. La lista de cotejo de 20 criterios permanece en `TeachingPlanIndicatorVersion` / `TeachingPlanIndicator` como fuente operativa de revisión.
