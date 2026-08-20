# V32.8.3 · Flujo contextual del Plan Docente

## Objetivo

Mejorar la experiencia del profesor durante la generación, revisión y aprobación del Plan Docente sin cambiar el modelo académico ni el flujo institucional de revisión.

## Cambios

- La actividad evaluada de la planificación semanal es la fuente única del nombre de la actividad. La sección E se sincroniza desde esa misma descripción.
- Se elimina la edición duplicada del nombre de la actividad evaluada en el bloque del instrumento.
- Se añade un indicador de cuatro etapas: Presentación, Metodología y TAC, Planificación y Evaluación.
- El botón inicial se denomina “Generar metodología y TAC con IA” y deja de mostrarse cuando ya existe un Plan.
- La regeneración y aprobación de metodología muestran el progreso en el botón donde el profesor está trabajando.
- Al aprobar metodología y generar planificación, la interfaz se desplaza automáticamente a la Sección D.
- La aprobación de planificación aparece inmediatamente después de la Sección D, no después de las secciones posteriores.
- Al aprobar la planificación, la interfaz se desplaza automáticamente a la Sección E.
- Al editar una semana, la fila modificada se vuelve a mostrar y resaltar después de guardar.

## Persistencia y compatibilidad

No se agregan tablas ni columnas. No requiere migración Prisma. Se conservan `methodologyApprovedAt` y `planningApprovedAt` introducidos en v32.8.2.
