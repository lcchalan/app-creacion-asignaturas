# v31 — Adaptación pedagógica de documentos de 16 a 8 semanas

## Objetivo

Sistema de Gestión Guía didáctica incorpora un segundo modo de elaboración para asignaturas que ya disponen de un Plan Docente y, opcionalmente, una Guía Didáctica organizados en 16 semanas. El sistema conserva esos documentos como fuentes históricas y ayuda al profesor a proponer una reestructuración pedagógica al sistema modular de 8 semanas lectivas.

La adaptación 16 → 8 no se interpreta como una compresión aritmética. La nueva organización se construye desde los resultados de aprendizaje vigentes, la progresión pedagógica y la jerarquía institucional de unidades, temas y subtemas. Las semanas del documento anterior se conservan como trazabilidad de origen, no como regla para decidir la nueva secuencia.

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

Si no se carga una Guía anterior, Sistema de Gestión Guía didáctica genera una guía nueva a partir del Plan Docente modular aprobado por el profesor.

## Propuesta de adaptación

`AdaptationProposal` registra una propuesta para `PLAN` o `GUIDE` e incluye:

- documento de origen;
- semanas de origen y destino;
- resumen y estructura semanal propuesta;
- instantáneas de formato, prompt, documentos institucionales y Especificaciones funcionales activas;
- fecha de generación y aprobación;
- estado de revisión.

Las acciones permitidas son:

- `KEEP`: conservar;
- `GROUP`: agrupar;
- `MERGE`: unificar;
- `SYNTHESIZE`: sintetizar;
- `MOVE`: trasladar;
- `REFORMULATE`: reformular pedagógicamente;
- `DELETE`: proponer una omisión curricular para decisión docente o retirar material histórico que ya no pertenece a la oferta;
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

## Política pedagógica configurable y validaciones de integridad

La política pedagógica de la adaptación no queda fijada en `src/index.ts`. Se administra como una **Especificación funcional** activa, versionada y acotada al proceso `PLAN_ADAPTATION`.

La especificación inicial se denomina **«Reestructuración pedagógica del Plan Docente 16 → 8 semanas»** y puede registrarse de forma aislada con `npm run db:seed-plan-adaptation-spec`. Este comando no modifica usuarios ni catálogos. La especificación establece, entre otros criterios, que la adaptación debe partir de los resultados de aprendizaje, reestructurar los contenidos en bloques pedagógicos, preservar las unidades y someter a decisión del profesor cualquier propuesta de omisión de temas o subtemas.

El administrador puede crear una nueva versión y ajustar esos criterios desde **Administración → Conocimiento e IA → Especificaciones funcionales** sin modificar el código fuente. Cada especificación puede limitarse por nivel académico, modalidad, duración, tipo de asignatura y proceso de generación.

El código conserva únicamente invariantes que no dependen de una decisión pedagógica configurable:

- origen de 16 semanas y destino de 8 semanas dentro de los rangos permitidos;
- una estructura única y completa de las semanas de destino;
- uso exclusivo de resultados y contenidos pertenecientes a la oferta vigente;
- conservación de la jerarquía unidad → tema → subtema dentro de cada semana;
- prohibición de inventar o renombrar elementos institucionales;
- cobertura de los resultados institucionales vigentes;
- conservación de las unidades institucionales;
- trazabilidad de semanas y decisiones;
- aprobación explícita del profesor antes de generar el Plan Docente;
- correspondencia exacta entre el resultado y los contenidos aprobados para cada semana y el Plan Docente finalmente generado.

### Omisiones de temas o subtemas

Cuando la Especificación funcional activa permite proponer una omisión, el sistema la representa como un cambio `DELETE` independiente. El backend exige que la decisión sea verificable: identifica el contenido que se propone omitir, el contenido institucional que conserva la cobertura, la semana de destino, los resultados relacionados y la justificación.

La IA no elimina automáticamente contenido institucional. La omisión solo llega al Plan Docente final si el profesor la acepta expresamente. Si el profesor la rechaza o solicita regeneración, su comentario se incorpora como retroalimentación para construir la siguiente propuesta.

Las unidades institucionales no pueden omitirse mediante este mecanismo. El sistema también verifica que una omisión aceptada no reaparezca en el Plan final y que la distribución semanal generada respete exactamente los contenidos aprobados.

### Trazabilidad de la política aplicada

