# v32.4.1 · Selector de listas de cotejo en Administración

## Objetivo

Mejorar la legibilidad de **Administración → Listas de cotejo** evitando mostrar simultáneamente las listas del Plan Docente y de la Guía Didáctica en dos columnas estrechas.

## Comportamiento

- Se incorpora el selector **Lista de cotejo a administrar**.
- La opción inicial es **Plan Docente**.
- Al seleccionar **Guía Didáctica**, se oculta la administración del Plan Docente y se muestra la de la Guía.
- Solo una lista se visualiza a la vez.
- La lista visible utiliza todo el ancho disponible del panel de administración.
- Se conservan sin cambios la edición, creación, activación, desactivación, eliminación y versionado de criterios.
- No hay cambios de backend, base de datos ni migraciones Prisma.

## Archivos modificados

- `public/index.html`
- `public/app.js`
- `public/styles.css`

## Validación

```bash
node --check public/app.js
git diff --check
npm test
npm run build
```
