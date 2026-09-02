# V33.0.5.1 - Conservacion del snapshot de formato durante correcciones

## Objetivo

Evitar que una regeneracion o una nueva propuesta de adaptacion dentro del mismo ciclo institucional sustituya el formato historico del Plan Docente por el formato que Administracion tenga activo en ese momento.

## Regla funcional

- Plan nuevo o borrador sin confirmacion/revision: puede usar el formato institucional activo.
- Plan confirmado o con workflow institucional existente: conserva su templateSnapshotId durante todo el ciclo, incluidas correcciones.
- El formato activo actual se mantiene separado y solo se informa como formato vigente.

## Cambios

1. activePlanContext acepta opcionalmente un templateSnapshotId y, cuando se informa, carga el formato historico mediante teachingPlanTemplateSnapshot.
2. La generacion/regeneracion del Plan incluye reviewWorkflow para decidir si el formato ya esta fijado.
3. El upsert conserva el snapshot resuelto del ciclo.
4. La respuesta de /teaching-plan/generate usa el bundle canonico para separar format.snapshot, format.active y format.outdated.
5. La adaptacion del Plan reutiliza el snapshot historico cuando pertenece a un ciclo ya confirmado o iniciado en revision.
6. Se agrega una prueba de regresion especifica.

## No incluido

- No se modifica Prisma ni se crea migracion.
- No se ejecuta seed.
- No se modifica Word ni PDF.
- No se altera la logica de teacherReviewedAt durante correcciones.
- No se hace commit ni push.

## Validacion recomendada

```bash
node --import tsx --test \
  tests/teaching-plan-template-snapshot-corrections.test.ts \
  tests/teaching-plan-applied-format.test.ts \
  tests/teaching-plan-format-versioning.test.ts \
  tests/teaching-plan-review-readiness.test.ts \
  tests/teaching-plan-review-readiness-ui.test.ts \
  tests/teaching-plan-validator-general-ui.test.ts

npm test
npm run build
```

## Prueba funcional principal

1. Generar un Plan con V2.
2. Confirmarlo e iniciar revision institucional.
3. Activar V1 en Administracion.
4. Solicitar correcciones desde el par.
5. Regenerar/corregir el Plan.
6. Verificar: formato aplicado V2, formato vigente V1.
7. Verificar Word, PDF y JSON: el snapshot aplicado continua en V2.
