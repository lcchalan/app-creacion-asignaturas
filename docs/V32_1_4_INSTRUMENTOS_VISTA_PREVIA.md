# v32.1.4 — Instrumentos de evaluación en la vista previa

## Objetivo

Mostrar en la vista HTML del Plan Docente la configuración completa de los instrumentos de evaluación preparados para EVA, sin incorporar ese detalle en la exportación PDF.

## Comportamiento

- La sección E conserva la tabla de actividades calificadas.
- Debajo de esa tabla, la vista previa HTML muestra los instrumentos que tienen `instrumentConfig`.
- Cuestionario: muestra modo de calificación, número de preguntas, tiempo y fórmula de conversión.
- Rúbrica, lista de cotejo y escala de valoración: muestran indicadores, niveles, descriptores, puntajes y máximo sobre 10.
- El mismo HTML es visible para el docente y para los roles revisores, porque ambos usan `teachingPlanPreviewHtml`.
- No se modifica `src/teaching-plan-word.ts` ni la ruta de exportación PDF. El PDF sigue mostrando el nombre del instrumento en la tabla de evaluación, pero no su configuración detallada, indicadores, niveles ni rúbrica/lista completa.

## Archivo modificado

- `public/app.js`

## Sin cambios

- Prisma / base de datos
- Backend
- Lista de cotejo institucional
- Workflow de revisión
- Exportación Word/PDF

## Validación

```bash
node --check public/app.js
npm test
npm run build
```
