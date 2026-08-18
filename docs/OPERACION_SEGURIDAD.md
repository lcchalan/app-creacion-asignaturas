# Operación, seguridad y solución de problemas

## 1. Estado operativo de la versión 28

La versión 28 compila con Node.js 24 y su esquema Prisma es válido. Sin embargo,
la aceptación para Internet abierto queda condicionada a controles de seguridad
adicionales. El uso recomendado de esta copia es:

- Desarrollo en una base separada.
- Demostración o piloto dentro de una red privada, VPN o proxy de identidad.
- Producción institucional solo después de ejecutar el plan de endurecimiento y
  una revisión de seguridad.

Esta advertencia no impide desplegar la aplicación; define el perímetro en el
que puede operarse responsablemente sin cambiar la lógica funcional.

## 2. Operación diaria en un VPS

### Estado, inicio y reinicio

```bash
sudo systemctl status app-creacion-asignaturas
sudo systemctl start app-creacion-asignaturas
sudo systemctl restart app-creacion-asignaturas
sudo systemctl stop app-creacion-asignaturas
```

### Logs

```bash
sudo journalctl -u app-creacion-asignaturas -n 200 --no-pager
sudo journalctl -u app-creacion-asignaturas -f
```

No publique logs completos en canales abiertos. Pueden contener identificadores,
nombres de archivos, errores de base y metadatos de solicitudes.

### Salud

```bash
curl --fail https://DOMINIO/health
curl --fail https://DOMINIO/health/database
```

- `/health` confirma que el proceso HTTP responde.
- `/health/database` confirma que Prisma puede ejecutar `SELECT 1`.
- Una respuesta correcta de salud no comprueba OpenAI, los modelos, el disco ni
  todos los flujos de la interfaz.

### Capacidad

Monitoree al menos:

- CPU, memoria y reinicios del proceso Node.
- Latencia y errores HTTP 4xx/5xx.
- Conexiones, tamaño y espacio libre de PostgreSQL.
- Conteo y tamaño de `GeneratedImage`, porque cada imagen vive en la base.
- Uso del disco de `knowledge/uploads`.
- Consumo, límites, latencia y errores del proyecto de OpenAI.
- Vigencia del certificado TLS.
- Antigüedad y resultado del último respaldo y restauración de prueba.

Consulta útil para las imágenes:

```sql
SELECT COUNT(*) AS imagenes,
       pg_size_pretty(COALESCE(SUM(octet_length("imageData")), 0)::bigint) AS bytes_imagen
FROM "GeneratedImage";
```

### Limpiar sesiones expiradas

El código deja de aceptar sesiones vencidas, pero no las elimina automáticamente.
Una tarea de mantenimiento puede ejecutar:

```sql
DELETE FROM "UserSession" WHERE "expiresAt" < NOW();
```

Realice esta operación con un usuario autorizado y registre su ejecución.

## 3. Gestión de OpenAI

- La clave debe almacenarse como secreto del servidor, nunca en Git, JavaScript
  del navegador, capturas ni documentación compartida.
- Use proyectos separados para desarrollo y producción.
- Defina límites y alertas de gasto.
- Restrinja quién puede ver o rotar la clave.
- Si sospecha exposición, revoque y sustituya la clave.
- Valide periódicamente acceso a `OPENAI_MODEL` y `OPENAI_IMAGE_MODEL` desde el
  proyecto de producción.

La guía oficial recomienda variables o un gestor de secretos y proyectos
separados por entorno:
<https://developers.openai.com/api/docs/guides/production-best-practices>.

La versión 28 usa la Responses API con `gpt-5.6` para texto. La documentación
oficial vigente indica que el alias `gpt-5.6` dirige al modelo de capacidad
principal de su familia:
<https://developers.openai.com/api/docs/guides/latest-model>.

El valor histórico de imágenes es `gpt-image-1`. A fecha 6 de agosto de 2026, el
catálogo oficial lo muestra como modelo anterior y marcado como obsoleto:
<https://developers.openai.com/api/docs/models/gpt-image-1>. Mantenga ese valor
para reproducir v28 solamente si su proyecto todavía tiene acceso. Cualquier
cambio a otro modelo debe probar generación, formato base64, calidad, costo y
exportación a Word antes de considerarse una nueva versión estable.

## 4. Controles inmediatos sin modificar el código

Antes de habilitar usuarios reales:

1. Publique el servicio solo detrás de HTTPS.
2. Bloquee acceso directo al puerto 3000.
3. Mantenga PostgreSQL en red privada y exija SSL cuando sea remoto.
4. Coloque toda la aplicación detrás de VPN, proxy de identidad o control de
   acceso institucional.
5. Desactive el autorregistro en el proxy si los usuarios serán creados por el
   administrador.
