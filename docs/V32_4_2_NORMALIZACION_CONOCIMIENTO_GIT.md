# v32.4.2 · Normalización de Conocimiento e IA en Git

## Objetivo

Separar físicamente en Git los dos tipos administrados desde **Conocimiento e IA** sin mezclar documentos institucionales con especificaciones funcionales:

```text
knowledge/
├── official/          Documentos institucionales activos
├── specifications/    Especificaciones funcionales/configuración activa
└── uploads/            Cargas temporales, fuera de Git
```

PostgreSQL continúa siendo la fuente operativa de versiones, estados, ámbitos y trazabilidad. Git conserva únicamente la representación canónica de la versión activa actual; el historial documental también queda disponible en los commits.

## Documentos institucionales

Los registros `KnowledgeDocument` activos se sincronizan en `knowledge/official/` con un nombre estable derivado de su clave, sin número de versión en el archivo. El `storagePath` de la versión activa se actualiza a la ruta canónica una vez que el archivo fue copiado y validado.

Esta normalización incorpora también los documentos heredados que permanecían directamente en `knowledge/`, entre ellos:

- `normas-apa` → `knowledge/official/normas-apa.txt`
- `indicaciones-rea` → `knowledge/official/indicaciones-rea.txt`

`metodologias-activas` conserva como fuente vigente la versión ya administrada en `knowledge/official/`; la copia `.txt` heredada de la raíz se retira cuando la normalización comprueba que existe una versión activa canónica.

## Especificaciones funcionales

Los registros activos de `GenerationInstruction` se serializan desde PostgreSQL a:

```text
knowledge/specifications/<clave>.txt
```

Cada cambio o activación desde Administración actualiza la representación canónica en Git. Las versiones anteriores no se mantienen como archivos separados; permanecen en PostgreSQL y en el historial de Git.

La especificación heredada `especificacion-funcional`, que anteriormente podía existir como `KnowledgeDocument`, se normaliza a `GenerationInstruction`. El registro documental heredado se archiva únicamente cuando existe una especificación funcional activa equivalente.

La configuración activa de indicadores de la Guía Didáctica (`IndicatorVersion`) se exporta de forma determinista a:

```text
knowledge/specifications/indicadores-generales.txt
```

Así, los cambios realizados desde **Administración → Listas de cotejo → Guía Didáctica** también quedan representados en Git sin convertir el archivo histórico en una segunda fuente operativa.

## Manifiestos

Se mantienen dos manifiestos independientes:

- `knowledge/official/manifest.json`: documentos institucionales activos.
- `knowledge/specifications/manifest.json`: especificaciones funcionales activas y configuración activa de indicadores de la Guía.

## Normalización inicial

Después de instalar v32.4.2 se ejecuta una sola vez:

```bash
npm run knowledge:normalize-layout
```

El comando:

1. normaliza `especificacion-funcional` al modelo `GenerationInstruction` cuando corresponde;
2. garantiza la especificación de adaptación 16 → 8 si aún depende del archivo heredado;
3. sincroniza documentos y especificaciones con Git;
4. actualiza las rutas activas de `KnowledgeDocument` a `knowledge/official/`;
5. retira archivos heredados de la raíz únicamente cuando demuestra que existe una copia canónica activa.

Es idempotente y no requiere migración Prisma.

## Compatibilidad

Se conservan los comandos existentes:

```bash
npm run knowledge:check-official
npm run knowledge:sync-official
```

Y se agregan alias más descriptivos:

```bash
npm run knowledge:check-git
npm run knowledge:sync-git
```

La sincronización automática se ejecuta después de activar/editar/dar de baja documentos institucionales, especificaciones funcionales y la lista de indicadores de la Guía. Un fallo de escritura en Git no revierte la decisión académica o administrativa en PostgreSQL; el comando manual permite reparar la copia canónica antes del commit.
