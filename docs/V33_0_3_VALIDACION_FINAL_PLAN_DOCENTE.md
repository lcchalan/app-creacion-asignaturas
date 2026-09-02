# v33.0.3 · Validación final útil para el profesor

## Objetivo

Convertir la validación final del Plan Docente en una herramienta de decisión y corrección,
no únicamente en una lista de controles verdes.

## Cambios funcionales

1. Los controles admiten tres estados visuales:
   - verde: correcto;
   - rojo: requiere corrección y bloquea la confirmación;
   - amarillo: verificación en curso o advertencia.

2. Los bancos de preguntas son un control automático explícito únicamente cuando el Plan
   contiene una actividad cuyo instrumento es `QUESTIONNAIRE`.

3. Para cada cuestionario se verifica:
   - existencia del banco;
   - cantidad mínima;
   - vigencia del alcance temático;
   - estado aprobado por el profesor.

4. Un banco faltante, incompleto, desactualizado o no aprobado bloquea:
   `Confirmar y enviar a revisión`.

5. La tarjeta del banco ofrece acción directa:
   `Abrir banco ACx`.

6. Antes de confirmar el Plan, el navegador vuelve a consultar el estado real de los bancos.
   La protección del backend existente se conserva.

7. La confirmación docente se redacta como responsabilidad académica, separada de la
   validación automática.

8. El campo de observaciones se renombra para dejar claro que corresponde a la revisión
   docente de esa versión. Sigue siendo opcional y queda registrado en el Plan.

## Compatibilidad

- No modifica Prisma.
- No cambia el esquema canónico.
- No altera planes históricos.
- No cambia la lógica institucional de aprobación por etapas.
- Es compatible con v33.0.2; puede aplicarse antes o después.
