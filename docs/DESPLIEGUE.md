# Guía de despliegue de la versión 28

## 1. Elegir el tipo de instalación

Antes de ejecutar comandos, determine cuál de estos dos objetivos corresponde:

| Objetivo | Acción sobre PostgreSQL | Resultado |
|---|---|---|
| Instalación limpia | `prisma migrate deploy` y `prisma/seed.ts` una vez | Roles, administrador, conocimiento e indicadores iniciales, sin proyectos históricos. |
| Recuperación | Restaurar un `.dump` y `knowledge/uploads` | Recupera los datos existentes al momento del respaldo. |

No combine ambos procedimientos. En particular, no ejecute migraciones ni
`seed` antes de restaurar un respaldo completo en una base vacía.

## 2. Información que debe recibir el responsable del despliegue

- URL del repositorio y acceso de solo lectura o una clave de despliegue.
- Etiqueta `v28` o hash de commit exacto.
- Dominio que usará el servicio.
- Plataforma: VPS, Render u otro proveedor.
- Datos de conexión PostgreSQL, entregados por un canal seguro.
- Clave de un proyecto de OpenAI específico para producción.
- Correo institucional del administrador inicial.
- Ubicación y propietario de los respaldos.
- Decisión sobre autorregistro y exposición del endpoint MCP.
- Ventana de mantenimiento y responsable de aprobar la puesta en producción.

## 3. Requisitos previos comunes

Compruebe las versiones antes de instalar:

```bash
node --version
npm --version
psql --version
git --version
```

La versión reproducible usa Node.js 24. `package.json` rechaza las versiones
fuera del rango `>=24 <25`. Node.js recomienda usar versiones LTS en producción:
<https://nodejs.org/en/about/previous-releases>.

Use PostgreSQL 17 o un servicio compatible. Para respaldar y restaurar, instale
las herramientas cliente de PostgreSQL de la misma versión mayor que el servidor
o una versión compatible posterior.

## 4. Despliegue en un VPS Linux

Los ejemplos usan Ubuntu, Nginx, systemd y la ruta
`/opt/app-creacion-asignaturas`. Adapte usuarios y políticas a su organización.

### 4.1 Instalar paquetes del sistema

Instale mediante los repositorios aprobados de su organización:

- Git.
- Node.js 24 LTS y npm 11.
- Cliente PostgreSQL 17.
- PostgreSQL 17 si la base estará en el mismo servidor.
- Nginx y una solución de certificados TLS.

No instale automáticamente la versión “latest” de Node: al momento de esta
entrega también existe una versión Current distinta, pero el proyecto exige la
serie 24.

### 4.2 Crear un usuario del servicio

```bash
sudo useradd --system --user-group \
  --home-dir /opt/app-creacion-asignaturas \
  --shell /usr/sbin/nologin guiasapp

sudo install -d -o guiasapp -g guiasapp -m 0750 \
  /opt/app-creacion-asignaturas
```

### 4.3 Descargar el código exacto

```bash
cd /opt/app-creacion-asignaturas
sudo -u guiasapp git clone URL_DEL_REPOSITORIO .
sudo -u guiasapp git fetch --tags --prune
sudo -u guiasapp git switch --detach v28
git rev-parse HEAD
```

Registre el resultado de `git rev-parse HEAD` en `docs/ENTREGA_TECNICA.md`. Para
un repositorio privado use una clave de despliegue; no coloque un token personal
dentro de la URL del remoto.

### 4.4 Crear PostgreSQL local, si no usa una base administrada

```bash
sudo -u postgres createuser --pwprompt guias_app
sudo -u postgres createdb --owner=guias_app guias_didacticas
```

Si usa PostgreSQL administrado, omita estos comandos y conserve la URL que
entregue el proveedor. La aplicación necesita crear tablas, índices,
restricciones y el esquema de migraciones de Prisma.

No exponga el puerto 5432 a Internet. Permita solamente el origen del servicio
o use la red privada del proveedor.

### 4.5 Crear el archivo de entorno

```bash
sudo install -o root -g guiasapp -m 0640 /dev/null \
  /etc/app-creacion-asignaturas.env
sudoedit /etc/app-creacion-asignaturas.env
```

Contenido mínimo:

