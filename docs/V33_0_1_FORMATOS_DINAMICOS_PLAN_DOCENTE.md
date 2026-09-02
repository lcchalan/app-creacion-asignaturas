# v33.0.1 · Formatos dinámicos del Plan Docente

## Propósito

Esta versión desacopla la semántica académica del Plan Docente de una cantidad fija de columnas del archivo institucional. El analizador reconoce el significado de las columnas principales de programación y evaluación y conserva el orden físico encontrado en cada versión del formato.

## Reglas académicas incorporadas

- **Actividad:** acción académica que realiza el estudiante.
- **Estrategias de trabajo:** directrices, pasos u orientaciones para realizar la actividad.
- **Entregable:** producto o evidencia concreta que el estudiante debe presentar.
- **Instrumento de evaluación:** medio con el que se valora el entregable o desempeño.
- **Total horas:** dato derivado, calculado siempre como ACD + APE + AA; no se genera con IA ni se almacena como un valor independiente en la oferta académica.

## Compatibilidad

Los perfiles `CURRENT_MODULAR` y `LEGACY_MODULAR` se conservan. Los nuevos formatos que mantienen los campos académicos mínimos pero reorganizan sus columnas se clasifican como `DYNAMIC_MODULAR`.

El contenido histórico que todavía no posee `deliverable` sigue siendo legible; el esquema de persistencia lo normaliza a cadena vacía. La generación nueva con IA exige un entregable no vacío para cada actividad evaluada.

## Alcance de esta iteración

Esta versión automatiza el reconocimiento y renderizado de las tablas de programación y evaluación, además de soportar el nuevo campo Entregable y las horas totales derivadas. Una iteración posterior puede incorporar la vista administrativa previa a la activación, resolución manual de ambigüedades y Content Controls de Word.
