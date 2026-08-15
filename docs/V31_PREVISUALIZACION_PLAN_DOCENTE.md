# V31 — Vista previa HTML y revisión del Plan Docente

## Objetivo

Permitir que el profesor revise el Plan Docente generado antes de descargar el Word y antes de iniciar la Guía Didáctica. La vista HTML reproduce la estructura funcional del formato oficial, sin convertir la revisión del profesor en un flujo interno de aprobación institucional.

## Estructura mostrada

La vista previa organiza el Plan Docente en:

- Portada.
- A. Datos de identificación de la asignatura.
- B. Descripción de la asignatura.
- C. Contribución al perfil de egreso, perfil profesional y competencias genéricas UTPL.
- D. Programación del proceso de aprendizaje.
- E. Evaluación de la asignatura.
- F. Datos del equipo docente.
- G. Bibliografía básica, complementaria y REA.
- H. Aprobación externa.

La metodología y las TAC siguen siendo los campos pedagógicos editables. Los datos institucionales permanecen de solo lectura.

## Validaciones automáticas

Antes de que el profesor confirme la revisión, el servidor vuelve a comprobar:

1. Cobertura exacta y no duplicada de los resultados de aprendizaje.
2. Semanas lectivas completas y sin duplicados.
3. Uso exclusivo de unidades, contenidos y subcontenidos de la oferta académica.
4. Totales de horas ACD, APE y AA.
5. Distribución oficial de las cinco actividades calificadas.
6. Total de 10 puntos y 100 %.
7. Metodología activa y TAC para cada resultado de aprendizaje.

Estas comprobaciones automáticas no sustituyen la revisión pedagógica del profesor.

## Confirmación de revisión

El profesor puede registrar observaciones opcionales y debe marcar una confirmación explícita. La base de datos conserva:

- fecha de revisión;
- observaciones;
- versión exacta del Plan Docente revisada;
- registro de auditoría.

La descarga del Word y la generación de la Guía Didáctica quedan habilitadas únicamente cuando el Plan Docente vigente fue revisado.

Si se regenera el Plan o se modifican metodología/TAC, la confirmación se invalida automáticamente y debe realizarse de nuevo.

## Aprobación externa

La confirmación de revisión corresponde exclusivamente al profesor. No implementa aprobación interna por par académico, calidad o director. La sección H continúa destinada a la aprobación fuera del sistema.
