# Aplicación de creación de asignaturas

Aplicación para apoyar la creación y revisión de asignaturas mediante ChatGPT, OpenAI Apps SDK y un
servidor MCP.

## Estado del proyecto

MVP funcional del generador de guías didácticas. Incluye un asistente de cinco
etapas, validación real de matrices Excel/CSV y generación de la semana 1 con
OpenAI.

## Requisitos

- Node.js 24 LTS
- npm 11 o superior
- Git
- Cuenta de GitHub

## Tecnologías

- Node.js
- TypeScript
- Model Context Protocol (MCP)
- OpenAI Apps SDK
- Interfaz web
- SheetJS (`xlsx`) para procesar matrices
- Render para el despliegue

## Estructura relevante

```text
app-creacion-asignaturas/
├── docs/
├── src/
│   ├── services/
│   │   └── matrix-service.ts
│   └── index.ts
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── tsconfig.json
```

## Instalación local

```bash
npm install
```

## Comandos disponibles

```bash
npm run dev
npm run build
npm start
```

## Variables de entorno

Copie `.env.example` como `.env` para configurar el entorno local. No almacene credenciales ni
secretos en el repositorio.

```bash
cp .env.example .env
```

Complete `OPENAI_API_KEY` únicamente en `.env`. `OPENAI_MODEL` permite cambiar
el modelo sin modificar el código.

## Flujo funcional

1. Registrar los datos de la asignatura y seleccionar 8 o 16 semanas.
2. Cargar una matriz `.xlsx`, `.xls` o `.csv` de hasta 10 MB.
3. Validar las columnas `Semana`, `Resultado de aprendizaje`,
   `Unidad/Contenido` y `Metodología`.
4. Registrar bibliografía básica, complementaria y REA opcionales.
5. Confirmar el proyecto.
6. Generar la semana 1 con la fila correspondiente de la matriz.

La API expone `/health`, `/mcp`, `/api/validate-matrix` y
`/api/generate-week`.

## Documentación

El desarrollo se registrará progresivamente en `docs/bitacora.md`. Cada fase tendrá documentación
específica para facilitar la reproducción del proyecto.
