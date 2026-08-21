# v32.10.1 · Banco estructurado de preguntas para cuestionarios

## Objetivo

Incorporar un banco de preguntas persistente para cada actividad evaluada del Plan Docente cuyo instrumento sea **Cuestionario**, manteniendo alineación con la planificación semanal, trazabilidad docente y soporte de IA.

## Configuración institucional

En **Administración → Configuración académica** se define el número mínimo de preguntas por banco mediante la clave `TEACHING_PLAN_QUESTION_BANK_MINIMUM_QUESTIONS`.

- Valor inicial: 20 preguntas.
- Rango permitido: 1 a 200.
- El tamaño requerido de un banco es el mayor valor entre el mínimo institucional y el número de preguntas que el cuestionario mostrará al estudiante.
- Cada banco conserva `minimumRequired` como snapshot. Un cambio administrativo no invalida retroactivamente bancos ya aprobados; una regeneración adopta el mínimo vigente.

## Configuración docente

Una vez aprobada la planificación semanal, el profesor puede abrir **Configurar banco de preguntas** desde cada actividad AC1–AC5 cuyo instrumento sea Cuestionario.

El profesor selecciona:

- temas autorizados, obtenidos exclusivamente de la semana de la actividad;
- tipos de pregunta y cantidad por tipo;
- indicaciones adicionales para la IA.

Tipos soportados:

- opción múltiple, una respuesta (`MULTIPLE_CHOICE_SINGLE`);
- opción múltiple, varias respuestas (`MULTIPLE_CHOICE_MULTIPLE`);
- verdadero/falso (`TRUE_FALSE`);
- completar (`FILL_BLANK`);
- relacionar (`MATCHING`);
- ordenar (`ORDERING`).

## Estructura de cada pregunta

Cada pregunta conserva de forma estructurada:

- tipo;
- tema;
- enunciado;
- opciones o elementos cuando correspondan;
- clave de respuesta;
- retroalimentación para respuesta correcta;
- retroalimentación para respuesta incorrecta;
- origen (`AI`, `AI_REGENERATED` o `TEACHER_EDITED`);
- versión.

El backend valida las reglas particulares de cada tipo y rechaza preguntas con temas no autorizados, claves inválidas, opciones inconsistentes o duplicados.

## IA y edición

La generación completa y la regeneración individual utilizan la cola persistente de IA y el límite institucional existente de generaciones por contenido.

- Regenerar todo el banco crea una nueva versión del banco y conserva un snapshot anterior.
- Editar manualmente una pregunta conserva una revisión de la versión previa.
- Regenerar una sola pregunta mantiene obligatoriamente su tipo y tema.
- Un reintento técnico de la cola no consume una generación funcional adicional.

## Coherencia con el Plan Docente

Si posteriormente cambia el tema, la semana o el tipo de instrumento, el banco histórico no se elimina. Se marca `NEEDS_REVIEW` y pierde su aprobación.

Los bancos correspondientes a instrumentos que ya no son Cuestionario se conservan en PostgreSQL como historial, pero no se publican en el documento canónico vigente.

Un Plan Docente que contenga cuestionarios no puede confirmarse para revisión institucional hasta que todos los bancos de los cuestionarios vigentes estén aprobados y sean válidos.

## JSON canónico

El contrato canónico del Plan Docente conserva la ruta mayor `teaching-plan-canonical-v1.schema.json` y evoluciona de `1.0.0` a `1.1.0` para incorporar `questionBanks`.

El Word/PDF del Plan Docente no imprime las claves ni el banco completo; estas estructuras quedan disponibles para gestión docente y futuras integraciones con el EVA/LMS.

## Base de datos

La migración `20260821013000_v32_10_1_question_banks` crea:

- `TeachingPlanQuestionBank`;
- `TeachingPlanQuestion`;
- `TeachingPlanQuestionRevision`;
- `TeachingPlanQuestionBankRevision`.

No elimina ni transforma bancos históricos porque esta funcionalidad no existía previamente.
