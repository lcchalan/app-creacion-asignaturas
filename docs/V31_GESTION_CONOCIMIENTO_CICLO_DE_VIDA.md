# V31 — Gestión del ciclo de vida de Conocimiento e IA

## Objetivo

Diferenciar claramente la corrección de configuración de una versión, la creación deliberada de una nueva versión, la consulta del historial, la descarga del archivo original y la baja controlada de recursos institucionales.

## Tipos de recurso

Los documentos institucionales se clasifican de forma explícita como:

- Documento institucional.
- Formato del Plan Docente.
- Prompt del Plan Docente.
- Prompt de la Guía Didáctica.

El título no reemplaza esta clasificación. La interfaz y el servidor advierten cuando un título como «Formato Plan Docente» está configurado como «Documento institucional».

## Editar configuración frente a crear una nueva versión

### Guardar cambios

Actualiza la versión seleccionada sin incrementar su número. Se usa para corregir:

- tipo de recurso;
- título o clave;
- prioridad;
- vigencia;
- aplicación al Plan Docente o a la Guía Didáctica;
- nivel, modalidad, duración o tipo de asignatura;
- texto controlado;
- archivo original, únicamente cuando el administrador seleccione expresamente un reemplazo.

### Crear nueva versión

Es una acción explícita. Crea el siguiente número de versión y conserva el original de la versión seleccionada cuando no se adjunta otro archivo. La activación de la nueva versión desactiva la anterior de la misma clave, sin eliminarla.

## Versiones e historial

La lista principal muestra la versión activa —o, si no existe, la versión vigente más reciente— de cada recurso. Las versiones anteriores permanecen ocultas hasta pulsar «Ver versiones».

El historial permite:

- consultar una versión;
- descargar su archivo original;
- utilizarla como base para crear una nueva versión;
- conocer su estado y la fecha de actualización.

## Descargas

- **Descargar original:** entrega el PDF o DOCX subido por el administrador. Si una versión histórica almacenó únicamente texto Markdown, se recupera el original PDF/DOCX más reciente de la misma línea de versiones.
- **Descargar texto procesado:** entrega por separado la síntesis o texto controlado utilizado por la IA.

## Baja de recursos

«Dar de baja» no elimina el registro ni el archivo. Cambia su estado a `ARCHIVED` y conserva:

- versión;
- archivo y huella;
- usuario y fecha de baja;
- motivo;
- referencias de planes y guías históricos.

Si se intenta dar de baja la única fuente activa requerida para generar el Plan Docente o la Guía Didáctica, el sistema exige una segunda confirmación y advierte que las nuevas generaciones quedarán bloqueadas hasta activar un reemplazo.

## Compatibilidad de tipos de asignatura

Los códigos internos, por ejemplo `TA-AC`, se mantienen para las relaciones de base de datos. En la interfaz, mensajes y validaciones se muestra el nombre del catálogo, por ejemplo `Tipo A - Conceptual`.

La compatibilidad de un recurso se evalúa contra el código y el nombre del tipo de asignatura para mantener soporte a datos históricos.

## Ámbito por proceso de las Especificaciones funcionales

Las Especificaciones funcionales pueden aplicarse de forma independiente a estos procesos:

- generación del Plan Docente;
- adaptación del Plan Docente 16 → 8;
- generación de la Guía Didáctica;
- adaptación de la Guía Didáctica 16 → 8.

El ámbito por proceso se almacena en `GenerationInstruction.processes` y se combina con nivel académico, modalidad, duración y tipo de asignatura. Esto permite ajustar una política pedagógica de adaptación sin alterar otros procesos de generación.

La propuesta de adaptación y el Plan Docente conservan snapshots de las Especificaciones funcionales utilizadas, de modo que una actualización posterior no se aplique retroactivamente a una propuesta ya aprobada.

## Limpieza controlada durante construcción

Mientras el sistema se encuentra en construcción puede ejecutarse `npm run db:cleanup-ai-knowledge` para obtener una vista previa de las versiones no activas. La ejecución real requiere `--apply`.

La limpieza conserva todos los registros con estado `ACTIVE` y elimina de la base de datos versiones anteriores de Especificaciones funcionales y documentos de conocimiento. También depura snapshots que apuntaban a versiones eliminadas. Las versiones de indicadores inactivas solo se eliminan cuando no tienen revisiones académicas asociadas; una versión con revisiones se conserva para no destruir trazabilidad de evaluación.

Antes de eliminar registros, el comando genera un respaldo JSON en `backups/`. Los archivos físicos de conocimiento no se borran automáticamente y quedan como respaldo de seguridad fuera del catálogo activo.

## Migración

La migración `20260813020000_v31_knowledge_lifecycle` agrega:

- `updatedAt`;
- `retiredAt`;
- `retirementReason`;
- `retiredById`;
- relaciones con el usuario que ejecutó la baja.

La migración `20260816113000_v31_adaptation_functional_specs` agrega el ámbito `processes` a las Especificaciones funcionales y los snapshots de especificaciones utilizados por propuestas de adaptación y Planes Docentes.
