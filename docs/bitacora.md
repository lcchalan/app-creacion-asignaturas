# Bitácora del proyecto

## Información general

- **Proyecto:** Aplicación de creación de asignaturas
- **Repositorio:** `app-creacion-asignaturas`
- **Fecha de inicio:** 24 de julio de 2026
- **Propósito:** Desarrollar una aplicación para apoyar la creación y revisión de asignaturas mediante
ChatGPT, OpenAI Apps SDK y un servidor MCP.

## Registro de avances

### Fase 1. Preparación del entorno

Se verificó la disponibilidad de las herramientas básicas para el desarrollo:

- Git y GitHub.
- Homebrew.
- Terminal Zsh.
- Equipo Mac con procesador Intel (`x86_64`).
- macOS Monterey 12.7.6.

### Fase 2. Instalación de Node.js

La instalación de Node.js mediante Homebrew no pudo completarse debido a un error durante la
aplicación de un parche de OpenSSL. Como alternativa, se instaló NVM mediante Homebrew y se configuró
en Zsh.

Versiones instaladas:

- NVM 0.40.6.
- Node.js 24.18.0.
- npm 11.16.0.

Node.js 24 quedó establecido como versión predeterminada en NVM.

### Fase 3. Inicialización del proyecto

Se inicializó el proyecto con npm y se configuró `package.json` con las siguientes características:

- Uso de módulos ES.
- Archivo principal: `dist/index.js`.
- Compatibilidad con Node.js 24.
- Comandos de desarrollo, compilación y ejecución.
- Información del repositorio de GitHub.

### Fase 4. Configuración de TypeScript

Se instalaron las dependencias de desarrollo:

- TypeScript.
- `tsx`.
- Tipos de Node.js.

También se autorizó el script de instalación de `esbuild` y se configuró `tsconfig.json` con:

- Código fuente en `src`.
- Archivos compilados en `dist`.
- Módulos `NodeNext`.
- Comprobación estricta de tipos.
- Generación de mapas de código y declaraciones.

### Fase 5. Estructura inicial

Se crearon las siguientes carpetas:

- `docs`: documentación del proyecto.
- `src/mcp`: configuración del servidor MCP.
- `src/resources`: recursos expuestos por el servidor.
- `src/services`: lógica y servicios de la aplicación.
- `src/shared`: tipos y utilidades compartidas.
- `src/tools/courses`: herramientas relacionadas con asignaturas.
- `tests`: pruebas automatizadas.
- `ui/src/components`: componentes de interfaz.
- `ui/src/forms`: formularios de la aplicación.

### Fase 6. Archivos de configuración y documentación

Se crearon los siguientes archivos:

- `.gitignore`: exclusiones para Git.
- `.env.example`: variables de entorno de ejemplo.
- `README.md`: descripción, requisitos, estructura y comandos del proyecto.
- `docs/bitacora.md`: registro progresivo del desarrollo.

## Próximos pasos

1. Instalar las dependencias necesarias para el servidor MCP.
2. Crear el servidor HTTP inicial.
3. Implementar el endpoint `/health`.
4. Configurar el endpoint `/mcp`.
5. Crear la herramienta de prueba `hello_world`.
6. Compilar y probar el servidor localmente.
7. Desarrollar el formulario inicial de datos de la asignatura.
8. Preparar la integración con ChatGPT mediante OpenAI Apps SDK.
9. Configurar el despliegue en Render.

## Criterios de trabajo

- Ejecutar y comprobar cada etapa antes de continuar.
- Mantener las credenciales fuera del repositorio.
- Documentar las decisiones técnicas relevantes.
- Validar la compilación después de cada cambio importante.
- Mantener separadas la lógica del servidor, las herramientas MCP y la interfaz.

### Fase 7. Implementación y validación del servidor MCP

Se instalaron las dependencias necesarias para desarrollar el servidor MCP:

- `@modelcontextprotocol/sdk` 1.29.0.
- `zod` 4.4.3.

También se autorizó el script de instalación de `fsevents`, utilizado para detectar cambios de archivos en macOS.

Se creó `src/index.ts` con los siguientes componentes:

- Servidor HTTP disponible en el puerto definido mediante la variable `PORT` o, de forma predeterminada, en el puerto 3000.
- Endpoint `/health` para verificar el estado del servidor.
- Endpoint `/mcp` mediante el transporte Streamable HTTP.
- Herramienta de prueba `hello_world`, presentada en MCP Inspector con el título “Saludar”.
- Validación del parámetro opcional `name` mediante Zod.
- Límite de tamaño para el cuerpo de las solicitudes.
- Respuestas estructuradas y en formato de texto.

Durante la compilación se identificó una incompatibilidad entre la opción `exactOptionalPropertyTypes` de TypeScript y los tipos del SDK MCP. Para
mantener la comprobación estricta general y permitir la compatibilidad con el SDK, esta opción se configuró en `false`.

La compilación generó correctamente los siguientes archivos:

- `dist/index.js`.
- `dist/index.js.map`.
- `dist/index.d.ts`.
- `dist/index.d.ts.map`.

El servidor se validó localmente mediante las siguientes pruebas:

- Respuesta correcta del endpoint `/health`.
- Negociación exitosa del protocolo MCP `2025-03-26`.
- Conexión mediante MCP Inspector con transporte Streamable HTTP.
- Reconocimiento de la herramienta `hello_world`.
- Ejecución correcta de la herramienta con el parámetro `name: "Luis"`.
- Obtención del mensaje: “¡Hola, Luis! El servidor MCP funciona correctamente.”.

Con estas pruebas se confirmó el funcionamiento del servidor HTTP, el endpoint MCP y la primera herramienta registrada.

### Fase 8. Interfaz modular y flujo de creación

Se sustituyó el formulario lineal por una interfaz institucional adaptable, con
estructura modular y paleta azul marino y dorado. El asistente organiza el
trabajo en cinco etapas:

1. Datos de la asignatura.
2. Carga y validación de la matriz.
3. Bibliografía básica, complementaria y REA.
4. Confirmación del proyecto.
5. Generación de la semana 1.

Se restringió la duración a 8 o 16 semanas, se incorporaron mensajes de
validación y se impidió utilizar una guía didáctica como fuente bibliográfica.

### Fase 9. Procesamiento de matrices y generación

Se añadió `xlsx` para leer archivos Excel y CSV en el servidor. El endpoint
`/api/validate-matrix` comprueba el archivo, identifica las cuatro columnas
obligatorias y devuelve las filas normalizadas. La generación selecciona
exclusivamente los registros de la semana solicitada y separa la bibliografía
básica, complementaria y los REA.

La compilación con TypeScript y una prueba de validación con CSV finalizaron
correctamente.
# Corrección 24 — Especificaciones contextuales y análisis previo

- Se incorporaron múltiples especificaciones funcionales por nivel académico, modalidad, duración y tipo de asignatura.
- Facultad y Carrera no intervienen en la selección del prompt.
- Los documentos institucionales pueden ser generales o contextuales.
- Toda nueva versión requiere un análisis de impacto previo verificable.
- El análisis informa reglas, mejoras, superposiciones y posibles contradicciones.
- Las contradicciones requieren documentar la decisión antes de guardar.
- Cada guía congela las versiones de especificaciones, documentos e indicadores utilizadas en su primera generación.
- Se añadió la migración incremental `20260805000000_correction_24_contextual_specs`.
- Se validaron el esquema Prisma, la sintaxis del cliente y la compilación TypeScript.
