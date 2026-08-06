# Ficha de entrega técnica y aceptación

Complete esta ficha para cada entorno. No escriba contraseñas, claves ni URLs
con credenciales.

## 1. Identificación

| Campo | Valor |
|---|---|
| Sistema | Aplicación de creación de asignaturas |
| Versión funcional | v28 |
| Entorno | Desarrollo / pruebas / producción |
| URL del repositorio | |
| Rama de origen | `feature/generador-guias-mvp` |
| Tag desplegado | |
| Hash de commit (`git rev-parse HEAD`) | |
| Fecha y hora | |
| Responsable del despliegue | |
| Responsable funcional | |
| Dominio | |
| Proveedor o servidor | |

Si el tag `v28` ya existe, no lo mueva para incluir documentación. Confirme los
archivos de documentación en un commit posterior y cree una etiqueta distinta,
por ejemplo `v28-docs-1`.

## 2. Inventario recibido

- [ ] Acceso al repositorio privado o copia verificada.
- [ ] Tag o hash exacto aprobado.
- [ ] `package.json` y `package-lock.json`.
- [ ] `prisma/schema.prisma`.
- [ ] Todas las carpetas de `prisma/migrations/`.
- [ ] `prisma/seed.ts`.
- [ ] `src/`, `public/` y `knowledge/`.
- [ ] `.env.example` sin secretos.
- [ ] Documentación completa de `docs/`.
- [ ] Respaldo PostgreSQL, si es una recuperación.
- [ ] Copia de `knowledge/uploads`, si es una recuperación.
- [ ] Checksums y conteos del respaldo.

## 3. Infraestructura

| Componente | Dato no sensible |
|---|---|
| Node.js | 24.x: |
| npm | 11.x: |
| PostgreSQL | Versión y proveedor: |
| Proxy/HTTPS | |
| Ruta persistente de uploads | |
| Servicio del proceso | systemd / plataforma: |
| Región | |
| Política de respaldo | |
| Monitoreo y alertas | |

## 4. Variables verificadas

- [ ] `DATABASE_URL` está en el gestor de secretos.
- [ ] `NODE_ENV=production`.
- [ ] `PORT` es correcto o lo asigna la plataforma.
- [ ] `OPENAI_API_KEY` pertenece al proyecto de producción.
- [ ] `OPENAI_MODEL` fue validado.
- [ ] `OPENAI_IMAGE_MODEL` fue validado.
- [ ] `MCP_SERVER_NAME` y `MCP_SERVER_VERSION` están definidos.
- [ ] `LOCAL_USER_EMAIL` corresponde al administrador autorizado.
- [ ] `INITIAL_ADMIN_PASSWORD` es larga, única y no está en Git.
- [ ] Ningún secreto aparece en `.env.example`, logs, commits ni incidencias.

## 5. Validación técnica previa

Ejecute desde la raíz:

```bash
npm ci --include=dev
npx prisma generate
npm run build
npx prisma validate
npm audit --omit=dev
```

Registre:

| Comprobación | Resultado | Evidencia o incidencia |
|---|---|---|
| `npm ci` | Aprobado / Fallido | |
| `prisma generate` | Aprobado / Fallido | |
| Compilación TypeScript | Aprobado / Fallido | |
| Esquema Prisma válido | Aprobado / Fallido | |
| Auditoría de dependencias revisada | Aceptada / Bloqueada | |
| Excepciones de seguridad aprobadas | Sí / No / No aplica | |

`npm test` no forma parte de la aceptación automática de v28 porque todavía no
hay pruebas configuradas. Esta limitación debe quedar aceptada explícitamente.

## 6. Base de datos

### Instalación limpia

- [ ] La base se creó vacía.
- [ ] `npx prisma migrate deploy` terminó sin errores.
- [ ] `npx prisma migrate status` no reporta migraciones pendientes o fallidas.
- [ ] El `seed` se ejecutó una sola vez.
- [ ] Existen los seis roles previstos.
- [ ] Existe el administrador correcto.
- [ ] Existen las fuentes de conocimiento base.
- [ ] Existe una versión activa de indicadores.

### Recuperación

- [ ] La base destino estaba vacía.
- [ ] No se ejecutaron migraciones ni `seed` antes de `pg_restore`.
- [ ] `pg_restore --exit-on-error` terminó correctamente.
- [ ] Los conteos origen/destino coinciden.
- [ ] `knowledge/uploads` fue restaurado.
- [ ] Las huellas SHA-256 coinciden.
- [ ] La restauración fue probada antes del cambio de producción.

