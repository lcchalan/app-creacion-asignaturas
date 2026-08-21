# v32.9.1 · Configuración institucional de evaluación del Plan Docente

## Objetivo

La distribución de actividades calificadas deja de depender de valores fijos dentro del prompt o de la interfaz. Administración mantiene la política institucional vigente para las categorías **Conceptual**, **Activa** e **Integradora**.

## Fuente institucional

Cada versión contiene exactamente las actividades AC1 a AC5 y, para cada una:

- componente: ACD, APE o AA;
- semana de ejecución;
- calificación real de la actividad;
- peso porcentual.

La versión solo puede activarse cuando la calificación total suma **10 puntos** y el peso total suma **100%**.

## Versionado y trazabilidad

Cada guardado administrativo crea una nueva `TeachingPlanEvaluationPolicyVersion`. La versión activa anterior pasa a histórica y no se modifica.

`TeachingPlan.evaluationPolicySnapshotId` conserva la versión utilizada por cada Plan Docente. Por tanto, un cambio administrativo posterior no altera ni invalida retroactivamente planes ya generados.

Los planes existentes reciben durante la migración la versión inicial correspondiente a la categoría de su tipo de asignatura.

## Uso transversal

La versión almacenada se utiliza como fuente para:

1. el contexto estructurado enviado a IA;
2. la validación backend de la planificación y de la sección E;
3. la validación local de la vista previa;
4. la edición posterior de metodología, planificación y revisión del mismo Plan.

La IA no decide semanas, componentes, calificaciones ni pesos institucionales.

## Administración

Se incorpora **Administración → Configuración académica → Distribución de evaluación del Plan Docente** con:

- selector Conceptual / Activa / Integradora;
- edición de componente, semana, calificación y peso para AC1–AC5;
- cálculo inmediato de totales;
- creación y activación de una nueva versión;
- historial de versiones.

## Datos iniciales

La migración registra como versión 1 las distribuciones institucionales vigentes:

- Conceptual;
- Activa;
- Integradora.

Los valores corresponden al documento institucional de puntuación por tipo de asignatura utilizado para esta actualización.

## Tipos de asignatura en instalaciones nuevas

El seed y la plantilla de oferta quedan alineados con los códigos vigentes:

- `TIPO-A` → Conceptual → `CONCEPTUAL`;
- `TIPO-B` → Activa → `ACTIVE`;
- `TIPO-C` → Integradora → `INTEGRATING`.

La política de evaluación se relaciona por categoría del Plan y no por el código visible, evitando acoplarla a un nombre de catálogo que pueda cambiar.
