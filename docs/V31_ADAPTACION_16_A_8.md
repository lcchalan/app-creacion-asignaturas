# v31 — Adaptación pedagógica de documentos de 16 a 8 semanas

## Objetivo

LUIS incorpora un segundo modo de elaboración para asignaturas que ya disponen de un Plan Docente y, opcionalmente, una Guía Didáctica organizados en 16 semanas. El sistema conserva esos documentos como fuentes históricas y ayuda al profesor a proponer una adaptación pedagógica al sistema modular de 8 semanas lectivas.

Este flujo no sustituye la revisión del profesor. La IA propone cambios trazables y justificados; el profesor acepta, edita, rechaza o solicita una nueva propuesta antes de generar el documento modular.

La aprobación descrita en este documento corresponde únicamente a la conformidad del profesor con la propuesta de adaptación. No habilita el flujo interno de aprobación por par académico, calidad o director de carrera, que permanece fuera del alcance prioritario de v31.

## Modos de elaboración

Cada proyecto debe seleccionar uno de estos modos antes de generar el Plan Docente. Los proyectos existentes que solo tienen revisión, perfil o bibliografía permanecen habilitados para elegir el modo de adaptación:

- `NEW`: creación de un Plan Docente nuevo con los datos institucionales vigentes.
- `ADAPTATION_16_TO_8`: adaptación pedagógica de documentos existentes de 16 a 8 semanas.

La elección se almacena en `Project.workflowMode`. Puede cambiarse mientras el proyecto no tenga documentos de origen, propuestas, Plan Docente modular ni contenido de Guía. Los datos de revisión, perfil y bibliografía ya registrados se conservan al seleccionar el modo.

## Documentos de origen

En el modo de adaptación se admiten archivos PDF o DOCX:

- `PLAN_16_WEEKS`: obligatorio para analizar y adaptar el Plan Docente.
- `GUIDE_16_WEEKS`: opcional al inicio; puede cargarse antes de adaptar la Guía Didáctica.

Cada archivo queda registrado en `LegacyAcademicDocument` con:

- proyecto y tipo;
- nombre original y ruta de almacenamiento;
- tipo MIME y tamaño;
- huella SHA-256;
- periodo académico y versión declarados;
- usuario y fecha de carga;
- estado activo/inactivo.

Una nueva carga no borra el archivo anterior: lo desactiva y conserva su historial. Solo puede existir un documento activo por proyecto y tipo.

## Orden del flujo

1. Seleccionar `ADAPTATION_16_TO_8`.
2. Subir el Plan Docente de 16 semanas.
3. Subir opcionalmente la Guía Didáctica anterior.
4. Completar revisión institucional, matriz de contribución, perfil docente y bibliografía.
5. Solicitar el análisis del Plan anterior.
6. Revisar cada cambio propuesto.
7. Aprobar la propuesta del Plan.
8. Generar y revisar el Plan Docente modular.
9. Si existe una Guía anterior, solicitar y aprobar su propuesta de adaptación.
10. Generar y aprobar las semanas de la Guía Didáctica.

Si no se carga una Guía anterior, LUIS genera una guía nueva a partir del Plan Docente modular aprobado por el profesor.

## Propuesta de adaptación

`AdaptationProposal` registra una propuesta para `PLAN` o `GUIDE` e incluye:

- documento de origen;
- semanas de origen y destino;
- resumen y estructura semanal propuesta;
- instantáneas de formato, prompt y documentos institucionales activos;
- fecha de generación y aprobación;
- estado de revisión.

Las acciones permitidas son:

- `KEEP`: conservar;
- `GROUP`: agrupar;
- `MERGE`: unificar;
- `SYNTHESIZE`: sintetizar;
- `MOVE`: trasladar;
- `REFORMULATE`: reformular pedagógicamente;
- `DELETE`: eliminar;
- `SPLIT`: dividir;
- `UPDATE`: actualizar.

Cada `AdaptationChange` conserva:

- semanas y contenido de origen;
- acción propuesta;
- semanas y contenido de destino;
- justificación pedagógica;
- resultados de aprendizaje relacionados;
- impacto en horas y evaluación;
- fuentes institucionales de respaldo;
- decisión y edición del profesor.

## Decisiones del profesor

El profesor puede registrar por cada cambio:

- `ACCEPTED`: aceptar la propuesta;
- `EDITED`: aceptar con contenido corregido y justificación breve del profesor;
- `REJECTED`: rechazar con fundamento;
- `REGENERATE`: solicitar otra propuesta con instrucciones;
- `PENDING`: pendiente de revisión.

