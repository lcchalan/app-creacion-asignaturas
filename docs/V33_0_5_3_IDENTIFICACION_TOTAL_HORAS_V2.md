# V33.0.5.3 - Identificacion del Plan Docente V2

## Problema observado

El perfil del formato V2 era detectado correctamente como DYNAMIC_MODULAR con identificationIncludesTotalHours=true y el total se calculaba correctamente. Sin embargo, la vista previa web representaba Numero de creditos y Total horas en dos filas independientes, mientras que el formato institucional V2 los dispone en una sola fila de cuatro columnas.

## Correccion

La vista previa web ahora representa, solo para DYNAMIC_MODULAR con identificationIncludesTotalHours=true:

- Numero de creditos | valor | Total de horas | valor

Los formatos que no incluyen Total de horas conservan la fila de Numero de creditos expandida.

## Alcance

- Se modifica public/app.js.
- Se agrega una prueba de regresion de la estructura visual.
- No se modifica el analizador del formato.
- No se modifica el contrato canonico.
- No se modifica Word/PDF.
- No se modifica Prisma ni PostgreSQL.
- No se ejecutan migraciones, seed, sincronizacion/restauracion de conocimiento, commit ni push.
