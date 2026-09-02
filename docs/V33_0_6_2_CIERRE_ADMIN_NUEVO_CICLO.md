# V33.0.6.2 — Cierre administrativo y habilitación de nuevo ciclo

## Alcance

Esta versión habilita la gestión administrativa de ciclos del Plan Docente sobre la fundación incorporada en V33.0.6.1.

- Solo ADMIN puede cerrar administrativamente el ciclo actual.
- El cierre exige motivo y admite observación opcional.
- El cierre no cambia el estado académico del TeachingPlan ni el estado del workflow.
- Revisiones, criterios, aprobaciones, notificaciones, snapshot y documento canónico permanecen históricos.
- Un ciclo administrativamente cerrado queda de solo lectura para el docente.
- ADMIN puede habilitar explícitamente el siguiente ciclo después del cierre.
- Habilitar el siguiente ciclo desvincula únicamente Project.currentTeachingPlanId; no borra el TeachingPlan histórico.
- La siguiente generación crea cycleNumber + 1 mediante la lógica de V33.0.6.1 y toma el formato institucional vigente.
- Si la Guía Didáctica ya tiene contenido, no se habilita un nuevo ciclo del Plan para evitar romper trazabilidad.
- El dashboard administrativo muestra ciclo actual, estado administrativo e historial básico.

## Fuera de alcance

La copia opcional de información académica del último Plan se implementará en V33.0.6.3. Esta versión conserva íntegramente el ciclo anterior para permitir esa reutilización posterior.

## Operaciones no ejecutadas por el actualizador

No se ejecutan migraciones, seed, knowledge:restore-from-git, commit ni push.
