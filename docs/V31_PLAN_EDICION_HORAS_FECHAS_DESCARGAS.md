# V31 - Edición del Plan, horas, fechas y formatos de descarga

- La sección D conserva las columnas oficiales: Semana, Contenidos, ACD, APE, AA, Actividades de aprendizaje, Recursos de aprendizaje, Instrumentos de evaluación y Calificación.
- Cada actividad se persiste de forma normalizada con componente, descripción, recurso individual y horas. Al eliminar una actividad se elimina su fila completa.
- La suma de horas de actividades por componente se valida contra las horas semanales ACD/APE/AA del Plan.
- Las estrategias de trabajo de la sección E se almacenan como elementos normalizados para EVA y se visualizan como lista.
- AcademicPeriod incorpora bimestralEvaluationAt. Las semanas se calculan lunes-domingo desde la semana que contiene startsAt.
- Administración habilita formatos de descarga del Plan: PDF obligatorio/predeterminado, Word y JSON opcionales.
- La estructura oficial del formato institucional permanece controlada por LUIS; el prompt no altera columnas ni secuencia.
