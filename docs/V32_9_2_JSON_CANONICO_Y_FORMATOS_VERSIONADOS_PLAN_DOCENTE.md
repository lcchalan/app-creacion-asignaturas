# v32.9.2 · JSON canónico y formatos versionados del Plan Docente

## Objetivo

Separar el contenido académico del Plan Docente de su formato institucional de salida. El Plan conserva una representación canónica estable y cada documento generado utiliza el snapshot del formato asociado al Plan.

## Documento canónico

Se incorpora `CanonicalTeachingPlanDocument`, relacionado uno a uno con `TeachingPlan`. El contrato inicial es `1.0.0` y se publica en:

`/schemas/teaching-plan-canonical-v1.schema.json`

El documento integra datos de identificación, oferta académica, contribución al perfil, perfil docente, bibliografía, contenido del Plan, distribución institucional de evaluación y trazabilidad de los recursos institucionales usados.

El JSON descargable del Plan Docente deja de ser un payload parcial y pasa a ser este documento canónico validado.

## Fuente para Word y PDF

Word y PDF se construyen desde la representación canónica. El contenido académico no depende de la posición de las tablas o secciones del archivo institucional.

El formato institucional continúa administrándose como `PLAN_TEMPLATE` versionado en Conocimiento e IA. `TeachingPlan.templateSnapshotId` conserva la versión usada por cada Plan.

## Cambio de formato institucional

Cuando Administración activa una versión posterior:

- los Planes históricos, confirmados o enviados a revisión conservan su formato original;
- pueden seguir revisándose, descargándose y continuar hacia la Guía Didáctica con el snapshot que les corresponde;
- un Plan en borrador todavía no confirmado puede ejecutar **Actualizar al formato vigente**;
- esa acción cambia únicamente el snapshot de formato y no vuelve a generar metodología, planificación, evaluación ni bibliografía;
- el cambio queda auditado como `TEACHING_PLAN_TEMPLATE_UPGRADED`.

Si un formato nuevo posee una estructura que el sistema todavía no reconoce, debe añadirse su mapeo antes de usarlo para renderizar Planes. El sistema no sustituye silenciosamente un formato histórico por otro.

## Persistencia y sincronización

El documento canónico se actualiza después de las operaciones principales que modifican el Plan y se materializa de forma diferida para Planes existentes al abrirlos si todavía no poseen documento canónico vigente.

Cada documento persistido registra checksum SHA-256. Las descargas Word, PDF y JSON devuelven `X-Canonical-Schema-Version` y `X-Content-SHA256`.

## Compatibilidad

- No se eliminan campos existentes de `TeachingPlan`.
- `templateSnapshotId` sigue siendo la referencia histórica del formato.
- La política de evaluación versionada de v32.9.1 forma parte del JSON canónico mediante `evaluationPolicySnapshotId`.
- Los Planes ya generados no requieren regeneración por un cambio posterior de formato.

## Base de datos

La versión incorpora la migración:

`20260821001500_v32_9_2_canonical_teaching_plan`

que crea únicamente `CanonicalTeachingPlanDocument` y su relación con `TeachingPlan`.
