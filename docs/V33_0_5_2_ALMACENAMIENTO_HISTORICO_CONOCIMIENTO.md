# V33.0.5.2 - Almacenamiento historico inmutable de Conocimiento e IA

## Problema confirmado

Las versiones V1 y V2 del formato FPDSM tenian ids, versiones y checksums distintos, pero ambas terminaron con el mismo storagePath: knowledge/official/fpdsm.docx. Al cambiar la version activa, esa ruta canonica se sobrescribia y todas las versiones que apuntaban a ella descargaban el contenido vigente, no su archivo historico.

## Causa

syncOfficialKnowledgeFromDatabase copiaba correctamente la version activa a knowledge/official, pero luego reemplazaba KnowledgeDocument.storagePath por canonicalPath. knowledge-git-restore tambien persistia item.gitPath (knowledge/official/...) directamente como storagePath.

## Regla corregida

- knowledge/uploads conserva la copia historica/inmutable usada por PostgreSQL.
- knowledge/official conserva solo la copia canonica ACTIVE destinada a Git.
- La sincronizacion a Git nunca relinkea storagePath.
- La restauracion desde Git materializa primero una copia en knowledge/uploads y luego guarda esa ruta en PostgreSQL.
- Antes de sincronizar se valida que el archivo fisico coincida con el checksum historico registrado.

## Reparacion de datos existentes

Se agrega scripts/repair-knowledge-storage-v33-0-5-2.ts.

Por defecto funciona en modo diagnostico y no modifica datos. Busca copias en knowledge/uploads por checksum y version. Si una version canonica actual coincide con el checksum registrado y no existe copia previa, puede crear una copia historica al aplicar.

La aplicacion requiere --apply y actualiza exclusivamente KnowledgeDocument.storagePath de los casos resueltos de forma segura. No cambia checksum, version, estado ni knowledge/official.

## No incluido

- No hay cambio de Prisma ni migracion.
- No hay seed.
- No se ejecuta knowledge:restore-from-git.
- No se hace commit ni push.
- No se modifica la logica de Plan Docente de V33.0.5.1.

## Validacion

1. Ejecutar las pruebas especificas.
2. Ejecutar npm test.
3. Ejecutar npm run build.
4. Ejecutar el reparador sin --apply y revisar las rutas propuestas.
5. Solo despues ejecutar el reparador con --apply.
6. Descargar V1 y V2 desde Conocimiento e IA y verificar que cada una conserva su archivo.
