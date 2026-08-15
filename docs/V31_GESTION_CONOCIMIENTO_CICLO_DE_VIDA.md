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

## Migración

La migración `20260813020000_v31_knowledge_lifecycle` agrega:

- `updatedAt`;
- `retiredAt`;
- `retirementReason`;
- `retiredById`;
- relaciones con el usuario que ejecutó la baja.
