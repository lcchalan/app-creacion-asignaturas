# V33.0.6.1 - Fundación de ciclos institucionales del Plan Docente

## Objetivo
Permitir que un proyecto conserve varios ciclos de Plan Docente sin borrar ni resetear el historial, manteniendo `project.teachingPlan` como referencia al ciclo actual.

## Reglas
- Cada TeachingPlan pertenece a un proyecto y tiene `cycleNumber`.
- `Project.currentTeachingPlanId` identifica el ciclo actual.
- Los ciclos anteriores permanecen asociados mediante `project.teachingPlans`.
- El workflow sigue siendo uno a uno con cada TeachingPlan; no se reutilizan aprobaciones entre ciclos.
- El cierre administrativo se modela separado del estado academico.
- `reusedFromTeachingPlanId` deja trazabilidad para la futura reutilizacion controlada del ultimo Plan.
- La ficha base no puede borrar un Plan que ya forma parte de un ciclo institucional.
- Una regeneracion normal incrementa `version` dentro del mismo ciclo; no crea un nuevo ciclo.

## Alcance de esta entrega
Esta version prepara modelo, migracion, backfill, generacion y proteccion del historial. Los endpoints/UI de cerrar proceso, iniciar nuevo ciclo y reutilizar contenido se implementan en las siguientes entregas.
