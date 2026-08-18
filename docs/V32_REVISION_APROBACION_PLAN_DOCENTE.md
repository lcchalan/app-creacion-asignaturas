# v32 · Revisión y aprobación institucional del Plan Docente

## Objetivo

La v32 incorpora al Sistema de Gestión Guía didáctica un proceso institucional, trazable y configurable para revisar y aprobar el Plan Docente sin sustituir la elaboración y confirmación que realiza el profesor.

El proceso queda deshabilitado después de la migración. La institución debe configurar responsables, lista de cotejo y etapas antes de activarlo.

## Principios funcionales

- Un usuario conserva una sola cuenta y puede tener varios roles simultáneamente.
- La interfaz separa el trabajo por vistas: Docente, Par académico, Equipo de calidad, DIITEP, Dirección de carrera y Administración, según los roles reales del usuario.
- Cambiar de vista no crea otra sesión ni concede permisos adicionales.
- El backend valida rol, usuario asignado, etapa vigente y versión del Plan en cada decisión académica.
- El profesor no puede revisar su propio Plan Docente.
- La etapa Dirección de carrera obtiene su responsable desde la carrera del Plan.
- Cada carrera puede tener como máximo un director activo.
- Las etapas institucionales se habilitan, deshabilitan y ordenan desde Administración.
- El proceso puede operar, por ejemplo, solo con Par académico, sin modificar código.
- La Guía Didáctica no continúa hasta que el Plan complete la última etapa institucional activa cuando el proceso está habilitado.

## Etapas disponibles

| Etapa | Rol requerido | Responsable |
| --- | --- | --- |
| Par académico | `REVIEWER` | Asignación por proyecto/asignatura |
| Equipo de calidad | `QUALITY` | Asignación por proyecto/asignatura |
| DIITEP | `DIITEP` | Asignación por proyecto/asignatura |
| Dirección de carrera | `DIRECTOR` | Director activo de la carrera |

Las etapas activas se copian al proceso del Plan al momento del primer envío. Los cambios posteriores en la configuración administrativa se aplican a nuevos procesos; no reescriben el historial de un proceso ya iniciado.

## Flujo general

1. El profesor genera, revisa y confirma el Plan Docente.
2. Si el proceso institucional está habilitado, el backend crea el flujo y deja pendiente la primera etapa activa.
3. El responsable recibe un correo con enlace al Plan.
4. El revisor completa su lista de cotejo y puede:
   - guardar un borrador;
   - solicitar correcciones;
   - aprobar la etapa.
5. Si aprueba, el sistema habilita la siguiente etapa activa.
6. Si solicita correcciones, el Plan regresa al profesor y queda suspendida únicamente la etapa que las solicitó.
7. Cuando el profesor corrige y reenvía, el Plan vuelve exclusivamente a ese responsable.
8. Las aprobaciones de etapas anteriores permanecen vigentes.
9. La aprobación de la última etapa activa completa el proceso y deja el Plan institucionalmente aprobado.

## Correcciones y trazabilidad

Una solicitud de correcciones no reinicia el flujo.

Ejemplo:

```text
Par académico       ✓ aprobado
Equipo de calidad   ⚠ solicita correcciones
Profesor             realiza cambios y reenvía
Equipo de calidad    revisa nuevamente
```

El Par académico no vuelve a aprobar. Recibe una notificación informativa para conocer las observaciones y el reenvío posterior.

La misma regla se aplica a DIITEP y Dirección de carrera: las etapas anteriores permanecen aprobadas y son informadas de las intervenciones posteriores.

Cada revisión registra:

- etapa;
- intento;
- versión del Plan revisada;
- usuario que revisó;
- lista de cotejo;
- resultados por criterio;
- observaciones;
- decisión;
- fecha.

## Versiones de la lista de cotejo

La lista de cotejo del Plan Docente tiene versiones independientes de la lista utilizada para la Guía Didáctica.

Una versión contiene criterios asociados a una etapa. Al iniciar un flujo se conserva la versión activa utilizada como referencia, evitando que una modificación posterior de la lista cambie revisiones históricas.

El sistema no incorpora criterios institucionales simulados. El administrador debe registrar y activar los criterios oficiales.

## Usuarios con varios roles

Un usuario puede ser, por ejemplo, Docente y Par académico con la misma cuenta.