```env
NODE_ENV="production"
PORT="3000"
DATABASE_URL="postgresql://guias_app:CONTRASENA_CODIFICADA@127.0.0.1:5432/guias_didacticas?schema=public"
OPENAI_API_KEY="CLAVE_DEL_PROYECTO_DE_PRODUCCION"
OPENAI_MODEL="gpt-5.6"
OPENAI_IMAGE_MODEL="gpt-image-1"
MCP_SERVER_NAME="app-creacion-asignaturas"
MCP_SERVER_VERSION="1.0.0"
LOCAL_USER_EMAIL="administrador@institucion.edu"
INITIAL_ADMIN_PASSWORD="CONTRASENA_INICIAL_LARGA_Y_UNICA"
```

Las comillas hacen que el archivo sea válido tanto para systemd como para los
comandos de inicialización que lo cargan con Bash. Codifique en formato URL
caracteres especiales de la contraseña de PostgreSQL. En una base remota agregue
las opciones SSL que exija el proveedor.

La clave de OpenAI debe permanecer en el servidor. La documentación oficial
indica que no debe exponerse en código, repositorios ni clientes:
<https://developers.openai.com/api/reference/overview>.

### 4.6 Instalar, generar y compilar

```bash
cd /opt/app-creacion-asignaturas
sudo -u guiasapp npm ci --include=dev
sudo -u guiasapp npx prisma generate
sudo -u guiasapp npm run build
sudo -u guiasapp install -d -m 0750 knowledge/uploads
```

`--include=dev` es necesario porque TypeScript, Prisma CLI y `tsx` están en
`devDependencies`, aunque se construya con `NODE_ENV=production`.

### 4.7 Crear una base limpia

Cargue el entorno protegido y aplique el historial existente:

```bash
cd /opt/app-creacion-asignaturas
sudo -u guiasapp /bin/bash -c \
  'set -a; source /etc/app-creacion-asignaturas.env; set +a; npx prisma migrate deploy'
```

Prisma reserva `migrate deploy` para producción y pruebas; no use
`migrate dev`, `db push` ni `migrate reset` en producción:
<https://www.prisma.io/docs/cli/migrate/deploy>.

Inicialice los datos una sola vez:

```bash
sudo -u guiasapp /bin/bash -c \
  'cd /opt/app-creacion-asignaturas && set -a; source /etc/app-creacion-asignaturas.env; set +a; npx tsx prisma/seed.ts'
```

No agregue el `seed` al servicio systemd ni a cada reinicio. La contraseña
definida para esta primera ejecución debe cumplir desde el inicio la política de
producción; v28 no obliga al administrador inicial a cambiarla automáticamente.

### 4.8 Crear el servicio systemd

Confirme primero la ruta de Node:

```bash
command -v node
```

Cree `/etc/systemd/system/app-creacion-asignaturas.service` y ajuste
`ExecStart` si Node no está en `/usr/bin/node`:

```ini
[Unit]
Description=Aplicación de creación de asignaturas v28
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=guiasapp
Group=guiasapp
WorkingDirectory=/opt/app-creacion-asignaturas
EnvironmentFile=/etc/app-creacion-asignaturas.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Active el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now app-creacion-asignaturas
sudo systemctl status app-creacion-asignaturas
sudo journalctl -u app-creacion-asignaturas -n 100 --no-pager
```

### 4.9 Configurar Nginx y HTTPS

La aplicación acepta cuerpos de hasta 15 MB y las generaciones pueden tardar.
El proxy debe usar un límite mayor y tiempos de espera amplios.

Ejemplo de servidor HTTPS; reemplace dominio y rutas de certificados:

```nginx
server {
    listen 80;
    server_name guias.ejemplo.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name guias.ejemplo.edu;

    ssl_certificate /RUTA/AL/CERTIFICADO_COMPLETO;
    ssl_certificate_key /RUTA/A/LA/CLAVE_PRIVADA;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_buffering off;
    }
}
```

Valide y recargue:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

El puerto 3000 debe aceptar conexiones solamente desde el propio servidor; los
usuarios deben ingresar siempre mediante HTTPS. Nginx documenta el control de
buffering y tiempos del proxy en
<https://nginx.org/en/docs/http/ngx_http_proxy_module.html>.

### 4.10 Verificar

