# v32.5 — Autoridades por carrera y modalidad

## Objetivo

El Sistema de Gestión Guía didáctica resuelve las autoridades académicas por la combinación **carrera/programa + modalidad**, en lugar de asumir un único Director para toda la carrera.

Esto permite que una carrera bimodal tenga, por ejemplo, una Dirección distinta para modalidad En línea y para modalidad Presencial.

## Alcance

- Director/a activo por `programId + modalityId`.
- Secretaría activa por `programId + modalityId`.
- Una misma persona puede estar asignada a varias combinaciones.
- La etapa Dirección del flujo del Plan Docente utiliza la modalidad real de la oferta académica.
- Secretaría queda registrada como rol institucional de consulta/seguimiento; no obtiene facultades de aprobación académica.
- La autorización de reportes para Director/a y Secretaría se implementará sobre estos mismos ámbitos en la fase de reportería.

## Compatibilidad con asignaciones anteriores

La migración toma las asignaciones históricas de Director que antes estaban definidas únicamente por carrera y las replica para las modalidades que ya existen en la oferta académica de esa carrera. De esta manera no se pierde el comportamiento actual al desplegar v32.5.

Las asignaciones activas que no tengan ninguna modalidad asociable en la oferta se cierran, ya que no pueden utilizarse de forma segura para resolver una autoridad bimodal.

## Reglas

1. Solo puede existir una asignación activa de Director por carrera + modalidad.
2. Solo puede existir una asignación activa de Secretaría por carrera + modalidad.
3. El Director seleccionado debe tener rol `DIRECTOR` y estar activo.
4. La Secretaría seleccionada debe tener rol `SECRETARY` y estar activa.
5. La combinación carrera + modalidad debe existir en alguna oferta académica registrada.
6. Secretaría no participa en decisiones del flujo de revisión del Plan Docente.
7. Un Plan que inicia un flujo conserva el Director resuelto en su `TeachingPlanWorkflowStage`, aunque posteriormente cambie la autoridad administrativa.

## Despliegue de la actualización

Esta versión incluye migración Prisma. En ambientes existentes use:

```bash
npx prisma generate
npx prisma migrate deploy
```

No es necesario ejecutar el seed general para crear el rol Secretaría: la propia migración registra `SECRETARY`. El seed se actualiza únicamente para instalaciones nuevas.

## Instalación reanudable v32.5.2

Si una aplicación previa de v32.5 quedó parcial, use el instalador v32.5.2. El instalador realiza un preflight completo en memoria y tiene alternativas estructurales para Prisma/TypeScript/HTML/JavaScript; solo escribe si todos los cambios pueden resolverse de forma segura.
