# v32.3 · Gestión de correcciones del Plan Docente en Vista Docente

## Objetivo

Incorporar una gestión explícita y trazable de las correcciones solicitadas durante la revisión institucional del Plan Docente. El correo electrónico permanece como notificación; la fuente oficial de observaciones y respuestas es el sistema.

## Flujo funcional

1. El revisor cierra su etapa con `CHANGES_REQUESTED`.
2. Para solicitar correcciones debe marcar al menos un criterio como `COMPLIES_PARTIALLY` o `DOES_NOT_COMPLY` y registrar una observación específica en cada criterio observado.
3. El docente abre su asignatura y ve el panel **Correcciones pendientes** antes del Plan Docente.
4. Cada corrección muestra etapa, criterio, valoración, observación y una acción **Ir a sección**.
5. El docente modifica el mismo Plan Docente, registra una respuesta breve y marca el criterio como atendido.
6. Las respuestas por criterio y la respuesta general opcional pueden guardarse sin reenviar el Plan.
7. **Enviar correcciones** se habilita cuando todas las correcciones estructuradas tienen respuesta, están marcadas como atendidas, las validaciones automáticas del Plan son correctas y el docente confirma la atención.
8. El Plan regresa únicamente a la etapa que solicitó la corrección. Las etapas anteriores mantienen su aprobación.
9. El revisor actual ve las respuestas del docente dentro del historial de su etapa; los revisores anteriores reciben la notificación informativa ya definida.

## Trazabilidad

Se agregan a `TeachingPlanReviewItem`:

- `teacherResponse`
- `teacherResponseUpdatedAt`
- `teacherAddressed`
- `teacherAddressedAt`

Se agregan a `TeachingPlanReview`:

- `teacherGeneralResponse`
- `teacherRespondedAt`

Las respuestas quedan asociadas a la ronda de revisión que originó la corrección y no se sobrescriben al crear un nuevo intento de revisión.

## API

### `GET /api/projects/:projectId/teaching-plan/corrections`

Solo el docente propietario del proyecto puede consultar las correcciones del Plan. Devuelve:

- `pending`: corrección vigente, si existe;
- `history`: rondas anteriores con observaciones y respuestas docentes.

### `PATCH /api/projects/:projectId/teaching-plan/corrections`

Solo el docente propietario puede guardar respuestas a la ronda vigente. El backend valida que:

- el workflow esté en `CHANGES_REQUESTED`;
- exista una etapa en `CHANGES_REQUESTED`;
- los ítems enviados sean exactamente los criterios de corrección vigentes;
- un criterio marcado como atendido tenga una respuesta docente;
- la respuesta general opcional quede asociada a la misma ronda de revisión.

### Reenvío existente

`PATCH /api/projects/:projectId/teaching-plan/review` valida adicionalmente que todos los criterios de corrección estén atendidos antes de devolver la etapa a `PENDING_REVIEW`.

## Navegación por sección

Los códigos de la lista de cotejo se relacionan con la vista HTML del Plan:

- A → Sección A
- B → Sección B
- C → Sección C
- D → Sección D
- E → Sección E
- F → Sección F
- G → Sección G
- DI01 → Sección D
- DI02 → Sección E
- DIR01 → Sección C
- DIR02 → Sección H
- criterios transversales como Q01/Q02 → inicio del Plan

La navegación no modifica el documento; solo lleva al docente al contexto correspondiente para facilitar la corrección.

## Seguridad

- Las respuestas docentes se actualizan únicamente si el usuario autenticado es propietario del proyecto.
- No se permite modificar correcciones cuando el workflow no está en `CHANGES_REQUESTED`.
- El reenvío no reactiva etapas previamente aprobadas.
- `ADMIN` no obtiene derechos académicos de revisión por esta funcionalidad.
- Las decisiones y respuestas generan trazabilidad en `AuditLog`.

## Correo

Al reenviar correcciones, el revisor actual recibe también el resumen de respuestas del docente. Los revisores de etapas anteriores continúan recibiendo el mensaje informativo y no deben aprobar nuevamente.

## Compatibilidad

Para una ronda antigua creada antes de v32.3 que tenga solo observación general y ningún criterio marcado como `COMPLIES_PARTIALLY` o `DOES_NOT_COMPLY`, el docente puede responder mediante la respuesta general y reenviar. Las nuevas solicitudes de corrección exigen al menos un criterio estructurado.
