# v32.8.2 · Flujo secuencial del Plan Docente

## Objetivo

Evitar que la planificación semanal y la evaluación queden desalineadas cuando el profesor modifica o regenera la metodología y las TAC.

## Flujo

1. Presentación microcurricular: el profesor puede agregar indicaciones y solicitar una nueva propuesta con IA.
2. Metodología y TAC: el profesor puede editar manualmente o indicar cómo debe regenerarse la propuesta con IA.
3. Al aprobar metodología y TAC, el sistema regenera la planificación semanal utilizando literalmente esas decisiones como contexto obligatorio.
4. La planificación puede revisarse y editarse por semana.
5. Al aprobar la planificación, se habilita la sección E. Evaluación de la asignatura.
6. La actividad calificada de la sección E se mantiene sincronizada con la actividad guardada en la semana correspondiente.

## Invalidaciones

- Guardar o regenerar metodología/TAC invalida la aprobación de metodología y de planificación.
- Editar una semana invalida la aprobación de planificación.
- No se puede confirmar el Plan Docente para revisión institucional hasta que ambas aprobaciones existan.

## Persistencia

`TeachingPlan` incorpora:

- `methodologyApprovedAt`
- `planningApprovedAt`

La migración es incremental y no modifica contenido histórico.
