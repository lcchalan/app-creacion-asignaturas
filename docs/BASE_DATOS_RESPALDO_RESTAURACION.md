# Base de datos, respaldo y restauración

## 1. Regla principal

Un respaldo completo de la versión 28 siempre tiene dos partes:

1. Un volcado lógico de PostgreSQL.
2. Una copia de `knowledge/uploads`.

El repositorio Git no contiene usuarios, proyectos, semanas, imágenes ni
documentos operativos. Las imágenes están dentro de PostgreSQL, mientras que los
archivos originales cargados por administración están en el sistema de archivos.

## 2. Instalación limpia

Use este procedimiento únicamente cuando no se recuperarán datos anteriores:

```bash
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run build
npm start
```

Antes del `seed`, defina `LOCAL_USER_EMAIL` e `INITIAL_ADMIN_PASSWORD`. El
`seed` se ejecuta una sola vez.

Verifique el historial:

```bash
npx prisma migrate status
```

En producción no use:

```text
prisma migrate dev
prisma db push
prisma migrate reset
```

## 3. Preparar un respaldo

Cree un directorio privado fuera de Git:

```bash
install -d -m 0700 respaldos
```

Use nombres que identifiquen versión, fecha y entorno:

```text
guias_v28_produccion_AAAAMMDD-HHMM.dump
knowledge-uploads_v28_AAAAMMDD-HHMM.tar.gz
conteos_v28_AAAAMMDD-HHMM.txt
checksums_v28_AAAAMMDD-HHMM.sha256
```

No publique estos archivos. Pueden contener datos personales, hashes de
contraseñas, sesiones, contenido académico e imágenes.

## 4. Respaldo con herramientas PostgreSQL

Defina los datos sin escribir la contraseña en el historial:

```bash
GUIAS_PG_HOST="servidor-postgresql"
GUIAS_PG_PORT="5432"
GUIAS_PG_USER="guias_app"
GUIAS_PG_DATABASE="guias_didacticas"
read -r -s -p "Contraseña PostgreSQL: " GUIAS_PG_PASSWORD
echo
export PGPASSWORD="$GUIAS_PG_PASSWORD"
```

Genere un archivo en formato personalizado:

```bash
pg_dump \
  --host="$GUIAS_PG_HOST" \
  --port="$GUIAS_PG_PORT" \
  --username="$GUIAS_PG_USER" \
  --dbname="$GUIAS_PG_DATABASE" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="respaldos/guias_v28_produccion_AAAAMMDD-HHMM.dump"
```

El formato `custom` está comprimido y permite inspección y restauración selectiva:
<https://www.postgresql.org/docs/17/app-pgdump.html>.

Compruebe que el archivo es legible:

```bash
pg_restore --list \
  "respaldos/guias_v28_produccion_AAAAMMDD-HHMM.dump" \
  > "respaldos/guias_v28_produccion_AAAAMMDD-HHMM-contenido.txt"
```

Limpie las variables de la sesión:

```bash
unset PGPASSWORD GUIAS_PG_PASSWORD
```

Una lista válida es una verificación básica, no sustituye una restauración de
prueba.

## 5. Respaldo cuando PostgreSQL usa Docker Compose

Desde la raíz del proyecto:

```bash
docker compose up -d postgres
docker compose ps
install -d -m 0700 respaldos
```

Genere el volcado:

```bash
docker compose exec -T postgres \
  pg_dump -U guias_app -d guias_didacticas \
  --format=custom --no-owner --no-privileges \
  > "respaldos/guias_v28_local_AAAAMMDD-HHMM.dump"
```

Inspecciónelo usando las herramientas del contenedor:

```bash
docker compose exec -T postgres pg_restore --list \
  < "respaldos/guias_v28_local_AAAAMMDD-HHMM.dump" \
  > "respaldos/guias_v28_local_AAAAMMDD-HHMM-contenido.txt"
```

No ejecute `docker compose down -v`: la opción `-v` elimina el volumen que
contiene PostgreSQL.

## 6. Copiar `knowledge/uploads`

Desde la raíz de la misma versión de código y en el mismo punto temporal del
respaldo:

```bash
tar -czf \
  "respaldos/knowledge-uploads_v28_AAAAMMDD-HHMM.tar.gz" \
  knowledge/uploads
```

En una plataforma administrada, copie el contenido desde el disco persistente.
Si la plataforma ofrece instantáneas, consérvelas como complemento, pero mantenga
también una copia exportable independiente.

## 7. Registrar conteos de control

Conéctese mediante `psql` y ejecute:

```sql
SELECT 'User' AS tabla, COUNT(*) AS registros FROM "User"
UNION ALL SELECT 'Project', COUNT(*) FROM "Project"
UNION ALL SELECT 'Matrix', COUNT(*) FROM "Matrix"
UNION ALL SELECT 'MatrixRow', COUNT(*) FROM "MatrixRow"
UNION ALL SELECT 'ProjectWeek', COUNT(*) FROM "ProjectWeek"
UNION ALL SELECT 'WeekVersion', COUNT(*) FROM "WeekVersion"
UNION ALL SELECT 'GeneratedImage', COUNT(*) FROM "GeneratedImage"
UNION ALL SELECT 'KnowledgeDocument', COUNT(*) FROM "KnowledgeDocument"
UNION ALL SELECT 'GenerationInstruction', COUNT(*) FROM "GenerationInstruction"
UNION ALL SELECT 'GuideReview', COUNT(*) FROM "GuideReview"
UNION ALL SELECT 'AuditLog', COUNT(*) FROM "AuditLog"
ORDER BY tabla;
```

