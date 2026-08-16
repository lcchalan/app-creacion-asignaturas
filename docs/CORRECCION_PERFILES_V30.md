> **Documento histórico V30.** El contrato canónico 2.0.0 descrito aquí fue reemplazado por la Guía canónica 3.0.0 del Sistema de Gestión Guía didáctica. No debe usarse como contrato vigente.

# Correcciones de perfiles y datos de asignatura

Este paquete parte de la versión estable `v29`. Debe aplicarse en una rama nueva; no se debe mover ni
recrear la etiqueta `v29`.

## Cambios incluidos

- El administrador asigna un solo rol mediante una lista desplegable.
- La tabla de usuarios muestra únicamente el rol asignado.
- La creación y la edición individual, así como las cargas masivas, reemplazan la asignación anterior
  para evitar que un usuario acumule roles.
- El nombre del profesor se obtiene de la sesión y el servidor lo vuelve a imponer al guardar.
- Se agregan competencias del perfil profesional, resultados de perfil de egreso y competencias
  genéricas de la UTPL.
- Los tres grupos se guardan en `Project`, se incorporan al contexto de generación y se exportan en el
  JSON canónico 2.0.0.
- Los documentos canónicos 1.0.0 existentes continúan siendo descargables y validables.

## Aplicación y verificación

Después de copiar los archivos sobre una rama creada desde el commit etiquetado como `v29`:

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:backfill-canonical
npm test
npm run build
```

El *backfill* actualiza los documentos canónicos existentes a 2.0.0. Los proyectos anteriores quedan
con los tres arreglos vacíos hasta que el profesor los complete; la interfaz exige al menos un elemento
en cada sección antes de un nuevo guardado.

## Verificación mínima en PostgreSQL

```sql
SELECT
  "professionalProfileCompetencies",
  "graduateProfileResults",
  "utplGenericCompetencies"
FROM "Project"
ORDER BY "updatedAt" DESC
LIMIT 1;
```

En `CanonicalGuideDocument.document`, los mismos valores deben aparecer dentro de
`metadata.academicProfile`, con `schemaVersion` igual a `2.0.0`.