6. Bloquee `/mcp` en el proxy si no se utilizará.
7. Configure alertas y límites del proyecto de OpenAI.
8. Pruebe los respaldos antes de cargar datos reales.
9. Use una contraseña administrativa final, larga y única desde el primer
   `seed`; la aplicación no obliga al administrador inicial a cambiarla.

Ejemplos opcionales de Nginx:

```nginx
# Use este bloque si la institución no permitirá autorregistro.
location = /api/auth/register {
    return 403;
}

# Use este bloque si la integración MCP no forma parte del despliegue.
location = /mcp {
    return 404;
}
```

Estos bloques deben aparecer antes de `location /`. No los use si los flujos son
requisitos aprobados.

## 5. Riesgos conocidos de la versión 28

### Rutas públicas con costo o procesamiento

Las rutas de generación de texto, imagen y recursos asistidos no llaman a
`requireUser`. Un tercero que alcance el servidor puede consumir la clave de
OpenAI indirectamente. También son públicas la validación de matrices, la
creación de Word, el endpoint MCP y el autorregistro.

Mitigación provisional: red privada o proxy de identidad para todo el sitio.

Corrección futura: autenticación, autorización por proyecto y limitación de
solicitudes en cada ruta con costo.

### Sesiones y navegador

La cookie `ggd_session` usa `HttpOnly` y `SameSite=Lax`, pero v28 no agrega el
atributo `Secure` ni implementa un token CSRF explícito. El servidor tampoco
establece una política completa de cabeceras de seguridad.

Mitigación provisional: redirección obligatoria a HTTPS, puerto 3000 inaccesible
al usuario y perímetro autenticado.

Corrección futura: cookie `Secure` en producción, protección CSRF y cabeceras
probadas sin romper la interfaz ni una eventual incrustación MCP.

### Autorregistro

`POST /api/auth/register` permite crear cuentas con rol `TEACHER` sin aprobación.
Si la institución exige matrícula controlada, bloquee la ruta y use las
funciones administrativas de creación individual o masiva.

### Valores alternativos del seed

`prisma/seed.ts` contiene valores locales alternativos para el correo y la
contraseña del administrador. Si `LOCAL_USER_EMAIL` o
`INITIAL_ADMIN_PASSWORD` no están definidas, podría crearse o actualizarse una
cuenta con esos valores inseguros para producción.

Mitigación obligatoria: verifique ambas variables antes de la única ejecución
del `seed` y confirme después el correo del administrador. La corrección futura
debe eliminar los valores alternativos y hacer que el `seed` falle cuando falte
configuración.

### Imágenes por URL

`GET /api/generated-images/:id` no verifica sesión y responde con caché pública
de un año. El UUID es difícil de adivinar, pero cualquier persona que reciba el
enlace puede acceder a la imagen.

### Archivos Excel

La aplicación procesa archivos suministrados por usuarios. Mantenga el límite de
tamaño, no acepte archivos desde orígenes desconocidos y ejecute el servicio con
permisos mínimos.

### Ausencia de pruebas automatizadas

`npm test` todavía termina con “no test specified”. Cada despliegue depende de
compilación, validación de Prisma y aceptación manual. Esta carencia aumenta el
riesgo al actualizar dependencias o modelos.

## 6. Auditoría de dependencias de referencia

El 6 de agosto de 2026 se ejecutó:

```bash
npm audit --omit=dev
```

Resultado de referencia: seis alertas, tres de severidad alta y tres moderadas,
sin alertas críticas. Entre ellas:

- `xlsx` 0.18.5: alertas altas de contaminación de prototipo y ReDoS; la
  auditoría no ofreció una corrección automática para el paquete de npm.
- `@modelcontextprotocol/sdk` y dependencias de Hono: alertas moderadas con
  actualización disponible.
- Dependencias transitivas `fast-uri` e `ip-address`: alertas altas con
  actualización disponible.

La auditoría es una fotografía temporal. Vuelva a ejecutarla antes de cada
despliegue:

```bash
npm ci --include=dev
npm audit --omit=dev
```

No ejecute `npm audit fix --force` en la etiqueta v28. Actualice en otra rama,
revise `package-lock.json`, compile y ejecute todas las pruebas de aceptación.
Para `xlsx`, evalúe una versión o distribución corregida, una biblioteca
alternativa o aislamiento adicional del procesamiento.

## 7. Plan de endurecimiento recomendado

