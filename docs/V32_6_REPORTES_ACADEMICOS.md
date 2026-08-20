# v32.6 · Organización de Revisión del Plan y Reportería Académica

## Alcance

1. La sección **Revisión del Plan** presenta un selector para mostrar un solo formulario de asignación a la vez:
   - Director/a por carrera y modalidad.
   - Responsables por Plan Docente.
   - Secretaría por carrera y modalidad.
2. **Seguimiento del flujo** se muestra a ancho completo, igual que **Notificaciones del proceso**.
3. La pestaña administrativa **Reporte de guías** pasa a **Reportes** e incorpora:
   - Plan Docente.
   - Guía Didáctica.
   - filtros por búsqueda, periodo, carrera, modalidad, estado, etapa y rango de actualización;
   - descarga XLSX de los registros filtrados.

## Reporte de Plan Docente

Incluye asignatura, profesor, nivel, unidad académica, carrera, modalidad, periodo, versión, confirmación docente, estado derivado del flujo, etapa/responsable actual, última revisión, fecha de aprobación, días en el estado y última actualización.

Los estados son derivados del Plan y del workflow existente; no se agrega un estado duplicado a la base de datos.

## Reporte de Guía Didáctica

Incluye asignatura, profesor, ámbito académico, progreso semanal, estado de elaboración, estado de revisión, etapa/responsable actual, última revisión, aprobación, días en estado y actualización.

## Excel

Cada descarga contiene:

- **Resumen**: total y distribución por estado.
- **Filtros**: filtros aplicados en la descarga.
- **Detalle**: registros resultantes con autofiltro.

## Seguridad

Los endpoints `/api/admin/reports` y `/api/admin/reports.xlsx` requieren rol `ADMIN` en backend.

## Base de datos

Esta versión no agrega tablas ni columnas y no requiere migración Prisma.
