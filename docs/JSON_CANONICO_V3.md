# JSON canónico de la Guía Didáctica — contrato 3.0.0

El Sistema de Gestión Guía didáctica v31 utiliza exclusivamente el contrato canónico `3.0.0` para Guías Didácticas nuevas.
Durante la etapa de construcción no se conserva compatibilidad con los contratos 1.0.0/2.0.0: la migración
`20260815143000_v31_guide_canonical_v3_reset` elimina artefactos de Guía de prueba y reinicia el flujo de Guía desde el Plan Docente vigente.

## Objetivo

El JSON deja de exponer el contenido semanal como un bloque Markdown opaco. Cada semana publica `content.format = "structured"` y una colección de bloques semánticos que permite a EVA, web, móvil o exportadores aplicar estilos puntuales sin interpretar visualmente un documento.

Bloques actualmente identificados:

- `heading`: Unidad, tema o subtema, con `number`, `level`, `role`, `text` y `sourceId`.
- `paragraph`: fragmentos de texto con marcas `bold`, `italic`, `underline` y enlaces.
- `list`: lista ordenada o no ordenada.
- `table`: encabezados y filas independientes.
- `image`: `assetId`, URL de entrega, texto alternativo, leyenda y fuente.
- `callout`: focalizadores `important`, `remember`, `definition`, `example`, `reflection`, `question`, `tip` o `warning`.
- `quote`: cita y atribución.
- `educational_resource`: referencia semántica a un recurso educativo. La ficha, el guion y la bibliografía permanecen encapsulados en `content.resources`; sus tablas de producción no se publican como bloques `table` ni consumen la numeración de tablas académicas.

Los recursos educativos aceptados por el profesor se reconstruyen en `content.resources`, con Bloom, tipo, complejidad, herramienta, propósito, justificación pedagógica, metadatos, guion y bibliografía. El bloque `educational_resource` solo referencia el `resourceId`, título y estado para ubicarlo dentro del flujo del contenido. El formato institucional del guion se genera a partir de la Especificación de recursos educativos activa en Administración → Conocimiento e IA. En el borrador su estado es `proposed`; cuando el contenido está aprobado, el JSON canónico lo publica como `teacher_approved`.

## Numeración curricular

La IA no decide la numeración. El sistema construye la jerarquía desde las relaciones de la oferta académica:

- `Unidad 1: ...`
- `1.1. ...`
- `1.1.1. ...`

A la IA se le entregan `sourceId` y encabezados institucionales; la respuesta contiene únicamente el desarrollo didáctico de cada sección. El sistema monta los encabezados después de validar que exista exactamente una sección por cada `sourceId`.

## API

- `GET /api/projects/:projectId/canonical-json`: descarga el documento canónico v3 completo.
- `GET /api/projects/:projectId/guide/weeks/:weekNumber`: entrega una sola semana estructurada junto con sus activos.
- `GET /schemas/guide-canonical-v3.schema.json`: publica el JSON Schema del contrato.

El encabezado `X-Canonical-Schema-Version` identifica la versión `3.0.0`.

## Recursos educativos

La selección debe ser coherente con resultado de aprendizaje, metodología y Taxonomía de Bloom. El sistema valida la correspondencia de tipos institucionales y genera el guion con dos tablas:

### Recurso interactivo

1. Metadatos: Asignatura, código, Profesor, Semana, URL/Descripción de referencia opcional y Título.
2. Guion: Elementos de referencia | Contenido o Texto | Descripción.

### Video o podcast

1. Los mismos metadatos.
2. Guion: Elementos de referencia | Voz en off | Contenido o Texto | Descripción.

Todo guion debe cerrar con la referencia bibliográfica en APA 7 de la información utilizada.