Guarde la salida como `conteos_v28_AAAAMMDD-HHMM.txt`. Estos conteos permiten
comparar origen y destino, aunque no demuestran por sí solos que cada registro
sea idéntico.

Registre también el tamaño aproximado de la base:

```sql
SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano_base;
```

## 8. Crear comprobaciones de integridad

En Linux:

```bash
sha256sum \
  "respaldos/guias_v28_produccion_AAAAMMDD-HHMM.dump" \
  "respaldos/knowledge-uploads_v28_AAAAMMDD-HHMM.tar.gz" \
  > "respaldos/checksums_v28_AAAAMMDD-HHMM.sha256"
```

En macOS:

```bash
shasum -a 256 \
  "respaldos/guias_v28_produccion_AAAAMMDD-HHMM.dump" \
  "respaldos/knowledge-uploads_v28_AAAAMMDD-HHMM.tar.gz" \
  > "respaldos/checksums_v28_AAAAMMDD-HHMM.sha256"
```

Antes de restaurar, vuelva a calcular y compare las huellas.

## 9. Restaurar en una base vacía

### 9.1 Condiciones

- Detenga escrituras en el origen o use un respaldo consistente ya terminado.
- Restaure primero en una base de prueba, nunca directamente sobre producción.
- Cree una base totalmente vacía.
- No ejecute migraciones ni `seed` antes del `pg_restore`.
- Restaure solo archivos creados por una fuente confiable. PostgreSQL advierte
  que una restauración ejecuta instrucciones contenidas en el volcado:
  <https://www.postgresql.org/docs/17/app-pgrestore.html>.

### 9.2 Crear el destino de prueba

Si el usuario tiene permiso para crear bases:

```bash
createdb \
  --host="servidor-postgresql-destino" \
  --port="5432" \
  --username="guias_app" \
  --owner="guias_app" \
  guias_restore_test
```

En un proveedor administrado, cree la base desde su panel si el permiso no está
disponible.

### 9.3 Restaurar PostgreSQL

```bash
pg_restore \
  --host="servidor-postgresql-destino" \
  --port="5432" \
  --username="guias_app" \
  --dbname="guias_restore_test" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "respaldos/guias_v28_produccion_AAAAMMDD-HHMM.dump"
```

`--exit-on-error` evita que una restauración con errores continúe silenciosamente.

### 9.4 Restaurar los archivos

Desde la raíz de la aplicación destino:

```bash
tar -xzf \
  "respaldos/knowledge-uploads_v28_AAAAMMDD-HHMM.tar.gz"
```

Asigne el propietario que ejecuta la aplicación:

```bash
sudo chown -R guiasapp:guiasapp knowledge/uploads
sudo chmod -R u=rwX,g=rX,o= knowledge/uploads
```

En Render, transfiera los archivos al disco montado en
`/opt/render/project/src/knowledge/uploads`.

### 9.5 Verificar la restauración

1. Ejecute los conteos de la sección 7 y compárelos con el manifiesto.
2. Apunte temporalmente una copia de la aplicación v28 a la base restaurada.
3. Ejecute `npx prisma migrate status`; no debe indicar migraciones fallidas.
4. Compruebe `/health/database`.
5. Inicie sesión con una cuenta de prueba.
6. Abra un proyecto, una semana y una imagen existentes.
7. Descargue un documento administrativo restaurado.
8. Exporte un Word de prueba.

Solo después de esta validación se aprueba el respaldo para recuperación real.

## 10. Restauración de prueba con Docker

Con el contenedor del proyecto iniciado:

```bash
docker compose exec -T postgres \
  createdb -U guias_app -O guias_app guias_restore_test

docker compose exec -T postgres \
  pg_restore -U guias_app -d guias_restore_test \
  --no-owner --no-privileges --exit-on-error \
  < "respaldos/guias_v28_local_AAAAMMDD-HHMM.dump"
```

Use una `DATABASE_URL` temporal que apunte a `guias_restore_test` para las
pruebas. No cambie la URL de producción.

## 11. Paquete de recuperación recomendado

```text
respaldo-v28-AAMMDD-HHMM/
├── guias_v28_produccion_AAAAMMDD-HHMM.dump
├── guias_v28_produccion_AAAAMMDD-HHMM-contenido.txt
├── knowledge-uploads_v28_AAAAMMDD-HHMM.tar.gz
├── conteos_v28_AAAAMMDD-HHMM.txt
├── checksums_v28_AAAAMMDD-HHMM.sha256
└── version-codigo.txt
```

`version-codigo.txt` debe contener la URL del repositorio, tag, hash de commit,
fecha, entorno, versión de PostgreSQL y responsable del respaldo.

## 12. Frecuencia y conservación

Como punto de partida para un entorno institucional:

- Respaldo diario de PostgreSQL.
- Copia diaria de `knowledge/uploads` coordinada con el volcado.
- Una restauración de prueba mensual.
- Retención definida por la política institucional; por ejemplo, diarios,
  semanales y mensuales en ubicaciones separadas.
- Cifrado en tránsito y en reposo.
- Al menos una copia fuera del servidor de producción.
- Acceso limitado y registro de descargas o restauraciones.

La frecuencia definitiva debe responder al volumen de cambios y al máximo de
datos que la institución puede aceptar perder.
