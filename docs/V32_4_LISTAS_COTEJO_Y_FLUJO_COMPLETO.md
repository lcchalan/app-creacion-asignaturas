# v32.4 · Listas de cotejo administrables y flujo completo del Plan Docente

## Objetivo

Esta versión incorpora dos mejoras institucionales:

1. Administración puede actualizar los criterios de las listas de cotejo del Plan Docente y de la Guía Didáctica.
2. Se completa y hace visible el flujo del Plan Docente para Par académico, Equipo de calidad, DIITEP y Dirección de carrera, manteniendo la misma lógica de autorización, correcciones, trazabilidad y aprobación final.

## 1. Administración de listas de cotejo

Se incorpora la pestaña **Administración → Listas de cotejo**.

### Plan Docente

La pantalla permite consultar la versión activa por responsable y:

- crear criterios;
- actualizar código, nombre, descripción, responsable y obligatoriedad;
- habilitar o deshabilitar criterios;
- eliminar criterios de la versión siguiente.

Cada operación crea automáticamente una **nueva versión activa**. La versión anterior pasa a inactiva y no se modifica. Los procesos de revisión que ya comenzaron conservan la `TeachingPlanIndicatorVersion` con la que fueron creados, por lo que una actualización administrativa no cambia una revisión en curso.

Si el proceso institucional está habilitado, el backend impide dejar sin criterios activos a una etapa activa.

### Guía Didáctica

La misma pestaña permite gestionar la versión activa de `IndicatorVersion` por Par académico, Equipo de calidad y DIITEP:

- crear criterios;
- actualizar nombre, descripción, responsable, puntuación y obligatoriedad;
- habilitar o deshabilitar criterios;
- retirar criterios.

Cada cambio crea una nueva versión y conserva las evaluaciones históricas. La puntuación continúa normalizándose según la distribución institucional actual de la Guía.

> Esta versión administra los criterios de la Guía, pero no sustituye su mecanismo de revisión por el workflow de cuatro etapas del Plan Docente.

## 2. Flujo completo del Plan Docente

La arquitectura de revisión del Plan Docente utiliza una única implementación para las cuatro etapas:

1. Par académico (`REVIEWER`)
2. Equipo de calidad (`QUALITY`)
3. DIITEP (`DIITEP`)
4. Dirección de carrera (`DIRECTOR`)

Las etapas pueden activarse o desactivarse desde Administración y su orden es configurable para los nuevos procesos.

### Responsables

- Par académico, Equipo de calidad y DIITEP se asignan explícitamente por Plan Docente.
- La Dirección de carrera se resuelve automáticamente desde la carrera del Plan.
- El docente no puede revisar su propio Plan.
- Tener rol `ADMIN` no concede por sí mismo capacidad de aprobación académica.

### Avance

Cuando una etapa aprueba:

- la etapa queda `APPROVED`;
- la siguiente etapa configurada pasa de `WAITING` a `PENDING_REVIEW`;
- el siguiente responsable recibe la notificación correspondiente;
- las etapas aprobadas anteriormente no se reabren.

La aprobación de la última etapa activa cambia el workflow y el Plan Docente a `APPROVED`.

### Correcciones

Cualquier etapa puede solicitar correcciones. El Plan vuelve al docente y, cuando este responde y reenvía, regresa exclusivamente a la etapa que solicitó el cambio. Las aprobaciones anteriores permanecen válidas.

El mismo comportamiento aplica a Calidad, DIITEP y Dirección de carrera, no solo al Par académico.

### Seguimiento administrativo

La pestaña **Revisión del Plan** incorpora una tabla de seguimiento por Plan Docente con las cuatro columnas de etapa, responsable y estado. Esto permite identificar rápidamente dónde se encuentra detenido o aprobado cada proceso.

## Seguridad y trazabilidad

- Las autorizaciones se validan en backend.
- Cada cambio de criterios genera una nueva versión; no se reescribe una lista usada históricamente.
- Las actualizaciones de criterios generan `AuditLog`.
- Las decisiones académicas continúan asociadas al usuario, etapa, intento, versión del Plan y versión de lista de cotejo.
- El proceso global puede suspenderse sin perder estados ni observaciones, según v32.3.1.

## Base de datos

v32.4 no agrega tablas ni columnas. Utiliza los modelos versionados existentes:

- `TeachingPlanIndicatorVersion`
- `TeachingPlanIndicator`
- `IndicatorVersion`
- `GuideIndicator`
- `TeachingPlanReviewWorkflow`
- `TeachingPlanWorkflowStage`
- `TeachingPlanReview`
- `TeachingPlanReviewItem`

Por lo tanto, **no requiere migración Prisma**.

## Prueba funcional recomendada

1. En Administración → Listas de cotejo, editar un criterio del Plan y comprobar que aumenta la versión activa.
2. Confirmar que un workflow iniciado antes del cambio conserva la versión anterior.
3. Editar un criterio de la Guía y comprobar que se crea una nueva `IndicatorVersion`.
4. Iniciar un Plan con las cuatro etapas activas.
5. Aprobar como Par académico y comprobar que Calidad pasa a pendiente de revisión.
6. Aprobar como Calidad y comprobar que DIITEP pasa a pendiente.
7. Hacer que DIITEP solicite correcciones; el docente responde y el Plan regresa únicamente a DIITEP.
8. Aprobar DIITEP y comprobar que Dirección pasa a pendiente.
9. Aprobar como Director/a y comprobar que el workflow y el Plan terminan en `APPROVED`.
10. Confirmar que una cuenta con solo rol `ADMIN` no puede emitir una decisión académica.
