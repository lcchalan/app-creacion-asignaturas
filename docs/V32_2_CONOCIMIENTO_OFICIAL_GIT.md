# v32.2 · Conocimiento institucional oficial sincronizado con Git

## Objetivo

En el ambiente de pruebas, los documentos oficiales administrados desde **Conocimiento e IA** se respaldan también en Git, pero únicamente en su versión activa vigente. Git no conserva copias visibles `v1`, `v2`, `v3`, etc.; el historial técnico queda en los commits.

## Separación de responsabilidades

- `knowledge/uploads/`: área operativa/temporal usada por la aplicación. Continúa ignorada por Git.
- `knowledge/official/`: copia canónica de los documentos oficiales activos. Sí se versiona en Git.
- PostgreSQL: conserva la configuración operativa de `KnowledgeDocument`, incluyendo prioridad, ámbitos, texto procesado y estados.
- Usuarios, catálogos académicos, asignaciones, proyectos, planes, revisiones y notificaciones siguen exclusivamente en PostgreSQL y no se exportan a Git.

## Regla de versión

Cada clave activa genera un único archivo canónico:

```text
knowledge/official/<clave>.<extensión>
```

Por ejemplo, una nueva versión de `lineamientos-sistema-modular` reemplaza:

```text
knowledge/official/lineamientos-sistema-modular.pdf
```

sin crear archivos `-v2`, `-v3`, etc.

## Manifiesto

`knowledge/official/manifest.json` contiene únicamente los documentos activos sincronizados, junto con los metadatos institucionales necesarios para auditar la correspondencia con PostgreSQL. No incluye IDs ni versiones históricas de la base de datos.

## Sincronización

Se incorpora:

```bash
npm run knowledge:sync-official
```

El comando:

1. consulta los `KnowledgeDocument` activos administrados desde `knowledge/uploads/` o ya sincronizados;
2. copia cada archivo a su ruta canónica en `knowledge/official/`;
3. actualiza `manifest.json`;
4. retira de `knowledge/official/` las copias que ya no figuren activas;
5. no elimina ni modifica usuarios, catálogos, asignaciones ni otros datos transaccionales.

Además, las operaciones administrativas de creación/activación, edición de un documento activo, activación y baja intentan actualizar automáticamente la copia oficial. Si la copia al filesystem falla, la operación académica en PostgreSQL no se revierte; el error queda registrado en consola y puede corregirse ejecutando manualmente `npm run knowledge:sync-official` antes del commit.

## Flujo recomendado antes de Git

```bash
npm run knowledge:sync-official
git status --short
git diff --check
npm test
npm run build
```

Después se revisan específicamente los archivos bajo `knowledge/official/` antes de ejecutar `git add`, `git commit` y `git push`.
