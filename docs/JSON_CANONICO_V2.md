# JSON canónico de la guía didáctica — contrato 2.0.0

## Objetivo

El contrato 2.0.0 amplía la guía canónica con la alineación académica solicitada para cada
asignatura. Conserva la matriz, bibliografía, semanas, activos y trazabilidad del contrato 1.0.0,
pero agrega tres colecciones dentro de `metadata.academicProfile`:

- `professionalProfileCompetencies`: competencias del perfil profesional ingresadas una por una.
- `graduateProfileResults`: resultados de perfil de egreso ingresados uno por uno.
- `utplGenericCompetencies`: competencias seleccionadas exclusivamente del catálogo institucional.

El esquema público está en `schemas/guide-canonical-v2.schema.json`. Los documentos nuevos declaran
`schemaVersion: "2.0.0"` y `$schema: "/schemas/guide-canonical-v2.schema.json"`.

## Persistencia

El modelo `Project` conserva las tres colecciones como arreglos de texto. La API valida que los
proyectos creados o actualizados tengan al menos un elemento en cada sección y que las competencias
genéricas pertenezcan a este catálogo:

1. Desarrollo personal integral.
2. Trabajo colaborativo.
3. Innovación y emprendimiento con visión de propósito.
4. Mentalidad sostenible.
5. Ciudadanía global.

Cada sincronización reconstruye el documento canónico 2.0.0 y actualiza su checksum SHA-256 dentro de
la misma transacción que guarda el proyecto, la matriz y las semanas.

## Compatibilidad

La ruta de descarga reconoce y valida tanto documentos 1.0.0 como 2.0.0. El esquema
`guide-canonical-v1.schema.json` no se modifica. Al ejecutar `npm run db:backfill-canonical`, los
proyectos existentes se reconstruyen como 2.0.0; los campos nuevos que todavía no hayan sido
completados se representan como arreglos vacíos hasta que el profesor actualice el proyecto.

## Despliegue

Después de apuntar `DATABASE_URL` a la base correspondiente:

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:backfill-canonical
npm test
npm run build
```
