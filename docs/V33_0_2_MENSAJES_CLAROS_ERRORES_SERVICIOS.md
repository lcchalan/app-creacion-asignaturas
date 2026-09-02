# v33.0.2 · Mensajes claros de errores y servicios externos

## Objetivo

Evitar que el usuario reciba mensajes técnicos como `Error interno del servidor` cuando el
Sistema de Gestión Guía didáctica puede identificar una causa accionable.

## Contrato de error público

Las respuestas pueden incluir:

- `error`: explicación breve para el usuario.
- `code`: código estable para la interfaz.
- `eyebrow`: categoría visible del modal.
- `title`: título visible del modal.
- `guidance`: acción recomendada.
- `actionLabel`: texto del botón de cierre.
- `retryable`: indica si el problema puede ser transitorio.

El detalle técnico completo continúa en el terminal/log del servidor y no se expone al usuario.

## Casos de IA clasificados

- Créditos/saldo agotado: no se reintenta automáticamente.
- Credenciales o configuración inválida: no se reintenta automáticamente.
- Límite temporal del proveedor: reintentable.
- Timeout: reintentable.
- Interrupción de conexión: reintentable.

## Compatibilidad

Los errores académicos y de validación existentes continúan usando el mismo modal.
El cambio es retrocompatible con llamadas que todavía pasan únicamente un texto.