```bash
curl --fail http://127.0.0.1:3000/health
curl --fail http://127.0.0.1:3000/health/database
curl --fail https://guias.ejemplo.edu/health
curl --fail https://guias.ejemplo.edu/health/database
```

Después complete todas las pruebas de `docs/ENTREGA_TECNICA.md`.

## 5. Despliegue en Render

La versión 28 requiere una base PostgreSQL persistente y un disco para
`knowledge/uploads`. Una instancia gratuita no es adecuada para producción:
Render indica que su sistema de archivos es efímero, no admite disco persistente
y la base PostgreSQL gratuita caduca:
<https://render.com/docs/free>.

### 5.1 Crear PostgreSQL

1. Cree una base Render Postgres de pago.
2. Seleccione la misma región del servicio web.
3. Conserve la URL interna para `DATABASE_URL`.
4. Active las opciones de respaldo y recuperación acordes a la criticidad.

### 5.2 Crear el servicio web

Conecte el repositorio y configure:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Rama o referencia | La que contenga el tag/commit v28 aprobado |
| Build Command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Pre-Deploy Command | `npx prisma migrate deploy` |
| Start Command | `npm start` |
| Health Check Path | `/health/database` |

Render documenta el uso de un comando previo al despliegue para migraciones de
Prisma: <https://render.com/docs/deploy-prisma-orm>.

### 5.3 Variables

Configure en el panel, sin crear un `.env` en Git:

```text
DATABASE_URL=<Internal Database URL>
NODE_ENV=production
OPENAI_API_KEY=<secreto del proyecto de producción>
OPENAI_MODEL=gpt-5.6
OPENAI_IMAGE_MODEL=gpt-image-1
MCP_SERVER_NAME=app-creacion-asignaturas
MCP_SERVER_VERSION=1.0.0
LOCAL_USER_EMAIL=<correo del administrador>
INITIAL_ADMIN_PASSWORD=<contraseña larga y única>
```

No defina `PORT`; Render lo asigna automáticamente y el código ya lo consume.

### 5.4 Disco persistente

Agregue un disco al servicio web con esta ruta de montaje exacta:

```text
/opt/render/project/src/knowledge/uploads
```

Solo lo escrito dentro de la ruta montada persiste. Consulte
<https://render.com/docs/disks>.

### 5.5 Primer seed

Después del primer despliegue y de las migraciones, abra una Shell del servicio y
ejecute una sola vez:

```bash
npx tsx prisma/seed.ts
```

No añada este comando a `Start Command`. Las variables del administrador deben
estar configuradas antes de ejecutarlo.

### 5.6 Aceptación

1. Compruebe `/health/database`.
2. Inicie sesión con el administrador.
3. Cree un proyecto de prueba y genere una semana.
4. Genere una imagen y descargue Word.
5. Cargue un documento administrativo.
6. Reinicie o vuelva a desplegar.
7. Confirme que el proyecto, la imagen y el documento continúan disponibles.
8. Cree y verifique un respaldo inicial.

## 6. Otras plataformas administradas

La plataforma debe proporcionar:

- Node.js 24.
- Una URL PostgreSQL accesible por TLS o red privada.
- Un paso previo al arranque para `npx prisma migrate deploy`.
- Persistencia montada en `knowledge/uploads`, o una adaptación futura a
  almacenamiento de objetos.
- Gestor de secretos.
- HTTPS, logs y al menos una instancia de ejecución.
- Tiempo de solicitud suficiente para las generaciones de OpenAI.

Si no existe un paso de predespliegue, el comando de inicio puede ser
`npx prisma migrate deploy && npm start`, pero el `seed` continúa siendo manual y
único. No use esta alternativa para restaurar una base desde un `dump`.

## 7. Actualización de una instalación existente

1. Anuncie una ventana de mantenimiento.
2. Respalde PostgreSQL y `knowledge/uploads`.
3. Registre el commit actual.
4. Descargue el tag o commit nuevo.
5. Ejecute `npm ci --include=dev`, `prisma generate` y `npm run build`.
6. Ejecute `prisma migrate deploy` una sola vez.
7. Reinicie el servicio.
8. Verifique ambas rutas de salud y las funciones críticas.

No edite migraciones que ya se hayan ejecutado. Una reversión del código no
revierte automáticamente el esquema; cualquier reversión de datos requiere un
procedimiento específico y un respaldo probado.