`AdaptationProposal.specificationSnapshotIds` conserva los identificadores de las Especificaciones funcionales utilizadas para generar la propuesta. La interfaz muestra sus títulos y versiones. Si las especificaciones activas aplicables cambian después de la aprobación, el sistema considera desactualizada la propuesta y exige analizar y aprobar una nueva antes de generar el Plan Docente.

## Jerarquía de fuentes

Para el Plan Docente, el documento antiguo es una fuente de contenido, pero no una autoridad normativa. La generación combina los datos institucionales vigentes, documentos y formatos activos, el prompt activo y las Especificaciones funcionales aplicables. Las Especificaciones funcionales controlan el comportamiento del proceso, pero no pueden autorizar la invención o modificación de datos institucionales de la oferta.

Para la Guía Didáctica, el Plan Docente modular vigente es la fuente obligatoria. La guía anterior se usa como fuente de contenido y experiencia previa, no para contradecir el Plan ni las reglas activas.

Las versiones activas utilizadas al analizar la propuesta quedan registradas. Si esas fuentes cambian antes de generar el Plan o la Guía, el sistema bloquea la generación y exige analizar y aprobar una nueva propuesta.

## Invariantes de versionado

- Los archivos anteriores no se sobrescriben ni eliminan automáticamente.
- Sustituir el Plan de origen invalida las propuestas del Plan.
- Sustituir la Guía de origen invalida las propuestas de la Guía.
- Cambiar los datos base antes de generar el Plan invalida las propuestas de adaptación.
- Cambiar una Especificación funcional aplicable al proceso invalida la propuesta aprobada para futuras generaciones y exige un nuevo análisis.
- Generar o modificar el Plan invalida cualquier propuesta de Guía anterior.
- Mientras la Guía Didáctica modular no tenga contenido, el profesor puede generar una nueva propuesta de adaptación del Plan. Si el Plan ya estaba confirmado, la interfaz exige una confirmación explícita de reapertura; la confirmación del Plan se revoca únicamente cuando la nueva propuesta se genera correctamente, se registra en auditoría y el profesor deberá regenerar, revisar y confirmar otra vez el Plan antes de continuar a la Guía.
- Una vez iniciada la Guía Didáctica modular, el Plan Docente queda bloqueado para reestructuraciones dentro de esa misma versión académica.
- El Plan de origen no puede sustituirse después de generar el Plan modular.
- La Guía de origen no puede sustituirse después de iniciar contenido de la Guía modular.

## Modelo de datos incorporado

- `Project.workflowMode`
- `Project.adaptationPlanApprovedAt`
- `Project.adaptationGuideApprovedAt`
- `LegacyAcademicDocument`
- `AdaptationProposal`, con `specificationSnapshotIds`.
- `AdaptationChange`.
- `GenerationInstruction.processes`, para limitar cada Especificación funcional al proceso donde aplica.
- `TeachingPlan.specificationSnapshotIds`, para registrar las especificaciones usadas en la generación del Plan.

La migración incremental original del flujo es:

```text
20260813010000_v31_adaptation_16_to_8
```

La integración de Especificaciones funcionales por proceso incorpora la migración incremental `20260816113000_v31_adaptation_functional_specs`, que agrega los ámbitos de proceso y los snapshots de especificaciones sin eliminar ni renombrar datos existentes.

## Pruebas automatizadas

`tests/adaptation-policy.test.ts` comprueba:

- aceptación de una propuesta trazable 16 → 8;
- rechazo de estructuras semanales incompletas;
- rechazo de contenidos o resultados inventados;
- conservación de la jerarquía unidad → tema → subtema dentro de cada semana;
- rechazo de propuestas antiguas que no contienen la nueva progresión pedagógica;
- separación entre políticas pedagógicas configurables y validaciones estructurales de código;
- soporte estructural para integración cuando la Especificación funcional aplicable la justifique;
- omisión explícita de un tema redundante con cobertura institucional conservada;
- bloqueo de omisiones silenciosas y de omisión de unidades;
- condiciones para aprobar una propuesta;
- resolución del contenido final aceptado o editado por el profesor;
- correspondencia entre el resultado principal aprobado de cada semana y el Plan Docente generado;
- bloqueo de cambios no aprobados en los contenidos semanales y de la reincorporación de un tema cuya omisión fue aceptada por el profesor.

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
