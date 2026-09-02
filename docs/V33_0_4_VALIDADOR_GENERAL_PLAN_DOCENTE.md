# v33.0.4 · Validador general del Plan Docente

## Criterio de diseño

El banco de preguntas es únicamente un ejemplo de la lógica del validador final.
El semáforo debe aplicarse a todos los controles automáticos del Plan Docente.

### Estados

- Verde: el control cumple.
- Rojo: existe una inconsistencia que requiere corrección y bloquea la confirmación.
- Amarillo: existe una advertencia o una comprobación todavía no concluida.
  Una advertencia puede ser bloqueante o informativa según el control.

### Controles actuales

- Resultados de aprendizaje.
- Organización semanal.
- Unidades y contenidos.
- Distribución de horas.
- Horas por actividad.
- Actividades calificadas.
- Totales de evaluación.
- Metodologías y TAC.
- Instrumentos EVA.
- Bancos de preguntas, únicamente cuando existen cuestionarios.
- Formato institucional.

Cada control fallido puede ofrecer una acción contextual para llevar al profesor a la
sección donde debe corregirlo. Los bancos conservan una acción específica porque pueden
abrir directamente el banco AC correspondiente.

## Regla de confirmación

El botón de confirmación docente permanece bloqueado mientras exista cualquier control
obligatorio en error o una verificación bloqueante pendiente.

La lógica no depende de los bancos de preguntas; estos son un control más dentro del mismo
motor de validación.

## Compatibilidad

- No modifica Prisma.
- No modifica la base de datos.
- No cambia el esquema canónico.
- No cambia el flujo de revisión institucional.
