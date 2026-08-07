# JSON canónico de la guía didáctica — contrato 1.0.0

## Objetivo

El JSON canónico representa una guía didáctica mediante un contrato estable y validable. En esta
primera etapa se mantiene la persistencia normalizada de la versión 28 y se agrega un documento JSON
paralelo. El editor continúa trabajando con Markdown y la exportación Word conserva su comportamiento.

El contrato público está en `schemas/guide-canonical-v1.schema.json` y la validación usada por la
aplicación está en `src/canonical-guide.ts`.

## Identidad y versión

| Campo | Valor en v1 | Propósito |
|---|---|---|
| `$schema` | `/schemas/guide-canonical-v1.schema.json` | Ubica el esquema JSON público. |
| `schemaVersion` | `1.0.0` | Identifica la versión del contrato. |
| `documentType` | `didactic-guide` | Evita confundir este documento con otros JSON. |
| `documentId` | UUID del proyecto | Mantiene la identidad entre PostgreSQL y los exportadores. |
| `language` | `es` | Declara el idioma del contenido. |

Los cambios incompatibles deben publicarse mediante un esquema nuevo y una versión mayor. No se debe
alterar retrospectivamente `guide-canonical-v1.schema.json` para aceptar una estructura incompatible.

## Estructura principal

| Sección | Contenido |
|---|---|
| `metadata` | Proyecto, nivel, facultad, carrera, docente, asignatura, modalidad y periodo. |
| `planning.sourceMatrix` | Nombre del archivo y filas originales de planificación. |
| `bibliography` | Bibliografía básica, complementaria y REA en Markdown. |
| `weeks` | Estado, contenido Markdown, versión y filas de matriz vinculadas a cada semana. |
| `assets` | Metadatos y rutas de imágenes; nunca contiene bytes ni base64. |
| `traceability` | Sistema de origen y fechas de creación/actualización. |

`unitContentLiteral` conserva literalmente el valor almacenado desde la columna `Unidad/Contenido`.
Un conversor o exportador no debe renombrar, reorganizar ni inferir unidades, temas o subtemas.
Los identificadores `matrix-row-N` se derivan del orden de la matriz y permanecen estables aunque la
persistencia normalizada vuelva a crear internamente sus filas.

## Persistencia dual

La tabla `CanonicalGuideDocument` conserva el JSON, su versión de contrato y su SHA-256. Cada llamada
válida a `POST /api/projects/sync` actualiza en una sola transacción:

1. Los modelos normalizados de proyecto, matriz y semanas.
2. El documento canónico validado.
3. El registro de auditoría.

Si falla la construcción o la validación del JSON, la transacción completa se revierte. Por tanto, no
puede quedar un JSON canónico que represente parcialmente el último guardado.

## Activos de imagen

Cada imagen se representa en `assets` con:

- una ruta lógica `fileName`, preparada para una futura exportación en paquete;
- una ruta `storage.href` para recuperar el activo mediante la API;
- metadatos de accesibilidad, procedencia, estilo y trazabilidad de generación.

El JSON no incluye `imageData`, URL `data:` ni contenido base64. En esta etapa los bytes siguen en el
almacenamiento compatible con v28 y se entregan mediante `/api/generated-images/:id`. La migración
física a un volumen u objeto externo podrá realizarse después sin cambiar la estructura del contrato.

## Instalación y conversión inicial

Use una base independiente para v29. Después de configurar `DATABASE_URL`:

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:backfill-canonical
npm test
npm run build
```

La conversión inicial es idempotente: puede ejecutarse nuevamente y actualizará el documento de cada
proyecto. Los proyectos sin una matriz completa y válida se omiten y se informan en la consola sin
interrumpir la conversión de los demás.

## API y descarga

- `GET /schemas/guide-canonical-v1.schema.json`: contrato JSON Schema público.
- `GET /api/projects/:id/canonical-json`: descarga autenticada del documento perteneciente al usuario.

La descarga vuelve a validar el documento almacenado. Si el registro no existe, la API responde `409`;
se debe guardar otra vez el proyecto o ejecutar la conversión inicial.

## Compatibilidad durante la transición

- `ProjectWeek.draftContent`, `ProjectWeek.approvedContent` y `WeekVersion.content` siguen en Markdown.
- `POST /api/download-word` no cambia.
- Las solicitudes actuales de generación y sincronización conservan su estructura.
- Los proyectos v28 se convierten sin modificar su contenido ni sus versiones semanales.
- El JSON será la entrada principal de generadores y exportadores en una etapa posterior, una vez
  verificada esta persistencia dual.
