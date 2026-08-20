# v32.8 — Cola persistente de IA y límites configurables

## Objetivo

Esta versión incorpora una cola persistente para las solicitudes de inteligencia artificial del Sistema de Gestión Guía didáctica. Una petición deja de depender de que el navegador mantenga abierta la conexión HTTP hasta que finalice la generación.

## Compatibilidad

La v32.8 puede aplicarse independientemente de la v32.7; no depende de los cambios académicos previstos para esa versión.

## Alcance

La cola se aplica de forma transversal a las rutas actuales que utilizan IA:

- generación del Plan Docente;
- análisis de adaptación del Plan Docente;
- generación de la presentación microcurricular;
- generación y regeneración de cada semana de la Guía Didáctica;
- análisis de oportunidades de recursos educativos que forma parte de la generación semanal;
- generación de recursos educativos asistidos;
- generación de imágenes;
- análisis de adaptación de la Guía Didáctica;
- revisión APA asistida con búsqueda web.

## Persistencia

Cada solicitud del profesor crea un `AiGenerationJob` en PostgreSQL. El trabajo conserva:

- usuario solicitante;
- asignatura/proyecto cuando corresponde;
- operación;
- contenido objetivo para el control del límite;
- clave de idempotencia;
- payload necesario para reanudar el trabajo;
- estado de la cola;
- resultado HTTP final;
- reintentos técnicos;
- llamadas remotas realizadas a OpenAI.

Las llamadas a Responses API se ejecutan en segundo plano y el identificador de la respuesta se registra en `AiGenerationRemoteCall`. Si el servidor se reinicia mientras OpenAI continúa procesando la petición, el trabajador recupera el mismo trabajo y consulta la respuesta ya creada en lugar de iniciar otra generación.

Para la API de imágenes, donde el mecanismo utilizado por el sistema no proporciona el mismo modelo de recuperación mediante Response ID, la petición permanece dentro del mismo trabajo y los reintentos técnicos no consumen cupos adicionales.

## Estados

Los trabajos utilizan los estados de aplicación:

- `QUEUED`: registrado y pendiente de ejecución;
- `RUNNING`: tomado por un trabajador;
- `COMPLETED`: operación terminada correctamente;
- `FAILED`: error definitivo después de los reintentos o validación funcional;
- `CANCELLED`: reservado para cancelación administrativa futura.

Cada trabajador renueva periódicamente un latido del trabajo activo. La cola detecta trabajos `RUNNING` cuyo latido quedó vencido, los devuelve a `QUEUED` y los retoma desde la información persistida; esto permite recuperar una ejecución tras reinicio sin interferir con otro proceso que continúe vivo.

## Idempotencia

El navegador agrega `X-AI-Idempotency-Key` a las solicitudes gestionadas por la cola. Si la respuesta HTTP se pierde y el navegador reintenta, el servidor devuelve el mismo trabajo en lugar de crear una segunda generación.

La clave pendiente se conserva en `localStorage`. Si la página se recarga, una nueva acción equivalente puede recuperar el trabajo anterior sin duplicar la solicitud.

## Recuperación del resultado

El resultado HTTP final queda almacenado en `AiGenerationJob`. Mientras la pestaña continúa abierta, el navegador retoma automáticamente la consulta al recuperar la conexión y luego ejecuta el mismo guardado funcional que ya utilizaba el sistema. Si la página se recarga o se cierra, el trabajo continúa en el servidor; al repetir la misma acción pendiente, la clave de idempotencia recupera el trabajo anterior en lugar de iniciar otra generación.

La cola no crea versiones académicas adicionales por su cuenta: conserva los contratos y mecanismos de guardado existentes de Plan Docente y Guía Didáctica.

## Límite institucional

La configuración se almacena en:

`AI_MAX_GENERATIONS_PER_CONTENT`

Valor inicial: `3`.

- `0`: sin límite;
- `1` a `100`: máximo de generaciones exitosas por profesor y contenido.

El contador es independiente por contenido. Por ejemplo, con límite 3:

- Plan Docente: hasta 3 generaciones;
- presentación: hasta 3 generaciones;
- semana 1 de la Guía: hasta 3 generaciones;
- semana 2: dispone de su propio cupo de 3;
- cada propuesta/recurso tiene su propio objetivo de control.

Los trabajos activos reservan temporalmente un cupo para impedir solicitudes concurrentes que excedan el máximo. La base de datos garantiza que un profesor no tenga dos trabajos activos para el mismo contenido. Un trabajo fallido libera la reserva. Solo los trabajos completados correctamente se contabilizan definitivamente.

Los reintentos técnicos pertenecen al mismo `AiGenerationJob` y no incrementan el contador del profesor.

## Administración

En `Administración → Conocimiento e IA` se agrega la tarjeta `Uso de inteligencia artificial`, donde se configura el máximo de generaciones por contenido.

También se incorpora el endpoint administrativo de consulta:

`GET /api/admin/ai-jobs?take=50`

para inspeccionar trabajos recientes cuando sea necesario diagnosticar la cola.

## Endpoints incorporados

- `GET /api/ai/jobs/:jobId`
- `GET /api/admin/ai-jobs`
- `PATCH /api/admin/settings/ai-generation`

Las rutas originales de generación se conservan. El navegador intercepta la respuesta `202` de la cola, consulta el trabajo y entrega al código existente una respuesta equivalente a la que recibía antes. Por ello no se modifican los contratos funcionales de cada formulario.

## Base de datos

Migración:

`20260819200000_v32_8_persistent_ai_jobs`

Crea:

- `AiGenerationJob`;
- `AiGenerationRemoteCall`;
- configuración inicial `AI_MAX_GENERATIONS_PER_CONTENT = 3` si todavía no existe.

No elimina ni altera planes, guías, usuarios, ofertas, revisiones o documentos institucionales existentes.

## Validación recomendada

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate deploy
git diff --check
npm test
npm run build
```

Pruebas funcionales prioritarias:

1. iniciar una generación de semana y cortar Wi-Fi después de enviar la petición;
2. restablecer la conexión y comprobar que no se crea una segunda generación;
3. iniciar una generación larga, reiniciar el servidor y verificar que el trabajo vuelve a `QUEUED/RUNNING` y continúa;
4. generar tres veces el mismo contenido con límite 3 y comprobar que la cuarta solicitud se rechaza con HTTP 429;
5. comprobar que un fallo técnico no incrementa el contador;
6. comprobar que otra semana de la misma Guía conserva su propio cupo;
7. cambiar el límite desde Administración y comprobar que se aplica en backend.

## Nota sobre OpenAI

La persistencia de Responses API utiliza `background: true` y consulta posteriormente la respuesta mediante su identificador. Este mecanismo requiere que la política de datos de la organización permita Background mode. OpenAI documenta que Background mode mantiene temporalmente estado para permitir el sondeo y no es compatible con Zero Data Retention; si la organización usa ZDR, esta estrategia debe sustituirse antes del despliegue productivo.