## 7. Aceptación funcional

Use datos de prueba, no información académica real, hasta terminar esta lista.

- [ ] `GET /health` responde `200`.
- [ ] `GET /health/database` responde `200`.
- [ ] La interfaz abre mediante HTTPS.
- [ ] El acceso directo por HTTP redirige a HTTPS.
- [ ] El puerto interno 3000 no es accesible desde Internet.
- [ ] El administrador puede iniciar sesión.
- [ ] El panel administrativo carga.
- [ ] Se puede crear o importar un profesor de prueba.
- [ ] El profesor puede iniciar sesión.
- [ ] Se puede crear un proyecto.
- [ ] Se valida una matriz `.xlsx` o `.csv` correcta.
- [ ] Una matriz con columnas incorrectas devuelve un error comprensible.
- [ ] El proyecto persiste después de cerrar y volver a iniciar sesión.
- [ ] Se genera una semana con OpenAI.
- [ ] Se guarda y recupera el contenido generado.
- [ ] Se genera un recurso asistido de texto.
- [ ] Se genera una imagen y se visualiza.
- [ ] La imagen persiste después de reiniciar.
- [ ] Se aprueba una semana.
- [ ] Se descarga un Word válido.
- [ ] Se carga un documento administrativo.
- [ ] El archivo cargado puede descargarse.
- [ ] El archivo persiste después de reiniciar o redesplegar.
- [ ] Los roles de revisión acceden solamente a las funciones autorizadas.

## 8. Seguridad y exposición

- [ ] Se leyó `docs/OPERACION_SEGURIDAD.md`.
- [ ] La aplicación está detrás de VPN, proxy de identidad o red privada.
- [ ] Se decidió si el autorregistro estará habilitado.
- [ ] Se decidió si `/mcp` estará expuesto.
- [ ] Hay límites o alertas de consumo de OpenAI.
- [ ] Se documentó la aceptación de las alertas de `npm audit`.
- [ ] PostgreSQL no está expuesto públicamente.
- [ ] El acceso a secretos está limitado por rol.
- [ ] Los logs no contienen claves ni contraseñas.
- [ ] Existe responsable y fecha para el endurecimiento pendiente.

| Riesgo aceptado temporalmente | Responsable | Fecha límite | Incidencia |
|---|---|---|---|
| | | | |

## 9. Respaldo inicial

- [ ] Se generó un `.dump` después de la aceptación.
- [ ] Se copió `knowledge/uploads`.
- [ ] Se generaron checksums.
- [ ] Se registraron conteos.
- [ ] Se almacenaron dos copias en ubicaciones autorizadas.
- [ ] Se realizó una restauración de prueba.
- [ ] Se programó el siguiente respaldo y la siguiente prueba de restauración.

## 10. Operación y propiedad

| Responsabilidad | Persona o equipo | Canal autorizado |
|---|---|---|
| Dueño funcional | | |
| Administración de usuarios | | |
| Infraestructura | | |
| PostgreSQL | | |
| Respaldos | | |
| Claves y proyecto de OpenAI | | |
| Seguridad | | |
| Soporte de primer nivel | | |
| Desarrollo | | |

## 11. Criterio de aprobación

El despliegue se considera aceptado cuando:

1. El código corresponde al commit registrado.
2. Compilación, Prisma y migraciones terminan sin errores.
3. La aceptación funcional está completa.
4. La persistencia fue comprobada después de un reinicio.
5. Existe un respaldo restaurable.
6. Los riesgos abiertos tienen responsable y fecha.
7. Los propietarios funcionales y técnicos firman la entrega.

| Aprobación | Nombre | Fecha | Observación |
|---|---|---|---|
| Responsable técnico | | | |
| Responsable funcional | | | |
| Seguridad/infraestructura | | | |

## 12. Incorporar esta documentación al repositorio

Desde la copia Git que contiene la versión funcional:

```bash
git status
git add .env.example .gitignore README.md docs
git diff --cached --check
git diff --cached --name-status
git commit -m "Documenta despliegue y operación de la versión 28"
git push origin feature/generador-guias-mvp
```

No mueva el tag `v28` si ya está publicado. Cree una etiqueta para el paquete
documentado:

```bash
git tag -a v28-docs-1 \
  -m "Versión 28 funcional con documentación de despliegue"
git push origin v28-docs-1
```

Antes del commit confirme que no aparezcan `.env`, `node_modules`, `dist`,
`knowledge/uploads`, archivos `.dump` ni respaldos comprimidos.