| Prioridad | Cambio | Criterio de aceptación |
|---:|---|---|
| 1 | Proteger todas las rutas de generación | Sin sesión devuelven `401`; el usuario solo accede a sus proyectos. |
| 1 | Limitar solicitudes y costo | Límites por usuario/IP y alertas verificadas. |
| 1 | Corregir dependencias auditadas | `npm audit --omit=dev` sin alertas altas aceptadas sin excepción formal. |
| 1 | Cookie segura y CSRF | Cookie `Secure` en producción y pruebas de solicitudes cruzadas. |
| 2 | Restringir autorregistro | Política configurable o invitación administrativa. |
| 2 | Proteger imágenes | Autorización por proyecto o enlaces firmados de duración limitada. |
| 2 | Pruebas automatizadas | Cobertura de autenticación, permisos, migración, generación simulada y exportación. |
| 2 | Logs estructurados | Identificador de solicitud, severidad y exclusión de secretos/contenido sensible. |
| 3 | Cola y tiempos de generación | Trabajo recuperable, reintentos controlados y estado visible. |
| 3 | Almacenamiento de objetos | Elimina dependencia de un disco local y permite varias instancias. |
| 3 | Identificador de seguridad OpenAI | Valor estable y respetuoso de la privacidad por usuario final, validado con la API. |

## 8. Actualización segura

```bash
cd /opt/app-creacion-asignaturas
git rev-parse HEAD
```

1. Cree y verifique un respaldo.
2. Registre el commit anterior y el nuevo.
3. Detenga o ponga la aplicación en mantenimiento si la migración lo requiere.
4. Descargue el tag o commit aprobado.
5. Ejecute `npm ci --include=dev`.
6. Ejecute `npx prisma generate` y `npm run build`.
7. Cargue el entorno y ejecute `npx prisma migrate deploy`.
8. Reinicie y verifique.
9. Conserve los logs y la ficha de aceptación.

Nunca modifique ni elimine una migración que ya figure como aplicada en una base.

## 9. Diagnóstico

### La aplicación no inicia por versión de Node

Síntoma: `npm` muestra `EBADENGINE` o TypeScript falla inesperadamente.

```bash
node --version
```

Solución: use una versión 24.x. No ignore el rango de `package.json` en
producción.

### Prisma no encuentra `DATABASE_URL`

Síntoma: error de variable no disponible.

```bash
sudo systemctl show app-creacion-asignaturas --property=EnvironmentFiles
sudo systemctl cat app-creacion-asignaturas
```

Compruebe que `EnvironmentFile` apunta al archivo correcto y que la variable está
definida. No imprima la URL completa en una conversación o incidencia.

### Prisma no se conecta a PostgreSQL

Compruebe DNS, puerto, firewall, SSL y credenciales desde el servidor de la
aplicación:

```bash
curl --fail http://127.0.0.1:3000/health/database
npx prisma migrate status
```

En una base administrada use su URL interna dentro de la misma plataforma y la
externa solo para administración autorizada.

### Migración fallida

```bash
npx prisma migrate status
```

No use `migrate reset`. Preserve logs, respalde la base y determine si la
migración fue aplicada parcial o totalmente antes de usar `prisma migrate
resolve`. La decisión debe tomarla una persona que conozca PostgreSQL y el SQL de
la migración.

### El `seed` no encuentra archivos

Confirme que existen:

```text
knowledge/specifications/especificacion-funcional.txt
knowledge/specifications/adaptacion-plan-16-a-8.txt
knowledge/official/metodologias-activas.md
knowledge/official/normas-apa.txt
knowledge/official/indicaciones-rea.txt
```

Ejecute desde una copia completa del repositorio, no desde un paquete que
contenga únicamente `dist/`.

### OpenAI devuelve 503 desde la aplicación

La versión 28 devuelve `503` cuando `OPENAI_API_KEY` no está configurada.
Compruebe el gestor de secretos y reinicie el proceso. No escriba la clave en el
comando ni en Git.

### “Modelo no encontrado” o acceso denegado

Compruebe `OPENAI_MODEL`, `OPENAI_IMAGE_MODEL`, el proyecto asociado a la clave,
facturación, límites y disponibilidad. No cambie modelos directamente en
producción: valide primero en un entorno separado.

### Nginx devuelve 413

El proxy está rechazando el cuerpo antes de llegar a Node. Confirme:

```nginx
client_max_body_size 20m;
```

### Nginx devuelve 502 o 504 durante una generación

Revise el estado del servicio y aumente, si corresponde:

```nginx
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

Confirme también errores o límites en OpenAI.

### Los documentos desaparecen después de desplegar

`knowledge/uploads` está en un sistema de archivos efímero o no fue restaurado.
Monte almacenamiento persistente en la ruta exacta y recupere la carpeta desde
el respaldo coordinado con PostgreSQL.

### Prisma Studio abre en `localhost:5555`

Esa dirección es la interfaz de Prisma Studio, no PostgreSQL. Studio se conecta
a la base de `DATABASE_URL`. Puede utilizarse sin Docker con una base remota,
pero no debe apuntar a producción salvo en una intervención autorizada.

### `npm test` termina con error

Es el comportamiento actual porque no hay pruebas configuradas. Use
`npm run build`, `npx prisma validate` y la lista manual de aceptación. No cambie
el script para ocultar esta limitación.
