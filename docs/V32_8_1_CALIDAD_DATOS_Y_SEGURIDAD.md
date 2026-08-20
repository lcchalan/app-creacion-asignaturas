# v32.8.1 · Calidad de datos académicos y seguridad

Actualización incremental del **Sistema de Gestión Guía didáctica**.

## Alcance

1. **Asignatura (`Course`)**
   - `sisCode`: Código SIS, único por asignatura.
   - `metacourseUrl`: URL de metacurso, única por asignatura y limitada a `http://` / `https://`.
   - Una misma asignatura continúa pudiendo participar en varias ofertas académicas, carreras, modalidades y semestres mediante `AcademicOffering`.

2. **Importación de oferta académica**
   - La hoja `OFERTAS` reconoce las columnas opcionales `codigo_sis` y `url_metacurso`.
   - Si una misma `asignatura_codigo` aparece en varias ofertas, Código SIS y URL metacurso deben ser consistentes.
   - El mismo Código SIS o URL metacurso no puede asignarse a dos asignaturas distintas.

3. **Contraseñas**
   - Mínimo 12 caracteres.
   - Al menos una mayúscula, una minúscula, un número y un carácter especial.
   - La política se aplica a cambio/restablecimiento de contraseña, contraseñas temporales manuales y automáticas, importaciones de usuarios y contraseña inicial del seed.

4. **Unidades y temas**
   - No se permiten unidades repetidas en una misma oferta.
   - No se permite repetir el mismo tema/contenido dentro de la misma oferta, aunque cambie mayúsculas, tildes o espacios.
   - Los subtemas pueden repetirse bajo contextos diferentes.
   - La validación existe en frontend y backend.

5. **Reporte de datos institucionales incorrectos**
   - El profesor puede reportar una inconsistencia antes de confirmar los datos institucionales.
   - El reporte se persiste en `InstitutionalDataIssue` antes de intentar enviar correo.
   - Destino por defecto: `lcchalan@hotmail.com`.
   - Puede sobreescribirse mediante `InstitutionalSetting` con clave `ACADEMIC_DATA_ISSUE_EMAIL`.
   - Si SMTP falla, el reporte no se pierde y queda con estado de correo `FAILED`.

6. **Bibliografía mínima**
   - Se exige al menos una bibliografía complementaria.
   - Se exige al menos un REA.
   - La validación se realiza en frontend y backend antes de cerrar la ficha base del Plan Docente.

## Compatibilidad

- `sisCode` y `metacourseUrl` son nullable para no romper asignaturas históricas.
- Los Excel anteriores siguen siendo legibles; las dos columnas nuevas son opcionales durante la transición.
- No se modifica la relación `Course -> AcademicOffering`.
- No se modifica el flujo de revisión ni la cola persistente de IA v32.8.

## Pendiente separado

El JSON canónico del Plan Docente se mantiene como una actualización arquitectónica posterior para no mezclar cambios de contrato documental con esta actualización de calidad de datos y seguridad.
