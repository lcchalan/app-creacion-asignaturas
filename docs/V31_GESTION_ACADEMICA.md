# v31: gestión académica y catálogos administrables

## Objetivo

La versión 31 separa los datos institucionales de las guías. Los nombres de
carreras, modalidades, unidades, periodos, tipos y asignaturas ya no se
mantienen en un archivo JavaScript. El administrador los gestiona desde la
pestaña **Catálogos académicos**.

## Modelo

- **Nivel académico:** grado, posgrado, tecnologías u otro nivel institucional.
- **Unidad académica:** facultad, escuela o unidad responsable.
- **Carrera o programa:** pertenece a un nivel y una unidad académica.
- **Modalidad:** presencial, en línea, a distancia, híbrida u otra.
- **Tipo de asignatura:** general, teórica, práctica, proyecto u otro tipo.
- **Periodo académico:** código, nombre, fechas y estado.
- **Asignatura:** código y nombre institucionales, independientes de la carrera.
- **Oferta académica:** combina asignatura, carrera, modalidad, tipo y periodo;
  también define el número de semanas.
- **Asignación docente:** relaciona una oferta con un profesor y registra
  `assignedAt` y `endedAt`.
- **Guía:** pertenece a una oferta académica. Conserva una instantánea de los
  nombres y códigos aplicados al momento de crearla.

## Operación administrativa

1. Abra **Administración > Catálogos académicos**.
2. Cree primero niveles, unidades, modalidades, tipos, periodos y asignaturas.
3. Cree las carreras seleccionando su nivel y unidad.
4. Cree la oferta académica seleccionando carrera, asignatura, modalidad, tipo,
   periodo y número de semanas.
5. Abra **Asignaciones**, elija profesor y oferta académica, y guarde.

Al asignar una oferta por primera vez se crea su guía en blanco. Al reasignarla,
la asignación vigente se cierra con fecha y la guía pasa al nuevo profesor sin
perder su identidad. No puede existir más de una asignación vigente para la
misma oferta.

## Actualizar, desactivar y eliminar

- **Editar** actualiza código, nombre, relaciones o fechas del registro.
- **Desactivar** impide usarlo en nuevas ofertas o asignaciones, pero conserva
  las relaciones existentes.
- **Eliminar** borra físicamente un registro solamente si nunca fue utilizado.
- Si el registro tiene relaciones o historial, **Eliminar** se convierte
  automáticamente en **Desactivar**.

Esta regla permite retirar una carrera o tipo de asignatura sin romper ofertas,
asignaciones o guías anteriores. Como las guías guardan una instantánea, un
cambio posterior de nombre no modifica silenciosamente documentos ya creados.

## Migración desde v30.1

La migración `20260809000000_v31_academic_management` está diseñada para la fase
de construcción:

- elimina las guías y sus datos dependientes;
- elimina las asignaciones, asignaturas y periodos de desarrollo del modelo
  anterior, porque su estructura no es compatible con la oferta normalizada;
- conserva usuarios, roles, sesiones, conocimiento institucional,
  especificaciones, indicadores y configuración de IA;
- crea los catálogos, ofertas y el historial de asignaciones de v31.

Después de aplicar la migración, `npm run db:seed` carga los niveles,
modalidades, unidades y carreras que antes estaban en
`public/academic-offer.js`, además de los tipos institucionales iniciales. Las
asignaturas, periodos y ofertas se registran desde Administración porque
requieren códigos y decisiones institucionales que el archivo anterior no
contenía.

No se debe ejecutar esta migración en un entorno que necesite conservar las
guías existentes sin preparar antes una estrategia de transformación.

## Incremento prioritario: plan docente y guía

La migración posterior `20260810000000_v31_teaching_plan_priority` no repite la
migración de catálogos. Añade la oferta curricular detallada, el perfil docente,
las relaciones de contribución y el plan docente versionado.

El flujo disponible es:

1. El administrador descarga la plantilla Excel de **Carga masiva de oferta
   académica**, completa sus siete hojas, valida el archivo y lo importa.
2. El profesor abre una asignatura y revisa los datos institucionales de solo
   lectura.
3. Relaciona cada resultado de aprendizaje en las cinco columnas de
   contribución, completa sus datos profesionales y registra bibliografía y
   REA.
4. La IA genera el plan docente con la programación semanal y las cinco
   actividades calificadas del tipo de asignatura. El profesor puede ajustar
   metodología activa y TAC.
5. El profesor descarga el plan en Word y genera la guía didáctica a partir de
   la programación vigente del plan.

Los formatos, prompts y documentos institucionales se versionan en
**Conocimiento e IA** y declaran si aplican al plan, a la guía o a ambos.

La revisión por Par académico, el análisis del Equipo de calidad, la lista de
cotejo y la aprobación de Dirección de carrera no forman parte de este
incremento. El plan y la guía se descargan y su revisión, firma y aprobación se
realizan fuera del sistema. Los roles y el circuito interno se habilitarán en
una fase posterior.
