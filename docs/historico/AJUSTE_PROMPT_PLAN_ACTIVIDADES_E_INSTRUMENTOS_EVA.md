# Ajuste recomendado — Prompt del Plan Docente

Este bloque debe incorporarse en una **nueva versión del Prompt del Plan Docente** administrada desde Conocimiento e IA. No reemplaza los Lineamientos ni el Formato oficial; ambos continúan teniendo mayor autoridad.

## Actividades por componente

1. Para cada semana devuelva `activityDetails` como una lista estructurada.
2. Cada actividad debe indicar exactamente un componente: `ACD`, `APE` o `AA`.
3. La redacción de la actividad debe ser concreta, observable y coherente con el resultado de aprendizaje, los contenidos y las horas del componente.
4. Las actividades calificadas AC1–AC5 deben vincularse a una única actividad mediante `evaluationCode` y conservar exactamente el componente, semana, calificación real y peso definidos por los Lineamientos institucionales.
5. No cambie ni invente unidades, contenidos o subcontenidos. El sistema construye su numeración jerárquica.

## Instrumentos para EVA

Todos los instrumentos se configuran en EVA sobre **10 puntos**, independientemente de la calificación real de la actividad en el Plan Docente.

La conversión posterior es:

`calificación_real = (puntaje_EVA / 10) × calificación_máxima_de_la_actividad`

### Cuestionario

Si `instrumentConfig.type = QUESTIONNAIRE`:

- `maximumScore = 10`;
- indique `gradingMode`: `LAST_ATTEMPT` o `HIGHEST_GRADE`;
- indique `questionCount`;
- indique `timeMinutes`;
- use `criteria = []`.

### Rúbrica

Si `instrumentConfig.type = RUBRIC`:

- `maximumScore = 10`;
- genere criterios pertinentes a la actividad;
- preferentemente use cuatro criterios;
- niveles base: Excelente 2,5; Bueno 1,75; Regular 1; Deficiente 0;
- redacte un descriptor específico para cada nivel y criterio;
- la suma de los puntajes máximos de todos los criterios debe ser exactamente 10.

### Lista de cotejo

Si `instrumentConfig.type = CHECKLIST`:

- `maximumScore = 10`;
- genere criterios verificables y pertinentes;
- preferentemente use cuatro criterios;
- cada criterio debe contener exactamente: Sí 2,5 y No 1,75;
- la suma de los máximos de los criterios debe ser exactamente 10.

### Escala de valoración

Si `instrumentConfig.type = RATING_SCALE`:

- `maximumScore = 10`;
- genere indicadores pertinentes a la actividad;
- preferentemente use cuatro indicadores;
- niveles base: Muy bien 2,5; Bien 1,75; Regular 1; Deficiente 0;
- la suma de los puntajes máximos debe ser exactamente 10.

## Responsabilidad del sistema

El modelo no debe intentar reproducir el diseño visual del formato. Debe devolver datos estructurados. El sistema controla en código:

- la estructura y orden de las secciones A–H;
- el formato de tablas;
- la numeración Unidad 1 / 1.1 / 1.1.1;
- las reglas de AC1–AC5;
- la escala máxima de 10 puntos de los instrumentos;
- la conversión a la calificación real;
- la validación antes de descargar el Word o continuar con la Guía.
