# v31 — Actividades e instrumentos de evaluación preparados para EVA

## Objetivo

El Plan Docente conserva la calificación institucional real de cada actividad (AC1–AC5), pero todos los instrumentos de evaluación se configuran en EVA sobre una escala máxima de **10 puntos**.

La conversión hacia la calificación real del Plan Docente es determinística:

`calificación_real = (puntaje_EVA / 10) × calificación_máxima_de_la_actividad`

Ejemplo: si AC1 vale 0,5 puntos y un estudiante obtiene 8/10 en EVA, la calificación real de AC1 es 0,4 puntos.

## Persistencia estructurada

Las actividades dejan de depender únicamente del JSON del Plan Docente. Se normalizan en tablas relacionadas:

- `TeachingPlanActivity`: resultado, semana, orden, componente ACD/APE/AA, actividad, contenidos, recursos, horas, código AC, calificación real, peso y estrategia de trabajo.
- `TeachingPlanInstrument`: tipo, nombre y escala máxima (10), además de configuración de cuestionario.
- `TeachingPlanInstrumentCriterion`: criterio o indicador.
- `TeachingPlanInstrumentLevel`: nivel/opción, descriptor y puntaje.

Esto permite consumir la información posteriormente mediante API para configurar actividades e instrumentos en EVA sin volver a interpretar texto libre.

## Tipos de instrumento

### Cuestionario

Guarda:

- tipo de calificación: `LAST_ATTEMPT` (Último intento) o `HIGHEST_GRADE` (Calificación más alta);
- número de preguntas;
- tiempo de resolución en minutos;
- escala EVA máxima de 10 puntos.

### Rúbrica

Se estructura en criterios y niveles. La configuración base reproduce el ejemplo institucional compartido:

- Excelente: 2,5 puntos;
- Bueno: 1,75 puntos;
- Regular: 1 punto;
- Deficiente: 0 puntos.

Con cuatro criterios de máximo 2,5 puntos, el instrumento suma 10 puntos. Los descriptores son específicos de cada criterio y pueden editarse.

### Lista de cotejo

Cada criterio tiene exactamente dos opciones:

- Sí: 2,5 puntos;
- No: 1,75 puntos.

La suma de los máximos de cuatro criterios es 10 puntos. Los valores pueden editarse siempre que el máximo total permanezca en 10.

### Escala de valoración

La configuración base reproduce el ejemplo compartido:

- Muy bien: 2,5 puntos;
- Bien: 1,75 puntos;
- Regular: 1 punto;
- Deficiente: 0 puntos.

La suma de los máximos debe ser exactamente 10 puntos.

## Edición de la sección D

Cada semana del previsualizador incorpora `Editar semana`. El profesor puede modificar:

- actividades de aprendizaje y su componente ACD/APE/AA;
- recursos de aprendizaje;
- texto de la actividad calificada;
- estrategias de trabajo;
- tipo y configuración del instrumento.

Se mantienen protegidos:

- resultado de aprendizaje institucional;
- semana;
- unidad/contenido/subcontenido institucional;
- horas ACD/APE/AA;
- código AC1–AC5;
- componente institucional de la actividad calificada;
- semana, calificación real y peso institucional de AC1–AC5.

Toda edición incrementa la versión del Plan Docente e invalida la revisión previa del profesor.

## API preparada para futura integración EVA

`GET /api/projects/:projectId/teaching-plan/eva-activities`

Devuelve la información normalizada de cada actividad, instrumento, criterios y niveles, junto con:

- `instrumentMaximumScore: 10`;
- `activityMaximumGrade`;
- fórmula de conversión;
- ejemplo del resultado para 10/10.

La integración de escritura hacia EVA no se implementa todavía; este endpoint deja preparado el contrato de lectura y la persistencia necesaria.
