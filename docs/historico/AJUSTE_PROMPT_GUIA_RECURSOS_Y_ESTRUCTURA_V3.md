# Ajuste obligatorio del Prompt de Guía Didáctica · Sistema de Gestión Guía didáctica v31

Añadir al Prompt de Guía activo:

## Estructura curricular

- No genere, corrija ni renumere encabezados de Unidad, tema o subtema.
- El sistema proporciona una lista de `sourceId` con la jerarquía institucional y monta los encabezados de forma determinística.
- Devuelva exactamente una sección de desarrollo por cada `sourceId` solicitado y no agregue unidades, temas o subtemas nuevos.
- El cuerpo puede utilizar párrafos, listas, tablas, negrita, cursiva, enlaces y focalizadores cuando aporten valor pedagógico. Los focalizadores deben expresarse como `> [!TIP] Título` (o IMPORTANT, EXAMPLE, REFLECTION, QUESTION, WARNING) y su contenido debe continuar en líneas prefijadas con `>` para que el sistema pueda identificarlos como bloques semánticos.

## Recursos educativos

- Antes de proponer un recurso, revise la Especificación de recursos educativos activa suministrada por el sistema.
- El recurso debe ser coherente con el resultado de aprendizaje y la metodología de aprendizaje.
- Determine el nivel de Taxonomía de Bloom y seleccione únicamente un tipo de recurso compatible con la especificación institucional.
- Respete los límites de complejidad establecidos: cantidad de preguntas, máximo de diapositivas y mínimos de palabras cuando correspondan.
- Considere las herramientas institucionales indicadas en la especificación (Genially, Powtoon, Canva, Educaplay, Podcast y Videos cortos).
- No proponga recursos decorativos o redundantes.

## Formato de guiones

Para recursos interactivos:
1. Ficha del recurso en una tabla de dos columnas `Campo | Información`. Debe contener: Asignatura, Código, Profesor, Semana, Título del recurso, Nivel de Bloom, Tipo de recurso, Nivel de complejidad, Herramienta sugerida, Propósito, Justificación pedagógica y URL o descripción del recurso de referencia (opcional). No coloque estos metadatos como párrafos antes de la ficha.
2. Guion del recurso con Elementos de referencia | Contenido o Texto | Descripción.
3. Estas dos tablas son estructuras internas de producción del recurso y no deben denominarse ni numerarse como `Tabla 1`, `Tabla 2`, etc. La numeración `Tabla N` queda reservada exclusivamente para tablas académicas del contenido de la Guía.

Para videos y podcast:
1. Use la misma Ficha del recurso de dos columnas, incluyendo todos los metadatos pedagógicos dentro de ella.
2. Guion audiovisual con Elementos de referencia | Voz en off | Contenido o Texto | Descripción.
3. La voz en off debe incluir enganche inicial, desarrollo y cierre motivacional.
4. La ficha y el guion son tablas internas de producción: no deben llevar numeración `Tabla N` ni alterar el contador de tablas académicas de la Guía.

Al final de todo guion interactivo, video o podcast incluya la referencia bibliográfica, en APA 7, de la fuente realmente utilizada. No invente referencias, DOI, URL, autores o fechas.
