# v32.10.2.4 - Contrato estricto de guiones para recursos educativos

## Problema corregido

La generacion asistida de recursos educativos utilizaba `educationalResourceSchema`, cuyo campo `script` acepta dos ramas validas: `interactive` y `audiovisual`. Aunque el prompt indicaba el formato esperado, Structured Output podia devolver la otra rama y el backend terminaba rechazandola despues con el mensaje `El guion generado no respeto el formato institucional ...`.

## Correccion

Se mantienen ambas ramas en el contrato persistido `educationalResourceSchema`, porque una guia puede contener recursos de ambos tipos. Para la llamada a IA se agregan contratos restringidos:

- `interactiveEducationalResourceSchema`: solo acepta `script.format = interactive` y `screens`.
- `audiovisualEducationalResourceSchema`: solo acepta `script.format = audiovisual`, `hook`, `development`, `motivationalClosing` y `scenes`.

El endpoint selecciona el esquema antes de llamar a Responses API segun el tipo de recurso solicitado. De esta forma el formato institucional deja de depender de una instruccion textual y pasa a estar impuesto por el propio contrato JSON.

## Compatibilidad

- No cambia PostgreSQL ni Prisma.
- No cambia el JSON canonico de la Guia.
- No cambia la representacion Markdown ya persistida.
- Los recursos existentes siguen validando con `educationalResourceSchema`.
- La comprobacion final de formato se conserva como invariante defensiva.