Una propuesta solo puede aprobarse cuando todos sus cambios están `ACCEPTED` o `EDITED`, y todo cambio editado contiene el texto final y la justificación del profesor. Los rechazos, solicitudes de regeneración y pendientes bloquean la aprobación.

Al generar una nueva propuesta se incorporan los comentarios de los cambios rechazados o solicitados para regeneración.

## Reglas de consistencia

La propuesta debe:

- transformar exactamente 16 semanas de origen en 8 semanas lectivas;
- contener una estructura única y completa de las semanas 1 a 8;
- usar únicamente resultados de aprendizaje y contenidos institucionales vigentes;
- cubrir todos los resultados y contenidos obligatorios de la oferta o del Plan modular;
- mantener las semanas de origen y destino dentro de sus rangos;
- justificar toda eliminación;
- indicar contenido y semana de destino para toda acción distinta de eliminar;
- conservar la distribución oficial de evaluación según el tipo de asignatura.

Los contenidos antiguos pueden conservarse, agruparse, sintetizarse, actualizarse o eliminarse con justificación. Los contenidos institucionales vigentes no pueden omitirse ni sustituirse silenciosamente.

## Jerarquía de fuentes

Para el Plan Docente, el documento antiguo es una fuente de contenido, pero no una autoridad normativa. Prevalecen:

1. datos institucionales vigentes de la oferta;
2. Lineamientos del Sistema Modular activos;
3. Formato oficial del Plan Docente activo;
4. prompt activo del Plan Docente;
5. demás documentos institucionales compatibles.

Para la Guía Didáctica, el Plan Docente modular vigente es la fuente obligatoria. La guía anterior se usa como fuente de contenido y experiencia previa, no para contradecir el Plan ni las reglas activas.

Las versiones activas utilizadas al analizar la propuesta quedan registradas. Si esas fuentes cambian antes de generar el Plan o la Guía, el sistema bloquea la generación y exige analizar y aprobar una nueva propuesta.

## Invariantes de versionado

- Los archivos anteriores no se sobrescriben ni eliminan automáticamente.
- Sustituir el Plan de origen invalida las propuestas del Plan.
- Sustituir la Guía de origen invalida las propuestas de la Guía.
- Cambiar los datos base antes de generar el Plan invalida las propuestas de adaptación.
- Generar o modificar el Plan invalida cualquier propuesta de Guía anterior.
- El Plan de origen no puede sustituirse después de generar el Plan modular.
- La Guía de origen no puede sustituirse después de iniciar contenido de la Guía modular.

## Modelo de datos incorporado

- `Project.workflowMode`
- `Project.adaptationPlanApprovedAt`
- `Project.adaptationGuideApprovedAt`
- `LegacyAcademicDocument`
- `AdaptationProposal`
- `AdaptationChange`

La migración incremental es:

```text
20260813010000_v31_adaptation_16_to_8
```

## Pruebas automatizadas

`tests/adaptation-policy.test.ts` comprueba:

- aceptación de una propuesta trazable 16 → 8;
- rechazo de estructuras semanales incompletas;
- rechazo de contenidos o resultados inventados;
- condiciones para aprobar una propuesta;
- resolución del contenido final aceptado o editado por el profesor.

## Prueba funcional recomendada

1. Abrir una oferta de 8 semanas asignada a un profesor.
2. Seleccionar “Adaptar Plan y Guía existentes de 16 a 8 semanas”.
3. Subir un Plan Docente anterior PDF o DOCX.
4. Subir opcionalmente una Guía Didáctica anterior.
5. Completar los pasos de preparación hasta Bibliografía.
6. Analizar el Plan anterior.
7. Aceptar un cambio, editar otro, rechazar otro y solicitar regeneración de uno adicional.
8. Confirmar que la propuesta no pueda aprobarse mientras existan cambios rechazados o pendientes.
9. Generar otra propuesta y verificar que incorpore los comentarios del profesor.
10. Aprobar todos los cambios y generar el Plan Docente modular.
11. Modificar metodología o TAC y comprobar que cualquier propuesta previa de Guía se invalide.
12. Analizar la Guía anterior, aprobar su propuesta y generar la semana 1.
13. Cerrar sesión y comprobar que documentos, propuesta, decisiones y progreso se recuperen desde la base de datos.
