# Aplicación de creación de asignaturas

Aplicación para apoyar la creación y revisión de asignaturas mediante ChatGPT, OpenAI Apps SDK y un
servidor MCP.

## Estado del proyecto

Proyecto en fase inicial de configuración.

## Requisitos

- Node.js 24 LTS
- npm 11 o superior
- Git
- Cuenta de GitHub

## Tecnologías previstas

- Node.js
- TypeScript
- Model Context Protocol (MCP)
- OpenAI Apps SDK
- Interfaz web
- Render para el despliegue

## Estructura inicial

```text
app-creacion-asignaturas/
├── docs/
├── src/
│   ├── mcp/
│   ├── resources/
│   ├── services/
│   ├── shared/
│   └── tools/
│       └── courses/
├── tests/
├── ui/
│   └── src/
│       ├── components/
│       └── forms/
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

## Funcionalidades previstas

1. Servidor con endpoint de verificación `/health`.
2. Servidor MCP accesible mediante `/mcp`.
3. Herramienta inicial `hello_world`.
4. Formulario para registrar los datos básicos de una asignatura.
5. Funciones para crear y revisar asignaturas.
6. Integración con ChatGPT.

## Documentación

El desarrollo se registrará progresivamente en `docs/bitacora.md`. Cada fase tendrá documentación
específica para facilitar la reproducción del proyecto.