```text
Usuario autenticado
       |
       +-- Vista Docente
       |      +-- sus asignaturas
       |
       +-- Vista Par académico
              +-- Planes asignados para revisión
```

El selector de vista muestra únicamente los roles que el usuario posee. Un usuario con un solo contexto de trabajo entra directamente a su vista correspondiente.

La vista seleccionada es una preferencia de navegación. La autorización real siempre se comprueba en el backend.

## Director por carrera

La relación entre carrera y Dirección se administra de forma independiente de los Planes.

```text
Plan Docente
   -> oferta académica
      -> carrera
         -> director activo
```

La base de datos impide que existan dos asignaciones activas de Dirección para la misma carrera.

## Notificaciones por correo

Las notificaciones se crean dentro de la operación académica y se envían después de confirmar la transacción de base de datos.

Eventos principales:

| Evento | Notificación |
| --- | --- |
| Profesor envía el Plan | Primera etapa activa |
| Revisor solicita correcciones | Profesor + etapas anteriores aprobadas como información |
| Profesor reenvía correcciones | Revisor que solicitó cambios + etapas anteriores aprobadas como información |
| Una etapa aprueba | Siguiente etapa activa + profesor + etapas anteriores aprobadas |
| Última etapa aprueba | Profesor y todos los participantes del proceso |

Si SMTP falla, la decisión académica conserva su validez. La notificación queda registrada como fallida y Administración puede reintentar el envío.

Para cada notificación se conserva destinatario, asunto, cuerpo, evento, estado, intentos, fecha de último intento, fecha de envío y error, si corresponde.

## Configuración inicial recomendada

Realizar esta configuración con el proceso todavía deshabilitado:

1. Asignar los roles correctos a los usuarios.
2. Configurar qué etapas estarán activas y su orden, manteniendo el proceso deshabilitado.
3. Crear y activar la versión oficial de la lista de cotejo con criterios para cada etapa activa.
4. Asignar Par académico, Equipo de calidad y DIITEP a los proyectos que correspondan.
5. Asignar un Director activo a cada carrera cuya etapa Dirección se utilizará.
6. Verificar `APP_BASE_URL` y la configuración SMTP.
7. Habilitar el proceso institucional.
8. Probar un Plan completo antes de habilitarlo para operación general.

## Despliegue de base de datos

La v32 utiliza una migración aditiva. En ambientes existentes debe aplicarse con:

```bash
npx prisma generate
npx prisma migrate deploy
```

No utilizar `prisma migrate dev` en el servidor de despliegue. `migrate deploy` aplica migraciones versionadas sin requerir una base de datos sombra.

La migración crea nuevas tablas y enumeraciones; no elimina ni reescribe los datos existentes del Plan Docente o la Guía Didáctica.

## Compatibilidad con el comportamiento anterior

El proceso institucional se crea con `enabled = false`.

Mientras permanezca deshabilitado:

- la confirmación del profesor conserva el comportamiento previo;
- no se crean flujos institucionales nuevos;
- no se bloquea la Guía Didáctica por falta de aprobación institucional.

Cuando el administrador lo habilita, los Planes que deban continuar hacia la Guía requieren completar el flujo institucional correspondiente.

## Seguridad

- Administración configura el proceso, pero no obtiene por ese motivo permiso académico para aprobar etapas.
- Para decidir en una etapa, el usuario debe poseer el rol requerido y ser el responsable asignado a esa etapa.
- Un administrador que también deba actuar como revisor necesita además el rol académico correspondiente y la asignación del Plan.
- El backend rechaza criterios de lista de cotejo que no pertenezcan a la revisión abierta.
- Una revisión cerrada no puede modificarse.
- Una etapa solo puede cerrarse si corresponde al estado vigente del flujo.
- El Plan no puede editarse mientras está en revisión ni después de la aprobación final; las correcciones habilitan nuevamente la edición del profesor.

## Auditoría

Se registran, entre otras, las siguientes operaciones:

- configuración del proceso;
- creación de versiones de lista de cotejo;
- asignación de revisores;
- asignación de Dirección de carrera;
- inicio del flujo;
- reenvío de correcciones;
- borrador de revisión;
- aprobación de etapa;
- solicitud de correcciones;
- reintento administrativo de una notificación.
