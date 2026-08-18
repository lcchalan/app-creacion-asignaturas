# v32.4.3 — Restauración de Conocimiento e IA desde Git

## Objetivo

Completar el respaldo autocontenido de **Conocimiento e IA** para que el repositorio pueda reconstruir únicamente esa parte de PostgreSQL sin depender de la base de datos de desarrollo.

La dirección de sincronización queda completa:

- `knowledge:sync-git`: PostgreSQL → Git.
- `knowledge:restore-from-git`: Git → PostgreSQL.
- `knowledge:check-git`: diagnóstico de alineación.
- `knowledge:normalize-layout`: normalización histórica de rutas.

## Datos incluidos

La restauración escribe exclusivamente en las estructuras relacionadas con Conocimiento e IA:

- `KnowledgeDocument` para documentos institucionales.
- `GenerationInstruction` para especificaciones funcionales.
- `IndicatorVersion` y `GuideIndicator` para la configuración de indicadores de la Guía Didáctica.

No modifica usuarios, roles, catálogos, oferta académica, asignaciones, Planes Docentes, Guías Didácticas, revisiones, notificaciones ni auditoría.

## Manifiestos

### Documentos institucionales

`knowledge/official/manifest.json` conserva metadatos, ruta canónica y checksum SHA-256 de cada documento ACTIVE.

### Especificaciones funcionales

A partir de v32.4.3, `knowledge/specifications/manifest.json` usa `schemaVersion: 2`.

Además del archivo de texto legible de `indicadores-generales`, el manifiesto conserva la estructura completa de `GuideIndicator`, incluyendo criterios inactivos. Esto permite reconstruir la configuración sin intentar interpretar texto libre.

## Seguridad del restore

Antes de escribir en PostgreSQL el proceso valida:

1. existencia y versión de ambos manifiestos;
2. rutas canónicas dentro del repositorio;
3. existencia de todos los archivos;
4. checksums de los archivos;
5. checksum estructural de los indicadores;
6. ausencia de claves duplicadas;
7. ausencia de conflictos con versiones ACTIVE diferentes en PostgreSQL.

Si existe un conflicto, la restauración se detiene antes de escribir.

## Idempotencia

- Documento institucional ACTIVE con el mismo checksum: se alinea su metadata/ruta canónica sin crear una versión nueva.
- Especificación ACTIVE de la misma versión y contenido: se alinea sin duplicar.
- Configuración activa de indicadores idéntica: no se modifica.
- Versión ACTIVE distinta: se reporta conflicto y no se sobrescribe.

En una base vacía, los documentos institucionales se crean como la primera versión disponible para cada clave. Las especificaciones funcionales y la configuración de indicadores conservan la versión registrada en el manifiesto.

## Preparación del repositorio

Después de aplicar v32.4.3 es obligatorio ejecutar una vez:

```bash
npm run knowledge:sync-git
```

Esto regenera `knowledge/specifications/manifest.json` con `schemaVersion: 2` y la estructura de indicadores necesaria para la restauración.

Luego:

```bash
npm run knowledge:check-git
npm test
npm run build
git diff --check
```

Solo después de estas comprobaciones debe hacerse el commit.
